# TODO Backlog - @kevintyj/pss

## 🛠️ **Config / CLI**
- [ ] Create `pss.config.(js|ts|yml)` schema and validation with zod
- [ ] Parse CLI flags via yargs and merge with config file options
- [ ] Add config file discovery (search for config in current dir, then parent dirs)
- [ ] Implement `--config` flag to specify custom config file path
- [ ] Add `--dry-run` flag for testing configuration without execution
- [ ] Validate required config fields and provide helpful error messages

## 🌐 **Static Server & Snapshot**
- [ ] Implement static file server for `dist/` directory using serve-static
- [ ] Use `get-port` to find available port automatically
- [ ] Launch Playwright browser (Chromium) with proper options
- [ ] Create snapshot function for single route with error handling
- [ ] Add request/response logging for debugging
- [ ] Implement graceful server shutdown after snapshots complete

## 🕷️ **Crawler**
- [ ] Implement BFS link crawling with depth control
- [ ] Parse internal links from HTML (`<a href>`, `<link>`, etc.)
- [ ] Respect `<base href>` tag if present in HTML
- [ ] Apply exclude patterns (string and RegExp) to filter routes
- [ ] Implement concurrency control using p-limit
- [ ] Add duplicate URL detection and prevention
- [ ] Handle relative vs absolute URL resolution correctly

## 📄 **Meta Extraction & Strip Modes**
- [ ] Extract `<title>` and `<meta>` tags via `page.evaluate`
- [ ] Implement `stripMode: "none"` (no modification)
- [ ] Implement `stripMode: "meta"` (remove meta tags but keep title)
- [ ] Implement `stripMode: "head"` (remove entire head section)
- [ ] Preserve essential meta tags (viewport, charset) in strip modes
- [ ] Handle custom meta tag extraction for RSS/JSON feeds

## 📊 **Reporter & Error Handling**
- [ ] Listen for `requestfinished` events to detect 4xx/5xx responses
- [ ] Track failed asset loads (CSS, JS, images, etc.)
- [ ] Generate `reports/broken-links.json` with detailed error info
- [ ] Add broken external link detection
- [ ] Implement retry logic for failed requests
- [ ] Create summary report with statistics

## 📡 **Non-HTML Outputs**
- [ ] Generate `rss.xml` using xmlbuilder2
- [ ] Generate `feed.json` (JSON Feed v1.1 spec)
- [ ] Generate `sitemap.xml` merging explicit + crawled routes
- [ ] Extract page metadata (title, description, date) for feeds
- [ ] Handle relative URL conversion to absolute for feeds
- [ ] Add feed validation and error handling

## 🚫 **404 Handling**
- [ ] Detect missing pages during crawling
- [ ] Generate `404.html` page if not exists
- [ ] Create Netlify-compatible `_redirects` file
- [ ] Add support for custom 404 page template
- [ ] Handle SPA fallback routing scenarios

## 📁 **File Output & Organization**
- [ ] Implement `flatOutput` option (flat vs nested directory structure)
- [ ] Add `addBaseHref` functionality for relative path handling
- [ ] Ensure proper file encoding (UTF-8) for all outputs
- [ ] Handle filename sanitization for cross-platform compatibility
- [ ] Add compression options for output files

## 🔧 **Build Integration**
- [ ] Implement `buildCommand` execution before prerendering
- [ ] Add `withBuild` flag to control build step
- [ ] Handle build command failures gracefully
- [ ] Add build output monitoring and logging

## 🧪 **Testing**
- [ ] Unit tests for configuration validation (zod schemas)
- [ ] Unit tests for URL parsing and crawling logic
- [ ] Unit tests for meta extraction and strip modes
- [ ] Integration tests for full prerendering workflow
- [ ] E2E test using `/pages/fixture-spa` test fixture
- [ ] Mock server tests for broken link detection
- [ ] Performance tests for large sites

## 🔄 **CI/CD**
- [ ] Create GitHub Action workflow file
- [ ] Add dependency installation step
- [ ] Add build and test execution
- [ ] Add artifact publishing if needed
- [ ] Add cross-platform testing (Ubuntu, macOS, Windows)

## 🚀 **Performance & Optimization**
- [ ] Implement proper resource cleanup (browser, server)
- [ ] Add memory usage monitoring
- [ ] Optimize concurrent request handling
- [ ] Add caching for repeated requests
- [ ] Implement request queue management

## 🔮 **Stretch Goals** (Future Enhancements)
- [ ] Streaming HTMLRewriter for large files
- [ ] VS Code schema support for config files
- [ ] Plugin system for custom processors
- [ ] Support for multiple browsers (WebKit, Firefox)
- [ ] Progressive Web App manifest generation
- [ ] OpenGraph and Twitter Card validation
- [ ] Internationalization (i18n) route handling
- [ ] WebP/AVIF image optimization integration
- [ ] Critical CSS extraction and inlining
- [ ] Service Worker generation for offline support

---

## 📋 **Immediate Next Steps**
1. Implement configuration system with zod validation
2. Set up basic static server and Playwright integration
3. Create single-route snapshot functionality
4. Add comprehensive error handling and logging 