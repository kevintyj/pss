import type { HeadInject, MetaInject, SnapshotResult, StripMode, WaitUntil } from '@kevintyj/pss-types';
import { type Browser, type BrowserContext, chromium, type Page, type Response } from 'playwright';

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
	stripMode?: StripMode;
	extraDelay?: number;
	retry?: number;
	retryDelay?: number;
	waitUntil?: WaitUntil;
	blockDomains?: string[];
	timeout?: number;
	autoFallbackNetworkIdle?: boolean;
	// New injection options
	injectMeta?: MetaInject;
	injectHead?: HeadInject;
	injectExtractedMeta?: boolean;
	injectExtractedHead?: boolean;
	verbose?: boolean;
}

export class BrowserManager {
	private browser: Browser | null = null;
	private context: BrowserContext | null = null;
	private options: BrowserOptions;
	private verbose: boolean;

	constructor(options: BrowserOptions = {}) {
		this.options = {
			headless: true,
			timeout: 5000,
			userAgent: 'PSS/1.0 (Prerendered Static Site Generator)',
			viewport: { width: 1920, height: 1080 },
			waitUntil: 'networkidle',
			blockDomains: [],
			verbose: false,
			...options,
		};

		this.verbose = this.options.verbose || false;
		this.verboseLog(`BrowserManager initialized with options: ${JSON.stringify(this.options, null, 2)}`);
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

	async launch(): Promise<void> {
		if (this.browser) {
			return;
		}

		this.log('🚀 Launching browser...');
		this.verboseLog(`Browser options: ${JSON.stringify(this.options, null, 2)}`);

		this.browser = await chromium.launch({
			headless: this.options.headless,
			args: [
				'--disable-web-security',
				'--disable-features=VizDisplayCompositor',
				'--disable-dev-shm-usage',
				'--no-sandbox',
			],
		});

		this.context = await this.browser.newContext({
			viewport: this.options.viewport,
			userAgent: this.options.userAgent,
			ignoreHTTPSErrors: true,
			extraHTTPHeaders: {
				'Accept-Language': 'en-US,en;q=0.9',
			},
		});

		// Set up domain blocking if configured
		if (this.options.blockDomains && this.options.blockDomains.length > 0) {
			this.verboseLog(`Setting up domain blocking for: ${this.options.blockDomains.join(', ')}`);

			await this.context.route('**/*', route => {
				const url = route.request().url();
				const shouldBlock = this.options.blockDomains?.some(
					domain =>
						url.includes(domain) || new URL(url).hostname === domain || new URL(url).hostname.endsWith(`.${domain}`)
				);

				if (shouldBlock) {
					this.verboseLog(`🚫 Blocking request to: ${url}`);
					route.abort();
				} else {
					route.continue();
				}
			});
		}

		// Set default timeouts
		this.context.setDefaultTimeout(this.options.timeout!);
		this.context.setDefaultNavigationTimeout(this.options.timeout!);

		this.log('✓ Browser launched successfully');
		this.verboseLog(`Browser context created with viewport: ${JSON.stringify(this.options.viewport)}`);
	}

	async takeSnapshot(options: SnapshotOptions): Promise<SnapshotResult> {
		if (!this.browser || !this.context) {
			throw new Error('Browser not initialized. Call launch() first.');
		}

		const {
			url,
			stripMode = 'none',
			extraDelay = 0,
			retry = 2,
			retryDelay = 1000,
			waitUntil = this.options.waitUntil,
			blockDomains = this.options.blockDomains,
			timeout = this.options.timeout,
			autoFallbackNetworkIdle = true,
			injectMeta,
			injectHead,
			injectExtractedMeta,
			injectExtractedHead,
			verbose,
		} = options;

		// Override verbose setting if passed in options
		const isVerbose = verbose !== undefined ? verbose : this.verbose;

		let lastError: Error | null = null;
		let attemptedFallback = false;
		let currentWaitUntil = waitUntil;

		// Set up per-request domain blocking if different from global
		let needsRouteCleanup = false;
		if (
			blockDomains &&
			blockDomains.length > 0 &&
			JSON.stringify(blockDomains) !== JSON.stringify(this.options.blockDomains)
		) {
			this.verboseLog(`Setting up per-request domain blocking for: ${blockDomains.join(', ')}`);
			needsRouteCleanup = true;

			await this.context.route('**/*', route => {
				const requestUrl = route.request().url();
				const shouldBlock = blockDomains.some(
					domain =>
						requestUrl.includes(domain) ||
						new URL(requestUrl).hostname === domain ||
						new URL(requestUrl).hostname.endsWith(`.${domain}`)
				);

				if (shouldBlock) {
					this.verboseLog(`🚫 Blocking request to: ${requestUrl}`);
					route.abort();
				} else {
					route.continue();
				}
			});
		}

		try {
			for (let attempt = 0; attempt <= retry; attempt++) {
				try {
					return await this.attemptSnapshot(
						url,
						stripMode,
						extraDelay,
						currentWaitUntil!,
						timeout!,
						injectMeta,
						injectHead,
						injectExtractedMeta,
						injectExtractedHead,
						isVerbose
					);
				} catch (error) {
					lastError = error as Error;

					if (attempt < retry) {
						this.log(`⚠️  Snapshot attempt ${attempt + 1} failed for ${url}, retrying...`);

						// Always log the error reason, not just in verbose mode
						console.warn(`❌ Failure reason: ${lastError.message}`);

						// Special handling for networkidle timeout with auto-fallback
						if (
							autoFallbackNetworkIdle &&
							!attemptedFallback &&
							currentWaitUntil === 'networkidle' &&
							(lastError.message.includes('TimeoutError') || lastError.message.includes('Timeout'))
						) {
							console.warn(`🔄 Auto-fallback: Switching from 'networkidle' to 'load' strategy`);
							console.warn(`💡 Pages with external widgets often work better with 'load' instead of 'networkidle'`);
							currentWaitUntil = 'load';
							attemptedFallback = true;

							// Don't count this as a retry attempt since we're trying a different strategy
							attempt--;
							continue;
						}

						// Extract response details from the error message if available
						if (lastError.message.includes('HTTP ') && lastError.message.includes(':')) {
							const httpMatch = lastError.message.match(/HTTP (\d+): (.+)/);
							if (httpMatch) {
								console.warn(`📊 Response details: Status ${httpMatch[1]}, Status Text: ${httpMatch[2]}`);
							}
						}

						// Special handling for timeout errors
						if (lastError.message.includes('TimeoutError') || lastError.message.includes('Timeout')) {
							console.warn(`⏱️  Timeout detected - this may indicate slow page loading or network issues`);
							console.warn(
								`⚙️  Consider increasing the timeout (current: ${timeout}ms) or using a different waitUntil strategy (current: ${currentWaitUntil})`
							);

							// Suggest specific solutions for external widgets
							if (currentWaitUntil === 'networkidle') {
								console.warn(`💡 For pages with external widgets (YouTube, Cloudflare, etc.), try:`);
								console.warn(`   • waitUntil: 'load' or 'domcontentloaded' instead of 'networkidle'`);
								console.warn(
									`   • blockDomains: ['youtube.com', 'challenges.cloudflare.com'] to block external resources`
								);
								console.warn(`   • Increase extraDelay to wait for content to load`);
								console.warn(`   • Set autoFallbackNetworkIdle: false to disable automatic fallback`);
							}
						}

						// Log error type and additional context
						console.warn(`🔍 Error type: ${lastError.constructor.name}`);

						if (isVerbose) {
							this.verboseLog(`Full error stack: ${lastError.stack}`);
						}

						if (retryDelay > 0) {
							await new Promise(resolve => setTimeout(resolve, retryDelay));
						}
					}
				}
			}

			throw new Error(`Failed to take snapshot after ${retry + 1} attempts: ${lastError?.message}`);
		} finally {
			// Clean up per-request routes if we set them up
			if (needsRouteCleanup) {
				await this.context.unroute('**/*');

				// Re-establish global domain blocking if it was configured
				if (this.options.blockDomains && this.options.blockDomains.length > 0) {
					await this.context.route('**/*', route => {
						const url = route.request().url();
						const shouldBlock = this.options.blockDomains?.some(
							domain =>
								url.includes(domain) || new URL(url).hostname === domain || new URL(url).hostname.endsWith(`.${domain}`)
						);

						if (shouldBlock) {
							this.verboseLog(`🚫 Blocking request to: ${url}`);
							route.abort();
						} else {
							route.continue();
						}
					});
				}
			}
		}
	}

	private async attemptSnapshot(
		url: string,
		stripMode: StripMode,
		extraDelay: number,
		waitUntil: WaitUntil,
		timeout: number,
		injectMeta?: MetaInject,
		injectHead?: HeadInject,
		injectExtractedMeta?: boolean,
		injectExtractedHead?: boolean,
		isVerbose?: boolean
	): Promise<SnapshotResult> {
		const page = (await this.context?.newPage()) as Page;
		let response: Response | null = null;

		try {
			// Navigate to the page
			this.log(`📸 Taking snapshot: ${url}`);
			if (isVerbose) {
				this.verboseLog(`Snapshot config: stripMode=${stripMode}, extraDelay=${extraDelay}`);
				this.verboseLog(
					`Injection config: injectMeta=${!!injectMeta}, injectHead=${!!injectHead}, injectExtractedMeta=${!!injectExtractedMeta}, injectExtractedHead=${!!injectExtractedHead}`
				);
			}

			response = await page.goto(url, {
				waitUntil: waitUntil,
				timeout: timeout,
			});

			if (!response) {
				throw new Error('Failed to load page - no response received');
			}

			if (response.status() !== 200) {
				// Include additional response details in error
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

			const metadata = await this.extractMetadata(page);
			if (isVerbose) {
				this.verboseLog(`Extracted metadata: ${JSON.stringify(metadata, null, 2)}`);
			}

			let html = await page.content();
			if (isVerbose) {
				this.verboseLog(`Original HTML length: ${html.length} characters`);
			}

			html = this.applyStripMode(html, stripMode);
			if (isVerbose) {
				this.verboseLog(`HTML after strip mode '${stripMode}': ${html.length} characters`);
			}

			html = this.applyInjections(
				html,
				injectMeta,
				injectHead,
				metadata,
				injectExtractedMeta,
				injectExtractedHead,
				isVerbose
			);
			if (isVerbose) {
				this.verboseLog(`Final HTML length: ${html.length} characters`);
			}

			return {
				url,
				html,
				title: metadata.title,
				meta: metadata.meta,
				statusCode: response.status(),
				timestamp: Date.now(),
			};
		} catch (error) {
			// Include response details in error message if available
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
					// If we can't get response details, just include the original error
					errorMessage += ` | Could not extract response details: ${responseError}`;
				}
			}

			throw new Error(errorMessage);
		} finally {
			await page.close();
		}
	}

