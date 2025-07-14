#!/usr/bin/env node

import { execSync } from 'node:child_process';

interface BuildGroup {
	name: string;
	packages: string[];
	description: string;
	parallel?: boolean;
}

interface PackageBuildResult {
	name: string;
	success: boolean;
	duration: number;
}

interface BuildGroupResult {
	name: string;
	builtPackages: PackageBuildResult[];
	skippedPackages: string[];
	duration: number;
}

interface BuildSummary {
	startTime: number;
	endTime?: number;
	totalPackages: number;
	builtPackages: PackageBuildResult[];
	skippedPackages: string[];
	buildGroups: BuildGroupResult[];
}

// Build order based on dependencies - core moved to be built right after types
const BUILD_ORDER: BuildGroup[] = [
	{
		name: 'Foundation',
		packages: ['types'],
		description: 'Core types and schemas - foundation for all other packages',
		parallel: false,
	},
	{
		name: 'Services',
		packages: ['config', 'browser', 'server'],
		description: 'Independent services that extend core functionality',
		parallel: true,
	},
	{
		name: 'Core Engine',
		packages: ['core'],
		description: 'Core prerendering engine',
		parallel: false,
	},
	{
		name: 'Applications',
		packages: ['cli', 'pss'],
		description: 'CLI and main package that provide user interfaces',
		parallel: true,
	},
];

class BuildManager {
	private colors = {
		reset: '\x1b[0m',
		bright: '\x1b[1m',
		dim: '\x1b[2m',
		green: '\x1b[32m',
		yellow: '\x1b[33m',
		blue: '\x1b[34m',
		red: '\x1b[31m',
		cyan: '\x1b[36m',
	};

	private log = {
		info: (msg: string) => console.log(`${this.colors.blue}ℹ${this.colors.reset} ${msg}`),
		success: (msg: string) => console.log(`${this.colors.green}✓${this.colors.reset} ${msg}`),
		warn: (msg: string) => console.log(`${this.colors.yellow}⚠${this.colors.reset} ${msg}`),
		error: (msg: string) => console.log(`${this.colors.red}✗${this.colors.reset} ${msg}`),
		step: (msg: string) => console.log(`${this.colors.cyan}→${this.colors.reset} ${msg}`),
	};

	private formatDuration(ms: number): string {
		if (ms < 1000) return `${Math.round(ms)}ms`;
		const seconds = ms / 1000;
		if (seconds < 60) return `${seconds.toFixed(1)}s`;
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
	}

	private displayBuildSummary(summary: BuildSummary): void {
		const duration = summary.endTime ? summary.endTime - summary.startTime : 0;

		console.log(`\n${this.colors.bright}📊 Build Summary${this.colors.reset}`);
		console.log(`${this.colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${this.colors.reset}`);

		// Overall stats
		console.log(`${this.colors.cyan}⏱️  Total time:${this.colors.reset} ${this.formatDuration(duration)}`);
		console.log(`${this.colors.cyan}📦 Total packages:${this.colors.reset} ${summary.totalPackages}`);
		console.log(`${this.colors.green}✅ Built packages:${this.colors.reset} ${summary.builtPackages.length}`);

		if (summary.skippedPackages.length > 0) {
			console.log(`${this.colors.yellow}⏭️  Skipped packages:${this.colors.reset} ${summary.skippedPackages.length}`);
		}

		// Group breakdown
		console.log(`\n${this.colors.bright}📋 Build Groups:${this.colors.reset}`);
		summary.buildGroups.forEach((group, index) => {
			const groupIcon = index === 0 ? '🔧' : index === 1 ? '⚙️' : index === 2 ? '📝' : '🚀';
			console.log(
				`  ${groupIcon} ${this.colors.bright}${group.name}${this.colors.reset} (${this.formatDuration(group.duration)})`
			);

			if (group.builtPackages.length > 0) {
				group.builtPackages.forEach(pkg => {
					console.log(
						`    ${this.colors.green}✓${this.colors.reset} ${pkg.name} ${this.colors.dim}(${this.formatDuration(pkg.duration)})${this.colors.reset}`
					);
				});
			}

			if (group.skippedPackages.length > 0) {
				console.log(`    ${this.colors.yellow}⏭${this.colors.reset} Skipped: ${group.skippedPackages.join(', ')}`);
			}
		});

		// Package details with individual timing
		if (summary.builtPackages.length > 0) {
			console.log(`\n${this.colors.bright}🔨 Built Packages (Individual Timing):${this.colors.reset}`);

			// Sort packages by build time (slowest first)
			const sortedPackages = [...summary.builtPackages].sort((a, b) => b.duration - a.duration);

			sortedPackages.forEach(pkg => {
				const timeColor =
					pkg.duration > 5000 ? this.colors.red : pkg.duration > 2000 ? this.colors.yellow : this.colors.green;
				console.log(
					`  ${pkg.name} ${this.colors.dim}(pnpm + tsc types)${this.colors.reset} - ${timeColor}${this.formatDuration(pkg.duration)}${this.colors.reset}`
				);
			});

			// Build time statistics
			const buildTimes = summary.builtPackages.map(p => p.duration);
			const avgTime = buildTimes.reduce((sum, time) => sum + time, 0) / buildTimes.length;
			const maxTime = Math.max(...buildTimes);
			const minTime = Math.min(...buildTimes);

			console.log(`\n${this.colors.bright}📈 Build Statistics:${this.colors.reset}`);
			console.log(`  ${this.colors.cyan}Average:${this.colors.reset} ${this.formatDuration(avgTime)}`);
			console.log(`  ${this.colors.cyan}Fastest:${this.colors.reset} ${this.formatDuration(minTime)}`);
			console.log(`  ${this.colors.cyan}Slowest:${this.colors.reset} ${this.formatDuration(maxTime)}`);
		}

		console.log(`${this.colors.bright}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${this.colors.reset}`);
		console.log(`${this.colors.bright}✨ Build completed successfully!${this.colors.reset}\n`);
	}

