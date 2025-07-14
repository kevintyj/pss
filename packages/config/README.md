# @kevintyj/pss-config

Configuration loading and validation for PSS (Prerendered Static Site Generator).

## 📦 Installation

```bash
pnpm install @kevintyj/pss-config
```

## 🚀 Usage

```typescript
import { loadConfig } from '@kevintyj/pss-config';

// Load configuration with discovery
const result = await loadConfig();
console.log(result.config); // Validated PSSConfig object
console.log(result.source); // 'pss.config.js'
console.log(result.path);   // '/path/to/pss.config.js'

// Load specific config file
const result2 = await loadConfig('./my-config.js');
```

## 📁 Configuration Files

PSS searches for configuration files in the following order:

1. `pss.config.js`
2. `pss.config.ts`
3. `pss.config.mjs`
4. `pss.config.cjs`
5. `pss.config.json`
6. `.pssrc.json`
7. `.pssrc.js`
8. `package.json` (under `"pss"` key)

### JavaScript/TypeScript Config

```javascript
// pss.config.js
export default {
  serveDir: 'dist',
  outDir: 'prerendered',
  concurrency: 5,
  strip: ['meta', 'title'], // Array-based strip configuration
  routes: ['/', '/about', '/contact'],
  crawlLinks: true,
  exclude: ['/admin/**', /\.pdf$/],
  
  // Browser and navigation settings
  timeout: 30000,
  waitUntil: 'load',
  blockDomains: ['youtube.com', 'googlevideo.com'],
  autoFallbackNetworkIdle: true,
  
  // Original content extraction
  originalContentSource: 'static-file',
  cacheOriginalContent: true,
  
  // Global injection defaults
  injectDefaults: {
    original: true,    // Include original content from static files
    extracted: false,  // Don't include JS-generated content by default
    static: true       // Include config-defined content
  },
  
  // Content-specific injection configuration
  inject: {
    meta: {
      static: {
        description: 'My awesome site',
        keywords: 'web,app,static',
        author: 'John Doe',
        'og:type': 'website'
      },
      extracted: true,  // Override default: include JS-generated meta
      original: true    // Include original meta from static files
    },
    title: {
      static: 'My Awesome Site',
      extracted: false, // Don't use JS-generated title
      original: true    // Use original title from static files
    },
    head: {
      static: '<link rel="canonical" href="https://mysite.com">',
      extracted: false, // Don't include JS-generated head content
      original: true    // Include original head content
    },
    body: {
      static: '<div class="loading">Loading...</div>',
      extracted: false, // Don't include JS-generated body content
      original: true    // Preserve original body for hydration
    }
  },
  
  // Route-specific configurations for external widgets
  routeConfig: [
    {
      route: '/blog/post/*',
      strip: ['meta'],
      inject: {
        meta: {
          static: { 'og:type': 'article' },
          extracted: true,
          original: false
        }
      },
      waitUntil: 'domcontentloaded',
      blockDomains: ['youtube.com', 'twitter.com'],
      timeout: 15000,
      extraDelay: 2000
    },
    {
      route: '/contact',
      strip: ['dynamic-content'],
      waitUntil: 'domcontentloaded', 
      blockDomains: ['challenges.cloudflare.com'],
      timeout: 12000,
      retry: 3
    },
    {
      route: '*', // Global route config
      blockDomains: ['google-analytics.com'],
      extraDelay: 1000
    }
  ],
  
  // Other options
  nonHtml: {
    sitemap: true,
    rss: false,
    jsonFeed: false
  }
};
```

### JSON Config

```json
{
  "serveDir": "build",
  "outDir": "static",
  "concurrency": 8,
  "strip": ["meta", "title"],
  "flatOutput": true,
  "timeout": 25000,
  "waitUntil": "load",
  "blockDomains": ["youtube.com", "googlevideo.com"],
  "autoFallbackNetworkIdle": true,
  "originalContentSource": "static-file",
  "cacheOriginalContent": true,
  "injectDefaults": {
    "original": true,
    "extracted": false,
    "static": true
  },
  "inject": {
    "meta": {
      "static": {
        "description": "My JSON-configured site",
        "keywords": "json,config,static"
      },
      "extracted": true,
      "original": true
    }
  }
}
```

### Package.json Config

