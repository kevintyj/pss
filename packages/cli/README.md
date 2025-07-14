# @pss/cli

Command-line interface for PSS (Prerendered Static Site Generator).

## Overview

This package provides a user-friendly command-line interface for PSS, allowing developers to prerender static sites with configurable options. It supports configuration files, CLI overrides, dry-run mode, verbose logging, advanced browser controls, and flexible content injection capabilities with multiple content sources.

## Features

- **Configuration Management**: Automatic discovery and loading of configuration files
- **CLI Overrides**: Override configuration options via command-line arguments
- **Advanced Browser Controls**: Timeout settings, wait strategies, and domain blocking
- **External Widget Support**: Specialized handling for YouTube, Cloudflare, and other external widgets
- **Auto-Fallback**: Automatic fallback from networkidle to load on timeout
- **Advanced Content Processing**: Array-based strip modes and multi-source injection system
- **Original Content Preservation**: Maintain hydration-ready structure with original content extraction
- **Dry Run Mode**: Preview configuration and validation without processing
- **Verbose Logging**: Detailed output for debugging and monitoring
- **Flexible Options**: Support for concurrency, output formats, and server management

## Installation

```bash
pnpm add @kevintyj/pss-cli
```

## Usage

### Basic Usage

```bash
# Prerender with default configuration
pss

# Specify custom directories
pss --serve-dir dist --out-dir prerendered

# Use existing server
pss --server-url http://localhost:3000 --start-server false

# Dry run to validate configuration
pss --dry-run
```

### Advanced Usage

```bash
# Custom configuration with high concurrency and array-based strip
pss --config pss.config.js --concurrency 10 --strip meta title

# Handle external widgets (YouTube, Cloudflare Turnstile, etc.)
pss --wait-until domcontentloaded --block-domains youtube.com googlevideo.com challenges.cloudflare.com

# Custom timeout and fallback behavior
pss --timeout 15000 --auto-fallback-network-idle false

# Flat output structure with verbose logging
pss --flat-output --verbose

# Original content preservation
pss --original-content-source static-file --cache-original-content
```

## CLI Options

### Basic Options

- `--config, -c <path>`: Path to configuration file
- `--serve-dir, -s <dir>`: Directory to serve static files from (default: "dist")
- `--out-dir, -o <dir>`: Output directory for prerendered files (default: "prerendered")
- `--help`: Show help information
- `--version`: Show version number

### Processing Options

- `--concurrency <number>`: Number of concurrent pages to process (default: 5)
- `--strip <modes...>`: Array of HTML stripping modes - controls what gets removed from HTML:
  - `meta`: Remove meta tags except essential ones (charset, viewport, Content-Type)
  - `title`: Remove title tag
  - `head`: Remove entire head section
  - `body`: Remove entire body content
  - `head-except-title`: Remove head content but keep title
  - `dynamic-content`: Remove dynamically generated content
  - Example: `--strip meta title` or `--strip body head-except-title`
- `--flat-output`: Use flat file structure instead of nested directories

### Content Source Options

- `--original-content-source <source>`: How to extract original content (default: "static-file")
  - `static-file`: Extract from static HTML files on disk
  - `pre-javascript`: Extract from page before JavaScript execution
- `--cache-original-content`: Cache original content extraction for better performance (default: true)

### Browser & Navigation Options

