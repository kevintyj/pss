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
			fallthrough: false,
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

		// Create HTTP server
		this.server = createServer((req, res) => {
			serve(req, res, err => {
				if (err) {
					console.error(`Server error for ${req.url}:`, err);
					res.statusCode = 404;
					res.end('File not found');
				}
			});
		});

		// Start server
		await new Promise<void>((resolve, reject) => {
			this.server!.listen(port, host, (err?: Error) => {
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

	async stop(): Promise<void> {
		if (!this.server) {
			return;
		}

		return new Promise<void>((resolve, reject) => {
			this.server!.close(err => {
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
