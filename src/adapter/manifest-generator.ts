/**
 * Precache Manifest Generator for next-pwa-turbo
 *
 * Generates the precache manifest from Next.js build outputs.
 * Works with Next.js 16's Turbopack build system.
 */

import { createHash } from "crypto";
import { readFile, writeFile, readdir, stat } from "fs/promises";
import { join, relative, extname } from "path";
import { globby } from "globby";
import { sanitizePath, hasPathTraversal } from "../utils/security.js";

/**
 * A single entry in the precache manifest
 */
export interface PrecacheEntry {
  url: string;
  revision: string | null;
}

/**
 * Options for the manifest generator
 */
export interface ManifestGeneratorOptions {
  /** Path to the .next build directory */
  buildDir: string;
  /** Path to the public directory */
  publicDir: string;
  /** Base path for URLs (from Next.js config) */
  basePath: string;
  /** Glob patterns for public files to exclude */
  publicExcludes: string[];
  /** Patterns for build files to exclude (strings or RegExp) */
  buildExcludes: (string | RegExp)[];
  /** Additional entries to include in the manifest */
  additionalManifestEntries: PrecacheEntry[];
  /** URL prefix modifications (original -> replacement) */
  modifyURLPrefix: Record<string, string>;
  /** Project root directory for security validation */
  projectRoot: string;
}

/**
 * Build manifest structure from Next.js
 */
interface NextBuildManifest {
  polyfillFiles?: string[];
  devFiles?: string[];
  ampDevFiles?: string[];
  lowPriorityFiles?: string[];
  rootMainFiles?: string[];
  pages?: Record<string, string[]>;
  ampFirstPages?: string[];
}

/**
 * Logger interface for consistent logging
 */
interface Logger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}

const logger: Logger = {
  info: (msg) => console.log(`[next-pwa-turbo] ${msg}`),
  warn: (msg) => console.warn(`[next-pwa-turbo] WARNING: ${msg}`),
  error: (msg) => console.error(`[next-pwa-turbo] ERROR: ${msg}`),
};

/**
 * Validates that a path is within the allowed project directory
 */
function isPathWithinProject(filePath: string, projectRoot: string): boolean {
  // Normalize paths for comparison
  const normalizedPath = join(filePath);
  const normalizedRoot = join(projectRoot);

  // Check if the path starts with the project root
  return normalizedPath.startsWith(normalizedRoot);
}

/**
 * Generates a revision hash for a file's contents
 */
async function generateRevisionHash(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath);
    return createHash("md5").update(content).digest("hex").slice(0, 8);
  } catch (error) {
    logger.warn(`Could not read file for revision hash: ${filePath}`);
    // Generate a timestamp-based revision as fallback
    return createHash("md5").update(Date.now().toString()).digest("hex").slice(0, 8);
  }
}

/**
 * Checks if a file/URL matches any of the exclusion patterns
 */
function matchesExclusion(
  value: string,
  patterns: (string | RegExp)[]
): boolean {
  return patterns.some((pattern) => {
    if (typeof pattern === "string") {
      // Simple glob-like matching for strings
      // Convert glob pattern to regex
      const regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&") // Escape special regex chars
        .replace(/\*/g, ".*") // * -> .*
        .replace(/\?/g, "."); // ? -> .
      return new RegExp(`^${regexPattern}$`).test(value);
    }
    return pattern.test(value);
  });
}

/**
 * Applies URL prefix modifications to a URL
 */
function applyURLPrefixModifications(
  url: string,
  modifyURLPrefix: Record<string, string>
): string {
  let modifiedUrl = url;

  for (const [originalPrefix, newPrefix] of Object.entries(modifyURLPrefix)) {
    if (modifiedUrl.startsWith(originalPrefix)) {
      modifiedUrl = newPrefix + modifiedUrl.slice(originalPrefix.length);
      break; // Only apply first matching prefix
    }
  }

  return modifiedUrl;
}

/**
 * Reads and parses the Next.js build manifest
 */
async function readBuildManifest(buildDir: string): Promise<NextBuildManifest | null> {
  const manifestPath = join(buildDir, "build-manifest.json");

  try {
    const content = await readFile(manifestPath, "utf-8");
    return JSON.parse(content) as NextBuildManifest;
  } catch (error) {
    logger.warn(`Could not read build manifest at ${manifestPath}`);
    return null;
  }
}

/**
 * Extracts all JS/CSS assets from the build manifest
 */
