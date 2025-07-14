# @pss/browser

Browser automation with Playwright for PSS (Prerendered Static Site Generator).

## Overview

This package provides browser automation capabilities using Playwright to take snapshots of web pages. It's designed to work efficiently with the PSS prerendering system by offering configurable HTML stripping modes, retry logic, and metadata extraction.

## Features

- **Playwright Integration**: Uses Chromium browser for reliable page snapshots
- **HTML Stripping**: Configurable modes to reduce HTML size (`none`, `meta`, `head`)
- **Retry Logic**: Automatic retry with exponential backoff for failed snapshots
- **Metadata Extraction**: Extracts page titles and meta tags
- **Viewport Configuration**: Customizable viewport dimensions
- **Network Idle Waiting**: Waits for network activity to settle before taking snapshots

## Installation

```bash
pnpm add @kevintyj/pss-browser
```

## Usage

### Basic Usage

```typescript
import { takeSnapshot } from '@kevintyj/pss-browser';

// Take a single snapshot
const result = await takeSnapshot('http://localhost:3000');
console.log(result.html);
```

### Advanced Usage with BrowserManager

```typescript
import { BrowserManager } from '@kevintyj/pss-browser';

const browser = new BrowserManager({
  headless: true,
  timeout: 5000,
  viewport: { width: 1920, height: 1080 }
});

await browser.launch();

// Take multiple snapshots efficiently
const snapshot1 = await browser.takeSnapshot({
  url: 'http://localhost:3000',
  stripMode: 'meta',
  extraDelay: 1000
});

const snapshot2 = await browser.takeSnapshot({
  url: 'http://localhost:3000/about',
  stripMode: 'head',
  retry: 3
});

await browser.close();
```

## API Reference

### BrowserManager

#### Constructor Options

```typescript
interface BrowserOptions {
  headless?: boolean;        // Run browser in headless mode (default: true)
  timeout?: number;          // Page load timeout in ms (default: 5000)
  userAgent?: string;        // Custom user agent string
  viewport?: {               // Viewport dimensions
    width: number;           // Default: 1920
    height: number;          // Default: 1080
  };
}
```

#### Methods

- `launch()`: Initialize the browser instance
- `takeSnapshot(options)`: Take a snapshot of a webpage
- `close()`: Close the browser and clean up resources
- `isRunning()`: Check if browser is currently running

### Snapshot Options

```typescript
interface SnapshotOptions {
  url: string;              // URL to take snapshot of
  stripMode?: StripMode;    // HTML stripping mode ('none' | 'meta' | 'head')
  extraDelay?: number;      // Extra delay before taking snapshot (ms)
  retry?: number;           // Number of retry attempts (default: 2)
  retryDelay?: number;      // Delay between retries (ms, default: 1000)
}
```

### Snapshot Result

```typescript
interface SnapshotResult {
  url: string;              // Original URL
  html: string;             // Page HTML content
  title?: string;           // Page title
  meta: Record<string, string>; // Extracted meta tags
  statusCode: number;       // HTTP status code
  timestamp: number;        // Snapshot timestamp
}
```

## Strip Modes

- **`none`**: No HTML modification
- **`meta`**: Remove meta tags except charset, viewport, and Content-Type
- **`head`**: Remove entire head section but keep title tag

## Error Handling

The package includes comprehensive error handling:

- Automatic retry with configurable attempts
- Graceful handling of HTTP errors
- Proper browser resource cleanup
- Detailed error messages for debugging

## Dependencies

- `playwright`: Browser automation
- `@kevintyj/pss-types`: Type definitions

## License

BSD-3-Clause 