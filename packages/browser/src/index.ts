import type { SnapshotResult, StripMode } from '@kevintyj/pss-types';
import { type Browser, type BrowserContext, chromium, type Page } from 'playwright';

export interface BrowserOptions {
	headless?: boolean;
	timeout?: number;
	userAgent?: string;
	viewport?: {
		width: number;
		height: number;
	};
}

export interface SnapshotOptions {
	url: string;
	stripMode?: StripMode;
	extraDelay?: number;
	retry?: number;
	retryDelay?: number;
}

export class BrowserManager {
	private browser: Browser | null = null;
	private context: BrowserContext | null = null;
	private options: BrowserOptions;

	constructor(options: BrowserOptions = {}) {
		this.options = {
			headless: true,
			timeout: 30000,
			userAgent: 'PSS/1.0 (Prerendered Static Site Generator)',
			viewport: { width: 1920, height: 1080 },
			...options,
		};
	}

	async launch(): Promise<void> {
		if (this.browser) {
			return;
		}

		console.log('🚀 Launching browser...');

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

		// Set default timeouts
		this.context.setDefaultTimeout(this.options.timeout!);
		this.context.setDefaultNavigationTimeout(this.options.timeout!);

		console.log('✓ Browser launched successfully');
	}

	async takeSnapshot(options: SnapshotOptions): Promise<SnapshotResult> {
		if (!this.browser || !this.context) {
			throw new Error('Browser not initialized. Call launch() first.');
		}

		const { url, stripMode = 'none', extraDelay = 0, retry = 2, retryDelay = 1000 } = options;

		let lastError: Error | null = null;

		for (let attempt = 0; attempt <= retry; attempt++) {
			try {
				return await this.attemptSnapshot(url, stripMode, extraDelay);
			} catch (error) {
				lastError = error as Error;

				if (attempt < retry) {
					console.log(`⚠️  Snapshot attempt ${attempt + 1} failed for ${url}, retrying...`);
					if (retryDelay > 0) {
						await new Promise(resolve => setTimeout(resolve, retryDelay));
					}
				}
			}
		}

		throw new Error(`Failed to take snapshot after ${retry + 1} attempts: ${lastError?.message}`);
	}

	private async attemptSnapshot(url: string, stripMode: StripMode, extraDelay: number): Promise<SnapshotResult> {
		const page = (await this.context?.newPage()) as Page;

		try {
			// Navigate to the page
			console.log(`📸 Taking snapshot: ${url}`);

			const response = await page.goto(url, {
				waitUntil: 'networkidle',
				timeout: this.options.timeout,
			});

			if (!response) {
				throw new Error('Failed to load page');
			}

			if (response.status() !== 200) {
				throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
			}

			// Wait for extra delay if specified
			if (extraDelay > 0) {
				await page.waitForTimeout(extraDelay);
			}

			const metadata = await this.extractMetadata(page);

			let html = await page.content();
			html = this.applyStripMode(html, stripMode);

			return {
				url,
				html,
				title: metadata.title,
				meta: metadata.meta,
				statusCode: response.status(),
				timestamp: Date.now(),
			};
		} catch (error) {
			throw new Error(`Failed to take snapshot of ${url}: ${error}`);
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

	async close(): Promise<void> {
		if (this.context) {
			await this.context.close();
			this.context = null;
		}

		if (this.browser) {
			await this.browser.close();
			this.browser = null;
			console.log('✓ Browser closed');
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
