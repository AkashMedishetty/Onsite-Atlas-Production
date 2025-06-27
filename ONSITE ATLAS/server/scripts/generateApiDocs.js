// Node script to scan server route files and generate endpoint markdown documentation
// Usage: node server/scripts/generateApiDocs.js

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Directory containing all route files
const ROUTES_DIR = path.join(__dirname, '..', 'src', 'routes');
// Output directory for generated docs
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'docs', 'api');

// HTTP methods we care about
const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'];

/**
 * Recursively collect every .js file under ROUTES_DIR (including sub-folders)
 */
function collectRouteFiles() {
  return glob.sync(path.join(ROUTES_DIR, '**', '*.js'));
}

/**
 * Extract endpoints from a route file.
 * We look for two patterns:
 * 1. router.METHOD('<path>', ...)
 * 2. router.route('<path>').METHOD(...)
 *
 * Both patterns are handled with RegExp – this is NOT a full JS parser but works well for typical Express syntax.
 */
function extractEndpoints(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const endpoints = [];

  // Pattern 1 – direct calls (router.get('/foo', ...))
  const directRegex = new RegExp('\\.(' + HTTP_METHODS.join('|') + ')\\s*\\(\\s*[\\"\\\'\\`]' +
    '([^\\"\\\'\\`]+)[\\"\\\'\\`]', 'gi');
  let match;
  while ((match = directRegex.exec(content)) !== null) {
    const [, method, routePath] = match;
    endpoints.push({ method: method.toUpperCase(), path: routePath, file: filePath });
  }

  // Pattern 2 – chained routes (router.route('/foo').get(...).post(...))
  const routeRegex = /\.route\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
  while ((match = routeRegex.exec(content)) !== null) {
    const routePath = match[1];
    const sliceFromMatch = content.slice(match.index);
    const chainMatches = [...sliceFromMatch.matchAll(/\.\s*(get|post|put|patch|delete|options|head)\s*\(/gi)];
    const methods = chainMatches.map((m) => m[1].toUpperCase());
    if (methods.length === 0) {
      // If no chained methods were found (edge case), mark as UNKNOWN
      endpoints.push({ method: 'UNKNOWN', path: routePath, file: filePath });
    } else {
      methods.forEach((m) => endpoints.push({ method: m, path: routePath, file: filePath }));
    }
  }

  return endpoints;
}

/** Deduplicate endpoint entries */
function dedupe(endpoints) {
  const seen = new Set();
  return endpoints.filter((ep) => {
    const key = `${ep.method} ${ep.path} ${ep.file}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Group endpoints roughly by feature using the first segment of the route file name */
function groupByFeature(endpoints) {
  const groups = {};
  endpoints.forEach((ep) => {
    const fileBase = path.basename(ep.file); // e.g. events.routes.js
    const feature = fileBase.split('.')[0]; // events
    if (!groups[feature]) groups[feature] = [];
    groups[feature].push(ep);
  });
  return groups;
}

/** Split groups into parts, keeping each file under ~480 lines (safety vs 500 limit) */
function splitIntoParts(groups) {
  const features = Object.keys(groups).sort();
  const MAX_LINES = 350; // keep well under 500-line rule
  const parts = [];
  let current = [];
  let currentLines = 0;

  features.forEach((feat) => {
    const block = groups[feat];
    const linesNeeded = block.length + 3; // heading + table header + rows
    if (currentLines + linesNeeded > MAX_LINES) {
      parts.push(current);
      current = [];
      currentLines = 0;
    }
    current.push({ heading: feat, items: block });
    currentLines += linesNeeded;
  });
  if (current.length) parts.push(current);
  return parts;
}

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function writeMarkdownFiles(parts) {
  parts.forEach((sections, idx) => {
    const mdLines = [];
    mdLines.push(`# API Endpoints – Part ${idx + 1}`);
    mdLines.push('All paths are mounted under the `/api` prefix (see `server/src/app.js`).');
    mdLines.push('');

    sections.forEach(({ heading, items }) => {
      mdLines.push(`## ${heading}`);
      mdLines.push('');
      mdLines.push('| Method | Path (relative to /api) | Source Route File |');
      mdLines.push('| ------ | ----------------------- | ----------------- |');
      items.sort((a, b) => (a.path > b.path ? 1 : -1)).forEach((ep) => {
        const rel = path.relative(path.join(__dirname, '..'), ep.file).replace(/\\\\/g, '/');
        mdLines.push(`| ${ep.method} | ${ep.path} | ${rel} |`);
      });
      mdLines.push('');
    });

    const fileName = path.join(OUTPUT_DIR, `part-${idx + 1}.md`);
    fs.writeFileSync(fileName, mdLines.join('\n'));
    console.log(`Generated ${fileName}`);
  });
}

function main() {
  console.log('Scanning route files...');
  const files = collectRouteFiles();
  let endpoints = [];
  files.forEach((file) => {
    endpoints = endpoints.concat(extractEndpoints(file));
  });
  endpoints = dedupe(endpoints);
  console.log(`Found ${endpoints.length} unique endpoints.`);

  const groups = groupByFeature(endpoints);
  const parts = splitIntoParts(groups);
  ensureOutputDir();
  writeMarkdownFiles(parts);
  console.log('Documentation files created in docs/api/.');
}

if (require.main === module) {
  main();
} 