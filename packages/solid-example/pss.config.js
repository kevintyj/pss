const config = {
	// Global settings - use static injection for all routes
	injectionTarget: 'static',
	strip: [],
	waitUntil: 'domcontentloaded',
	concurrency: 2,
	timeout: 10000,

	serveDir: 'dist',
	outDir: 'output',
	originalContentSource: 'static-file',

	// Global defaults: preserve static structure, inject only dynamic content
	injectDefaults: {
		extracted: false, // Don't inject extracted content by default
		original: false, // Don't inject original content by default (it's already in the static file)
		static: false,
	},

	// Global injection: only get dynamic meta and title from JS
	inject: {
		meta: {
			extracted: true, // Get dynamic meta from JS
			original: false, // Don't include original meta (avoid duplication)
		},
		title: {
			extracted: true, // Get dynamic title from JS
			original: false, // Don't include original title (avoid duplication)
		},
		// head and body will use defaults (original: false) to avoid duplication
		// since the static file already contains the head and body structure
	},
};

export default config;
