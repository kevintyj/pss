import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, parse } from 'node:path';
import { BrowserManager } from '@kevintyj/pss-browser';
import { StaticServer } from '@kevintyj/pss-server';
import type { CrawlResult, PSSConfig, SnapshotResult } from '@kevintyj/pss-types';
import pLimit from 'p-limit';

export class PrerenderEngine {
	private config: PSSConfig;
	private server: StaticServer | null = null;
	private browser: BrowserManager | null = null;
	private baseUrl: string = '';

	constructor(config: PSSConfig) {
		this.config = config;
	}

	async prerender(): Promise<CrawlResult> {
		const startTime = Date.now();
		console.log('🚀 Starting prerendering process...');

		try {
			// Step 1: Start static server
			await this.startServer();

			// Step 2: Initialize browser
			await this.initializeBrowser();

			// Step 3: Copy static assets to output directory
			await this.copyStaticAssets();

			// Step 4: Get routes to process
			const routes = await this.getRoutes();
			console.log(`📄 Found ${routes.length} routes to process`);

			// Step 5: Process routes with concurrency control
			const snapshots = await this.processRoutes(routes);

			// Step 6: Write output files (HTML files will overwrite copies)
			await this.writeOutputFiles(snapshots);

			const crawlTime = Date.now() - startTime;
			console.log(`✅ Prerendering completed in ${crawlTime}ms`);

			return {
				snapshots,
				brokenLinks: [], // TODO: Implement broken link detection
				stats: {
					totalPages: snapshots.length,
					totalAssets: 0, // TODO: Count assets
					failedAssets: 0, // TODO: Count failed assets
					crawlTime,
				},
			};
		} finally {
			await this.cleanup();
		}
	}

	private async startServer(): Promise<void> {
		// If serverUrl is provided, use it instead of starting our own server
		if (this.config.serverUrl) {
			this.baseUrl = this.config.serverUrl;
			console.log(`🌐 Using existing server at ${this.baseUrl}`);
			return;
		}

		// If startServer is false, construct URL from port
		if (!this.config.startServer) {
			const port = this.config.serverPort || 3000;
			this.baseUrl = `http://localhost:${port}`;
			console.log(`🌐 Using existing server at ${this.baseUrl}`);
			return;
		}

		// Otherwise, start our own server
		this.server = new StaticServer({
			serveDir: this.config.serveDir,
			port: this.config.serverPort,
		});

		const serverInfo = await this.server.start();
		this.baseUrl = serverInfo.url;
		console.log(`🌐 Server started at ${this.baseUrl}`);
	}

	private async initializeBrowser(): Promise<void> {
		this.browser = new BrowserManager({
			headless: true,
			timeout: 30000,
		});

		await this.browser.launch();
	}

	private async copyStaticAssets(): Promise<void> {
		console.log(`📁 Copying static assets from ${this.config.serveDir} to ${this.config.outDir}`);

		// Ensure output directory exists
		mkdirSync(this.config.outDir, { recursive: true });

		// Check if source directory exists
		if (!existsSync(this.config.serveDir)) {
			throw new Error(`Source directory ${this.config.serveDir} does not exist`);
		}

		// Copy all files from source to output directory
		cpSync(this.config.serveDir, this.config.outDir, {
			recursive: true,
			force: true, // Overwrite existing files
		});

		console.log('✅ Static assets copied successfully');
	}

	private async getRoutes(): Promise<string[]> {
		const routes = [...this.config.routes];

		// Add index route if not present
		if (!routes.includes('/') && !routes.includes('/index.html')) {
			routes.unshift('/');
		}

		// If crawlLinks is enabled, discover routes by crawling
		if (this.config.crawlLinks) {
			console.log('🕷️  Crawling links to discover routes...');
			const crawledRoutes = await this.crawlLinks(routes);

			// Merge crawled routes with existing routes, removing duplicates
			const allRoutes = [...new Set([...routes, ...crawledRoutes])];

			console.log(`🔗 Discovered ${crawledRoutes.length} additional routes through crawling`);
			return allRoutes;
		}

		return routes;
	}

