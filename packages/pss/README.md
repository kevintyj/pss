# PSS - Prerendered Static Site Generator

A fast, flexible prerendering tool that generates static HTML files from your web applications using Playwright.

## Quick Start

```bash
# Install
pnpm install -g pss

# Use with default settings
pss

# Custom configuration with array-based strip
pss --serve-dir build --out-dir static --concurrency 5 --strip meta title
```

## Features

- 🚀 **Fast**: Concurrent page processing with configurable limits
- 🎯 **Flexible**: Multiple configuration formats and options
- 🔧 **Configurable**: Extensive options for different use cases
- 🛡️ **Type Safe**: Built with TypeScript throughout
- 🔄 **Retry Logic**: Automatic retry for failed pages
- 📱 **Modern**: Uses latest Playwright for reliable rendering
- 🎨 **Advanced Content Processing**: Array-based strip modes and multi-source injection
- 🏗️ **Hydration Support**: Preserve original content structure for client-side hydration

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

# Array-based strip configuration
pss --strip meta title head-except-title

# Original content preservation
pss --original-content-source static-file --cache-original-content

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
  strip: ['meta', 'title'], // Array-based strip configuration
  flatOutput: false,
  extraDelay: 1000,
  retry: 3,
  
  // Original content extraction
  originalContentSource: 'static-file',
  cacheOriginalContent: true,
  
  // Global injection defaults
  injectDefaults: {
    original: true,    // Include original content
    extracted: false,  // Don't include JS-generated content by default
    static: true       // Include config-defined content
  },
  
  // Content-specific injection
  inject: {
    meta: {
      static: {
        'description': 'My awesome site',
        'og:type': 'website'
      },
      extracted: true,  // Override default for meta
      original: true
    },
    title: {
      static: 'My Site',
      extracted: false,
      original: true
    },
    head: {
      static: '<link rel="canonical" href="https://mysite.com">',
      extracted: false,
      original: true
    },
    body: {
      original: true // Preserve original body for hydration
    }
  }
};
```

### Package.json

```json
{
  "pss": {
    "serveDir": "build",
    "outDir": "static",
    "concurrency": 8,
    "strip": ["meta"],
    "originalContentSource": "static-file",
    "injectDefaults": {
      "original": true,
      "extracted": false,
      "static": true
    }
  }
}
```

## CLI Options

- `--config, -c` - Configuration file path
- `--serve-dir, -s` - Source directory (default: 'dist')
- `--out-dir, -o` - Output directory (default: 'prerendered')
- `--concurrency` - Concurrent pages (default: 5)
- `--strip` - Array of HTML processing modes: 'meta', 'title', 'head', 'body', 'head-except-title', 'dynamic-content'
- `--original-content-source` - How to extract original content: 'static-file' or 'pre-javascript'
- `--cache-original-content` - Cache original content extraction (default: true)
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
  strip: ['meta', 'title'],   // Array of strip modes
  flatOutput: false,          // Flat vs nested structure
  
  // Original content
  originalContentSource: 'static-file', // 'static-file' or 'pre-javascript'
  cacheOriginalContent: true, // Cache original content extraction
  
  // Injection defaults
  injectDefaults: {
    original: true,           // Include original content by default
    extracted: false,         // Include JS-generated content by default
    static: true              // Include config-defined content by default
  },
  
  // Content-specific injection
  inject: {
    meta: {
      static: { 'description': 'My site' },
      extracted: true,
      original: true
    },
    title: {
      static: 'My Site',
      extracted: false,
      original: true
    },
    head: {
      static: '<link rel="canonical" href="https://mysite.com">',
      extracted: false,
      original: true
    },
    body: {
      original: true          // Preserve original body for hydration
    }
  },
  
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

### Array-Based Configuration
Configure multiple strip modes simultaneously:

```javascript
strip: ['meta', 'title', 'head-except-title']
```

### Available Strip Modes

- **`meta`**: Remove meta tags but preserve essential ones (charset, viewport)
- **`title`**: Remove title tag
- **`head`**: Remove entire head section  
- **`body`**: Remove entire body content
- **`head-except-title`**: Remove head content but keep title
- **`dynamic-content`**: Remove dynamically generated content

## Content Injection System

PSS uses a three-source injection system:

### Content Sources

1. **Original**: Content from static files or pre-JavaScript execution
2. **Extracted**: Content generated by JavaScript execution
3. **Static**: Content defined in configuration

### Injection Priority

Content is merged in this order: **original → extracted → static** (later sources override earlier ones)

### Examples

```javascript
// Default behavior: original + static content
{
  injectDefaults: { original: true, extracted: false, static: true }
}

// Include JS-generated meta but use static title
{
  inject: {
    meta: { extracted: true },
    title: { static: 'My Static Title', extracted: false }
  }
}

// Preserve hydration while replacing meta
{
  strip: ['meta'],
  inject: {
    meta: {
      static: { 'description': 'SEO optimized' },
      original: false
    },
    body: {
      original: true // Keep original body structure
    }
  }
}
```

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
    pnpm prerender --concurrency 10 --strip meta title
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

**Hydration issues**
Preserve original content: `--original-content-source static-file`

### Debug Mode

```bash
pss --verbose --dry-run
```

## Architecture

PSS is built as a modular monorepo:

- `@pss/cli` - Command-line interface
- `@pss/core` - Prerendering engine
- `@pss/browser` - Playwright automation with content processing
- `@pss/server` - Static file server
- `@pss/config` - Configuration loading and validation
- `@pss/types` - TypeScript definitions

## License

BSD-3-Clause 