- `--timeout <ms>`: Page load timeout in milliseconds (default: 30000)
  - See [Playwright documentation](https://playwright.dev/docs/api/class-frame#frame-goto) for details
- `--wait-until <strategy>`: When to consider navigation successful (default: "load")
  - `load`: Wait for the load event (recommended for external widgets)
  - `domcontentloaded`: Wait for DOM to be ready (fastest, good for most pages)
  - `networkidle`: Wait for no network requests for 500ms (slower, can timeout with widgets)
  - `commit`: Wait for navigation to be committed (minimal)
  - See [Playwright wait strategies](https://playwright.dev/docs/api/class-frame#frame-goto-option-wait-until) for details
- `--block-domains <domains...>`: Block external domains during rendering
  - Example: `--block-domains youtube.com googlevideo.com challenges.cloudflare.com`
  - Useful for preventing external widgets from causing timeouts
- `--auto-fallback-network-idle`: Automatically fallback from networkidle to load on timeout (default: true)
  - Helps pages with external widgets succeed automatically

### Crawling Options

- `crawlSpecialProtocols` (boolean, default: false): Enable crawling of special protocol links
  - When `false` (default): Skips `mailto:`, `tel:`, `javascript:`, `data:`, and other non-HTTP protocol links
  - When `true`: Allows crawling of special protocol links (may result in 404 errors)
  - Prevents errors when pages contain links like `mailto:contact@example.com` or `tel:+1234567890`

### Content Injection Options

PSS supports a three-source injection system with content-specific controls:

#### Static Content Injection
- `--inject-meta <json>`: JSON string of meta tags to inject into all pages
  - Example: `'{"description":"My site","keywords":"web,app","author":"John Doe"}'`
  - Supports standard meta tags, Open Graph (`og:`), Twitter (`twitter:`), and http-equiv tags
- `--inject-head <html>`: HTML content to inject into the head section of all pages
  - Example: `'<link rel="stylesheet" href="styles.css"><script>console.log("injected")</script>'`
- `--inject-body <html>`: HTML content to inject into the body section of all pages
  - Example: `'<div class="loading">Loading...</div>'`
- `--inject-title <title>`: Static title to inject into all pages

#### Global Injection Defaults
- `--inject-defaults-original`: Include original content by default (default: true)
- `--inject-defaults-extracted`: Include extracted (JS-generated) content by default (default: false)
- `--inject-defaults-static`: Include static (config-defined) content by default (default: true)

**Note**: Full content-specific injection configuration is only available through configuration files due to CLI complexity.

### Server Options

- `--server-url <url>`: URL of existing server to use instead of starting a new one
- `--server-port <port>`: Port of existing server to use (default: 3000)
- `--start-server`: Whether to start a new server (default: true)

### Utility Options

- `--dry-run`: Show what would be done without actually doing it
- `--verbose, -v`: Enable verbose logging

## External Widget Solutions

PSS provides specialized support for handling external widgets that commonly cause prerendering timeouts:

### YouTube Embeds
```bash
pss --wait-until domcontentloaded --block-domains youtube.com googlevideo.com ytimg.com --timeout 15000
```

### Cloudflare Turnstile
```bash
pss --wait-until domcontentloaded --block-domains challenges.cloudflare.com cf-js.com --timeout 12000
```

### Social Media Embeds
```bash
pss --wait-until load --block-domains twitter.com facebook.com instagram.com --auto-fallback-network-idle true
```

### Google Analytics & Tag Manager
```bash
pss --block-domains google-analytics.com googletagmanager.com --wait-until load
```

## Common Use Cases

### 1. SEO Optimization with Original Content Preservation

Perfect for Single Page Applications that need proper meta tags for SEO while preserving hydration structure:

```bash
pss --serve-dir dist --out-dir seo-optimized \
  --strip meta \
  --inject-meta '{"description":"Modern web app with great UX","keywords":"react,spa,fast","og:title":"My App","og:description":"Built with React and optimized for performance"}' \
  --inject-head '<link rel="canonical" href="https://myapp.com"><meta name="robots" content="index,follow">' \
  --original-content-source static-file \
  --cache-original-content
```

**Use case**: Your React/Vue app generates dynamic meta tags based on route content, and you want to preserve original body structure for hydration while replacing meta tags.

### 2. Social Media Sharing Optimization

Optimize pages for social media sharing with proper Open Graph and Twitter tags:

```bash
pss --serve-dir dist --out-dir social-ready \
  --strip meta title \
  --inject-meta '{"og:site_name":"My Company","og:type":"website","twitter:card":"summary_large_image","twitter:creator":"@mycompany","fb:app_id":"123456789"}' \
  --inject-head '<meta property="og:image" content="https://mysite.com/og-image.jpg">' \
  --inject-title "My Company - Social Ready" \
  --wait-until load
```

**Use case**: E-commerce site or blog where you want consistent social sharing metadata across all product pages or articles.

### 3. Performance-Focused Static Generation

Generate lightweight static pages with minimal HTML for maximum performance:

```bash
pss --serve-dir dist --out-dir lightweight \
  --strip head-except-title dynamic-content \
  --inject-meta '{"description":"Fast-loading static site","viewport":"width=device-width,initial-scale=1"}' \
  --inject-head '<style>body{font-family:sans-serif}</style>' \
  --flat-output \
  --concurrency 10 \
  --wait-until domcontentloaded
```

**Use case**: Documentation site or landing page where you want to strip unnecessary HTML but preserve title and add minimal styling for fast loading.

### 4. External Widget Heavy Site

Handle sites with lots of external widgets (YouTube, social embeds, analytics):

```bash
pss --serve-dir dist --out-dir widget-optimized \
  --strip dynamic-content \
  --wait-until domcontentloaded \
  --block-domains youtube.com googlevideo.com twitter.com facebook.com google-analytics.com \
  --timeout 20000 \
  --auto-fallback-network-idle true \
  --concurrency 5 \
  --verbose
```

**Use case**: Marketing site or blog with multiple external widgets that need to be prerendered without timeouts.

## Configuration Priority

The CLI follows this priority order for configuration:

1. **CLI Arguments**: Highest priority (only when explicitly provided)
2. **Configuration File**: Loaded from `pss.config.js`, `pss.config.ts`, etc.
3. **Default Values**: Fallback defaults

## Configuration Files

The CLI automatically discovers configuration files in these formats:
- `pss.config.js`
- `pss.config.ts`
- `pss.config.json`
- `pss.config.mjs`
- `pss.config.cjs`

Example configuration file:

```javascript
// pss.config.js
export default {
  serveDir: 'dist',
  outDir: 'prerendered',
  concurrency: 10,
  strip: ['meta', 'title'],
  flatOutput: false,
  routes: ['/'],
  
  // Crawling settings
  crawlSpecialProtocols: false, // Skip mailto:, tel:, etc. links by default
  
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
    original: true,
    extracted: false,
    static: true
  },
  
  // Content-specific injection
  inject: {
    meta: {
      static: {
        description: 'My awesome site',
        keywords: 'web,app,static',
        author: 'John Doe'
      },
      extracted: true,
      original: true
    },
    head: {
      static: '<link rel="canonical" href="https://mysite.com">',
      extracted: false,
      original: true
    },
    title: {
      static: 'My Awesome Site',
      extracted: false,
      original: true
    }
  },
  
  // Route-specific configurations
  routeConfig: [
    {
      route: '/blog/post/*',
      waitUntil: 'domcontentloaded',
      blockDomains: ['youtube.com', 'twitter.com'],
      timeout: 15000,
      strip: ['meta'],
      inject: {
        meta: {
          static: { 'og:type': 'article' },
          extracted: true,
          original: false
        }
      }
    },
    {
      route: '/contact',
      waitUntil: 'domcontentloaded',
      blockDomains: ['challenges.cloudflare.com'],
      timeout: 12000,
      strip: ['dynamic-content']
    }
  ],
  
  // Server settings
  startServer: true,
  serverPort: 3000
};
```

## Output Information

The CLI provides detailed output including:

- Configuration source and values
- Browser and navigation settings
- Domain blocking status
- Injection status (meta tags, head content)
- Processing progress with emojis
- Results summary (pages processed, timing)
- Generated page list
- Error handling with meaningful messages

### Example Output

```
🚀 PSS (Prerendered Static Site Generator)
═══════════════════════════════════════════

📋 Configuration:
   Source: pss.config.js
   Serve directory: dist
   Output directory: prerendered
   Concurrency: 5
   Strip modes: meta, title
   Flat output: false
   Start server: true
   Timeout: 30000ms
   Wait until: load
   Block domains: youtube.com, googlevideo.com
   Auto-fallback networkidle: true
   Crawl special protocols: false
   Original content source: static-file
   Cache original content: true
   Inject defaults: original=true, extracted=false, static=true
   Content injection configured: meta, head, title
   Routes: Auto-detect from /

🚀 Starting prerendering process...
✓ Static server running at http://localhost:3000
🚫 Blocking request to: https://youtube.com/embed/xyz
🔄 Auto-fallback: Switching from 'networkidle' to 'load' strategy

📊 Results:
   Pages processed: 3
   Output directory: prerendered
   Total time: 1247ms

📄 Generated pages:
   • http://localhost:3000/ → http://localhost:3000/
   • http://localhost:3000/about → http://localhost:3000/about
   • http://localhost:3000/contact → http://localhost:3000/contact

✅ Prerendering completed successfully!
```

## Error Handling

The CLI provides comprehensive error handling:

- **Configuration Errors**: Clear messages for invalid config values
- **JSON Parsing Errors**: Helpful feedback for malformed `--inject-meta` JSON
- **Browser Errors**: Detailed timeout and navigation error messages
- **External Widget Issues**: Specific guidance for handling widgets
- **Server Errors**: Helpful feedback for server startup issues
- **Processing Errors**: Detailed error context for debugging
- **Exit Codes**: Proper exit codes for CI/CD integration

## Programmatic Usage

The CLI can also be used programmatically:

```typescript
import { cli } from '@kevintyj/pss-cli';

// Run CLI programmatically
await cli();
```

## Dependencies

- `@kevintyj/pss-config`: Configuration loading and validation
- `@kevintyj/pss-core`: Core prerendering functionality
- `@kevintyj/pss-types`: Type definitions
- `@kevintyj/pss-browser`: Browser automation with injection capabilities
- `@kevintyj/pss-server`: Static file server
- `yargs`: Command-line argument parsing

## References

- [Playwright Frame.goto() Documentation](https://playwright.dev/docs/api/class-frame#frame-goto)
- [Playwright WaitUntil Options](https://playwright.dev/docs/api/class-frame#frame-goto-option-wait-until)
- [Playwright Route Blocking](https://playwright.dev/docs/api/class-browsercontext#browser-context-route)