	private async crawlLinks(seedRoutes: string[]): Promise<string[]> {
		const crawlConfig =
			typeof this.config.crawlLinks === 'object' ? this.config.crawlLinks : { depth: 3, concurrency: 3 };
		const maxDepth = crawlConfig.depth;
		const concurrency = crawlConfig.concurrency;

		const visited = new Set<string>();
		const discovered = new Set<string>();
		const queue: Array<{ route: string; depth: number }> = [];

		// Initialize queue with seed routes
		seedRoutes.forEach(route => {
			const normalizedRoute = this.normalizeRoute(route);
			queue.push({ route: normalizedRoute, depth: 0 });
			visited.add(normalizedRoute);
		});

		const limit = pLimit(concurrency);

		while (queue.length > 0) {
			const batch = queue.splice(0, concurrency);

			const promises = batch.map(({ route, depth }) =>
				limit(async () => {
					if (depth >= maxDepth) return;

					try {
						const url = this.resolveUrl(route);
						const snapshot = await this.browser?.takeSnapshot({
							url,
							stripMode: 'none',
							extraDelay: this.config.extraDelay,
							retry: this.config.retry,
							retryDelay: this.config.retryDelay,
						});

						if (snapshot) {
							const links = this.extractLinksFromHtml(snapshot.html, url);

							for (const link of links) {
								const normalizedLink = this.normalizeRoute(link);

								if (!visited.has(normalizedLink) && !this.isExcluded(normalizedLink)) {
									visited.add(normalizedLink);
									discovered.add(normalizedLink);
									queue.push({ route: normalizedLink, depth: depth + 1 });
								}
							}
						}
					} catch (error) {
						console.warn(`⚠️  Failed to crawl ${route}:`, error);
					}
				})
			);

			await Promise.all(promises);
		}

		return Array.from(discovered);
	}

	private extractLinksFromHtml(html: string, baseUrl: string): string[] {
		const links: string[] = [];
		const base = new URL(baseUrl);

		// Extract links from anchor tags
		const anchorRegex = /<a[^>]*href=["']([^"']+)["'][^>]*>/gi;
		let match: RegExpExecArray | null;

		match = anchorRegex.exec(html);
		while (match !== null) {
			const href = match[1];

			try {
				const absoluteUrl = new URL(href, base);

				// Only include links from the same origin
				if (absoluteUrl.origin === base.origin) {
					links.push(absoluteUrl.pathname);
				}
			} catch (_error) {
				// Skip invalid URLs
			}

			match = anchorRegex.exec(html);
		}

		return links;
	}

	private normalizeRoute(route: string): string {
		// Remove query parameters and fragments
		const url = new URL(route, 'http://example.com');
		let pathname = url.pathname;

		// Remove trailing slash except for root
		if (pathname.length > 1 && pathname.endsWith('/')) {
			pathname = pathname.slice(0, -1);
		}

		return pathname;
	}

	private isExcluded(route: string): boolean {
		return this.config.exclude.some(pattern => {
			if (pattern instanceof RegExp) {
				return pattern.test(route);
			}
			return route.includes(pattern);
		});
	}

	private async processRoutes(routes: string[]): Promise<SnapshotResult[]> {
		const limit = pLimit(this.config.concurrency);
		const snapshots: SnapshotResult[] = [];

		const promises = routes.map(route =>
			limit(async () => {
				try {
					const url = this.resolveUrl(route);
					const snapshot = await this.browser?.takeSnapshot({
						url,
						stripMode: this.config.stripMode,
						extraDelay: this.config.extraDelay,
						retry: this.config.retry,
						retryDelay: this.config.retryDelay,
					});

					if (snapshot) {
						snapshots.push(snapshot);
						console.log(`✅ Processed: ${route}`);
						return snapshot;
					}
				} catch (error) {
					console.error(`❌ Failed to process ${route}:`, error);
					throw error;
				}
			})
		);

		await Promise.all(promises);
		return snapshots;
	}

	private async writeOutputFiles(snapshots: SnapshotResult[]): Promise<void> {
		console.log(`📁 Writing ${snapshots.length} files to ${this.config.outDir}`);

		// Ensure output directory exists
		await mkdirSync(this.config.outDir, { recursive: true });

		const promises = snapshots.map(snapshot => this.writeSnapshotFile(snapshot));

		await Promise.all(promises);
	}

	private async writeSnapshotFile(snapshot: SnapshotResult): Promise<void> {
		const filename = this.getOutputFilename(snapshot.url);
		const filepath = join(this.config.outDir, filename);

		// Ensure directory exists
		await mkdirSync(parse(filepath).dir, { recursive: true });

		// Write HTML file
		await writeFileSync(filepath, snapshot.html, 'utf8');

		console.log(`📄 Wrote: ${filename}`);
	}

	private getOutputFilename(url: string): string {
		const pathname = new URL(url).pathname;
		let filename = pathname === '/' ? 'index.html' : pathname;

		// Remove leading slash
		if (filename.startsWith('/')) {
			filename = filename.substring(1);
		}

		// Add .html extension if missing
		if (!filename.endsWith('.html') && !filename.includes('.')) {
			filename = this.config.flatOutput ? `${filename}.html` : `${filename}/index.html`;
		}

		return filename;
	}

	private resolveUrl(route: string): string {
		if (route.startsWith('http://') || route.startsWith('https://')) {
			return route;
		}

		// Ensure route starts with /
		if (!route.startsWith('/')) {
			route = `/${route}`;
		}

		return this.baseUrl + route;
	}

	private async cleanup(): Promise<void> {
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
		}

		if (this.server) {
			await this.server.stop();
			this.server = null;
		}
	}
}

// Helper function to run prerendering with config
export async function prerender(config: PSSConfig): Promise<CrawlResult> {
	const engine = new PrerenderEngine(config);
	return await engine.prerender();
}