	private async extractMetadata(page: Page): Promise<{ title?: string; meta: Record<string, string> }> {
		return await page.evaluate(() => {
			const title = document.title;
			const meta: Record<string, string> = {};

			// Extract all meta tags
			const metaTags = document.querySelectorAll('meta');
			metaTags.forEach(tag => {
				const name = tag.getAttribute('name') || tag.getAttribute('property') || tag.getAttribute('http-equiv');
				const content = tag.getAttribute('content');

				if (name && content) {
					meta[name] = content;
				}
			});

			return { title, meta };
		});
	}

	private applyStripMode(html: string, stripMode: StripMode): string {
		switch (stripMode) {
			case 'none':
				return html;

			case 'meta':
				// Remove meta tags but keep title and essential tags
				return html.replace(/<meta(?!\s+(?:charset|name="viewport"|http-equiv="Content-Type"))[^>]*>/gi, '');

			case 'head': {
				// Remove entire head section but keep title
				const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
				const title = titleMatch ? titleMatch[0] : '';

				return html.replace(/<head[^>]*>[\s\S]*?<\/head>/i, `<head>${title}</head>`);
			}

			default:
				return html;
		}
	}

	private applyInjections(
		html: string,
		injectMeta?: MetaInject,
		injectHead?: HeadInject,
		extractedMetadata?: { title?: string; meta: Record<string, string> },
		injectExtractedMeta?: boolean,
		_injectExtractedHead?: boolean,
		isVerbose?: boolean
	): string {
		let modifiedHtml = html;

		// Apply static meta tag injection
		if (injectMeta && Object.keys(injectMeta).length > 0) {
			if (isVerbose) {
				this.verboseLog(`Injecting ${Object.keys(injectMeta).length} static meta tags`);
			}
			modifiedHtml = this.injectMetaTags(modifiedHtml, injectMeta);
		}

		// Apply extracted meta tag injection
		if (injectExtractedMeta && extractedMetadata?.meta) {
			if (isVerbose) {
				this.verboseLog(`Injecting ${Object.keys(extractedMetadata.meta).length} extracted meta tags`);
			}
			modifiedHtml = this.injectMetaTags(modifiedHtml, extractedMetadata.meta);
		}

		// Apply head injection
		if (injectHead?.trim()) {
			if (isVerbose) {
				this.verboseLog(
					`Injecting head content: ${injectHead.substring(0, 100)}${injectHead.length > 100 ? '...' : ''}`
				);
			}
			modifiedHtml = this.injectHeadContent(modifiedHtml, injectHead);
		}

		return modifiedHtml;
	}

