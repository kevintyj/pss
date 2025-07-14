#!/usr/bin/env node
import { loadConfig } from '@kevintyj/pss-config';
import { prerender } from '@kevintyj/pss-core';
import type { PSSConfig } from '@kevintyj/pss-types';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

export async function cli() {
	const argv = await yargs(hideBin(process.argv))
		.scriptName('pss')
		.usage('$0 [options]', 'Prerendered Static Site Generator')
		.option('config', {
			alias: 'c',
			type: 'string',
			description: 'Path to configuration file',
		})
		.option('serve-dir', {
			alias: 's',
			type: 'string',
			description: 'Directory to serve static files from',
			default: 'dist',
		})
		.option('out-dir', {
			alias: 'o',
			type: 'string',
			description: 'Output directory for prerendered files',
			default: 'prerendered',
		})
		.option('concurrency', {
			type: 'number',
			description: 'Number of concurrent pages to process',
			default: 5,
		})
		.option('strip-mode', {
			type: 'string',
			choices: ['none', 'meta', 'head'],
			description: 'HTML stripping mode',
			default: 'none',
		})
		.option('flat-output', {
			type: 'boolean',
			description: 'Use flat file structure instead of nested directories',
			default: false,
		})
		.option('dry-run', {
			type: 'boolean',
			description: 'Show what would be done without actually doing it',
			default: false,
		})
		.option('verbose', {
			alias: 'v',
			type: 'boolean',
			description: 'Enable verbose logging',
			default: false,
		})
		.option('server-url', {
			type: 'string',
			description: 'URL of existing server to use instead of starting a new one',
		})
		.option('server-port', {
			type: 'number',
			description: 'Port of existing server to use',
			default: 3000,
		})
		.option('start-server', {
			type: 'boolean',
			description: 'Whether to start a new server',
			default: true,
		})
		// New injection options
		.option('inject-meta', {
			type: 'string',
			description: 'JSON string of meta tags to inject (e.g., \'{"description":"My site","keywords":"web,app"}\')',
		})
		.option('inject-head', {
			type: 'string',
			description: 'HTML content to inject into head section',
		})
		.option('inject-extracted-meta', {
			type: 'boolean',
			description: 'Inject meta tags that were extracted from the rendered page',
			default: false,
		})
		.option('inject-extracted-head', {
			type: 'boolean',
			description: 'Inject head content that was extracted from the rendered page',
			default: false,
		})
		// Browser and navigation options
		.option('timeout', {
			type: 'number',
			description: 'Page load timeout in milliseconds (see: https://playwright.dev/docs/api/class-frame#frame-goto)',
			default: 30000,
		})
		.option('wait-until', {
			type: 'string',
			choices: ['load', 'domcontentloaded', 'networkidle', 'commit'],
			description:
				'When to consider navigation successful (see: https://playwright.dev/docs/api/class-frame#frame-goto-option-wait-until)',
			default: 'load',
		})
		.option('block-domains', {
			type: 'array',
			description: 'Domains to block during rendering (e.g., youtube.com googlevideo.com)',
			default: [],
		})
		.option('auto-fallback-network-idle', {
			type: 'boolean',
			description: 'Automatically fallback from networkidle to load on timeout',
			default: true,
		})
		.version('1.0.0')
		.help().argv;

	try {
		console.log('🚀 PSS (Prerendered Static Site Generator)');
		console.log('═══════════════════════════════════════════');

		// Load configuration
		const configResult = await loadConfig(argv.config);
		let config = configResult.config;

		// Override config with CLI arguments (only if explicitly provided)
		const cliOverrides: Partial<PSSConfig> = {};
		const originalArgv = process.argv.slice(2);
		const argvString = originalArgv.join(' ');

		if (argvString.includes('--serve-dir') || argvString.includes('-s')) {
			cliOverrides.serveDir = argv.serveDir;
		}
		if (argvString.includes('--out-dir') || argvString.includes('-o')) {
			cliOverrides.outDir = argv.outDir;
		}
		if (argvString.includes('--concurrency')) {
			cliOverrides.concurrency = argv.concurrency;
		}
		if (argvString.includes('--strip-mode')) {
			cliOverrides.stripMode = argv.stripMode as 'none' | 'meta' | 'head';
		}
		if (argvString.includes('--flat-output')) {
			cliOverrides.flatOutput = argv.flatOutput;
		}
		if (argvString.includes('--server-url')) {
			cliOverrides.serverUrl = argv.serverUrl;
		}
		if (argvString.includes('--server-port')) {
			cliOverrides.serverPort = argv.serverPort;
		}
		if (argvString.includes('--start-server')) {
			cliOverrides.startServer = argv.startServer;
		}
		if (argvString.includes('--verbose') || argvString.includes('-v')) {
			cliOverrides.verbose = argv.verbose;
		}

		// Handle injection options
		if (argvString.includes('--inject-meta')) {
			try {
				cliOverrides.injectMeta = JSON.parse(argv.injectMeta || '{}');
			} catch (error) {
				throw new Error(`Invalid JSON for --inject-meta: ${error instanceof Error ? error.message : error}`);
			}
		}
		if (argvString.includes('--inject-head')) {
			cliOverrides.injectHead = argv.injectHead;
		}
		if (argvString.includes('--inject-extracted-meta')) {
			cliOverrides.injectExtractedMeta = argv.injectExtractedMeta;
		}
		if (argvString.includes('--inject-extracted-head')) {
			cliOverrides.injectExtractedHead = argv.injectExtractedHead;
		}

		// Handle browser and navigation options
		if (argvString.includes('--timeout')) {
			cliOverrides.timeout = argv.timeout;
		}
		if (argvString.includes('--wait-until')) {
			cliOverrides.waitUntil = argv.waitUntil as 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
		}
		if (argvString.includes('--block-domains')) {
			cliOverrides.blockDomains = argv.blockDomains as string[];
		}
		if (argvString.includes('--auto-fallback-network-idle')) {
			cliOverrides.autoFallbackNetworkIdle = argv.autoFallbackNetworkIdle;
		}

		// Apply CLI overrides
		config = { ...config, ...cliOverrides };

		// Show configuration
		console.log('📋 Configuration:');
		console.log(`   Source: ${configResult.source}`);
		console.log(`   Serve directory: ${config.serveDir}`);
		console.log(`   Output directory: ${config.outDir}`);
		console.log(`   Concurrency: ${config.concurrency}`);
		console.log(`   Strip mode: ${config.stripMode}`);
		console.log(`   Flat output: ${config.flatOutput}`);
		console.log(`   Start server: ${config.startServer}`);
		console.log(`   Verbose: ${config.verbose}`);
		console.log(`   Timeout: ${config.timeout}ms`);
		console.log(`   Wait until: ${config.waitUntil}`);
		if (config.blockDomains && config.blockDomains.length > 0) {
			console.log(`   Block domains: ${config.blockDomains.join(', ')}`);
		}
		console.log(`   Auto-fallback networkidle: ${config.autoFallbackNetworkIdle}`);
		if (config.crawlSpecialProtocols) {
			console.log(`   Crawl special protocols: ${config.crawlSpecialProtocols}`);
		}
		if (config.serverUrl) {
			console.log(`   Server URL: ${config.serverUrl}`);
		} else if (!config.startServer) {
			console.log(`   Server port: ${config.serverPort}`);
		}
		if (config.injectMeta && Object.keys(config.injectMeta).length > 0) {
			console.log(`   Inject meta: ${Object.keys(config.injectMeta).length} tags`);
		}
		if (config.injectHead) {
			console.log(`   Inject head: ${config.injectHead.substring(0, 50)}${config.injectHead.length > 50 ? '...' : ''}`);
		}
		if (config.injectExtractedMeta) {
			console.log(`   Inject extracted meta: true`);
		}
		if (config.injectExtractedHead) {
			console.log(`   Inject extracted head: true`);
		}
		console.log(`   Routes: ${config.routes.length > 0 ? config.routes.join(', ') : 'Auto-detect from /'}`);
		console.log();

		if (argv.dryRun) {
			console.log('🔍 Dry run mode - no files will be written');
			console.log('✅ Configuration validation passed');
			return;
		}

		// Run prerendering
		const result = await prerender(config);

		// Show results
		console.log();
		console.log('📊 Results:');
		console.log(`   Pages processed: ${result.snapshots.length}`);
		console.log(`   Output directory: ${config.outDir}`);
		console.log(`   Total time: ${result.stats.crawlTime}ms`);
		console.log();

		if (result.snapshots.length > 0) {
			console.log('📄 Generated pages:');
			for (const snapshot of result.snapshots) {
				console.log(`   • ${snapshot.url} → ${snapshot.url}`);
			}
		}

		console.log();
		console.log('✅ Prerendering completed successfully!');
	} catch (error) {
		console.error('❌ Error:', error instanceof Error ? error.message : error);
		process.exit(1);
	}
}

// Only run CLI if this script is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	cli().catch(error => {
		console.error('❌ Error:', error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
