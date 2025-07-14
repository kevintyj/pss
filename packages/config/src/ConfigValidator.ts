import type { PSSConfig } from '@kevintyj/pss-types';

export interface ValidationResult {
	isValid: boolean;
	errors: string[];
	warnings: string[];
}

export class ConfigValidator {
	private config: PSSConfig;

	constructor(config: PSSConfig) {
		this.config = config;
	}

	validate(): ValidationResult {
		const errors: string[] = [];
		const warnings: string[] = [];

		// Validate strip/inject conflicts
		this.validateStripInjectConflicts(errors, warnings);

		// Validate content source requirements
		this.validateContentSourceRequirements(errors, warnings);

		// Validate route configuration
		this.validateRouteConfiguration(errors, warnings);

		// Validate browser options
		this.validateBrowserOptions(errors, warnings);

		// Validate output options
		this.validateOutputOptions(errors, warnings);

		return {
			isValid: errors.length === 0,
			errors,
			warnings,
		};
	}

	private validateStripInjectConflicts(_errors: string[], warnings: string[]): void {
		const strip = this.config.strip || [];
		const inject = this.config.inject || {};

		// Check for conflicting strip and inject combinations
		for (const stripMode of strip) {
			switch (stripMode) {
				case 'meta':
					if (inject.meta?.original || inject.meta?.extracted) {
						warnings.push(
							`Strip mode 'meta' will remove meta tags, but inject.meta.original or inject.meta.extracted is enabled. Consider using inject.meta.static instead.`
						);
					}
					break;

				case 'title':
					if (inject.title?.original || inject.title?.extracted) {
						warnings.push(
							`Strip mode 'title' will remove title tags, but inject.title.original or inject.title.extracted is enabled. Consider using inject.title.static instead.`
						);
					}
					break;

				case 'head':
					if (inject.head?.original || inject.head?.extracted) {
						warnings.push(
							`Strip mode 'head' will remove head content, but inject.head.original or inject.head.extracted is enabled. Consider using inject.head.static instead.`
						);
					}
					break;

				case 'body':
					if (inject.body?.original || inject.body?.extracted) {
						warnings.push(
							`Strip mode 'body' will remove body content, but inject.body.original or inject.body.extracted is enabled. Consider using inject.body.static instead.`
						);
					}
					break;

				case 'head-except-title':
					if (inject.head?.original || inject.head?.extracted) {
						warnings.push(
							`Strip mode 'head-except-title' will remove head content, but inject.head.original or inject.head.extracted is enabled. Consider using inject.head.static instead.`
						);
					}
					if (inject.meta?.original || inject.meta?.extracted) {
						warnings.push(
							`Strip mode 'head-except-title' will remove meta tags, but inject.meta.original or inject.meta.extracted is enabled. Consider using inject.meta.static instead.`
						);
					}
					break;
			}
		}

		// Check for potentially problematic combinations
		if (strip.includes('body') && inject.body?.original) {
			warnings.push(
				`You're stripping body content but also injecting original body content. This may be intended for hydration, but verify this is the desired behavior.`
			);
		}
	}

	private validateContentSourceRequirements(errors: string[], warnings: string[]): void {
		const inject = this.config.inject || {};
		const hasOriginalInjection = Object.values(inject).some(config => config?.original === true);

		if (hasOriginalInjection) {
			if (!this.config.serveDir) {
				errors.push(
					`Original content injection is enabled but 'serveDir' is not configured. Set 'serveDir' to enable original content extraction.`
				);
			}

			if (this.config.originalContentSource === 'pre-javascript' && !this.config.cacheOriginalContent) {
				warnings.push(
					`Using 'pre-javascript' content source without caching may impact performance. Consider enabling 'cacheOriginalContent'.`
				);
			}
		}
	}

	private validateRouteConfiguration(_errors: string[], warnings: string[]): void {
		// Check for conflicting route configurations
		if (this.config.routes.length > 0 && this.config.crawlLinks) {
			warnings.push(
				`Both 'routes' and 'crawlLinks' are configured. Routes will be processed first, then additional routes will be discovered via crawling.`
			);
		}

		// Validate route config patterns
		for (const routeConfig of this.config.routeConfig) {
			if (routeConfig.route === '*' && this.config.routeConfig.length > 1) {
				warnings.push(
					`Global route pattern '*' is configured along with other route patterns. The global pattern will apply to all routes.`
				);
			}

			// Check for conflicting strip/inject in route config
			if (routeConfig.strip && routeConfig.inject) {
				const stripModes = routeConfig.strip;
				const injectConfig = routeConfig.inject;

				for (const stripMode of stripModes) {
					if (stripMode === 'body' && injectConfig.body?.original) {
						warnings.push(
							`Route '${routeConfig.route}' strips body content but also injects original body content. Verify this is intended.`
						);
					}
				}
			}
		}
	}

	private validateBrowserOptions(_errors: string[], warnings: string[]): void {
		// Validate timeout values
		if (this.config.timeout < 1000) {
			warnings.push(
				`Timeout value ${this.config.timeout}ms is very low. Consider using at least 1000ms to avoid timeouts on slow pages.`
			);
		}

		if (this.config.timeout > 60000) {
			warnings.push(
				`Timeout value ${this.config.timeout}ms is very high. Consider using a lower value to avoid hanging on problematic pages.`
			);
		}

		// Validate wait strategy
		if (this.config.waitUntil === 'networkidle' && this.config.blockDomains.length === 0) {
			warnings.push(
				`Using 'networkidle' wait strategy without blocked domains may cause timeouts on pages with external widgets. Consider blocking problematic domains or using 'load' strategy.`
			);
		}

		// Validate concurrency
		if (this.config.concurrency > 10) {
			warnings.push(
				`High concurrency value ${this.config.concurrency} may overwhelm the target server. Consider using a lower value.`
			);
		}
	}

	private validateOutputOptions(errors: string[], _warnings: string[]): void {
		// Validate output directory
		if (this.config.outDir === this.config.serveDir) {
			errors.push(
				`Output directory '${this.config.outDir}' cannot be the same as serve directory '${this.config.serveDir}'. This would overwrite source files.`
			);
		}

		// Validate exclude patterns
		for (const exclude of this.config.exclude) {
			if (typeof exclude === 'string' && exclude.startsWith('/')) {
				// This is fine - absolute path exclusion
			} else if (exclude instanceof RegExp) {
				try {
					// Test if the regex is valid
					new RegExp(exclude);
				} catch (_error) {
					errors.push(`Invalid regex pattern in exclude: ${exclude}`);
				}
			}
		}
	}

	static validate(config: PSSConfig): ValidationResult {
		const validator = new ConfigValidator(config);
		return validator.validate();
	}
}
