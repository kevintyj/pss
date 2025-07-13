import { mkdirSync, writeFileSync } from 'node:fs';
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

			// Step 3: Get routes to process
			const routes = await this.getRoutes();
			console.log(`📄 Found ${routes.length} routes to process`);

			// Step 4: Process routes with concurrency control
			const snapshots = await this.processRoutes(routes);

			// Step 5: Write output files
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

	private async getRoutes(): Promise<string[]> {
		const routes = [...this.config.routes];

		// Add index route if not present
		if (!routes.includes('/') && !routes.includes('/index.html')) {
			routes.unshift('/');
		}

		return routes;
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