```json
{
  "name": "my-app",
  "pss": {
    "serveDir": "build",
    "outDir": "static",
    "concurrency": 3,
    "strip": ["meta"],
    "timeout": 20000,
    "waitUntil": "domcontentloaded",
    "blockDomains": ["challenges.cloudflare.com"],
    "originalContentSource": "static-file"
  }
}
```

## ⚙️ Configuration Options

### Basic Options

- `serveDir` (string, default: "dist"): Directory to serve static files from
- `outDir` (string, default: "prerendered"): Output directory for prerendered files
- `routes` (string[], default: []): Specific routes to prerender
- `concurrency` (number, default: 5): Number of concurrent pages to process
- `strip` (StripOption[], default: []): Array of HTML stripping modes
  - `meta`: Remove meta tags (except charset and viewport)
  - `title`: Remove title tag
  - `head`: Remove entire head section
  - `body`: Remove entire body content
  - `head-except-title`: Remove head content but keep title
  - `dynamic-content`: Remove dynamically generated content
- `flatOutput` (boolean, default: false): Use flat file structure instead of nested

### Original Content Options

- `originalContentSource` ("static-file" | "pre-javascript", default: "static-file"): How to extract original content
  - `static-file`: Extract content from static HTML files on disk
  - `pre-javascript`: Extract content from page before JavaScript execution
- `cacheOriginalContent` (boolean, default: true): Cache original content extraction for better performance

### Content Injection System

PSS uses a three-source injection system with global defaults and content-specific overrides:

#### Global Injection Defaults

- `injectDefaults` (object): Default behavior for all content types
  - `original` (boolean, default: true): Include original content by default
  - `extracted` (boolean, default: false): Include JS-generated content by default
  - `static` (boolean, default: true): Include config-defined content by default

#### Content-Specific Injection

- `inject` (object): Content-specific injection configuration
  - `meta`: Meta tag injection configuration
  - `title`: Title injection configuration
  - `head`: Head content injection configuration
  - `body`: Body content injection configuration

Each content type supports:
- `static`: Static content to inject (object for meta, string for others)
- `extracted`: Whether to include JS-generated content (boolean)
- `original`: Whether to include original content (boolean)

#### Injection Priority

Content is merged in this order: **original → extracted → static** (later sources override earlier ones)

#### Examples

```javascript
// Default behavior: only original and static content
{
  injectDefaults: { original: true, extracted: false, static: true }
}

// Include everything for meta tags, only original for title
{
  injectDefaults: { original: true, extracted: false, static: true },
  inject: {
    meta: { extracted: true }, // Override default
    title: { static: null }    // Only use original title
  }
}

// Preserve hydration structure while replacing meta
{
  strip: ['meta'],
  inject: {
    meta: {
      static: { 'description': 'SEO optimized' },
      extracted: false,
      original: false
    },
    body: {
      original: true // Keep original body for hydration
    }
  }
}
```

### Crawling Options

- `crawlSpecialProtocols` (boolean, default: false): Enable crawling of special protocol links
  - When `false` (default): Skips `mailto:`, `tel:`, `javascript:`, `data:`, and other non-HTTP protocol links
  - When `true`: Allows crawling of special protocol links (may result in 404 errors)
  - Example protocols filtered by default: `mailto:`, `tel:`, `sms:`, `fax:`, `ftp:`, `javascript:`, `data:`, `blob:`, `about:`, etc.

### Browser & Navigation Options

