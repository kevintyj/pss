# PSS Solid.js Example

This is an example Solid.js application for testing PSS (Prerendered Static Site Generator) functionality.

## Purpose

This example demonstrates how PSS can prerender a Solid.js application with:

- **Static File Generation**: Convert dynamic routes to static HTML files
- **Original Content Preservation**: Maintain hydration-ready structure
- **Content Injection**: Add meta tags, head content, and other optimizations
- **Route Discovery**: Automatic crawling of application routes

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Build the Application

```bash
pnpm run build
```

### 3. Test PSS Prerendering

From the project root, run:

```bash
# Basic prerendering
pnpm dev

# Or with custom configuration
pss --serve-dir packages/solid-example/dist --out-dir packages/solid-example/prerendered --verbose
```

## Configuration

The example includes a `pss.config.js` file with optimized settings:

- **Static File Source**: Uses built files from `dist/` directory
- **Original Content**: Preserves hydration structure
- **Content Injection**: Adds meta tags and optimizations
- **Strip Configuration**: Removes unnecessary content for optimization

## Development

### Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build

### Testing with PSS

This example is used by the PSS development team to test:

- Different rendering scenarios
- Content injection capabilities
- Route discovery mechanisms
- Performance optimizations

## Learn More

- [PSS Documentation](../../README.md)
- [Solid.js Website](https://solidjs.com)
- [Solid.js Discord](https://discord.com/invite/solidjs)
