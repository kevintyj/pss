import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { OriginalContent, OriginalContentSource } from '@kevintyj/pss-types';
import type { Page } from 'playwright';

export class OriginalContentExtractor {
	private contentCache = new Map<string, OriginalContent>();
	private verbose: boolean;

	constructor(verbose: boolean = false) {
		this.verbose = verbose;
	}

	private log(message: string): void {
		if (this.verbose) {
			console.log(`[OriginalContentExtractor] ${message}`);
		}
	}

	/**
	 * Extract original content based on the configured source method
	 */
	async extractOriginalContent(
		url: string,
		route: string,
		serveDir: string,
		source: OriginalContentSource,
		page?: Page,
		cacheEnabled: boolean = true
	): Promise<OriginalContent> {
		const cacheKey = `${route}:${source}`;

		// Check cache first
		if (cacheEnabled && this.contentCache.has(cacheKey)) {
			this.log(`Using cached original content for ${route}`);
			return this.contentCache.get(cacheKey)!;
		}

		let content: OriginalContent;

		switch (source) {
			case 'static-file':
				content = await this.extractFromStaticFile(route, serveDir);
				break;
			case 'pre-javascript':
				if (!page) {
					throw new Error('Page instance required for pre-javascript extraction');
				}
				content = await this.extractFromPreJavaScript(page, url);
				break;
			default:
				throw new Error(`Unsupported original content source: ${source}`);
		}

		// Cache the result
		if (cacheEnabled) {
			this.contentCache.set(cacheKey, content);
		}

		return content;
	}

	/**
	 * Extract original content from static HTML files
	 */
	private async extractFromStaticFile(route: string, serveDir: string): Promise<OriginalContent> {
		this.log(`Extracting original content from static file for route: ${route}`);

		try {
			// Determine file path from route
			const filePath = this.getFilePathFromRoute(route, serveDir);
			this.log(`Reading static file: ${filePath}`);

			const html = await readFile(filePath, 'utf-8');
			return this.parseHtmlContent(html);
		} catch (error) {
			this.log(`Failed to read static file for route ${route}: ${error}`);
			return {
				title: undefined,
				meta: {},
				head: undefined,
				body: undefined,
			};
		}
	}

	/**
	 * Extract original content from page before JavaScript execution
	 */
	private async extractFromPreJavaScript(page: Page, url: string): Promise<OriginalContent> {
		this.log(`Extracting original content from pre-JavaScript state for: ${url}`);

		try {
			// Navigate to page but don't wait for JavaScript to execute
			await page.goto(url, {
				waitUntil: 'domcontentloaded', // Don't wait for JavaScript
				timeout: 10000,
			});

			// Extract content before JavaScript modifications
			const content = await page.evaluate(() => {
				const title = document.title;
				const meta: Record<string, string> = {};
				const head = document.head?.innerHTML || '';
				const body = document.body?.innerHTML || '';

				// Extract meta tags
				const metaTags = document.querySelectorAll('meta');
				metaTags.forEach(tag => {
					const name = tag.getAttribute('name') || tag.getAttribute('property') || tag.getAttribute('http-equiv');
					const content = tag.getAttribute('content');
					if (name && content) {
						meta[name] = content;
					}
				});

				return { title, meta, head, body };
			});

			return content;
		} catch (error) {
			this.log(`Failed to extract pre-JavaScript content for ${url}: ${error}`);
			return {
				title: undefined,
				meta: {},
				head: undefined,
				body: undefined,
			};
		}
	}

	/**
	 * Parse HTML content and extract structured data
	 */
	private parseHtmlContent(html: string): OriginalContent {
		try {
			// Extract title
			const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
			const title = titleMatch ? titleMatch[1].trim() : undefined;

			// Extract meta tags
			const meta: Record<string, string> = {};
			const metaMatches = html.matchAll(/<meta\s+([^>]+)>/gi);

			for (const match of metaMatches) {
				const attributes = match[1];
				const nameMatch = attributes.match(/(?:name|property|http-equiv)=["']([^"']+)["']/i);
				const contentMatch = attributes.match(/content=["']([^"']+)["']/i);

				if (nameMatch && contentMatch) {
					meta[nameMatch[1]] = contentMatch[1];
				}
			}

			// Extract head content
			const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
			const head = headMatch ? headMatch[1].trim() : undefined;

			// Extract body content
			const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
			const body = bodyMatch ? bodyMatch[1].trim() : undefined;

			return { title, meta, head, body };
		} catch (error) {
			this.log(`Failed to parse HTML content: ${error}`);
			return {
				title: undefined,
				meta: {},
				head: undefined,
				body: undefined,
			};
		}
	}

	/**
	 * Determine file path from route
	 */
	private getFilePathFromRoute(route: string, serveDir: string): string {
		// Handle root route
		if (route === '/' || route === '') {
			return join(serveDir, 'index.html');
		}

		// Remove leading slash
		const cleanRoute = route.startsWith('/') ? route.slice(1) : route;

		// Handle routes that end with /
		if (cleanRoute.endsWith('/')) {
			return join(serveDir, cleanRoute, 'index.html');
		}

		// Handle routes that already have .html extension
		if (cleanRoute.endsWith('.html')) {
			return join(serveDir, cleanRoute);
		}

		// Try .html extension first
		const htmlPath = join(serveDir, `${cleanRoute}.html`);

		// If not found, try directory with index.html
		return htmlPath;
	}

	/**
	 * Clear the content cache
	 */
	clearCache(): void {
		this.contentCache.clear();
		this.log('Content cache cleared');
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats(): { size: number; keys: string[] } {
		return {
			size: this.contentCache.size,
			keys: Array.from(this.contentCache.keys()),
		};
	}
}
