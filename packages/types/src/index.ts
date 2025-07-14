import { z } from 'zod';

// Strip mode options
export type StripOption = 'meta' | 'title' | 'head' | 'body' | 'head-except-title' | 'dynamic-content';

export const StripOptionSchema = z.enum(['meta', 'title', 'head', 'body', 'head-except-title', 'dynamic-content']);

export type WaitUntil = 'load' | 'domcontentloaded' | 'networkidle' | 'commit';

export const WaitUntilSchema = z.enum(['load', 'domcontentloaded', 'networkidle', 'commit']);

// Original content source options
export type OriginalContentSource = 'static-file' | 'pre-javascript';

export const OriginalContentSourceSchema = z.enum(['static-file', 'pre-javascript']);

// Content source configuration for each content type
export const ContentSourceSchema = z.object({
	original: z.boolean().default(true),
	extracted: z.boolean().default(false),
	static: z.boolean().default(true),
});

export type ContentSource = z.infer<typeof ContentSourceSchema>;

// Injection defaults configuration
export const InjectDefaultsSchema = z.object({
	original: z.boolean().default(true),
	extracted: z.boolean().default(false),
	static: z.boolean().default(true),
});

export type InjectDefaults = z.infer<typeof InjectDefaultsSchema>;

// Content-specific injection configuration
export const ContentInjectSchema = z.object({
	meta: ContentSourceSchema.extend({
		static: z.record(z.string(), z.string()).optional(),
	}).optional(),
	title: ContentSourceSchema.extend({
		static: z.string().optional(),
	}).optional(),
	head: ContentSourceSchema.extend({
		static: z.string().optional(),
	}).optional(),
	body: ContentSourceSchema.extend({
		static: z.string().optional(),
	}).optional(),
});

export type ContentInject = z.infer<typeof ContentInjectSchema>;

// Crawl links configuration
export const CrawlLinksSchema = z.union([
	z.boolean(),
	z.object({
		depth: z.number().min(0).default(3),
		concurrency: z.number().min(1).max(10).default(3),
	}),
]);

export const NonHtmlSchema = z
	.object({
		rss: z.boolean().default(false),
		jsonFeed: z.boolean().default(false),
		sitemap: z.boolean().default(true),
	})
	.default(() => ({ rss: false, jsonFeed: false, sitemap: true }));

// Schema for route-specific configuration
export const RouteConfigSchema = z.object({
	route: z.string(),
	waitUntil: WaitUntilSchema.optional(),
	timeout: z.number().min(1000).optional(),
	extraDelay: z.number().min(0).optional(),
	blockDomains: z.array(z.string()).optional(),
	retry: z.number().min(0).optional(),
	strip: z.array(StripOptionSchema).optional(),
	inject: ContentInjectSchema.optional(),
});

export type RouteConfig = z.infer<typeof RouteConfigSchema>;

// Legacy type aliases for backward compatibility (will be removed)
export type MetaInject = Record<string, string>;
export type HeadInject = string;
export type BodyInject = string;

export const PSSConfigSchema = z.object({
	serveDir: z.string().default('dist'),
	outDir: z.string().default('prerendered'),
	routes: z.array(z.string()).default([]),
	sitemap: z.string().default('sitemap.xml'),
	crawlLinks: CrawlLinksSchema.default(true),
	exclude: z.array(z.union([z.string(), z.instanceof(RegExp)])).default([]),
	extraDelay: z.number().min(0).default(0),

	// New strip configuration - array of strip options
	strip: z.array(StripOptionSchema).default([]),

	// Global injection defaults
	injectDefaults: InjectDefaultsSchema.default(() => ({
		original: true,
		extracted: false,
		static: true,
	})),

	// Content-specific injection configuration
	inject: ContentInjectSchema.default({}),

	// Original content extraction configuration
	originalContentSource: OriginalContentSourceSchema.default('static-file'),

	// Performance optimizations
	optimizeExtraction: z.boolean().default(true),
	cacheOriginalContent: z.boolean().default(true),

	flatOutput: z.boolean().default(false),
	addBaseHref: z.boolean().default(false),
	concurrency: z.number().min(1).max(20).default(5),
	retry: z.number().min(0).default(2),
	retryDelay: z.number().min(0).default(1000),
	buildCommand: z.string().optional(),
	withBuild: z.boolean().default(false),
	nonHtml: NonHtmlSchema,
	// Global browser options that apply to all routes
	timeout: z.number().min(500).default(5000),
	waitUntil: WaitUntilSchema.default('load'),
	blockDomains: z.array(z.string()).default([]),
	autoFallbackNetworkIdle: z.boolean().default(true),
	// Route-specific configurations
	routeConfig: z.array(RouteConfigSchema).default([]),
	// Server configuration
	serverUrl: z.string().url().optional(),
	serverPort: z.number().min(1).max(65535).optional(),
	startServer: z.boolean().default(true),
	// Crawling configuration
	crawlSpecialProtocols: z.boolean().default(false),
	// Feed configuration
	siteTitle: z.string().default('My Site'),
	siteUrl: z.string().url().optional(),
	siteDescription: z.string().default(''),
	author: z
		.object({
			name: z.string().default(''),
			email: z.string().email().optional(),
			url: z.string().url().optional(),
		})
		.default(() => ({ name: '' })),
	verbose: z.boolean().default(false),
});

export type PSSConfig = z.infer<typeof PSSConfigSchema>;

export interface SnapshotResult {
	url: string;
	html: string;
	title?: string;
	meta: Record<string, string>;
	statusCode: number;
	timestamp: number;
}

// Interface for extracted content data
export interface ExtractedContent {
	title?: string;
	meta: Record<string, string>;
	head?: string;
	body?: string;
}

// Interface for original content data
export interface OriginalContent {
	title?: string;
	meta: Record<string, string>;
	head?: string;
	body?: string;
}

export interface CrawlResult {
	snapshots: SnapshotResult[];
	brokenLinks: Array<{
		url: string;
		referrer: string;
		statusCode: number;
		error: string;
	}>;
	stats: {
		totalPages: number;
		totalAssets: number;
		failedAssets: number;
		crawlTime: number;
	};
}
