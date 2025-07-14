import { z } from 'zod';

export type StripMode = 'none' | 'meta' | 'head';

export const StripModeSchema = z.enum(['none', 'meta', 'head']);

export type WaitUntil = 'load' | 'domcontentloaded' | 'networkidle' | 'commit';

export const WaitUntilSchema = z.enum(['load', 'domcontentloaded', 'networkidle', 'commit']);

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
	stripMode: StripModeSchema.optional(),
});

export const MetaInjectSchema = z.record(z.string(), z.string()).optional();
export type MetaInject = z.infer<typeof MetaInjectSchema>;

export const HeadInjectSchema = z.string().optional();
export type HeadInject = z.infer<typeof HeadInjectSchema>;

export type RouteConfig = z.infer<typeof RouteConfigSchema>;

export const PSSConfigSchema = z.object({
	serveDir: z.string().default('dist'),
	outDir: z.string().default('prerendered'),
	routes: z.array(z.string()).default([]),
	sitemap: z.string().default('sitemap.xml'),
	crawlLinks: CrawlLinksSchema.default(true),
	exclude: z.array(z.union([z.string(), z.instanceof(RegExp)])).default([]),
	extraDelay: z.number().min(0).default(0),
	stripMode: StripModeSchema.default('none'),
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
	// Injection configuration
	injectMeta: MetaInjectSchema,
	injectHead: HeadInjectSchema,
	injectExtractedMeta: z.boolean().default(false),
	injectExtractedHead: z.boolean().default(false),
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
