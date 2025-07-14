# PSS - Prerendered Static Site Generator

A fast, flexible prerendering tool that generates static HTML files from your web applications using Playwright.

## Quick Start

```bash
# Install
pnpm install -g pss

# Use with default settings
pss

# Custom configuration
pss --serve-dir build --out-dir static --concurrency 5
```

## Features

- 🚀 **Fast**: Concurrent page processing with configurable limits
- 🎯 **Flexible**: Multiple configuration formats and options
- 🔧 **Configurable**: Extensive options for different use cases
- 🛡️ **Type Safe**: Built with TypeScript throughout
- 🔄 **Retry Logic**: Automatic retry for failed pages
- 📱 **Modern**: Uses latest Playwright for reliable rendering

## Installation

```bash
# Global installation
pnpm install -g pss

# Local installation
pnpm install --save-dev pss
```

## Usage

### Command Line

```bash
# Basic usage
pss

# With options
pss --serve-dir dist --out-dir prerendered --concurrency 3

# Dry run (test configuration)
pss --dry-run

# Verbose output
pss --verbose
```

### Configuration File

Create a `pss.config.js` file:

```javascript
export default {
  serveDir: 'dist',
  outDir: 'prerendered',
  routes: ['/', '/about', '/contact'],
  concurrency: 5,
  stripMode: 'meta',
  flatOutput: false,
  extraDelay: 1000,
  retry: 3
};
```

### Package.json

```json
{
  "pss": {
    "serveDir": "build",
    "outDir": "static",
    "concurrency": 8
  }
}
```

## CLI Options

- `--config, -c` - Configuration file path
- `--serve-dir, -s` - Source directory (default: 'dist')
- `--out-dir, -o` - Output directory (default: 'prerendered')
- `--concurrency` - Concurrent pages (default: 5)
- `--strip-mode` - HTML processing: 'none', 'meta', 'head'
- `--flat-output` - Flat file structure
- `--dry-run` - Test without execution
- `--verbose, -v` - Detailed logging
- `--help` - Show help
- `--version` - Show version

## Configuration

### Complete Options

```javascript
export default {
  // Required
  serveDir: 'dist',           // Directory to serve
  outDir: 'prerendered',      // Output directory
  
  // Routes
  routes: ['/'],              // Specific routes to prerender
  
  // Processing
  concurrency: 5,             // Concurrent pages
  stripMode: 'none',          // 'none' | 'meta' | 'head'
  flatOutput: false,          // Flat vs nested structure
  
  // Timing
  extraDelay: 0,              // Extra wait before snapshot
  retry: 2,                   // Retry attempts
  retryDelay: 1000,           // Delay between retries
  
  // Advanced
  exclude: [],                // Patterns to exclude
  crawlLinks: true,           // Auto-discover links
  nonHtml: {                  // Non-HTML outputs
    rss: false,
    jsonFeed: false,
    sitemap: true
  },
  
  // Site info
  siteTitle: 'My Site',
  siteUrl: 'https://example.com',
  siteDescription: 'My awesome site'
};
```

## Strip Modes

### `'none'` (default)
Keep all HTML content unchanged.

### `'meta'`
Remove meta tags but preserve essential ones (charset, viewport).

### `'head'`
Remove entire head section except title tag.

## Output Structure

### Nested (default)
```
prerendered/
├── index.html
├── about/
│   └── index.html
└── contact/
    └── index.html
```

### Flat
```
prerendered/
├── index.html
├── about.html
└── contact.html
```

## Integration

### NPM Scripts

```json
{
  "scripts": {
    "build": "vite build",
    "prerender": "pss",
    "build:prerender": "npm run build && npm run prerender"
  }
}
```

### CI/CD

```yaml
# GitHub Actions
- name: Build and prerender
  run: |
    pnpm build
    pnpm prerender --concurrency 10
```

## Frameworks

Works with any framework that generates static files:

- ✅ Vite
- ✅ Webpack
- ✅ Parcel
- ✅ Create React App
- ✅ Next.js (static export)
- ✅ Vue CLI
- ✅ Angular CLI

## Troubleshooting

### Common Issues

**Module not found errors**
```bash
pnpm install
```

**Playwright browser missing**
```bash
npx playwright install
```

**Port conflicts**
PSS automatically finds available ports.

**Memory issues**
Reduce concurrency: `--concurrency 2`

### Debug Mode

```bash
pss --verbose --dry-run
```

## Architecture

PSS is built as a modular monorepo:

- `@pss/cli` - Command-line interface
- `@pss/core` - Prerendering engine
- `@pss/browser` - Playwright automation
- `@pss/server` - Static file server
- `@pss/config` - Configuration loading
- `@pss/types` - TypeScript definitions

## License

BSD-3-Clause 