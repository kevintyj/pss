# @pss/types

TypeScript types and Zod schemas for PSS (Prerendered Static Site Generator).

## Installation

```bash
pnpm add @kevintyj/pss-types
```

## Exports

### Types

- **`StripMode`** - Type for HTML stripping modes: `'none' | 'meta' | 'head'`
- **`PSSConfig`** - Configuration object interface for PSS
- **`SnapshotResult`** - Result interface for individual page snapshots
- **`CrawlResult`** - Result interface for complete crawling operations

### Schemas

- **`StripModeSchema`** - Zod schema for validating strip modes
- **`CrawlLinksSchema`** - Zod schema for crawl links configuration
- **`NonHtmlSchema`** - Zod schema for non-HTML output options (RSS, JSON feed, sitemap)
- **`PSSConfigSchema`** - Main Zod schema for PSS configuration validation

## Usage

### Basic Type Usage

```typescript
import type { PSSConfig, SnapshotResult } from '@kevintyj/pss-types';

const config: PSSConfig = {
  serveDir: 'dist',
  outDir: 'prerendered',
  routes: ['/'],
  concurrency: 5,
  stripMode: 'none'
};

const snapshot: SnapshotResult = {
  url: 'https://example.com',
  html: '<html>...</html>',
  title: 'Example Page',
  meta: { description: 'Example description' },
  statusCode: 200,
  timestamp: Date.now()
};
```

### Schema Validation

```typescript
import { PSSConfigSchema } from '@kevintyj/pss-types';

// Validate and parse configuration
const config = PSSConfigSchema.parse(userConfig);

// Safe parsing with error handling
const result = PSSConfigSchema.safeParse(userConfig);
if (!result.success) {
  console.error('Configuration validation failed:', result.error);
}
```

### Configuration Options

The `PSSConfig` interface includes:

- **`serveDir`** - Directory to serve static files from (default: `'dist'`)
- **`outDir`** - Output directory for prerendered files (default: `'prerendered'`)
- **`routes`** - Array of specific routes to prerender (default: `[]`)
- **`concurrency`** - Number of concurrent pages to process (default: `5`)
- **`stripMode`** - HTML stripping mode: `'none'`, `'meta'`, or `'head'` (default: `'none'`)
- **`flatOutput`** - Use flat file structure vs nested (default: `false`)
- **`crawlLinks`** - Enable automatic link crawling (default: `true`)
- **`crawlSpecialProtocols`** - Enable crawling of special protocol links like `mailto:`, `tel:`, etc. (default: `false`)
- **`exclude`** - Array of patterns to exclude from crawling (default: `[]`)
- **`retry`** - Number of retry attempts for failed requests (default: `2`)
- **`extraDelay`** - Extra delay before taking snapshots in ms (default: `0`)
- **`nonHtml`** - Configuration for non-HTML outputs (RSS, JSON feed, sitemap)
- **`siteTitle`**, **`siteUrl`**, **`siteDescription`** - Site metadata for feeds
- **`author`** - Author information for feeds

## License

BSD-3-Clause 