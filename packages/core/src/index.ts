import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, parse } from 'node:path';
import { BrowserManager } from '@kevintyj/pss-browser';
import { StaticServer } from '@kevintyj/pss-server';
import type { CrawlResult, PSSConfig, RouteConfig, SnapshotResult } from '@kevintyj/pss-types';
import { XMLParser } from 'fast-xml-parser';
import pLimit from 'p-limit';

export class PrerenderEngine {
	private config: PSSConfig;
	private server: StaticServer | null = null;
	private browser: BrowserManager | null = null;
	private baseUrl: string = '';
	private verbose: boolean;

	constructor(config: PSSConfig) {
		this.config = config;
		this.verbose = config.verbose || false;
	}

	// Normal logging (always shown)
	private log(message: string) {
		console.log(message);
	}

	// Verbose logging (only shown when verbose is true)
	private verboseLog(message: string) {
		if (this.verbose) {
			console.log(`[VERBOSE] ${message}`);
		}
	}

	async prerender(): Promise<CrawlResult> {
		const startTime = Date.now();
		this.log('🚀 Starting prerendering process...');
		this.verboseLog(`Configuration: ${JSON.stringify(this.config, null, 2)}`);

		try {
			// Step 1: Start static server
			await this.startServer();

			// Step 2: Initialize browser
			await this.initializeBrowser();

			// Step 3: Copy static assets to output directory
			await this.copyStaticAssets();

			// Step 4: Get routes to process
			const routes = await this.getRoutes();
			this.log(`📄 Found ${routes.length} routes to process`);
			this.verboseLog(`Routes to process: ${routes.join(', ')}`);

			// Step 5: Process routes with concurrency control
			const snapshots = await this.processRoutes(routes);

			// Step 6: Write output files (HTML files will overwrite copies)
			await this.writeOutputFiles(snapshots);

			const crawlTime = Date.now() - startTime;
			this.log(`✅ Prerendering completed in ${crawlTime}ms`);
			this.verboseLog(`Final snapshots: ${snapshots.length} pages processed`);

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
		if (this.config.serverUrl) {
			this.baseUrl = this.config.serverUrl;
			this.log(`🌐 Using existing server at ${this.baseUrl}`);
			this.verboseLog(`External server configuration: ${this.config.serverUrl}`);
			return;
		}

		if (!this.config.startServer && this.config.serverPort) {
			this.baseUrl = `http://localhost:${this.config.serverPort}`;
			this.log(`🌐 Using existing server at ${this.baseUrl}`);
			this.verboseLog(`Local server port: ${this.config.serverPort}`);
			return;
		}

		this.server = new StaticServer({
			serveDir: this.config.serveDir,
			port: this.config.serverPort,
			verbose: this.verbose,
		});

		const serverInfo = await this.server.start();
		this.baseUrl = serverInfo.url;
		this.log(`🌐 Server started at ${this.baseUrl}`);
		this.verboseLog(`Server details: ${JSON.stringify(serverInfo, null, 2)}`);
	}

	private async initializeBrowser(): Promise<void> {
		this.browser = new BrowserManager({
			headless: true,
			timeout: this.config.timeout,
			waitUntil: this.config.waitUntil,
			blockDomains: this.config.blockDomains,
			verbose: this.verbose,
		});

		await this.browser.launch();
		this.verboseLog('Browser initialized with Playwright');
	}

	private async copyStaticAssets(): Promise<void> {
		// Create output directory if it doesn't exist
		if (!existsSync(this.config.outDir)) {
			mkdirSync(this.config.outDir, { recursive: true });
		}

		// Copy all static assets
		this.log(`📁 Copying static assets from ${this.config.serveDir} to ${this.config.outDir}`);
		this.verboseLog(`Copying assets: ${this.config.serveDir} → ${this.config.outDir}`);

		try {
			cpSync(this.config.serveDir, this.config.outDir, {
				recursive: true,
				force: true,
				dereference: true,
				preserveTimestamps: true,
			});

			this.log('✅ Static assets copied successfully');
			this.verboseLog('All static files copied to output directory');
		} catch (error) {
			this.verboseLog(`Asset copy error: ${error}`);
			throw error;
		}
	}

	private async parseSitemap(): Promise<string[]> {
		const sitemapPath = join(this.config.serveDir, this.config.sitemap);

		if (!existsSync(sitemapPath)) {
			this.log(`📋 No sitemap found at ${sitemapPath}`);
			this.verboseLog(`Sitemap path checked: ${sitemapPath}`);
			return [];
		}

		try {
			this.log(`📋 Reading sitemap from ${sitemapPath}`);
			this.verboseLog(`Parsing sitemap file: ${sitemapPath}`);
			const sitemapXml = readFileSync(sitemapPath, 'utf8');
			this.verboseLog(`Sitemap content length: ${sitemapXml.length} characters`);

			const parser = new XMLParser({
				ignoreAttributes: false,
				parseAttributeValue: false,
				parseTagValue: false,
				trimValues: true,
			});

			const parsed = parser.parse(sitemapXml);

			// Handle both single URL and array of URLs
			const urlset = parsed.urlset;
			if (!urlset || !urlset.url) {
				console.warn('⚠️  No URLs found in sitemap');
				return [];
			}

			const urls = Array.isArray(urlset.url) ? urlset.url : [urlset.url];
			const routes: string[] = [];

			for (const urlEntry of urls) {
				const loc = urlEntry.loc;
				if (loc) {
					try {
						const url = new URL(loc);
						const route = url.pathname;

						// Normalize route
						const normalizedRoute = this.normalizeRoute(route);

						// Check if route is excluded
						if (!this.isExcluded(normalizedRoute)) {
							routes.push(normalizedRoute);
							this.verboseLog(`Added route from sitemap: ${normalizedRoute}`);
						} else {
							this.verboseLog(`Excluded route from sitemap: ${normalizedRoute}`);
						}
					} catch (_error) {
						console.warn(`⚠️  Invalid URL in sitemap: ${loc}`);
						this.verboseLog(`Failed to parse sitemap URL: ${loc}`);
					}
				}
			}

			this.log(`📋 Found ${routes.length} routes in sitemap`);
			this.verboseLog(`Sitemap routes: ${routes.join(', ')}`);
			return routes;
		} catch (error) {
			console.error(`❌ Failed to parse sitemap: ${error}`);
			this.verboseLog(`Sitemap parsing error: ${error}`);
			return [];
		}
	}

	private async getRoutes(): Promise<string[]> {
		let routes: string[] = [];

		// Start with explicit routes from config
		if (this.config.routes.length > 0) {
			routes = [...this.config.routes];
			this.verboseLog(`Using explicit routes: ${routes.join(', ')}`);
		}

		// Add routes from sitemap
		const sitemapRoutes = await this.parseSitemap();
		routes = [...routes, ...sitemapRoutes];

		// If no routes found, use root
		if (routes.length === 0) {
			routes = ['/'];
			this.verboseLog('No routes found, using root route: /');
		}

		// Crawl for additional routes if enabled
		if (this.config.crawlLinks) {
			this.log('🕷️  Crawling links to discover routes...');
			this.verboseLog(`Crawling configuration: ${JSON.stringify(this.config.crawlLinks)}`);

			const crawledRoutes = await this.crawlLinks(routes);
			routes = [...routes, ...crawledRoutes];

			this.log(`🔗 Discovered ${crawledRoutes.length} additional routes through crawling`);
			this.verboseLog(`Crawled routes: ${crawledRoutes.join(', ')}`);
		}

		// Remove duplicates and normalize
		const uniqueRoutes = [...new Set(routes.map(route => this.normalizeRoute(route)))];
		this.verboseLog(`Final unique routes: ${uniqueRoutes.join(', ')}`);

		return uniqueRoutes;
	}

	private async crawlLinks(seedRoutes: string[]): Promise<string[]> {
		const crawlConfig =
			typeof this.config.crawlLinks === 'object' ? this.config.crawlLinks : { depth: 3, concurrency: 3 };
		const maxDepth = crawlConfig.depth;
		const concurrency = crawlConfig.concurrency;
		this.verboseLog(`Crawling with depth: ${maxDepth}, concurrency: ${concurrency}`);

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
			this.verboseLog(`Crawling batch of ${batch.length} routes`);

			const promises = batch.map(({ route, depth }) =>
				limit(async () => {
					if (depth >= maxDepth) {
						this.verboseLog(`Skipping ${route} - max depth reached`);
						return;
					}

					try {
						const url = this.resolveUrl(route);
						this.verboseLog(`Crawling ${route} at depth ${depth}`);

						const snapshot = await this.browser?.takeSnapshot({
							url,
							stripMode: 'none',
							extraDelay: this.config.extraDelay,
							retry: this.config.retry,
							retryDelay: this.config.retryDelay,
							verbose: this.verbose,
						});

						if (snapshot) {
							this.verboseLog(`Successfully crawled ${route}, extracting links`);
							const links = this.extractLinksFromHtml(snapshot.html, url);
							this.verboseLog(`Found ${links.length} links in ${route}`);

							for (const link of links) {
								const normalizedLink = this.normalizeRoute(link);

								if (!visited.has(normalizedLink) && !this.isExcluded(normalizedLink)) {
									visited.add(normalizedLink);
									discovered.add(normalizedLink);
									queue.push({ route: normalizedLink, depth: depth + 1 });
									this.verboseLog(`Discovered new route: ${normalizedLink}`);
								}
							}
						}
					} catch (error) {
						console.warn(`⚠️  Failed to crawl ${route}:`, error);
						this.verboseLog(`Crawling error for ${route}: ${error}`);
					}
				})
			);

			await Promise.all(promises);
		}

		return Array.from(discovered);
	}