	private injectMetaTags(html: string, metaTags: MetaInject): string {
		if (!metaTags || Object.keys(metaTags).length === 0) {
			return html;
		}

		// Generate meta tag HTML
		const metaTagsHtml = Object.entries(metaTags)
			.map(([name, content]) => {
				// Handle different meta tag types
				if (name.startsWith('og:') || name.startsWith('twitter:') || name.startsWith('fb:')) {
					return `<meta property="${name}" content="${this.escapeHtml(content)}" />`;
				} else if (name === 'charset') {
					return `<meta charset="${this.escapeHtml(content)}" />`;
				} else if (name.startsWith('http-equiv:')) {
					const httpEquiv = name.replace('http-equiv:', '');
					return `<meta http-equiv="${httpEquiv}" content="${this.escapeHtml(content)}" />`;
				} else {
					return `<meta name="${name}" content="${this.escapeHtml(content)}" />`;
				}
			})
			.join('\n    ');

		// Find the closing </head> tag and inject meta tags before it
		const headCloseMatch = html.match(/<\/head>/i);
		if (headCloseMatch) {
			const index = headCloseMatch.index!;
			return `${html.slice(0, index)}    ${metaTagsHtml}\n  ${html.slice(index)}`;
		}

		// If no </head> found, try to inject after <head>
		const headOpenMatch = html.match(/<head[^>]*>/i);
		if (headOpenMatch) {
			const index = headOpenMatch.index! + headOpenMatch[0].length;
			return `${html.slice(0, index)}\n    ${metaTagsHtml}${html.slice(index)}`;
		}

		// If no head section found, create one
		const htmlMatch = html.match(/<html[^>]*>/i);
		if (htmlMatch) {
			const index = htmlMatch.index! + htmlMatch[0].length;
			return `${html.slice(0, index)}\n  <head>\n    ${metaTagsHtml}\n  </head>${html.slice(index)}`;
		}

		// Last resort: add at the beginning of the document
		return `<head>\n  ${metaTagsHtml}\n</head>\n${html}`;
	}

