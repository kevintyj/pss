# PSS (Prerendered Static Site Generator)

A fast, flexible prerendering tool that generates static HTML files from your web applications using Playwright.

## 🚀 Features

- **Fast**: Concurrent page processing with configurable limits
- **Flexible**: Multiple configuration formats and options
- **Type Safe**: Built with TypeScript throughout
- **Modern**: Uses latest Playwright for reliable rendering
- **Modular**: Clean workspace architecture with composable packages

## 📁 Project Structure

This project uses **pnpm workspaces** to organize code into composable packages:

```
pss/
├── packages/                  # Reusable packages
│   ├── types/                # TypeScript types and Zod schemas
│   ├── config/               # Configuration loading and validation
│   ├── server/               # Static file server
│   ├── browser/              # Browser automation with Playwright
│   ├── core/                 # Core prerendering logic
│   └── cli/                  # CLI interface
├── apps/
│   └── pss/                  # Main application entry point
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

- **[@pss/types](./packages/types)** - TypeScript types and Zod schemas
- **[@pss/config](./packages/config)** - Configuration loading and validation  
- **[@pss/server](./packages/server)** - Static file server functionality
- **[@pss/browser](./packages/browser)** - Browser automation with Playwright
- **[@pss/core](./packages/core)** - Core prerendering engine
- **[@pss/cli](./packages/cli)** - Command-line interface

### Applications

- **[pss](./apps/pss)** - Main CLI application

## 🔧 Technologies

- **TypeScript** - All code is written in TypeScript
- **Playwright** - Browser automation for taking page snapshots
- **Zod** - Schema validation for configuration
- **pnpm** - Package manager with workspace support
- **Biome** - Modern linting and formatting tool
- **Node.js** - Runtime environment

## 📖 Usage

See the [main application README](./apps/pss/README.md) for detailed usage instructions.

### Quick Start

```bash
# Install globally
pnpm install -g pss

# Use with default settings
pss

# Custom configuration
pss --serve-dir build --out-dir static --concurrency 5
```

## 🏗️ Architecture

PSS follows a modular architecture where each package has a single responsibility:

- **Types** provide compile-time and runtime validation
- **Config** handles loading from multiple sources
- **Server** serves static files during prerendering
- **Browser** manages Playwright for page snapshots
- **Core** orchestrates the entire process
- **CLI** provides the user interface

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

### Debug Commands

```bash
# Check workspace dependencies
pnpm list --depth=0

# Rebuild all packages
pnpm build

# Test configuration
pss --dry-run --verbose
```

## 📄 License

ISC

## 🔮 Future Enhancements

See [TODO.md](./TODO.md) for planned features and improvements:

- Non-HTML outputs (RSS, JSON feeds, sitemaps)
- Advanced crawling strategies
- Performance optimizations
- Better error reporting
- Plugin system 