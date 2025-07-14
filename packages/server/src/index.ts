import { existsSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import getPort from 'get-port';
import serveStatic from 'serve-static';

export interface ServerOptions {
	serveDir: string;
	port?: number;
	host?: string;
	verbose?: boolean;
}

export interface ServerInfo {
	server: Server;
	url: string;
	port: number;
	host: string;
}

export class StaticServer {
	private server: Server | null = null;
	private options: ServerOptions;
	private verbose: boolean;

	constructor(options: ServerOptions) {
		this.options = options;
		this.verbose = options.verbose || false;
	}

	// Normal logging (always shown)
	private log(message: string) {
		console.log(message);
	}

	// Verbose logging (only shown when verbose is true)
	private verboseLog(message: string) {
		if (this.verbose) {
			console.log(`[VERBOSE] ${message}`);
		}
	}

	async start(): Promise<ServerInfo> {
		const host = this.options.host || 'localhost';
		const port = this.options.port || (await getPort({ port: 3000 }));

		this.verboseLog(`Starting server with options: ${JSON.stringify(this.options, null, 2)}`);
		this.verboseLog(`Server directory: ${this.options.serveDir}`);
		this.verboseLog(`Directory exists: ${existsSync(this.options.serveDir)}`);

		// Create static file server
		const serve = serveStatic(this.options.serveDir, {
			index: ['index.html'],
			fallthrough: true, // Enable fallthrough for SPA routing
			setHeaders: (res, path) => {
				// Set proper headers for static files
				if (path.endsWith('.html')) {
					res.setHeader('Content-Type', 'text/html; charset=utf-8');
				}
				// Disable caching for development
				res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
				res.setHeader('Pragma', 'no-cache');
				res.setHeader('Expires', '0');
			},
		});

		// Create HTTP server with SPA fallback
		this.server = createServer((req, res) => {
			if (this.verbose) {
				this.verboseLog(`Request: ${req.method} ${req.url}`);
			}

			serve(req, res, err => {
				if (err) {
					console.error(`Server error for ${req.url}:`, err);
					this.verboseLog(`Server error details: ${err.message}`);
					res.statusCode = 404;
					res.end('File not found');
				} else {
					// SPA fallback: serve index.html for routes that don't match files
					this.serveSpaFallback(req, res);
				}
			});
		});

		// Start server
		await new Promise<void>((resolve, reject) => {
			this.server?.listen(port, host, (err?: Error) => {
				if (err) {
					reject(err);
				} else {
					resolve();
				}
			});
		});

		const url = `http://${host}:${port}`;
		this.log(`✓ Static server running at ${url}`);
		this.log(`✓ Serving files from: ${this.options.serveDir}`);
		this.verboseLog(`Server bound to: ${host}:${port}`);
		this.verboseLog(`Server process ID: ${process.pid}`);

		return {
			server: this.server,
			url,
			port,
			host,
		};
	}

	private serveSpaFallback(req: any, res: any): void {
		const url = req.url || '/';

		// Skip API routes and files with extensions
		if (url.startsWith('/api/') || url.includes('.')) {
			this.verboseLog(`Skipping SPA fallback for: ${url}`);
			res.statusCode = 404;
			res.end('File not found');
			return;
		}

		// Serve index.html for SPA routes
		const indexPath = join(this.options.serveDir, 'index.html');
		if (existsSync(indexPath)) {
			this.verboseLog(`SPA fallback: serving index.html for ${url}`);
			try {
				const content = readFileSync(indexPath, 'utf8');
				res.setHeader('Content-Type', 'text/html; charset=utf-8');
				res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
				res.setHeader('Pragma', 'no-cache');
				res.setHeader('Expires', '0');
				res.statusCode = 200;
				res.end(content);
			} catch (error) {
				this.verboseLog(`Error reading index.html: ${error}`);
				res.statusCode = 500;
				res.end('Internal Server Error');
			}
		} else {
			this.verboseLog(`No index.html found for SPA fallback: ${indexPath}`);
			res.statusCode = 404;
			res.end('File not found');
		}
	}

	async stop(): Promise<void> {
		if (this.server) {
			await new Promise<void>((resolve, reject) => {
				this.server?.close((err?: Error) => {
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				});
			});
			this.server = null;
			this.log('✓ Static server stopped');
			this.verboseLog('Server shutdown complete');
		}
	}

	isRunning(): boolean {
		return this.server !== null;
	}
}

// Helper function to create and start a server
export async function createStaticServer(options: ServerOptions): Promise<ServerInfo> {
	const server = new StaticServer(options);
	return await server.start();
}
