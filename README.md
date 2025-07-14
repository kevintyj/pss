# PSS (Prerendered Static Site Generator)

A fast, flexible prerendering tool that generates static HTML files from your web applications using Playwright.

## 🚀 Features

- **Fast**: Concurrent page processing with configurable limits
- **Flexible**: Multiple configuration formats and options
- **Type Safe**: Built with TypeScript throughout
- **Modern**: Uses latest Playwright for reliable rendering
- **Modular**: Clean workspace architecture with composable packages
- **Sitemap Support**: Automatic sitemap parsing and route discovery
- **Advanced Content Processing**: Strip and inject content from multiple sources
  - **Strip modes**: Support for arrays: `['meta', 'title', 'head', 'body', 'head-except-title', 'dynamic-content']`
  - **Three content sources**: Original (static/pre-JS), extracted (JS-generated), static (config-defined)
  - **Flexible injection**: Content-specific injection controls with global defaults
  - **Original content preservation**: Maintain hydration-ready structure
- **Advanced Browser Control**: Page timeouts, wait conditions, domain blocking
- **Route-Specific Config**: Different settings per route
- **Non-HTML Outputs**: RSS feeds, JSON feeds, and sitemaps
- **Verbose Logging**: Detailed logging for debugging
- **Special Protocol Support**: Optionally crawl mailto:, tel:, etc. links

## 🔧 Quick Example

```javascript
// pss.config.js - New flexible configuration structure
export default {
  // Array-based strip configuration
  strip: ['body', 'meta'], // Strip body content and meta tags
  
  // Global injection defaults
  injectDefaults: {
    original: true,    // Include original content (from static files)
    extracted: false,  // Don't include JS-generated content by default
    static: true       // Include config-defined content
  },
  
  // Content-specific injection configuration
  inject: {
    meta: {
      static: {
        'description': 'Lightweight prerendered content',
        'og:type': 'website',
        'keywords': 'web,app,static'
      },
      extracted: true,  // Override default: include JS-generated meta
      original: true    // Include original meta from static files
    },
    title: {
      static: 'My App - Static Title',
      extracted: false, // Don't use JS-generated title
      original: true    // Use original title from static files
    },
    head: {
      static: '<link rel="stylesheet" href="/minimal.css">',
      extracted: false, // Don't include JS-generated head content
      original: true    // Include original head content
    },
    body: {
      static: '<div class="loading">Content loading...</div>',
      extracted: false, // Don't include JS-generated body content
      original: true    // Preserve original body for hydration
    }
  },
  
  // Original content extraction settings
  originalContentSource: 'static-file', // or 'pre-javascript'
  cacheOriginalContent: true,
  
  // Route-specific overrides
  routeConfig: [
    {
      route: '/blog/*',
      strip: [], // Keep full content for blog posts
      injectDefaults: { original: true, extracted: true, static: true }
    },
    {
      route: '/api/*',
      strip: ['head', 'body'], // Strip everything except meta and title
      inject: {
        meta: { static: { 'content-type': 'application/json' } }
      }
    }
  ]
};
```

## 📁 Project Structure

This project uses **pnpm workspaces** to organize code into composable packages:

```
pss/
├── packages/                  # All packages
│   ├── types/                # TypeScript types and Zod schemas
│   ├── config/               # Configuration loading and validation
│   ├── server/               # Static file server
│   ├── browser/              # Browser automation with Playwright
│   ├── core/                 # Core prerendering logic
│   ├── cli/                  # CLI interface
│   ├── pss/                  # Main package (re-exports everything)
│   └── solid-example/        # Example Solid.js application
├── .cursor/                  # Cursor AI rules and documentation
├── biome.json                # Biome configuration (linting/formatting)
├── pnpm-workspace.yaml       # pnpm workspace configuration
└── tsconfig.json            # Base TypeScript configuration
```

## 🛠️ Development

### Prerequisites

- Node.js 18+
- pnpm 8+

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd pss

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Install Playwright browsers
npx playwright install
```

### Commands

```bash
# Build all packages
pnpm build

# Run in development mode
pnpm dev

# Format code
pnpm format

# Lint code
pnpm lint

# Auto-fix linting issues
pnpm lint:fix

# Check everything (format + lint)
pnpm check

