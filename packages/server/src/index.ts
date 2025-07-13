import { existsSync, readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { join } from 'node:path';
import getPort from 'get-port';
import serveStatic from 'serve-static';

export interface ServerOptions {
	serveDir: string;
	port?: number;
	host?: string;
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

	constructor(options: ServerOptions) {
		this.options = options;
	}

	async start(): Promise<ServerInfo> {
		const host = this.options.host || 'localhost';
		const port = this.options.port || (await getPort({ port: 3000 }));

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
			serve(req, res, err => {
				if (err) {
					console.error(`Server error for ${req.url}:`, err);
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
		console.log(`✓ Static server running at ${url}`);
		console.log(`✓ Serving files from: ${this.options.serveDir}`);

		return {
			server: this.server,
			url,
			port,
			host,
		};
	}

	private serveSpaFallback(req: any, res: any): void {
		// Check if this is a request for a static asset
		const url = req.url || '';
		const isStaticAsset = url.includes('.') && !url.endsWith('.html');

		if (isStaticAsset) {
			// For static assets that don't exist, return 404
			res.statusCode = 404;
			res.end('File not found');
			return;
		}

		// For HTML routes, serve index.html (SPA fallback)
		const indexPath = join(this.options.serveDir, 'index.html');

		if (existsSync(indexPath)) {
			try {
				const indexContent = readFileSync(indexPath, 'utf8');
				res.statusCode = 200;
				res.setHeader('Content-Type', 'text/html; charset=utf-8');
				res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
				res.setHeader('Pragma', 'no-cache');
				res.setHeader('Expires', '0');
				res.end(indexContent);
			} catch (error) {
				console.error('Error serving index.html:', error);
				res.statusCode = 500;
				res.end('Internal Server Error');
			}
		} else {
			res.statusCode = 404;
			res.end('File not found');
		}
	}

	async stop(): Promise<void> {
		if (!this.server) {
			return;
		}

		return new Promise<void>((resolve, reject) => {
			this.server?.close(err => {
				if (err) {
					reject(err);
				} else {
					console.log('✓ Static server stopped');
					this.server = null;
					resolve();
				}
			});
		});
	}

	isRunning(): boolean {
		return this.server !== null;
	}
}

// Helper function to create and start server
export async function createStaticServer(options: ServerOptions): Promise<ServerInfo> {
	const server = new StaticServer(options);
	return await server.start();
}
