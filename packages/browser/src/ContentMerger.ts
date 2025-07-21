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
			// Filter out meta tags and titles from original head content if they're configured as original: false
			let filteredHeadContent = originalContent.head;

			// Check if meta tags should be excluded from original content
			const metaConfig = injectConfig.meta;
			const shouldExcludeMeta = metaConfig?.original === false;

			// Check if title should be excluded from original content
			const titleConfig = injectConfig.title;
			const shouldExcludeTitle = titleConfig?.original === false;

			if (shouldExcludeMeta || shouldExcludeTitle) {
				filteredHeadContent = this.filterHeadContent(originalContent.head, shouldExcludeMeta, shouldExcludeTitle);
				this.log(
					`Filtered original head content (excluded meta: ${shouldExcludeMeta}, excluded title: ${shouldExcludeTitle})`
				);
			}

			headParts.push(filteredHeadContent);
			this.log(`Added original head content (${filteredHeadContent.length} chars)`);
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
		let modifiedHtml = html;
		const tagsToInject: Array<{ key: string; content: string }> = [];

		// Compare existing meta tags with what we're about to inject
		Object.entries(metaTags).forEach(([key, content]) => {
			const existingContent = this.getExistingMetaContent(html, key);

			if (existingContent === null) {
				// Meta tag doesn't exist, we need to inject it
				tagsToInject.push({ key, content });
				this.log(`Meta tag '${key}' not found, will inject`);
			} else if (existingContent !== content) {
				// Meta tag exists but with different content, remove old and inject new
				modifiedHtml = this.removeExistingMetaTag(modifiedHtml, key);
				tagsToInject.push({ key, content });
				this.log(`Meta tag '${key}' content differs ('${existingContent}' → '${content}'), will replace`);
			} else {
				// Meta tag exists with same content, skip injection
				this.log(`Meta tag '${key}' already exists with same content, skipping injection`);
			}
		});

		// Only inject tags that are actually needed
		if (tagsToInject.length > 0) {
			const metaTagsHtml = tagsToInject.map(({ key, content }) => this.generateMetaTag(key, content)).join('\n    ');

			return this.injectIntoHead(modifiedHtml, metaTagsHtml);
		}

		return modifiedHtml;
	}

	/**
	 * Generate a meta tag HTML string based on the key type
	 */
	private generateMetaTag(key: string, content: string): string {
		const escapedContent = this.escapeHtml(content);

		if (key === 'charset') {
			return `<meta charset="${escapedContent}" />`;
		} else if (key.startsWith('http-equiv:')) {
			const httpEquiv = key.replace('http-equiv:', '');
			return `<meta http-equiv="${httpEquiv}" content="${escapedContent}" />`;
		} else if (key.startsWith('og:') || key.startsWith('twitter:') || key.startsWith('fb:')) {
			return `<meta property="${key}" content="${escapedContent}" />`;
		} else {
			return `<meta name="${key}" content="${escapedContent}" />`;
		}
	}

	/**
	 * Get the content of an existing meta tag in HTML
	 */
	private getExistingMetaContent(html: string, key: string): string | null {
		// Find all meta tags in the HTML
		const metaTagRegex = /<meta\s+[^>]*\/?>/gi;
		const matches = html.match(metaTagRegex);

		if (!matches) {
			return null;
		}

		// Parse each meta tag to find matching key
		for (const metaTag of matches) {
			const parsedMeta = this.parseMetaTag(metaTag);
			if (parsedMeta && parsedMeta.key === key) {
				return parsedMeta.content;
			}
		}

		return null;
	}

	/**
	 * Parse a meta tag string and extract key and content
	 */
	private parseMetaTag(metaTagHtml: string): { key: string; content: string } | null {
		// Extract charset meta tags
		const charsetMatch = metaTagHtml.match(/charset=["']([^"']*?)["']/i);
		if (charsetMatch) {
			return { key: 'charset', content: charsetMatch[1] };
		}

		// Extract http-equiv meta tags
		const httpEquivMatch = metaTagHtml.match(/http-equiv=["']([^"']*?)["'][^>]*content=["']([^"']*?)["']/i);
		if (httpEquivMatch) {
			return { key: `http-equiv:${httpEquivMatch[1]}`, content: httpEquivMatch[2] };
		}

		// Extract property-based meta tags (og:, twitter:, etc.)
		const propertyMatch = metaTagHtml.match(/property=["']([^"']*?)["'][^>]*content=["']([^"']*?)["']/i);
		if (propertyMatch) {
			return { key: propertyMatch[1], content: propertyMatch[2] };
		}

		// Extract name-based meta tags
		const nameMatch = metaTagHtml.match(/name=["']([^"']*?)["'][^>]*content=["']([^"']*?)["']/i);
		if (nameMatch) {
			return { key: nameMatch[1], content: nameMatch[2] };
		}

		return null;
	}

	/**
	 * Remove a specific meta tag from HTML
	 */
	private removeExistingMetaTag(html: string, key: string): string {
		// Find all meta tags and rebuild HTML without the matching one
		const metaTagRegex = /<meta\s+[^>]*\/?>\s*/gi;

		return html.replace(metaTagRegex, match => {
			const parsedMeta = this.parseMetaTag(match);
			// If this meta tag matches our key, remove it (return empty string)
			return parsedMeta && parsedMeta.key === key ? '' : match;
		});
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

	/**
	 * Filter out meta tags and/or title tags from head content
	 */
	private filterHeadContent(headContent: string, excludeMeta: boolean, excludeTitle: boolean): string {
		let filteredContent = headContent;

		if (excludeMeta) {
			// Remove all meta tags (handle both self-closing and non-self-closing)
			filteredContent = filteredContent.replace(/<meta\s+[^>]*\/?>\s*/gi, '');
		}

		if (excludeTitle) {
			// Remove title tags
			filteredContent = filteredContent.replace(/<title\s*[^>]*>.*?<\/title>\s*/gi, '');
		}

		return filteredContent;
	}
}