- `timeout` (number, default: 30000): Page load timeout in milliseconds
  - See [Playwright Frame.goto()](https://playwright.dev/docs/api/class-frame#frame-goto) for details
- `waitUntil` ("load" | "domcontentloaded" | "networkidle" | "commit", default: "load"): When to consider navigation successful
  - `load`: Wait for the load event (recommended for external widgets)
  - `domcontentloaded`: Wait for DOM to be ready (fastest, good for most pages)
  - `networkidle`: Wait for no network requests for 500ms (can timeout with widgets)
  - `commit`: Wait for navigation to be committed (minimal)
  - See [Playwright WaitUntil](https://playwright.dev/docs/api/class-frame#frame-goto-option-wait-until) for details
- `blockDomains` (string[], default: []): Domains to block during rendering
  - Example: `['youtube.com', 'googlevideo.com', 'challenges.cloudflare.com']`
  - Prevents external widgets from causing timeouts
- `autoFallbackNetworkIdle` (boolean, default: true): Automatically fallback from networkidle to load on timeout
  - Helps pages with external widgets succeed without manual intervention

### Route-Specific Configuration

- `routeConfig` (RouteConfig[], default: []): Array of route-specific configurations
  - Each route config can override global settings for specific routes
  - Supports exact matches, wildcard patterns (`/blog/*`), and global patterns (`*`)

#### RouteConfig Options

```typescript
interface RouteConfig {
  route: string;                    // Route pattern (exact, wildcard, or '*' for global)
  strip?: StripOption[];            // Override strip modes for this route
  inject?: ContentInject;           // Override injection configuration
  injectDefaults?: InjectDefaults;  // Override injection defaults
  waitUntil?: WaitUntil;           // Override wait strategy for this route
  timeout?: number;                 // Override timeout for this route
  extraDelay?: number;              // Extra delay after page load
  blockDomains?: string[];          // Domains to block for this route
  retry?: number;                   // Number of retry attempts
}
```

### Crawling & Processing

- `crawlLinks` (boolean | object, default: true): Enable automatic link discovery
- `exclude` (Array<string | RegExp>, default: []): Patterns to exclude from crawling
- `retry` (number, default: 2): Number of retry attempts for failed requests
- `retryDelay` (number, default: 1000): Delay between retries in milliseconds
- `extraDelay` (number, default: 0): Extra delay before taking snapshots

### Server Options

- `startServer` (boolean, default: true): Whether to start a new server
- `serverUrl` (string, optional): URL of existing server to use
- `serverPort` (number, default: 3000): Port for the static server

### Output Options

- `nonHtml` (object): Configuration for non-HTML outputs
  - `sitemap` (boolean, default: true): Generate sitemap.xml
  - `rss` (boolean, default: false): Generate RSS feed
  - `jsonFeed` (boolean, default: false): Generate JSON feed

## 🎯 External Widget Solutions

### Common Widget Configurations

#### YouTube Embeds
```javascript
{
  routeConfig: [
    {
      route: '/blog/post/*',
      waitUntil: 'domcontentloaded',
      blockDomains: ['youtube.com', 'googlevideo.com', 'ytimg.com'],
      timeout: 15000,
      extraDelay: 2000
    }
  ]
}
```

#### Cloudflare Turnstile
```javascript
{
  routeConfig: [
    {
      route: '/contact',
      waitUntil: 'domcontentloaded',
      blockDomains: ['challenges.cloudflare.com', 'cf-js.com'],
      timeout: 12000,
      retry: 3
    }
  ]
}
```

#### Social Media Embeds
```javascript
{
  routeConfig: [
    {
      route: '/blog/*',
      waitUntil: 'load',
      blockDomains: ['twitter.com', 'facebook.com', 'instagram.com'],
      timeout: 10000
    }
  ]
}
```

#### Global Analytics Blocking
```javascript
{
  routeConfig: [
    {
      route: '*', // Applies to all routes
      blockDomains: ['google-analytics.com', 'googletagmanager.com']
    }
  ]
}
```

## 🔧 API

### `loadConfig(configPath?, cwd?)`

Loads and validates PSS configuration.

**Parameters:**
- `configPath` (string, optional) - Explicit path to config file
- `cwd` (string, optional) - Working directory for config discovery

**Returns:** `Promise<ConfigLoadResult>`

```typescript
interface ConfigLoadResult {
  config: PSSConfig;
  source: string;
  path: string;
}
```

### `mergeConfigs(baseConfig, overrideConfig)`

Merges two configuration objects with deep merging for nested objects.

```typescript
import { mergeConfigs } from '@kevintyj/pss-config';

const merged = mergeConfigs(
  { 
    blockDomains: ['youtube.com'],
    routeConfig: [{ route: '/blog/*', timeout: 10000 }]
  },
  { 
    blockDomains: ['twitter.com'],
    routeConfig: [{ route: '/contact', timeout: 15000 }]
  }
);
// Result: blockDomains: ['youtube.com', 'twitter.com']
//         routeConfig: [both configs merged]
```

### `validateConfig(config)`

Validates configuration using Zod schema and returns typed config object.

```typescript
import { validateConfig } from '@kevintyj/pss-config';

try {
  const config = validateConfig({
    serveDir: 'dist',
    outDir: 'prerendered',
    timeout: 30000,
    waitUntil: 'load',
    blockDomains: ['youtube.com']
  });
} catch (error) {
  console.error('Invalid configuration:', error.message);
}
```

## 🏗️ Configuration Discovery

The configuration system supports multiple discovery methods:

1. **Explicit path**: `loadConfig('./custom-config.js')`
2. **Auto-discovery**: Searches current directory and parent directories
3. **Package.json**: Looks for `"pss"` key in package.json
4. **Defaults**: Falls back to sensible defaults

## 🔒 Validation

All configurations are validated using Zod schemas from `@kevintyj/pss-types`:

- Type safety for all configuration options
- Validation of timeout ranges (minimum 1000ms)
- Validation of waitUntil enum values
- Array validation for blockDomains and routeConfig
- Automatic default value application

## 🐛 Error Handling

The configuration system provides detailed error messages:

```typescript
try {
  const result = await loadConfig('./invalid-config.js');
} catch (error) {
  // Error includes:
  // - File path that failed
  // - Specific validation errors
  // - Suggestions for fixes
  // - Line numbers for syntax errors
}
```

## 📖 Advanced Examples

### Multi-Environment Configuration

```javascript
// pss.config.js
const isDev = process.env.NODE_ENV === 'development';

export default {
  serveDir: 'dist',
  outDir: 'prerendered',
  timeout: isDev ? 60000 : 30000,
  waitUntil: isDev ? 'networkidle' : 'load',
  verbose: isDev,
  
  routeConfig: isDev ? [] : [
    // Production: block external widgets
    {
      route: '*',
      blockDomains: ['youtube.com', 'twitter.com', 'facebook.com']
    }
  ]
};
```

### Performance-Optimized Configuration

```javascript
// pss.config.js
export default {
  serveDir: 'dist',
  outDir: 'prerendered',
  concurrency: 10,
  stripMode: 'meta',
  flatOutput: true,
  
  // Fast navigation strategy
  waitUntil: 'domcontentloaded',
  timeout: 15000,
  autoFallbackNetworkIdle: false,
  
  // Block all analytics and ads
  blockDomains: [
    'google-analytics.com',
    'googletagmanager.com',
    'facebook.com',
    'doubleclick.net'
  ],
  
  // Route-specific optimizations
  routeConfig: [
    {
      route: '/api/*',
      stripMode: 'head', // API docs don't need full head
      timeout: 5000
    },
    {
      route: '/blog/*',
      extraDelay: 1000, // Let content render
      blockDomains: ['youtube.com', 'twitter.com']
    }
  ]
};
```

### Flexible Strip and Inject Configuration

```javascript
// pss.config.js
export default {
  serveDir: 'dist',
  outDir: 'prerendered',
  
  // Global strip mode
  stripMode: 'body', // Strip body content from all pages
  
  // Inject content into stripped pages
  injectMeta: {
    'description': 'Lightweight prerendered content',
    'og:type': 'website',
    'twitter:card': 'summary'
  },
  injectHead: `
    <link rel="stylesheet" href="/minimal.css">
    <script>console.log('Minimal page loaded');</script>
  `,
  injectBody: `
    <div class="minimal-content">
      <h1>Content Loading...</h1>
      <p>This is a minimal version of the page.</p>
    </div>
  `,
  
  // Selective injection: only preserve specific extracted content
  injectExtractedMeta: true,    // ✅ Preserve meta tags
  injectExtractedTitle: true,   // ✅ Preserve title
  // injectExtractedHead: false (implicit) - Don't preserve head
  // injectExtractedBody: false (implicit) - Don't preserve body
  
  // Route-specific overrides
  routeConfig: [
    {
      route: '/blog/*',
      stripMode: 'none', // Keep full content for blog posts
      // No injection options = inject everything by default (backward compatibility)
    },
    {
      route: '/api/*',
      stripMode: 'head', // API docs only need meta
      injectHead: '<meta name="robots" content="noindex">',
      disableAllInjection: false // Explicit: allow injection
    },
    {
      route: '/admin/*',
      disableAllInjection: true // Completely disable all injection
    }
  ]
};
```

## 🔧 Development

```bash
# Build
pnpm build

# Run in development
pnpm dev

# Format code
pnpm format

# Lint
pnpm lint
```

## 📚 References

- [Playwright Frame.goto() Documentation](https://playwright.dev/docs/api/class-frame#frame-goto)
- [Playwright WaitUntil Options](https://playwright.dev/docs/api/class-frame#frame-goto-option-wait-until)
- [Playwright Route Blocking](https://playwright.dev/docs/api/class-browsercontext#browser-context-route)
- [Zod Validation Library](https://zod.dev/)