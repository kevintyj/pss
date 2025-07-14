import type {
	ContentInject,
	ExtractedContent,
	InjectDefaults,
	OriginalContent,
	SnapshotResult,
	StripOption,
	WaitUntil,
} from '@kevintyj/pss-types';
import { type Browser, type BrowserContext, chromium, type Page, type Response } from 'playwright';
import { ContentMerger } from './ContentMerger';
import { OriginalContentExtractor } from './OriginalContentExtractor';

export interface BrowserOptions {
	headless?: boolean;
	timeout?: number;
	userAgent?: string;
	viewport?: {
		width: number;
		height: number;
	};
	waitUntil?: WaitUntil;
	blockDomains?: string[];
	verbose?: boolean;
}

export interface SnapshotOptions {
	url: string;
	strip?: StripOption[];
	extraDelay?: number;
	retry?: number;
	retryDelay?: number;
	waitUntil?: WaitUntil;
	blockDomains?: string[];
	timeout?: number;
	autoFallbackNetworkIdle?: boolean;

	// New injection configuration
	injectDefaults?: InjectDefaults;
	inject?: ContentInject;

	// Original content extraction
	serveDir?: string;
	route?: string;
	originalContentSource?: 'static-file' | 'pre-javascript';
	cacheOriginalContent?: boolean;
	optimizeExtraction?: boolean;

	verbose?: boolean;
}

export class BrowserManager {
	private browser: Browser | null = null;
	private context: BrowserContext | null = null;
	private options: BrowserOptions;
	private verbose: boolean;
	private originalContentExtractor: OriginalContentExtractor;
	private contentMerger: ContentMerger;

	constructor(options: BrowserOptions = {}) {
		this.options = {
			headless: true,
			timeout: 5000,
			userAgent: 'PSS/1.0 (Prerendered Static Site Generator)',
			viewport: { width: 1920, height: 1080 },
			waitUntil: 'load',
			blockDomains: [],
			verbose: false,
			...options,
		};

		this.verbose = this.options.verbose || false;
		this.originalContentExtractor = new OriginalContentExtractor(this.verbose);
		this.contentMerger = new ContentMerger(this.verbose);
	}

	private log(message: string) {
		console.log(`[BrowserManager] ${message}`);
	}

	private verboseLog(message: string) {
		if (this.verbose) {
			this.log(message);
		}
	}

	async launch(): Promise<void> {
		if (this.browser && this.context) {
			this.verboseLog('Browser already launched');
			return;
		}

		this.verboseLog('Launching browser...');
		this.browser = await chromium.launch({
			headless: this.options.headless,
			timeout: this.options.timeout,
		});

		this.verboseLog('Creating browser context...');
		this.context = await this.browser.newContext({
			userAgent: this.options.userAgent,
			viewport: this.options.viewport,
			ignoreHTTPSErrors: true,
		});

		// Set up request interception for domain blocking
		if (this.options.blockDomains && this.options.blockDomains.length > 0) {
			this.verboseLog(`Blocking domains: ${this.options.blockDomains.join(', ')}`);
			await this.context.route('**/*', route => {
				const url = route.request().url();
				const shouldBlock = this.options.blockDomains?.some(domain => url.includes(domain));

				if (shouldBlock) {
					this.verboseLog(`Blocked request to: ${url}`);
					route.abort();
				} else {
					route.continue();
				}
			});
		}

		this.verboseLog('Browser launched successfully');
	}