function extractAssetsFromManifest(manifest: NextBuildManifest): string[] {
  const assets = new Set<string>();

  // Add polyfill files
  if (manifest.polyfillFiles) {
    manifest.polyfillFiles.forEach((file) => assets.add(file));
  }

  // Add root main files (app entry points)
  if (manifest.rootMainFiles) {
    manifest.rootMainFiles.forEach((file) => assets.add(file));
  }

  // Add low priority files
  if (manifest.lowPriorityFiles) {
    manifest.lowPriorityFiles.forEach((file) => assets.add(file));
  }

  // Add page-specific assets
  if (manifest.pages) {
    for (const pageAssets of Object.values(manifest.pages)) {
      pageAssets.forEach((file) => assets.add(file));
    }
  }

  return Array.from(assets);
}

/**
 * Gets all static files from the .next/static directory
 */
async function getStaticBuildFiles(
  buildDir: string,
  projectRoot: string
): Promise<string[]> {
  const staticDir = join(buildDir, "static");

  try {
    await stat(staticDir);
  } catch {
    // Static directory doesn't exist
    return [];
  }

  try {
    const files = await globby("**/*", {
      cwd: staticDir,
      onlyFiles: true,
      dot: false,
    });

    // Filter and validate files
    return files
      .map((file) => `/_next/static/${file}`)
      .filter((file) => {
        // Validate path doesn't have traversal
        if (hasPathTraversal(file)) {
          logger.warn(`Skipping file with path traversal: ${file}`);
          return false;
        }
        return true;
      });
  } catch (error) {
    logger.warn(`Could not read static build files: ${error}`);
    return [];
  }
}

/**
 * Gets all files from the public directory
 */
async function getPublicFiles(
  publicDir: string,
  projectRoot: string,
  excludePatterns: string[]
): Promise<string[]> {
  try {
    await stat(publicDir);
  } catch {
    // Public directory doesn't exist
    return [];
  }

  // Validate public directory is within project
  if (!isPathWithinProject(publicDir, projectRoot)) {
    logger.error("Public directory is outside project root");
    return [];
  }

  try {
    const files = await globby("**/*", {
      cwd: publicDir,
      onlyFiles: true,
      dot: false,
      ignore: excludePatterns,
    });

    // Filter and validate files
    return files
      .map((file) => `/${file}`)
      .filter((file) => {
        // Validate path doesn't have traversal
        if (hasPathTraversal(file)) {
          logger.warn(`Skipping public file with path traversal: ${file}`);
          return false;
        }
        return true;
      });
  } catch (error) {
    logger.warn(`Could not read public files: ${error}`);
    return [];
  }
}

/**
 * Determines if a file needs a revision hash
 * Files with content hashes in their names don't need revision
 */
function needsRevision(url: string): boolean {
  // Files in _next/static typically have content hashes
  // Pattern: filename.{hash}.{ext}
  const hashPattern = /\.[a-f0-9]{8,}\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|avif)$/i;

  if (hashPattern.test(url)) {
    return false;
  }

  // Also check for chunk patterns like [hash]-[name].js
  const chunkHashPattern = /[a-f0-9]{8,}-/;
  if (chunkHashPattern.test(url)) {
    return false;
  }

  return true;
}

/**
 * Generates the precache manifest from build outputs
 */
