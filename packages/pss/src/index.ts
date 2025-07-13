#!/usr/bin/env node
import { cli } from '@kevintyj/pss-cli';

export * from '@kevintyj/pss-browser';
export * from '@kevintyj/pss-cli';
export * from '@kevintyj/pss-config';
export * from '@kevintyj/pss-core';
export * from '@kevintyj/pss-server';
// Re-export everything from subpackages
export * from '@kevintyj/pss-types';

// Only run CLI if this script is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
	cli().catch(error => {
		console.error('❌ Error:', error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