	async takeSnapshot(options: SnapshotOptions): Promise<SnapshotResult> {
		if (!this.browser || !this.context) {
			throw new Error('Browser not launched. Call launch() first.');
		}

		const {
			url,
			strip = [],
			extraDelay = 0,
			retry = 2,
			retryDelay = 1000,
			waitUntil = this.options.waitUntil || 'load',
			blockDomains = [],
			timeout = this.options.timeout || 5000,
			autoFallbackNetworkIdle = true,
			injectDefaults = { original: true, extracted: false, static: true },
			inject = {},
			serveDir = '',
			route = '',
			originalContentSource = 'static-file',
			cacheOriginalContent = true,
			verbose = this.verbose,
		} = options;

		let attempt = 0;
		const maxAttempts = retry + 1;

		while (attempt < maxAttempts) {
			try {
				this.verboseLog(`Attempt ${attempt + 1}/${maxAttempts} for ${url}`);

				return await this.attemptSnapshot(
					url,
					strip,
					extraDelay,
					waitUntil,
					timeout,
					blockDomains,
					autoFallbackNetworkIdle,
					injectDefaults,
					inject,
					serveDir,
					route,
					originalContentSource,
					cacheOriginalContent,
					verbose
				);
			} catch (error) {
				attempt++;
				this.verboseLog(`Attempt ${attempt} failed: ${error}`);

				if (attempt >= maxAttempts) {
					throw error;
				}

				if (retryDelay > 0) {
					this.verboseLog(`Waiting ${retryDelay}ms before retry...`);
					await new Promise(resolve => setTimeout(resolve, retryDelay));
				}
			}
		}

		throw new Error(`Failed to take snapshot after ${maxAttempts} attempts`);
	}

	private async attemptSnapshot(
		url: string,
		strip: StripOption[],
		extraDelay: number,
		waitUntil: WaitUntil,
		timeout: number,
		blockDomains: string[],
		_autoFallbackNetworkIdle: boolean,
		injectDefaults: InjectDefaults,
		inject: ContentInject,
		serveDir: string,
		route: string,
		originalContentSource: 'static-file' | 'pre-javascript',
		cacheOriginalContent: boolean,
		isVerbose: boolean
	): Promise<SnapshotResult> {
		const page = (await this.context?.newPage()) as Page;
		let response: Response | null = null;

		try {
			// Set up domain blocking for this page if specified
			if (blockDomains && blockDomains.length > 0) {
				await page.route('**/*', route => {
					const requestUrl = route.request().url();
					const shouldBlock = blockDomains.some(domain => requestUrl.includes(domain));

					if (shouldBlock) {
						if (isVerbose) {
							this.verboseLog(`Blocked request to: ${requestUrl}`);
						}
						route.abort();
					} else {
						route.continue();
					}
				});
			}

			// Extract original content if needed
			let originalContent: OriginalContent = {
				title: undefined,
				meta: {},
				head: undefined,
				body: undefined,
			};

			if (serveDir && route) {
				originalContent = await this.originalContentExtractor.extractOriginalContent(
					url,
					route,
					serveDir,
					originalContentSource,
					originalContentSource === 'pre-javascript' ? page : undefined,
					cacheOriginalContent
				);
			}

			// Navigate to the page
			this.log(`📸 Taking snapshot: ${url}`);
			if (isVerbose) {
				this.verboseLog(`Snapshot config: strip=${JSON.stringify(strip)}, extraDelay=${extraDelay}`);
			}

			response = await page.goto(url, {
				waitUntil: waitUntil,
				timeout: timeout,
			});

			if (!response) {
				throw new Error('Failed to load page - no response received');
			}

			if (response.status() !== 200) {
				const headers = await response.allHeaders();
				const responseInfo = {
					status: response.status(),
					statusText: response.statusText(),
					url: response.url(),
					headers: headers,
				};

				throw new Error(
					`HTTP ${response.status()}: ${response.statusText()} | Response details: ${JSON.stringify(responseInfo, null, 2)}`
				);
			}

			// Wait for extra delay if specified
			if (extraDelay > 0) {
				if (isVerbose) {
					this.verboseLog(`Waiting ${extraDelay}ms extra delay...`);
				}
				await page.waitForTimeout(extraDelay);
			}

			// Extract content from the rendered page
			const extractedContent = await this.extractContent(page);
			if (isVerbose) {
				this.verboseLog(`Extracted content: ${JSON.stringify(extractedContent, null, 2)}`);
			}

			let html = await page.content();
			if (isVerbose) {
				this.verboseLog(`Original HTML length: ${html.length} characters`);
			}

			// Apply strip modes
			html = this.applyStripModes(html, strip);
			if (isVerbose) {
				this.verboseLog(`HTML after strip modes ${JSON.stringify(strip)}: ${html.length} characters`);
			}

			// Merge content from all sources
			const mergedContent = this.contentMerger.mergeContent(originalContent, extractedContent, injectDefaults, inject);

			// Apply merged content to HTML
			html = this.contentMerger.applyMergedContent(html, mergedContent);
			if (isVerbose) {
				this.verboseLog(`Final HTML length: ${html.length} characters`);
			}

			return {
				url,
				html,
				title: extractedContent.title,
				meta: extractedContent.meta,
				statusCode: response.status(),
				timestamp: Date.now(),
			};
		} catch (error) {
			let errorMessage = `Failed to take snapshot of ${url}: ${error}`;

			if (response) {
				try {
					const responseDetails = {
						status: response.status(),
						statusText: response.statusText(),
						url: response.url(),
					};
					errorMessage += ` | Response info: ${JSON.stringify(responseDetails, null, 2)}`;
				} catch (responseError) {
					errorMessage += ` | Could not extract response details: ${responseError}`;
				}
			}

			throw new Error(errorMessage);
		} finally {
			await page.close();
		}
	}

