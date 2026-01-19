/**
 * Service Worker Compiler for next-pwa-turbo
 *
 * Uses esbuild to compile service worker templates with injected
 * precache manifest and configuration.
 *
 * Security principles:
 * - No eval() or new Function()
 * - All injected values are escaped via escapeForServiceWorker
 * - Strict validation of all inputs
 */

import * as esbuild from 'esbuild';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { escapeForServiceWorker } from '../utils/security.js';
import type { PWAConfig, Fallbacks } from '../config/schema.js';

// =============================================================================
// Types
// =============================================================================

/**
 * Precache manifest entry
 */
export interface PrecacheEntry {
  url: string;
  revision: string | null;
  integrity?: string;
}

/**
 * Configuration passed to the service worker at build time
 */
export interface SWConfig {
  skipWaiting: boolean;
  clientsClaim: boolean;
  cleanupOutdatedCaches: boolean;
  navigationPreload: boolean;
  fallbacks?: Fallbacks;
  scope: string;
  basePath?: string;
  cacheOnFrontEndNav: boolean;
  reloadOnOnline: boolean;
  dynamicStartUrl: boolean;
  dynamicStartUrlRedirect?: string;
}

/**
 * Options for compiling the service worker
 */
export interface CompileSWOptions {
  /** Precache manifest entries */
  manifest: PrecacheEntry[];
  /** Path to SW source (template or custom) */
  swSrc: string;
  /** Output path for compiled SW */
  swDest: string;
  /** Build mode */
  mode: 'development' | 'production';
  /** PWA configuration */
  config: PWAConfig;
}

/**
 * Result of service worker compilation
 */
