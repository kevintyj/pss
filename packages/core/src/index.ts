import { exec } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, parse } from 'node:path';
import { promisify } from 'node:util';

import { XMLParser } from 'fast-xml-parser';
import pLimit from 'p-limit';

import { BrowserManager } from '@kevintyj/pss-browser';
import { StaticServer } from '@kevintyj/pss-server';
import type { CrawlResult, PSSConfig, RouteConfig, SnapshotResult } from '@kevintyj/pss-types';

const execAsync = promisify(exec);

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

	private validateConfig(): void {
		if (this.config.outDir === this.config.serveDir) {
			throw new Error(
				`Output directory '${this.config.outDir}' cannot be the same as serve directory '${this.config.serveDir}'`
			);
		}

		if (!this.config.serveDir) {
			throw new Error('Serve directory must be specified');
		}

		if (!this.config.outDir) {
			throw new Error('Output directory must be specified');
		}
	}

	async prerender(): Promise<CrawlResult> {
		const startTime = Date.now();
		this.log('🚀 Starting prerendering process...');
		this.verboseLog(`Configuration: ${JSON.stringify(this.config, null, 2)}`);

		// Validate configuration
		this.validateConfig();

		try {
			// Step 0: Run build command if enabled
			if (this.config.withBuild && this.config.buildCommand) {
				await this.runBuildCommand();
			}

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

			// Step 7: Generate non-HTML files (RSS, JSON feeds, sitemap)
			await this.generateNonHtmlFiles(snapshots);

			const crawlTime = Date.now() - startTime;
			this.log(`✅ Prerendering completed in ${crawlTime}ms`);
			this.verboseLog(`Final snapshots: ${snapshots.length} pages processed`);

			return {
				snapshots,
				brokenLinks: [], // Broken link detection would require additional crawling
				stats: {
					totalPages: snapshots.length,
					totalAssets: 0, // Asset counting would require filesystem analysis
					failedAssets: 0, // Failed asset counting would require additional monitoring
					crawlTime,
				},
			};
		} catch (error) {
			this.log(`❌ Prerendering failed: ${error instanceof Error ? error.message : error}`);
			throw error;
		} finally {
			await this.cleanup();
		}
	}

	private async runBuildCommand(): Promise<void> {
		if (!this.config.buildCommand) return;

		this.log(`🔨 Running build command: ${this.config.buildCommand}`);
		this.verboseLog(`Executing build command: ${this.config.buildCommand}`);

		try {
			const { stdout, stderr } = await execAsync(this.config.buildCommand);

			if (stdout) {
				this.verboseLog(`Build stdout: ${stdout}`);
			}
			if (stderr) {
				this.verboseLog(`Build stderr: ${stderr}`);
			}

			this.log('✅ Build command completed successfully');
		} catch (error) {
			this.log(`❌ Build command failed: ${error}`);
			throw error;
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
		const { depth: maxDepth, concurrency } = crawlConfig;
		this.verboseLog(`Crawling with depth: ${maxDepth}, concurrency: ${concurrency}`);

		const visited = new Set<string>();
		const discovered = new Set<string>();
		const queue: Array<{ route: string; depth: number }> = [];

		// Initialize queue with seed routes
		for (const route of seedRoutes) {
			const normalizedRoute = this.normalizeRoute(route);
			queue.push({ route: normalizedRoute, depth: 0 });
			visited.add(normalizedRoute);
		}

		const limit = pLimit(concurrency);

		while (queue.length > 0) {
			const batch = queue.splice(0, concurrency);
			this.verboseLog(`Crawling batch of ${batch.length} routes`);

			const promises = batch.map(({ route, depth }) =>
				limit(async () => {
					if (depth >= maxDepth) return;

					try {
						const url = this.resolveUrl(route);
						this.verboseLog(`Crawling ${route} at depth ${depth}`);

						const snapshot = await this.browser?.takeSnapshot({
							url,
							strip: this.config.strip,
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
						console.warn(`⚠️  Failed to crawl ${route}:`, error instanceof Error ? error.message : error);
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
			strip: routeConfig?.strip || this.config.strip,
			inject: routeConfig?.inject || this.config.inject,
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

					const snapshot = await this.browser?.takeSnapshot({
						url,
						strip: effectiveConfig.strip,
						extraDelay: effectiveConfig.extraDelay,
						retry: effectiveConfig.retry,
						retryDelay: this.config.retryDelay,
						waitUntil: effectiveConfig.waitUntil,
						blockDomains: effectiveConfig.blockDomains,
						timeout: effectiveConfig.timeout,
						autoFallbackNetworkIdle: this.config.autoFallbackNetworkIdle,
						// New injection configuration
						injectDefaults: this.config.injectDefaults,
						inject: effectiveConfig.inject,
						// Original content extraction
						serveDir: this.config.serveDir,
						route: route,
						originalContentSource: this.config.originalContentSource,
						injectionTarget: this.config.injectionTarget,
						cacheOriginalContent: this.config.cacheOriginalContent,
						optimizeExtraction: this.config.optimizeExtraction,
						verbose: this.verbose,
					});

					if (snapshot) {
						// Add base href if configured
						if (this.config.addBaseHref && this.config.siteUrl) {
							snapshot.html = this.addBaseHref(snapshot.html, this.config.siteUrl);
						}

						snapshots.push(snapshot);
						this.log(`✅ Processed: ${route}`);

						// Verbose: Show basic metadata
						if (this.verbose) {
							this.verboseLog(`${route}: ${snapshot.title || 'No title'} (${snapshot.statusCode})`);
						}

						return snapshot;
					}
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					console.error(`❌ Failed to process ${route}: ${errorMessage}`);
					if (this.verbose && error instanceof Error && error.stack) {
						console.error(error.stack);
					}
					throw error;
				}
			})
		);

		await Promise.all(promises);
		return snapshots;
	}

	private addBaseHref(html: string, baseUrl: string): string {
		// Check if base tag already exists
		if (html.includes('<base')) {
			this.verboseLog('Base tag already exists, skipping base href addition');
			return html;
		}

		// Add base href to head
		const baseTag = `<base href="${baseUrl}">`;

		// Find head tag and insert after it
		const headMatch = html.match(/<head[^>]*>/i);
		if (headMatch) {
			const headEndIndex = headMatch.index! + headMatch[0].length;
			return `${html.slice(0, headEndIndex)}\n  ${baseTag}${html.slice(headEndIndex)}`;
		}

		// Fallback: insert at the beginning of HTML
		this.verboseLog('No head tag found, inserting base tag at the beginning');
		return `${baseTag}\n${html}`;
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

	private async generateNonHtmlFiles(snapshots: SnapshotResult[]): Promise<void> {
		if (!this.config.nonHtml) return;

		this.log('📊 Generating non-HTML files...');
		this.verboseLog(`Non-HTML configuration: ${JSON.stringify(this.config.nonHtml, null, 2)}`);

		// Generate sitemap
		if (this.config.nonHtml.sitemap) {
			await this.generateSitemap(snapshots);
		}

		// Generate RSS feed
		if (this.config.nonHtml.rss) {
			await this.generateRSSFeed(snapshots);
		}

		// Generate JSON feed
		if (this.config.nonHtml.jsonFeed) {
			await this.generateJSONFeed(snapshots);
		}
	}

	private async generateSitemap(snapshots: SnapshotResult[]): Promise<void> {
		this.verboseLog('Generating sitemap.xml');

		const siteUrl = this.config.siteUrl || this.baseUrl;
		const urls = snapshots
			.map(snapshot => {
				const url = new URL(snapshot.url);
				return `  <url>
    <loc>${siteUrl}${url.pathname}</loc>
    <lastmod>${new Date(snapshot.timestamp).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
			})
			.join('\n');

		const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

		const sitemapPath = join(this.config.outDir, 'sitemap.xml');
		writeFileSync(sitemapPath, sitemap, 'utf8');
		this.log('📄 Generated sitemap.xml');
		this.verboseLog(`Sitemap written to: ${sitemapPath}`);
	}

	private async generateRSSFeed(snapshots: SnapshotResult[]): Promise<void> {
		this.verboseLog('Generating RSS feed');

		const siteUrl = this.config.siteUrl || this.baseUrl;
		const items = snapshots
			.map(snapshot => {
				const url = new URL(snapshot.url);
				const title = snapshot.title || 'Untitled';
				const description = snapshot.meta.description || this.config.siteDescription;

				return `    <item>
      <title><![CDATA[${title}]]></title>
      <link>${siteUrl}${url.pathname}</link>
      <description><![CDATA[${description}]]></description>
      <pubDate>${new Date(snapshot.timestamp).toUTCString()}</pubDate>
      <guid isPermaLink="true">${siteUrl}${url.pathname}</guid>
    </item>`;
			})
			.join('\n');

		const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title><![CDATA[${this.config.siteTitle}]]></title>
    <link>${siteUrl}</link>
    <description><![CDATA[${this.config.siteDescription}]]></description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>PSS (Pre-render Static Sites)</generator>
${items}
  </channel>
</rss>`;

		const rssPath = join(this.config.outDir, 'feed.xml');
		writeFileSync(rssPath, rss, 'utf8');
		this.log('📄 Generated feed.xml');
		this.verboseLog(`RSS feed written to: ${rssPath}`);
	}

	private async generateJSONFeed(snapshots: SnapshotResult[]): Promise<void> {
		this.verboseLog('Generating JSON feed');

		const siteUrl = this.config.siteUrl || this.baseUrl;
		const items = snapshots.map(snapshot => {
			const url = new URL(snapshot.url);
			return {
				id: `${siteUrl}${url.pathname}`,
				url: `${siteUrl}${url.pathname}`,
				title: snapshot.title || 'Untitled',
				content_text: snapshot.meta.description || this.config.siteDescription,
				date_published: new Date(snapshot.timestamp).toISOString(),
			};
		});

		const jsonFeed = {
			version: 'https://jsonfeed.org/version/1.1',
			title: this.config.siteTitle,
			home_page_url: siteUrl,
			feed_url: `${siteUrl}/feed.json`,
			description: this.config.siteDescription,
			author: {
				name: this.config.author.name,
				email: this.config.author.email,
				url: this.config.author.url,
			},
			items,
		};

		const jsonPath = join(this.config.outDir, 'feed.json');
		writeFileSync(jsonPath, JSON.stringify(jsonFeed, null, 2), 'utf8');
		this.log('📄 Generated feed.json');
		this.verboseLog(`JSON feed written to: ${jsonPath}`);
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