	async buildPackage(packageName: string): Promise<PackageBuildResult> {
		const startTime = Date.now();
		this.log.step(`Building ${packageName}...`);

		try {
			execSync(`pnpm --filter ./packages/${packageName} run build`, {
				stdio: 'inherit',
				cwd: process.cwd(),
			});

			const duration = Date.now() - startTime;
			this.log.success(
				`${packageName} built successfully ${this.colors.dim}(${this.formatDuration(duration)})${this.colors.reset}`
			);
			return { name: packageName, success: true, duration };
		} catch (error) {
			const duration = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.log.error(`Failed to build ${packageName}: ${errorMessage}`);
			return { name: packageName, success: false, duration };
		}
	}

	async buildGroup(group: BuildGroup): Promise<BuildGroupResult> {
		const groupStartTime = Date.now();

		this.log.info(`${this.colors.bright}Building ${group.name}${this.colors.reset}`);
		this.log.info(`${this.colors.dim}${group.description}${this.colors.reset}`);

		const builtPackages: PackageBuildResult[] = [];
		const skippedPackages: string[] = [];

		if (group.parallel) {
			// Build packages in parallel
			const promises = group.packages.map(pkg => this.buildPackage(pkg));
			const results = await Promise.all(promises);

			const failed = results.filter(r => !r.success);
			if (failed.length > 0) {
				throw new Error(`${failed.length} packages failed to build: ${failed.map(p => p.name).join(', ')}`);
			}

			builtPackages.push(...results);
		} else {
			// Build packages sequentially
			for (const packageName of group.packages) {
				const result = await this.buildPackage(packageName);
				if (!result.success) {
					throw new Error(`Package ${packageName} failed to build`);
				}
				builtPackages.push(result);
			}
		}

		const duration = Date.now() - groupStartTime;
		this.log.success(`${group.name} completed successfully`);

		return {
			name: group.name,
			builtPackages,
			skippedPackages,
			duration,
		};
	}

	async build(): Promise<void> {
		console.log(`${this.colors.bright}🏗️  PSS Monorepo Build Tool${this.colors.reset}\n`);

		const buildSummary: BuildSummary = {
			startTime: Date.now(),
			totalPackages: 0,
			builtPackages: [],
			skippedPackages: [],
			buildGroups: [],
		};

		this.log.info('Starting PSS monorepo build...');

		for (const group of BUILD_ORDER) {
			const groupResult = await this.buildGroup(group);
			buildSummary.buildGroups.push(groupResult);
			buildSummary.builtPackages.push(...groupResult.builtPackages);
			buildSummary.skippedPackages.push(...groupResult.skippedPackages);
			console.log(); // spacing
		}

		buildSummary.endTime = Date.now();
		buildSummary.totalPackages = buildSummary.builtPackages.length + buildSummary.skippedPackages.length;

		this.displayBuildSummary(buildSummary);
	}

	async clean(): Promise<void> {
		this.log.info('Cleaning all build artifacts...');

		const packages = ['types', 'config', 'browser', 'server', 'core', 'cli', 'pss'];
		for (const pkg of packages) {
			try {
				execSync(`rm -rf packages/${pkg}/dist`, { stdio: 'inherit' });
				this.log.success(`Cleaned ${pkg}`);
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				this.log.error(`Failed to clean ${pkg}: ${errorMessage}`);
			}
		}
	}
}

async function main() {
	const builder = new BuildManager();
	const command = process.argv[2] || 'build';

	try {
		switch (command) {
			case 'build':
				await builder.build();
				break;
			case 'clean':
				await builder.clean();
				break;
			default:
				console.log('Usage: bun scripts/build.ts [build|clean]');
				process.exit(1);
		}
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error('Build failed:', errorMessage);
		process.exit(1);
	}
}

// Handle script interruption
process.on('SIGINT', () => {
	console.log('\n⚠️  Build interrupted by user');
	process.exit(130);
});

process.on('SIGTERM', () => {
	console.log('\n⚠️  Build terminated');
	process.exit(143);
});

main();
