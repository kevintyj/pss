import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
	plugins: [solidPlugin()],
	server: {
		port: 3000,
	},
	build: {
		target: 'esnext',
		// Ensure assets are placed in a consistent directory
		assetsDir: 'assets',
		// Generate manifest for better asset tracking
		manifest: true,
		// Ensure consistent file naming
		rollupOptions: {
			output: {
				// Use consistent naming for assets
				assetFileNames: 'assets/[name].[hash][extname]',
				chunkFileNames: 'assets/[name].[hash].js',
				entryFileNames: 'assets/[name].[hash].js',
			},
		},
	},
	// Ensure base is set to root for proper asset resolution
	base: '/',
});