	private extractLinksFromHtml(html: string, baseUrl: string): string[] {
		const links: string[] = [];
		const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
		let match: RegExpExecArray | null;

		// Define protocols that should be skipped during crawling
		const skipProtocols = [
			'mailto:',
			'tel:',
			'sms:',
			'fax:',
			'ftp:',
			'sftp:',
			'ftps:',
			'javascript:',
			'data:',
			'blob:',
			'file:',
			'about:',
			'chrome:',
			'chrome-extension:',
			'moz-extension:',
			'webkit:',
			'resource:',
		];

		while (true) {
			match = linkRegex.exec(html);
			if (match === null) break;

			const href = match[1];

			// Skip external links (starts with http/https or //)
			if (href.startsWith('http') || href.startsWith('//')) {
				continue;
			}

			// Skip fragments (hash links)
			if (href.startsWith('#')) {
				continue;
			}

			// Skip special protocols unless explicitly enabled
			if (!this.config.crawlSpecialProtocols) {
				if (skipProtocols.some(protocol => href.startsWith(protocol))) {
					continue;
				}

				// Skip any href that contains special protocols (edge case handling)
				if (skipProtocols.some(protocol => href.includes(protocol))) {
					continue;
				}
			}

			try {
				const url = new URL(href, baseUrl);

				// Double-check that the resolved URL is HTTP/HTTPS (unless special protocols are enabled)
				if (!this.config.crawlSpecialProtocols && url.protocol !== 'http:' && url.protocol !== 'https:') {
					continue;
				}

				// Only add if it's a valid path on the same origin or if special protocols are enabled
				if (url.origin === new URL(baseUrl).origin || this.config.crawlSpecialProtocols) {
					links.push(url.pathname);
				}
			} catch {
				// Invalid URL, skip
			}
		}

		return links;
	}

