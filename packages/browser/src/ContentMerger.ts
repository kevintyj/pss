import type { ContentInject, ExtractedContent, InjectDefaults, OriginalContent } from '@kevintyj/pss-types';

export interface MergedContent {
	title?: string;
	meta: Record<string, string>;
	head: string;
	body: string;
}

export class ContentMerger {
	private verbose: boolean;

	constructor(verbose: boolean = false) {
		this.verbose = verbose;
	}

	private log(message: string): void {
		if (this.verbose) {
			console.log(`[ContentMerger] ${message}`);
		}
	}

	/**
	 * Merge content from all sources based on configuration
	 */
	mergeContent(
		originalContent: OriginalContent,
		extractedContent: ExtractedContent,
		injectDefaults: InjectDefaults,
		injectConfig: ContentInject
	): MergedContent {
		this.log('Starting content merge process');

		const mergedContent: MergedContent = {
			title: undefined,
			meta: {},
			head: '',
			body: '',
		};

		// Merge each content type
		mergedContent.title = this.mergeTitle(originalContent, extractedContent, injectDefaults, injectConfig);
		mergedContent.meta = this.mergeMeta(originalContent, extractedContent, injectDefaults, injectConfig);
		mergedContent.head = this.mergeHead(originalContent, extractedContent, injectDefaults, injectConfig);
		mergedContent.body = this.mergeBody(originalContent, extractedContent, injectDefaults, injectConfig);

		this.log(
			`Merge complete - Title: ${mergedContent.title ? 'set' : 'none'}, Meta: ${Object.keys(mergedContent.meta).length} tags, Head: ${mergedContent.head.length} chars, Body: ${mergedContent.body.length} chars`
		);

		return mergedContent;
	}

	/**
	 * Merge title from different sources
	 */
	private mergeTitle(
		originalContent: OriginalContent,
		extractedContent: ExtractedContent,
		injectDefaults: InjectDefaults,
		injectConfig: ContentInject
	): string | undefined {
		const titleConfig = injectConfig.title;
		const shouldInjectOriginal = titleConfig?.original !== undefined ? titleConfig.original : injectDefaults.original;
		const shouldInjectExtracted =
			titleConfig?.extracted !== undefined ? titleConfig.extracted : injectDefaults.extracted;
		const shouldInjectStatic = titleConfig?.static !== undefined ? titleConfig.static : injectDefaults.static;

		let title: string | undefined;

		// Priority: original → extracted → static
		if (shouldInjectOriginal && originalContent.title) {
			title = originalContent.title;
			this.log(`Using original title: ${title}`);
		}

		if (shouldInjectExtracted && extractedContent.title) {
			title = extractedContent.title;
			this.log(`Using extracted title: ${title}`);
		}

		if (shouldInjectStatic && titleConfig?.static) {
			title = titleConfig.static;
			this.log(`Using static title: ${title}`);
		}

		return title;
	}

	/**
	 * Merge meta tags from different sources
	 */
	private mergeMeta(
		originalContent: OriginalContent,
		extractedContent: ExtractedContent,
		injectDefaults: InjectDefaults,
		injectConfig: ContentInject
	): Record<string, string> {
		const metaConfig = injectConfig.meta;
		const shouldInjectOriginal = metaConfig?.original !== undefined ? metaConfig.original : injectDefaults.original;
		const shouldInjectExtracted = metaConfig?.extracted !== undefined ? metaConfig.extracted : injectDefaults.extracted;
		const shouldInjectStatic = metaConfig?.static !== undefined ? metaConfig.static : injectDefaults.static;

		const mergedMeta: Record<string, string> = {};

		// Priority: original → extracted → static (later sources override earlier ones)
		if (shouldInjectOriginal && originalContent.meta) {
			Object.assign(mergedMeta, originalContent.meta);
			this.log(`Added ${Object.keys(originalContent.meta).length} original meta tags`);
		}

		if (shouldInjectExtracted && extractedContent.meta) {
			Object.assign(mergedMeta, extractedContent.meta);
			this.log(`Added ${Object.keys(extractedContent.meta).length} extracted meta tags`);
		}

		if (shouldInjectStatic && metaConfig?.static) {
			Object.assign(mergedMeta, metaConfig.static);
			this.log(`Added ${Object.keys(metaConfig.static).length} static meta tags`);
		}

		return mergedMeta;
	}

	/**
	 * Merge head content from different sources
	 */
	private mergeHead(
		originalContent: OriginalContent,
		extractedContent: ExtractedContent,
		injectDefaults: InjectDefaults,
		injectConfig: ContentInject
	): string {
		const headConfig = injectConfig.head;
		const shouldInjectOriginal = headConfig?.original !== undefined ? headConfig.original : injectDefaults.original;
		const shouldInjectExtracted = headConfig?.extracted !== undefined ? headConfig.extracted : injectDefaults.extracted;
		const shouldInjectStatic = headConfig?.static !== undefined ? headConfig.static : injectDefaults.static;

		const headParts: string[] = [];

		// Priority: original → extracted → static
		if (shouldInjectOriginal && originalContent.head) {
			headParts.push(originalContent.head);
			this.log(`Added original head content (${originalContent.head.length} chars)`);
		}

		if (shouldInjectExtracted && extractedContent.head) {
			headParts.push(extractedContent.head);
			this.log(`Added extracted head content (${extractedContent.head.length} chars)`);
		}

		if (shouldInjectStatic && headConfig?.static) {
			headParts.push(headConfig.static);
			this.log(`Added static head content (${headConfig.static.length} chars)`);
		}

		return headParts.join('\n');
	}

