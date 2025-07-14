# @pss/server

A static file server designed specifically for PSS (Prerendered Static Site Generator) that serves static files during the prerendering process.

## Overview

The `@pss/server` package provides a lightweight HTTP server that serves static files with built-in SPA (Single Page Application) fallback support. It's designed to work seamlessly with the PSS prerendering workflow, providing a local development server that can serve your static assets while Playwright crawls and prerenders your pages.

## Features

- **Static File Serving**: Serves static files from a specified directory
- **SPA Fallback**: Automatically serves `index.html` for routes that don't match static files
- **Automatic Port Allocation**: Uses `get-port` to automatically find available ports
- **Development-Friendly Headers**: Disables caching for development builds
- **Graceful Shutdown**: Proper cleanup and shutdown handling
- **TypeScript Support**: Full TypeScript support with type definitions

## Installation

```bash
pnpm add @pss/server
```

## Usage

### Basic Usage

```typescript
import { StaticServer } from '@pss/server';

const server = new StaticServer({
  serveDir: './dist',
  port: 3000,
  host: 'localhost'
});

const serverInfo = await server.start();
console.log(`Server running at ${serverInfo.url}`);

// Later, when done...
await server.stop();
```

### Helper Function

```typescript
import { createStaticServer } from '@pss/server';

const serverInfo = await createStaticServer({
  serveDir: './build',
  port: 8080
});

console.log(`Server started at ${serverInfo.url}`);
```

## API Reference

### `StaticServer`

Main server class that handles static file serving.

#### Constructor

```typescript
new StaticServer(options: ServerOptions)
```

#### Methods

- `start(): Promise<ServerInfo>` - Starts the server and returns server information
- `stop(): Promise<void>` - Stops the server gracefully
- `isRunning(): boolean` - Returns whether the server is currently running

### Types

#### `ServerOptions`

```typescript
interface ServerOptions {
  serveDir: string;    // Directory to serve static files from
  port?: number;       // Port to bind to (auto-allocated if not specified)
  host?: string;       // Host to bind to (defaults to 'localhost')
}
```

#### `ServerInfo`

```typescript
interface ServerInfo {
  server: Server;      // Node.js HTTP server instance
  url: string;         // Full URL of the server (e.g., 'http://localhost:3000')
  port: number;        // Actual port the server is running on
  host: string;        // Host the server is bound to
}
```

## SPA Fallback Behavior

The server includes intelligent SPA fallback logic:

1. **Static Assets**: Files with extensions (like `.js`, `.css`, `.png`) are served directly
2. **HTML Routes**: Routes without extensions or ending in `.html` fall back to `index.html`
3. **404 Handling**: Missing static assets return 404, while missing HTML routes serve the SPA fallback

## Integration with PSS

This server is automatically used by the PSS core engine during prerendering:

```typescript
// In PSS core
const server = new StaticServer({
  serveDir: config.serveDir,
  port: config.serverPort,
});

const serverInfo = await server.start();
// Playwright then crawls pages from serverInfo.url
```

## Configuration

The server can be configured through the PSS configuration system:

```javascript
// pss.config.js
export default {
  serveDir: './dist',
  serverPort: 3000,
  startServer: true,  // Whether PSS should start its own server
  serverUrl: null,    // Use existing server instead of starting new one
};
```

## Development Headers

The server automatically sets development-friendly HTTP headers:

- `Cache-Control: no-cache, no-store, must-revalidate`
- `Pragma: no-cache`
- `Expires: 0`
- `Content-Type: text/html; charset=utf-8` (for HTML files)

## Error Handling

The server includes comprehensive error handling:

- Server startup errors are properly propagated
- File serving errors are logged and return appropriate HTTP status codes
- Graceful shutdown handles cleanup of resources

## Example Use Cases

### Development Server
```typescript
const server = new StaticServer({
  serveDir: './public',
  port: 3000
});

await server.start();
// Your development server is now running
```

### Testing Environment
```typescript
const server = new StaticServer({
  serveDir: './test-fixtures'
});

const { url } = await server.start();
// Run tests against the server
await runTests(url);
await server.stop();
```

### PSS Integration
```typescript
// This happens automatically in PSS core
const server = new StaticServer({
  serveDir: config.serveDir,
  port: config.serverPort
});

const serverInfo = await server.start();
// Playwright crawls from serverInfo.url
```

## Dependencies

- `get-port`: Automatic port allocation
- `serve-static`: Static file serving middleware
- `@pss/types`: Type definitions for PSS

## Contributing

This package is part of the PSS monorepo. See the main project README for contribution guidelines.

## License

BSD-3-Clause