export async function generatePrecacheManifest(
  options: ManifestGeneratorOptions
): Promise<PrecacheEntry[]> {
  const {
    buildDir,
    publicDir,
    basePath,
    publicExcludes,
    buildExcludes,
    additionalManifestEntries,
    modifyURLPrefix,
    projectRoot,
  } = options;

  // Validate directories are within project root
  if (!isPathWithinProject(buildDir, projectRoot)) {
    throw new Error("Build directory is outside project root - security violation");
  }

  if (!isPathWithinProject(publicDir, projectRoot)) {
    throw new Error("Public directory is outside project root - security violation");
  }

  const entries: PrecacheEntry[] = [];
  const seenUrls = new Set<string>();

  logger.info("Generating precache manifest...");

  // 1. Read build manifest and extract assets
  const buildManifest = await readBuildManifest(buildDir);
  let manifestAssets: string[] = [];

  if (buildManifest) {
    manifestAssets = extractAssetsFromManifest(buildManifest);
    logger.info(`Found ${manifestAssets.length} assets in build manifest`);
  }

  // 2. Get all static build files
  const staticFiles = await getStaticBuildFiles(buildDir, projectRoot);
  logger.info(`Found ${staticFiles.length} static build files`);

  // 3. Combine and deduplicate build assets
  const allBuildAssets = new Set([...manifestAssets, ...staticFiles]);

  // 4. Process build assets
  for (const asset of allBuildAssets) {
    // Sanitize the asset path
    const sanitizedAsset = sanitizePath(asset);
    if (!sanitizedAsset && asset) {
      logger.warn(`Skipping invalid asset path: ${asset}`);
      continue;
    }

    // Skip if matches exclusion patterns
    if (matchesExclusion(asset, buildExcludes)) {
      continue;
    }

    // Construct full URL with basePath
    let url = asset.startsWith("/") ? asset : `/${asset}`;
    if (basePath && basePath !== "/") {
      url = `${basePath}${url}`;
    }

    // Apply URL prefix modifications
    url = applyURLPrefixModifications(url, modifyURLPrefix);

    // Skip duplicates
    if (seenUrls.has(url)) {
      continue;
    }
    seenUrls.add(url);

    // Determine revision
    let revision: string | null = null;
    if (needsRevision(url)) {
      // For files without content hash, generate revision from file content
      const filePath = join(buildDir, asset.replace(/^\/_next\//, ""));
      try {
        revision = await generateRevisionHash(filePath);
      } catch {
        // Use a fallback revision
        revision = createHash("md5").update(url).digest("hex").slice(0, 8);
      }
    }

    entries.push({ url, revision });
  }

  // 5. Get and process public files
  const publicFiles = await getPublicFiles(publicDir, projectRoot, publicExcludes);
  logger.info(`Found ${publicFiles.length} public files`);

  for (const file of publicFiles) {
    // Construct full URL with basePath
    let url = file;
    if (basePath && basePath !== "/") {
      url = `${basePath}${file}`;
    }

    // Apply URL prefix modifications
    url = applyURLPrefixModifications(url, modifyURLPrefix);

    // Skip duplicates
    if (seenUrls.has(url)) {
      continue;
    }
    seenUrls.add(url);

    // Generate revision for public files (they don't have content hashes)
    const filePath = join(publicDir, file.slice(1)); // Remove leading /
    const revision = await generateRevisionHash(filePath);

    entries.push({ url, revision });
  }

  // 6. Add additional manifest entries
  for (const entry of additionalManifestEntries) {
    // Validate entry
    if (!entry.url || typeof entry.url !== "string") {
      logger.warn("Skipping invalid additional manifest entry (missing url)");
      continue;
    }

    // Check for path traversal in additional entries
    if (hasPathTraversal(entry.url)) {
      logger.warn(`Skipping additional entry with path traversal: ${entry.url}`);
      continue;
    }

    let url = entry.url;

    // Apply basePath if URL is relative
    if (url.startsWith("/") && basePath && basePath !== "/") {
      url = `${basePath}${url}`;
    }

    // Apply URL prefix modifications
    url = applyURLPrefixModifications(url, modifyURLPrefix);

    // Skip duplicates
    if (seenUrls.has(url)) {
      continue;
    }
    seenUrls.add(url);

    entries.push({
      url,
      revision: entry.revision,
    });
  }

  logger.info(`Generated precache manifest with ${entries.length} entries`);

  return entries;
}

/**
 * Writes the PWA manifest to disk
 */
export async function writePWAManifest(
  manifest: PrecacheEntry[],
  outputPath: string,
  projectRoot: string
): Promise<void> {
  // Validate output path is within project
  if (!isPathWithinProject(outputPath, projectRoot)) {
    throw new Error("Output path is outside project root - security violation");
  }

  // Validate no path traversal
  if (hasPathTraversal(outputPath)) {
    throw new Error("Output path contains path traversal - security violation");
  }

  try {
    const content = JSON.stringify(manifest, null, 2);
    await writeFile(outputPath, content, "utf-8");
    logger.info(`Wrote PWA manifest to ${outputPath}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to write PWA manifest: ${errorMessage}`);
  }
}

/**
 * Reads an existing PWA manifest from disk
 */
export async function readPWAManifest(
  manifestPath: string,
  projectRoot: string
): Promise<PrecacheEntry[] | null> {
  // Validate path is within project
  if (!isPathWithinProject(manifestPath, projectRoot)) {
    throw new Error("Manifest path is outside project root - security violation");
  }

  try {
    const content = await readFile(manifestPath, "utf-8");
    return JSON.parse(content) as PrecacheEntry[];
  } catch {
    return null;
  }
}