# CI mode
pnpm ci
```

## 📦 Packages

### Core Packages

- **[@kevintyj/pss-types](./packages/types)** - TypeScript types and Zod schemas
  - Exports: `StripOption`, `ContentSource`, `InjectDefaults`, `ContentInject`, `WaitUntil`, `PSSConfig`, `SnapshotResult`, `CrawlResult`, `RouteConfig`, validation schemas
- **[@kevintyj/pss-config](./packages/config)** - Configuration loading and validation  
  - Exports: `loadConfig()`, `mergeConfigs()`, `validateConfig()`, `ConfigLoadResult`, `ConfigValidator`
- **[@kevintyj/pss-server](./packages/server)** - Static file server functionality
  - Exports: `StaticServer`, `createStaticServer()`, `ServerOptions`, `ServerInfo`
- **[@kevintyj/pss-browser](./packages/browser)** - Browser automation with Playwright
  - Exports: `BrowserManager`, `OriginalContentExtractor`, `ContentMerger`, `takeSnapshot()`, `BrowserOptions`, `SnapshotOptions`
- **[@kevintyj/pss-core](./packages/core)** - Core prerendering engine
  - Exports: `PrerenderEngine`, `prerender()` function
- **[@kevintyj/pss-cli](./packages/cli)** - Command-line interface
  - Exports: `cli()` function with full command-line argument parsing
- **[@kevintyj/pss](./packages/pss)** - Main package that re-exports everything
  - Exports: All exports from all above packages, serves as the main CLI entry point

### Example Applications

- **[solid-example](./packages/solid-example)** - Example Solid.js application for testing PSS

## 🔧 Technologies

- **TypeScript** - All code is written in TypeScript
- **Playwright** - Browser automation for taking page snapshots
- **Zod** - Schema validation for configuration
- **pnpm** - Package manager with workspace support
- **Biome** - Modern linting and formatting tool
- **Node.js** - Runtime environment
- **fast-xml-parser** - XML parsing for sitemap processing

## 📖 Usage

See the [main application README](./packages/pss/README.md) for detailed usage instructions.

### Quick Start

```bash
# Install the main package
pnpm install @kevintyj/pss

# Use with default settings
pss

# Custom configuration with new options
pss --serve-dir build --out-dir static --concurrency 5 --strip meta title
```

### Advanced Usage

```bash
# Array-based strip configuration
pss --strip body meta head --original-content-source static-file

# Content injection with sources
pss --inject-meta '{"description":"My site","keywords":"web,app"}' --inject-head '<link rel="stylesheet" href="custom.css">'

# Browser control
pss --timeout 30000 --wait-until networkidle --block-domains youtube.com googlevideo.com

# Verbose logging
pss --verbose

# Route-specific configuration (via config file)
pss --config pss.config.js
```

## 🏗️ Architecture

PSS follows a modular architecture where each package has a single responsibility:

- **Types** provide compile-time and runtime validation
- **Config** handles loading from multiple sources
- **Server** serves static files during prerendering
- **Browser** manages Playwright for page snapshots
- **Core** orchestrates the entire process
- **CLI** provides the user interface
- **PSS** (main package) re-exports everything and serves as the CLI entry point

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `pnpm test`
5. Format code: `pnpm format`
6. Lint code: `pnpm lint`
7. Commit changes: `git commit -m 'Add amazing feature'`
8. Push to branch: `git push origin feature/amazing-feature`
9. Open a Pull Request

## 📝 Code Style

- **Biome** is configured for consistent formatting and linting
- **Auto-format on save** is enabled in VS Code
- **Import sorting** is automatic
- **Single quotes** for JavaScript/TypeScript
- **2-space indentation**
- **100-character line width**

## 🐛 Troubleshooting

### Common Issues

- **Module not found**: Run `pnpm install` to install dependencies
- **Playwright errors**: Run `npx playwright install` to install browsers
- **Port conflicts**: PSS automatically finds available ports
- **Memory issues**: Reduce concurrency with `--concurrency 2`
- **Timeout errors**: Increase timeout with `--timeout 60000`
- **Sitemap issues**: Check sitemap.xml format and location

### Debug Commands

```bash
# Check workspace dependencies
pnpm list --depth=0

# Rebuild all packages
pnpm build

# Test configuration
pss --dry-run --verbose

# Run with verbose logging
pss --verbose

# Test with longer timeout
pss --timeout 60000 --verbose
```

## 📄 License

BSD-3-Clause

## 🔮 Future Enhancements

See [TODO.md](./TODO.md) for planned features and improvements:

- Advanced crawling strategies
- Performance optimizations
- Better error reporting
- Plugin system
- Enhanced non-HTML outputs 