	private normalizeRoute(route: string): string {
		// Remove query parameters and fragments
		const cleanRoute = route.split('?')[0].split('#')[0];

		// Ensure route starts with /
		return cleanRoute.startsWith('/') ? cleanRoute : `/${cleanRoute}`;
	}

	private isExcluded(route: string): boolean {
		return this.config.exclude.some(pattern => {
			if (pattern instanceof RegExp) {
				return pattern.test(route);
			}
			return route.includes(pattern);
		});
	}

	/**
	 * Check if a route matches a pattern (supports wildcards)
	 */
	private routeMatches(route: string, pattern: string): boolean {
		// Exact match
		if (pattern === route) return true;

		// Global wildcard
		if (pattern === '*') return true;

		// Pattern with wildcards
		if (pattern.includes('*')) {
			const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
			return regex.test(route);
		}

		return false;
	}

	/**
	 * Get route-specific configuration for a given route
	 */
	private getRouteConfig(route: string): RouteConfig | undefined {
		// Find the most specific matching configuration
		// Priority: exact match > specific patterns > wildcard patterns > global (*)
		const configs = this.config.routeConfig;

		// First pass: exact matches
		for (const config of configs) {
			if (config.route === route) {
				return config;
			}
		}

		// Second pass: specific patterns (with wildcards but not just '*')
		for (const config of configs) {
			if (config.route !== '*' && config.route.includes('*') && this.routeMatches(route, config.route)) {
				return config;
			}
		}

		// Third pass: global wildcard '*'
		for (const config of configs) {
			if (config.route === '*') {
				return config;
			}
		}

		return undefined;
	}

	/**
	 * Get effective configuration for a route, merging global and route-specific settings
	 */
	private getEffectiveConfig(route: string) {
		const routeConfig = this.getRouteConfig(route);

		return {
			waitUntil: routeConfig?.waitUntil || this.config.waitUntil,
			timeout: routeConfig?.timeout || this.config.timeout,
			extraDelay: routeConfig?.extraDelay || this.config.extraDelay,
			blockDomains: routeConfig?.blockDomains || this.config.blockDomains,
			retry: routeConfig?.retry || this.config.retry,
			stripMode: routeConfig?.stripMode || this.config.stripMode,
		};
	}