	private injectHeadContent(html: string, headContent: HeadInject): string {
		if (!headContent || !headContent.trim()) {
			return html;
		}

		const trimmedContent = headContent.trim();

		// Find the closing </head> tag and inject content before it
		const headCloseMatch = html.match(/<\/head>/i);
		if (headCloseMatch) {
			const index = headCloseMatch.index!;
			return `${html.slice(0, index)}    ${trimmedContent}\n  ${html.slice(index)}`;
		}

		// If no </head> found, try to inject after <head>
		const headOpenMatch = html.match(/<head[^>]*>/i);
		if (headOpenMatch) {
			const index = headOpenMatch.index! + headOpenMatch[0].length;
			return `${html.slice(0, index)}\n    ${trimmedContent}${html.slice(index)}`;
		}

		// If no head section found, create one
		const htmlMatch = html.match(/<html[^>]*>/i);
		if (htmlMatch) {
			const index = htmlMatch.index! + htmlMatch[0].length;
			return `${html.slice(0, index)}\n  <head>\n    ${trimmedContent}\n  </head>${html.slice(index)}`;
		}

		// Last resort: add at the beginning of the document
		return `<head>\n  ${trimmedContent}\n</head>\n${html}`;
	}

	private escapeHtml(unsafe: string): string {
		return unsafe
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	async close(): Promise<void> {
		if (this.context) {
			await this.context.close();
			this.context = null;
		}

		if (this.browser) {
			await this.browser.close();
			this.browser = null;
			this.log('✓ Browser closed');
		}
	}

	isRunning(): boolean {
		return this.browser !== null;
	}
}

// Helper function to take a single snapshot
export async function takeSnapshot(
	url: string,
	options: Partial<SnapshotOptions & BrowserOptions> = {}
): Promise<SnapshotResult> {
	const browser = new BrowserManager(options);

	try {
		await browser.launch();
		return await browser.takeSnapshot({ url, ...options });
	} finally {
		await browser.close();
	}
}