	private async extractContent(page: Page): Promise<ExtractedContent> {
		return await page.evaluate(() => {
			const title = document.title;
			const meta: Record<string, string> = {};
			const head = document.head?.innerHTML || '';
			const body = document.body?.innerHTML || '';

			// Extract all meta tags
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
	}

	private applyStripModes(html: string, stripModes: StripOption[]): string {
		let modifiedHtml = html;

		for (const stripMode of stripModes) {
			modifiedHtml = this.applyStripMode(modifiedHtml, stripMode);
		}

		return modifiedHtml;
	}

	private applyStripMode(html: string, stripMode: StripOption): string {
		switch (stripMode) {
			case 'meta':
				// Remove meta tags but keep title and essential tags
				return html.replace(/<meta(?!\s+(?:charset|name="viewport"|http-equiv="Content-Type"))[^>]*>/gi, '');

			case 'title':
				// Remove title tags
				return html.replace(/<title[^>]*>([^<]*)<\/title>/gi, '');

			case 'head': {
				// Remove entire head section
				return html.replace(/<head[^>]*>[\s\S]*?<\/head>/i, '<head></head>');
			}

			case 'body': {
				// Remove entire body content but keep body tags
				return html.replace(/<body[^>]*>[\s\S]*?<\/body>/i, '<body></body>');
			}

			case 'head-except-title': {
				// Remove head content but keep title
				const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
				const title = titleMatch ? titleMatch[0] : '';
				return html.replace(/<head[^>]*>[\s\S]*?<\/head>/i, `<head>${title}</head>`);
			}

			case 'dynamic-content': {
				// Remove JavaScript-generated content by comparing with original
				// This is a simplified implementation - would need more sophisticated detection
				return html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
			}

			default:
				return html;
		}
	}

	async close(): Promise<void> {
		if (this.context) {
			await this.context.close();
			this.context = null;
		}
		if (this.browser) {
			await this.browser.close();
			this.browser = null;
		}
		this.verboseLog('Browser closed');
	}

	isRunning(): boolean {
		return this.browser !== null && this.context !== null;
	}
}

export async function takeSnapshot(
	url: string,
	options: Partial<SnapshotOptions & BrowserOptions> = {}
): Promise<SnapshotResult> {
	const manager = new BrowserManager(options);
	try {
		await manager.launch();
		return await manager.takeSnapshot({ url, ...options });
	} finally {
		await manager.close();
	}
}