	private async processRoutes(routes: string[]): Promise<SnapshotResult[]> {
		const limit = pLimit(this.config.concurrency);
		const snapshots: SnapshotResult[] = [];
		this.verboseLog(`Processing ${routes.length} routes with concurrency: ${this.config.concurrency}`);

		const promises = routes.map(route =>
			limit(async () => {
				try {
					const url = this.resolveUrl(route);
					const effectiveConfig = this.getEffectiveConfig(route);

					this.verboseLog(`Processing route: ${route} → ${url}`);
					this.verboseLog(`Route config: ${JSON.stringify(effectiveConfig, null, 2)}`);

					const snapshot = await this.browser?.takeSnapshot({
						url,
						stripMode: effectiveConfig.stripMode,
						extraDelay: effectiveConfig.extraDelay,
						retry: effectiveConfig.retry,
						retryDelay: this.config.retryDelay,
						waitUntil: effectiveConfig.waitUntil,
						blockDomains: effectiveConfig.blockDomains,
						timeout: effectiveConfig.timeout,
						autoFallbackNetworkIdle: this.config.autoFallbackNetworkIdle,
						// Add injection options
						injectMeta: this.config.injectMeta,
						injectHead: this.config.injectHead,
						injectExtractedMeta: this.config.injectExtractedMeta,
						injectExtractedHead: this.config.injectExtractedHead,
						verbose: this.verbose,
					});

					if (snapshot) {
						snapshots.push(snapshot);
						this.log(`✅ Processed: ${route}`);

						// Verbose: Show HTML preview and metadata
						if (this.verbose) {
							this.verboseLog(`HTML preview for ${route}:`);
							const htmlPreview = snapshot.html.substring(0, 500) + (snapshot.html.length > 500 ? '...' : '');
							this.verboseLog(htmlPreview);
							this.verboseLog(`Meta tags: ${JSON.stringify(snapshot.meta, null, 2)}`);
							this.verboseLog(`Title: ${snapshot.title}`);
							this.verboseLog(`Status: ${snapshot.statusCode}`);
						}

						return snapshot;
					}
				} catch (error) {
					console.error(`❌ Failed to process ${route}:`, error);
					this.verboseLog(`Processing error for ${route}: ${error}`);
					throw error;
				}
			})
		);

		await Promise.all(promises);
		return snapshots;
	}

	private async writeOutputFiles(snapshots: SnapshotResult[]): Promise<void> {
		this.log(`📁 Writing ${snapshots.length} files to ${this.config.outDir}`);
		this.verboseLog(`Output configuration: flatOutput=${this.config.flatOutput}`);

		for (const snapshot of snapshots) {
			await this.writeSnapshotFile(snapshot);
		}
	}

	private async writeSnapshotFile(snapshot: SnapshotResult): Promise<void> {
		const filename = this.getOutputFilename(snapshot.url);
		const filepath = join(this.config.outDir, filename);

		// Create directory if it doesn't exist
		const dir = parse(filepath).dir;
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true });
		}

		writeFileSync(filepath, snapshot.html, 'utf8');
		this.log(`📄 Wrote: ${filename}`);
		this.verboseLog(`File written: ${filepath} (${snapshot.html.length} characters)`);
	}

	private getOutputFilename(url: string): string {
		try {
			const urlObj = new URL(url);
			const pathname = urlObj.pathname;

			// Handle root path
			if (pathname === '/') {
				return 'index.html';
			}

			// Handle flat output
			if (this.config.flatOutput) {
				// Convert /path/to/page to path-to-page.html
				const flatName = pathname.replace(/^\//, '').replace(/\//g, '-');
				return flatName.endsWith('.html') ? flatName : `${flatName}.html`;
			}

			// Handle nested output
			if (pathname.endsWith('/')) {
				return `${pathname}index.html`;
			}

			return pathname.endsWith('.html') ? pathname.substring(1) : `${pathname.substring(1)}.html`;
		} catch {
			// Fallback for invalid URLs
			return 'index.html';
		}
	}

	private resolveUrl(route: string): string {
		return `${this.baseUrl}${route}`;
	}

	private async cleanup(): Promise<void> {
		if (this.browser) {
			await this.browser.close();
			this.verboseLog('Browser closed');
		}

		if (this.server) {
			await this.server.stop();
			this.verboseLog('Server stopped');
		}
	}
}

// Helper function to run prerendering with config
export async function prerender(config: PSSConfig): Promise<CrawlResult> {
	const engine = new PrerenderEngine(config);
	return await engine.prerender();
}