	/**
	 * Merge body content from different sources
	 */
	private mergeBody(
		originalContent: OriginalContent,
		extractedContent: ExtractedContent,
		injectDefaults: InjectDefaults,
		injectConfig: ContentInject
	): string {
		const bodyConfig = injectConfig.body;
		const shouldInjectOriginal = bodyConfig?.original !== undefined ? bodyConfig.original : injectDefaults.original;
		const shouldInjectExtracted = bodyConfig?.extracted !== undefined ? bodyConfig.extracted : injectDefaults.extracted;
		const shouldInjectStatic = bodyConfig?.static !== undefined ? bodyConfig.static : injectDefaults.static;

		const bodyParts: string[] = [];

		// Priority: original → extracted → static
		if (shouldInjectOriginal && originalContent.body) {
			bodyParts.push(originalContent.body);
			this.log(`Added original body content (${originalContent.body.length} chars)`);
		}

		if (shouldInjectExtracted && extractedContent.body) {
			bodyParts.push(extractedContent.body);
			this.log(`Added extracted body content (${extractedContent.body.length} chars)`);
		}

		if (shouldInjectStatic && bodyConfig?.static) {
			bodyParts.push(bodyConfig.static);
			this.log(`Added static body content (${bodyConfig.static.length} chars)`);
		}

		return bodyParts.join('\n');
	}

	/**
	 * Apply merged content to HTML
	 */
	applyMergedContent(html: string, mergedContent: MergedContent): string {
		let modifiedHtml = html;

		// Apply title
		if (mergedContent.title) {
			modifiedHtml = this.injectTitle(modifiedHtml, mergedContent.title);
		}

		// Apply meta tags
		if (Object.keys(mergedContent.meta).length > 0) {
			modifiedHtml = this.injectMetaTags(modifiedHtml, mergedContent.meta);
		}

		// Apply head content
		if (mergedContent.head) {
			modifiedHtml = this.injectHeadContent(modifiedHtml, mergedContent.head);
		}

		// Apply body content
		if (mergedContent.body) {
			modifiedHtml = this.injectBodyContent(modifiedHtml, mergedContent.body);
		}

		return modifiedHtml;
	}

	/**
	 * Inject title into HTML
	 */
	private injectTitle(html: string, title: string): string {
		const escapedTitle = this.escapeHtml(title);
		const titleTag = `<title>${escapedTitle}</title>`;

		// Find existing title tag and replace it
		const existingTitleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
		if (existingTitleMatch) {
			return html.replace(existingTitleMatch[0], titleTag);
		}

		// No existing title tag, inject into head
		return this.injectIntoHead(html, titleTag);
	}

	/**
	 * Inject meta tags into HTML
	 */
	private injectMetaTags(html: string, metaTags: Record<string, string>): string {
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

		return this.injectIntoHead(html, metaTagsHtml);
	}

	/**
	 * Inject head content into HTML
	 */
	private injectHeadContent(html: string, headContent: string): string {
		return this.injectIntoHead(html, headContent);
	}

	/**
	 * Inject body content into HTML
	 */
	private injectBodyContent(html: string, bodyContent: string): string {
		// Find the body tag and inject content
		const bodyMatch = html.match(/<body[^>]*>/i);
		if (bodyMatch) {
			const index = bodyMatch.index! + bodyMatch[0].length;
			return `${html.slice(0, index)}\n${bodyContent}${html.slice(index)}`;
		}

		// If no body tag found, append to end
		return `${html}\n${bodyContent}`;
	}

	/**
	 * Inject content into head section
	 */
	private injectIntoHead(html: string, content: string): string {
		// Find the closing </head> tag and inject content before it
		const headCloseMatch = html.match(/<\/head>/i);
		if (headCloseMatch) {
			const index = headCloseMatch.index!;
			return `${html.slice(0, index)}    ${content}\n  ${html.slice(index)}`;
		}

		// If no </head> found, try to inject after <head>
		const headOpenMatch = html.match(/<head[^>]*>/i);
		if (headOpenMatch) {
			const index = headOpenMatch.index! + headOpenMatch[0].length;
			return `${html.slice(0, index)}\n    ${content}${html.slice(index)}`;
		}

		// If no head section found, create one
		const htmlMatch = html.match(/<html[^>]*>/i);
		if (htmlMatch) {
			const index = htmlMatch.index! + htmlMatch[0].length;
			return `${html.slice(0, index)}\n  <head>\n    ${content}\n  </head>${html.slice(index)}`;
		}

		// Last resort: add at the beginning of the document
		return `<head>\n  ${content}\n</head>\n${html}`;
	}

	/**
	 * Escape HTML characters
	 */
	private escapeHtml(text: string): string {
		const htmlEscapes: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;',
		};
		return text.replace(/[&<>"']/g, match => htmlEscapes[match]);
	}
}