export interface CompileSWResult {
  /** Whether compilation succeeded */
  success: boolean;
  /** Output file path */
  outputPath: string;
  /** Output file size in bytes */
  outputSize: number;
  /** Warnings during compilation */
  warnings: string[];
  /** Errors during compilation (if success is false) */
  errors: string[];
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extracts SW config from PWA config
 * Uses conditional spreading to handle optional properties with exactOptionalPropertyTypes
 */
function extractSWConfig(config: PWAConfig): SWConfig {
  const swConfig: SWConfig = {
    skipWaiting: config.skipWaiting,
    clientsClaim: config.clientsClaim,
    cleanupOutdatedCaches: config.cleanupOutdatedCaches,
    navigationPreload: config.navigationPreload,
    scope: config.scope,
    cacheOnFrontEndNav: config.cacheOnFrontEndNav,
    reloadOnOnline: config.reloadOnOnline,
    dynamicStartUrl: config.dynamicStartUrl,
  };

  // Only include optional properties if they are defined
  if (config.fallbacks !== undefined) {
    swConfig.fallbacks = config.fallbacks;
  }
  if (config.basePath !== undefined) {
    swConfig.basePath = config.basePath;
  }
  if (config.dynamicStartUrlRedirect !== undefined) {
    swConfig.dynamicStartUrlRedirect = config.dynamicStartUrlRedirect;
  }

  return swConfig;
}

/**
 * Validates the manifest entries
 */
function validateManifest(manifest: PrecacheEntry[]): string[] {
  const warnings: string[] = [];

  if (!Array.isArray(manifest)) {
    throw new Error('Manifest must be an array');
  }

  for (let i = 0; i < manifest.length; i++) {
    const entry = manifest[i];

    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Manifest entry ${i} must be an object`);
    }

    if (typeof entry.url !== 'string' || entry.url.length === 0) {
      throw new Error(`Manifest entry ${i} must have a non-empty url`);
    }

    if (entry.revision !== null && typeof entry.revision !== 'string') {
      throw new Error(`Manifest entry ${i} revision must be a string or null`);
    }

    // Warn about potentially problematic entries
    if (entry.url.includes('..')) {
      warnings.push(`Manifest entry ${i} URL contains '..': ${entry.url}`);
    }

    if (entry.url.length > 2000) {
      warnings.push(`Manifest entry ${i} URL is very long (${entry.url.length} chars)`);
    }
  }

  return warnings;
}

/**
 * Validates the source file exists and is readable
 */
async function validateSwSrc(swSrc: string): Promise<void> {
  try {
    const stat = await fs.stat(swSrc);
    if (!stat.isFile()) {
      throw new Error(`Service worker source is not a file: ${swSrc}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Service worker source file not found: ${swSrc}`);
    }
    throw error;
  }
}

/**
 * Ensures the destination directory exists
 */
async function ensureDestDir(swDest: string): Promise<void> {
  const destDir = path.dirname(swDest);
  await fs.mkdir(destDir, { recursive: true });
}

// =============================================================================
// Main Compiler
// =============================================================================

/**
 * Compiles a service worker using esbuild.
 *
 * This function:
 * 1. Validates all inputs
 * 2. Reads the SW template source
 * 3. Injects the precache manifest and config via esbuild's define feature
 * 4. Compiles and bundles with esbuild
 * 5. Writes the output to the destination
 *
 * @param options - Compilation options
 * @returns Compilation result
 *
 * @example
 * ```ts
 * const result = await compileServiceWorker({
 *   manifest: [{ url: '/index.html', revision: 'abc123' }],
 *   swSrc: './templates/sw.ts',
 *   swDest: './public/sw.js',
 *   mode: 'production',
 *   config: pwaConfig,
 * });
 * ```
 */
export async function compileServiceWorker(
  options: CompileSWOptions
): Promise<CompileSWResult> {
  const { manifest, swSrc, swDest, mode, config } = options;
  const warnings: string[] = [];
  const errors: string[] = [];

  console.log(`[next-pwa-turbo] Compiling service worker...`);
  console.log(`[next-pwa-turbo]   Source: ${swSrc}`);
  console.log(`[next-pwa-turbo]   Destination: ${swDest}`);
  console.log(`[next-pwa-turbo]   Mode: ${mode}`);
  console.log(`[next-pwa-turbo]   Manifest entries: ${manifest.length}`);

  try {
    // Validate inputs
    await validateSwSrc(swSrc);
    const manifestWarnings = validateManifest(manifest);
    warnings.push(...manifestWarnings);

    // Ensure destination directory exists
    await ensureDestDir(swDest);

    // Extract SW config from PWA config
    const swConfig = extractSWConfig(config);

    // Escape values for safe injection
    // Using escapeForServiceWorker ensures no code injection is possible
    const escapedManifest = escapeForServiceWorker(manifest);
    const escapedConfig = escapeForServiceWorker(swConfig);

    // Escape fallbacks configuration if present
    const escapedFallbacks = swConfig.fallbacks
      ? escapeForServiceWorker(swConfig.fallbacks)
      : 'null';

    // Build with esbuild
    const buildResult = await esbuild.build({
      entryPoints: [swSrc],
      outfile: swDest,
      bundle: true,
      format: 'iife', // Service workers need to be self-contained
      platform: 'browser',
      target: ['es2020'],
      minify: mode === 'production',
      sourcemap: mode === 'development' ? 'inline' : false,
      treeShaking: true,
      // Inject the manifest and config as global constants
      // These replace the placeholders in the SW template
      define: {
        '__PWA_MANIFEST__': escapedManifest,
        '__PWA_CONFIG__': escapedConfig,
        '__PWA_MODE__': JSON.stringify(mode),
        // Comprehensive fallback configuration for different request types
        '__PWA_FALLBACKS__': escapedFallbacks,
      },
      // Log level
      logLevel: 'warning',
      // Ensure clean output
      legalComments: 'none',
      // Handle external imports (workbox packages will be bundled)
      metafile: true,
    });

    // Collect esbuild warnings
    for (const warning of buildResult.warnings) {
      warnings.push(`esbuild: ${warning.text}`);
    }

    // Get output file size
    const outputStat = await fs.stat(swDest);

    console.log(`[next-pwa-turbo] Service worker compiled successfully`);
    console.log(`[next-pwa-turbo]   Output size: ${(outputStat.size / 1024).toFixed(2)} KB`);

    if (warnings.length > 0) {
      console.log(`[next-pwa-turbo] Warnings:`);
      for (const warning of warnings) {
        console.log(`[next-pwa-turbo]   - ${warning}`);
      }
    }

    return {
      success: true,
      outputPath: swDest,
      outputSize: outputStat.size,
      warnings,
      errors: [],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    errors.push(errorMessage);

    console.error(`[next-pwa-turbo] Service worker compilation failed`);
    console.error(`[next-pwa-turbo]   Error: ${errorMessage}`);

    return {
      success: false,
      outputPath: swDest,
      outputSize: 0,
      warnings,
      errors,
    };
  }
}

/**
 * Gets the default service worker template path.
 * Looks for the template in the package's templates directory.
 *
 * @param packageRoot - Root directory of the next-pwa-turbo package
 * @returns Path to the default SW template
 */
export function getDefaultSwTemplatePath(packageRoot: string): string {
  return path.join(packageRoot, 'templates', 'sw.ts');
}

/**
 * Resolves the service worker source path.
 * If customWorkerSrc is provided and exists, uses that.
 * Otherwise, falls back to the default template.
 *
 * @param config - PWA configuration
 * @param cwd - Current working directory
 * @param packageRoot - Root directory of the next-pwa-turbo package
 * @returns Resolved path to the SW source
 */
export async function resolveSwSrc(
  config: PWAConfig,
  cwd: string,
  packageRoot: string
): Promise<string> {
  // Check for custom worker source
  if (config.customWorkerSrc) {
    const customPath = path.isAbsolute(config.customWorkerSrc)
      ? config.customWorkerSrc
      : path.join(cwd, config.customWorkerSrc);

    try {
      await fs.access(customPath);
      console.log(`[next-pwa-turbo] Using custom service worker: ${customPath}`);
      return customPath;
    } catch {
      console.warn(`[next-pwa-turbo] Custom worker source not found: ${customPath}`);
      console.warn(`[next-pwa-turbo] Falling back to default template`);
    }
  }

  // Use default template
  const defaultPath = getDefaultSwTemplatePath(packageRoot);
  console.log(`[next-pwa-turbo] Using default service worker template: ${defaultPath}`);
  return defaultPath;
}

/**
 * Resolves the service worker destination path.
 *
 * @param config - PWA configuration
 * @param cwd - Current working directory
 * @returns Resolved path for the SW output
 */
export function resolveSwDest(config: PWAConfig, cwd: string): string {
  const destDir = path.isAbsolute(config.dest)
    ? config.dest
    : path.join(cwd, config.dest);

  return path.join(destDir, config.sw);
}
