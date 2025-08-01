#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { loadConfig } from '@kevintyj/pss-config';
import { prerender } from '@kevintyj/pss-core';
import type { PSSConfig } from '@kevintyj/pss-types';

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
		.option('strip', {
			type: 'array',
			description: 'HTML stripping modes (meta, title, head, body, head-except-title, dynamic-content)',
			default: [],
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
		// Original content source options
		.option('original-content-source', {
			type: 'string',
			choices: ['static-file', 'pre-javascript'],
			description: 'Source for original content extraction',
			default: 'static-file',
		})
		.option('cache-original-content', {
			type: 'boolean',
			description: 'Cache original content across routes',
			default: true,
		})
		// Browser and navigation options
		.option('timeout', {
			type: 'number',
			description: 'Page load timeout in milliseconds (see: https://playwright.dev/docs/api/class-frame#frame-goto)',
			default: 5000,
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
		.version('0.0.0')
		.help().argv;

	let config: PSSConfig | undefined;

	try {
		console.log('🚀 PSS (Prerendered Static Site Generator)');
		console.log('═══════════════════════════════════════════');

		// Load configuration
		const configResult = await loadConfig(argv.config);
		config = configResult.config;

		// Override config with CLI arguments (only if explicitly provided)
		const cliOverrides: Partial<PSSConfig> = {};
		const originalArgv = process.argv.slice(2);
		const argvString = originalArgv.join(' ');

		// Helper function to check if argument was provided
		const hasArg = (arg: string, shortArg?: string): boolean => {
			return argvString.includes(`--${arg}`) || (shortArg ? argvString.includes(`-${shortArg}`) : false);
		};

		// Basic options
		if (hasArg('serve-dir', 's')) cliOverrides.serveDir = argv.serveDir;
		if (hasArg('out-dir', 'o')) cliOverrides.outDir = argv.outDir;
		if (hasArg('concurrency')) cliOverrides.concurrency = argv.concurrency;
		if (hasArg('strip')) cliOverrides.strip = argv.strip as PSSConfig['strip'];
		if (hasArg('flat-output')) cliOverrides.flatOutput = argv.flatOutput;
		if (hasArg('verbose', 'v')) cliOverrides.verbose = argv.verbose;

		// Server options
		if (hasArg('server-url')) cliOverrides.serverUrl = argv.serverUrl;
		if (hasArg('server-port')) cliOverrides.serverPort = argv.serverPort;
		if (hasArg('start-server')) cliOverrides.startServer = argv.startServer;

		// Content options
		if (hasArg('original-content-source'))
			cliOverrides.originalContentSource = argv.originalContentSource as PSSConfig['originalContentSource'];
		if (hasArg('cache-original-content') && typeof argv.cacheOriginalContent === 'boolean')
			cliOverrides.cacheOriginalContent = argv.cacheOriginalContent;

		// Browser options
		if (hasArg('timeout')) cliOverrides.timeout = argv.timeout;
		if (hasArg('wait-until')) cliOverrides.waitUntil = argv.waitUntil as PSSConfig['waitUntil'];
		if (hasArg('block-domains')) cliOverrides.blockDomains = argv.blockDomains as string[];
		if (hasArg('auto-fallback-network-idle')) cliOverrides.autoFallbackNetworkIdle = argv.autoFallbackNetworkIdle;

		// Apply CLI overrides
		config = { ...config, ...cliOverrides };

		// Show configuration
		const showConfig = (config: PSSConfig, source: string) => {
			console.log('📋 Configuration:');
			console.log(`   Source: ${source}`);
			console.log(`   Serve directory: ${config.serveDir}`);
			console.log(`   Output directory: ${config.outDir}`);
			console.log(`   Concurrency: ${config.concurrency}`);
			console.log(`   Strip modes: ${config.strip.join(', ') || 'none'}`);
			console.log(`   Flat output: ${config.flatOutput}`);
			console.log(`   Start server: ${config.startServer}`);
			console.log(`   Verbose: ${config.verbose}`);
			console.log(`   Original content source: ${config.originalContentSource}`);
			console.log(`   Cache original content: ${config.cacheOriginalContent}`);
			console.log(`   Timeout: ${config.timeout}ms`);
			console.log(`   Wait until: ${config.waitUntil}`);

			if (config.blockDomains?.length > 0) {
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

			// Show injection configuration
			const hasInjectConfig =
				config.inject &&
				Object.keys(config.inject).some(key => {
					const contentConfig = config.inject?.[key as keyof typeof config.inject];
					return contentConfig && (contentConfig.static || contentConfig.original || contentConfig.extracted);
				});
			if (hasInjectConfig) {
				console.log(`   Injection configured: ${Object.keys(config.inject!).join(', ')}`);
			}
		};

		showConfig(config, configResult.source);

		console.log('');

		// Perform dry run if requested
		if (argv.dryRun) {
			console.log('🔍 Dry run mode - showing what would be done:');
			console.log('   • Load and parse routes');
			console.log('   • Start static server');
			console.log('   • Initialize browser');
			console.log('   • Process routes with configured options');
			console.log('   • Write HTML files to output directory');
			console.log('   • Generate sitemap and feeds');
			console.log('✅ Dry run complete - no files were actually processed');
			return;
		}

		// Start prerendering
		const result = await prerender(config);

		// Show results
		console.log('');
		console.log('📊 Prerendering Results:');
		console.log(`   Total pages: ${result.stats.totalPages}`);
		console.log(`   Total assets: ${result.stats.totalAssets}`);
		console.log(`   Failed assets: ${result.stats.failedAssets}`);
		console.log(`   Processing time: ${(result.stats.crawlTime / 1000).toFixed(2)}s`);

		if (result.brokenLinks.length > 0) {
			console.log(`   Broken links: ${result.brokenLinks.length}`);
			if (config.verbose) {
				console.log('\n🔗 Broken Links:');
				result.brokenLinks.forEach(link => {
					console.log(`   • ${link.url} (${link.statusCode}) - Referenced from: ${link.referrer}`);
				});
			}
		}

		console.log('');
		console.log('✅ Prerendering completed successfully!');
		console.log(`📁 Output directory: ${config.outDir}`);
		console.log(`🌐 View your prerendered site files in the output directory`);
	} catch (error) {
		console.error('');
		console.error('❌ Prerendering failed:');

		if (error instanceof Error) {
			console.error(`   ${error.message}`);
			if (config?.verbose && error.stack) {
				console.error('\n🔍 Stack trace:');
				console.error(error.stack);
			}
		} else {
			console.error(`   ${error}`);
		}

		console.error('');
		console.error('💡 Troubleshooting tips:');
		console.error('   • Check that your serve directory exists and contains files');
		console.error('   • Verify your configuration file is valid');
		console.error('   • Use --verbose for more detailed error information');
		console.error('   • Check the GitHub repository for known issues');

		process.exit(1);
	}
}

// Only run CLI if this script is being executed directly
if (
	import.meta.url &&
	process.argv[1] &&
	(import.meta.url === `file://${process.argv[1]}` ||
		import.meta.url.endsWith('cli/dist/index.js') ||
		import.meta.url.endsWith('cli/src/index.ts'))
) {
	cli().catch(error => {
		console.error('❌ Error:', error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
