import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { type PSSConfig, PSSConfigSchema } from '@kevintyj/pss-types';

const CONFIG_FILES = [
	'pss.config.js',
	'pss.config.ts',
	'pss.config.mjs',
	'pss.config.cjs',
	'pss.config.json',
	'.pssrc.json',
	'.pssrc.js',
];

export interface ConfigLoadResult {
	config: PSSConfig;
	source: string;
	path: string;
}

export async function loadConfig(configPath?: string, cwd: string = process.cwd()): Promise<ConfigLoadResult> {
	let configFile: string | undefined;
	let configSource: string = 'defaults';

	// If explicit path provided, use it
	if (configPath) {
		configFile = resolve(cwd, configPath);
		configSource = configPath;
	} else {
		// Discovery: search for config files
		const discovered = await discoverConfigFile(cwd);
		if (discovered) {
			configFile = discovered.path;
			configSource = discovered.filename;
		}
	}

	let userConfig: Partial<PSSConfig> = {};

	// Load configuration from file
	if (configFile) {
		try {
			userConfig = await loadConfigFile(configFile);
			console.log(`✓ Loaded configuration from ${configSource}`);
		} catch (error) {
			throw new Error(`Failed to load config from ${configSource}: ${error}`);
		}
	} else {
		console.log('No config file found, using defaults');
	}

	// Check package.json for pss field
	const packageJsonConfig = await loadPackageJsonConfig(cwd);
	if (packageJsonConfig) {
		userConfig = { ...packageJsonConfig, ...userConfig };
		console.log('✓ Merged configuration from package.json');
	}

	// Validate and apply defaults
	const validatedConfig = PSSConfigSchema.parse(userConfig);

	return {
		config: validatedConfig,
		source: configSource,
		path: configFile || join(cwd, 'package.json'),
	};
}

async function discoverConfigFile(cwd: string): Promise<{ path: string; filename: string } | null> {
	for (const filename of CONFIG_FILES) {
		const filepath = join(cwd, filename);
		try {
			await fs.access(filepath);
			return { path: filepath, filename };
		} catch {
			// Continue to next file
		}
	}
	return null;
}

async function loadConfigFile(filepath: string): Promise<Partial<PSSConfig>> {
	const ext = filepath.split('.').pop()?.toLowerCase();

	switch (ext) {
		case 'json':
			return await loadJsonConfig(filepath);
		case 'js':
		case 'mjs':
		case 'cjs':
		case 'ts':
			return await loadJsConfig(filepath);
		default:
			throw new Error(`Unsupported config file format: ${ext}`);
	}
}

async function loadJsonConfig(filepath: string): Promise<Partial<PSSConfig>> {
	const content = await fs.readFile(filepath, 'utf8');
	try {
		return JSON.parse(content);
	} catch (error) {
		throw new Error(`Invalid JSON in config file: ${error}`);
	}
}

async function loadJsConfig(filepath: string): Promise<Partial<PSSConfig>> {
	try {
		// Convert to file URL for import
		const fileUrl = pathToFileURL(filepath).href;
		const module = await import(fileUrl);

		// Handle both default export and named export
		const config = module.default || module.config || module;

		// If it's a function, call it
		if (typeof config === 'function') {
			return await config();
		}

		return config;
	} catch (error) {
		throw new Error(`Failed to load JS config: ${error}`);
	}
}

async function loadPackageJsonConfig(cwd: string): Promise<Partial<PSSConfig> | null> {
	const packageJsonPath = join(cwd, 'package.json');

	try {
		const content = await fs.readFile(packageJsonPath, 'utf8');
		const packageJson = JSON.parse(content);

		return packageJson.pss || null;
	} catch {
		return null;
	}
}

export function mergeConfigs(baseConfig: Partial<PSSConfig>, overrideConfig: Partial<PSSConfig>): Partial<PSSConfig> {
	const merged = { ...baseConfig };

	for (const [key, value] of Object.entries(overrideConfig)) {
		if (value !== undefined) {
			if (key === 'exclude' && Array.isArray(value) && Array.isArray(merged.exclude)) {
				// Merge exclude patterns
				merged.exclude = [...merged.exclude, ...value];
			} else if (key === 'nonHtml' && typeof value === 'object' && typeof merged.nonHtml === 'object') {
				// Merge nonHtml options
				merged.nonHtml = { ...merged.nonHtml, ...value };
			} else if (key === 'author' && typeof value === 'object' && typeof merged.author === 'object') {
				// Merge author info
				merged.author = { ...merged.author, ...value };
			} else {
				// Direct override
				(merged as any)[key] = value;
			}
		}
	}

	return merged;
}

export function validateConfig(config: unknown): PSSConfig {
	try {
		return PSSConfigSchema.parse(config);
	} catch (error) {
		if (error instanceof Error) {
			throw new Error(`Configuration validation failed: ${error.message}`);
		}
		throw error;
	}
}
