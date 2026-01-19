/**
 * Next.js Build Adapter for next-pwa-turbo
 *
 * This module provides the Build Adapter that integrates with Next.js 16's
 * build system. Build Adapters are the Turbopack-native way to extend the
 * build process without webpack plugins.
 *
 * @module adapter
 */

import { join } from "path";
import type { PWAConfig } from "../config/schema.js";
import {
  generatePrecacheManifest,
  writePWAManifest,
  type PrecacheEntry,
  type ManifestGeneratorOptions,
} from "./manifest-generator.js";
import { sanitizePath, hasPathTraversal } from "../utils/security.js";

/**
 * Next.js configuration relevant to PWA adapter
 */
export interface NextConfig {
  /** Base path for the application */
  basePath?: string;
  /** Output directory (typically .next) */
  distDir?: string;
  /** Whether the build is for production */
  isProduction?: boolean;
}

/**
 * Build context provided by Next.js during build
 */
export interface BuildContext {
  /** The root directory of the project */
  projectDir: string;
  /** The output directory (.next by default) */
  outputDir: string;
  /** Whether this is a production build */
  isProduction: boolean;
  /** Build ID for cache busting */
  buildId: string;
  /** Target environment */
  target: "server" | "serverless" | "experimental-serverless-trace";
}

/**
 * Build configuration that can be modified
 */
export interface BuildConfig {
  /** Output file extensions to process */
  outputFileExtensions?: string[];
  /** Additional files to include in build output */
  additionalOutputFiles?: string[];
}

/**
 * Build Adapter interface for Next.js 16
 * This interface represents how Build Adapters hook into Next.js build lifecycle
 */
export interface BuildAdapter {
  /** Unique name for this adapter */
  name: string;

  /**
   * Called after the build completes successfully
   * Use this to process build outputs and generate additional files
   */
  onBuildComplete?: (context: BuildContext) => Promise<void>;

  /**
   * Called before build starts to modify build configuration
   * Return the modified config or undefined to keep original
   */
  modifyBuildConfig?: (config: BuildConfig) => BuildConfig | undefined;

  /**
   * Called when build fails with an error
   */
  onBuildError?: (error: Error, context: BuildContext) => Promise<void>;

  /**
   * Called during development mode hot reload
   */
  onHotReload?: (context: BuildContext) => Promise<void>;
}

/**
 * Options for creating the PWA Build Adapter
 */
export interface PWABuildAdapterOptions {
  /** PWA configuration */
  config: PWAConfig;
  /** Next.js configuration */
  nextConfig: NextConfig;
}

/**
 * Result of the build adapter processing
 */
export interface PWABuildResult {
  /** Generated precache manifest */
  manifest: PrecacheEntry[];
  /** Path to the written manifest file */
  manifestPath: string;
  /** Number of entries in the manifest */
  entryCount: number;
  /** Total estimated size of precached assets (approximate) */
  warnings: string[];
}

/**
 * Logger for the build adapter
 */
const logger = {
  info: (msg: string) => console.log(`[next-pwa-turbo] ${msg}`),
  warn: (msg: string) => console.warn(`[next-pwa-turbo] WARNING: ${msg}`),
  error: (msg: string) => console.error(`[next-pwa-turbo] ERROR: ${msg}`),
};

/**
 * Validates the adapter options
 */
function validateOptions(options: PWABuildAdapterOptions): void {
  if (!options.config) {
    throw new Error("PWA config is required");
  }

  // Validate that dest doesn't have path traversal
  if (options.config.dest && hasPathTraversal(options.config.dest)) {
    throw new Error("PWA config dest contains invalid path traversal");
  }

  // Validate scope is valid
  if (options.config.scope && hasPathTraversal(options.config.scope)) {
    throw new Error("PWA config scope contains invalid path traversal");
  }
}

/**
 * Resolves paths for the manifest generator
 */
function resolvePaths(
  context: BuildContext,
  options: PWABuildAdapterOptions
): {
  buildDir: string;
  publicDir: string;
  outputPath: string;
} {
  const { projectDir, outputDir } = context;
  const { config } = options;

  // Build directory is the .next directory
  const buildDir = outputDir;

  // Public directory relative to project root
  const publicDir = join(projectDir, "public");

  // Output path for the PWA manifest
  const outputPath = join(outputDir, "pwa-manifest.json");

  return { buildDir, publicDir, outputPath };
}

/**
 * Creates a Next.js Build Adapter for PWA functionality
 *
 * This adapter hooks into Next.js 16's build lifecycle to:
 * 1. Read the build manifest after compilation
 * 2. Generate a precache manifest from build outputs
 * 3. Write the manifest for service worker consumption
 *
 * @param options - Configuration options for the adapter
 * @returns A BuildAdapter instance
 *
 * @example
 * ```ts
 * import { createPWABuildAdapter } from 'next-pwa-turbo/adapter';
 * import { validateConfig } from 'next-pwa-turbo/config';
 *
 * const pwaConfig = validateConfig({
 *   dest: 'public',
 *   sw: 'sw.js',
 *   disable: process.env.NODE_ENV === 'development',
 * });
 *
 * const adapter = createPWABuildAdapter({
 *   config: pwaConfig,
 *   nextConfig: { basePath: '' },
 * });
 *
 * // Register with Next.js build system
 * export default {
 *   buildAdapters: [adapter],
 * };
 * ```
 */
export function createPWABuildAdapter(
  options: PWABuildAdapterOptions
): BuildAdapter {
  // Validate options upfront
  validateOptions(options);

  const { config, nextConfig } = options;

  return {
    name: "next-pwa-turbo",

    /**
     * Process build outputs after successful compilation
     */
    async onBuildComplete(context: BuildContext): Promise<void> {
      // Skip if PWA is disabled
      if (config.disable) {
        logger.info("PWA is disabled, skipping manifest generation");
        return;
      }

      // Skip in development unless explicitly enabled
      if (!context.isProduction && !config.devOptions?.enabled) {
        logger.info("Skipping PWA manifest in development mode");
        return;
      }

      logger.info("Processing build outputs for PWA...");

      try {
        const { buildDir, publicDir, outputPath } = resolvePaths(context, options);

        // Prepare manifest generator options
        const generatorOptions: ManifestGeneratorOptions = {
          buildDir,
          publicDir,
          basePath: nextConfig.basePath ?? config.basePath ?? "",
          publicExcludes: config.publicExcludes ?? [],
          buildExcludes: config.buildExcludes ?? [],
          additionalManifestEntries: normalizeAdditionalEntries(
            config.additionalManifestEntries
          ),
          modifyURLPrefix: config.modifyURLPrefix ?? {},
          projectRoot: context.projectDir,
        };

        // Generate the precache manifest
        const manifest = await generatePrecacheManifest(generatorOptions);

        // Apply manifest transforms if configured
        let finalManifest = manifest;
        if (config.manifestTransforms && config.manifestTransforms.length > 0) {
          finalManifest = await applyManifestTransforms(
            manifest,
            config.manifestTransforms,
            context
          );
        }

        // Write the manifest to the build directory
        await writePWAManifest(finalManifest, outputPath, context.projectDir);

        logger.info(
          `PWA build complete: ${finalManifest.length} entries in precache manifest`
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`Failed to generate PWA manifest: ${errorMessage}`);
        throw error;
      }
    },

    /**
     * Modify build configuration if needed
     */
    modifyBuildConfig(buildConfig: BuildConfig): BuildConfig | undefined {
      // Currently no modifications needed
      // This hook is available for future enhancements
      return buildConfig;
    },

    /**
     * Handle build errors gracefully
     */
    async onBuildError(error: Error, context: BuildContext): Promise<void> {
      logger.error(`Build failed: ${error.message}`);
      // Clean up any partial manifest files if needed
      // For now, we just log the error
    },

    /**
     * Handle hot reload in development
     */
    async onHotReload(context: BuildContext): Promise<void> {
      // Only process if dev options are enabled
      if (!config.devOptions?.enabled) {
        return;
      }

      logger.info("Hot reload detected, updating PWA manifest...");

      try {
        const { buildDir, publicDir, outputPath } = resolvePaths(context, options);

        const generatorOptions: ManifestGeneratorOptions = {
          buildDir,
          publicDir,
          basePath: nextConfig.basePath ?? config.basePath ?? "",
          publicExcludes: config.publicExcludes ?? [],
          buildExcludes: config.buildExcludes ?? [],
          additionalManifestEntries: normalizeAdditionalEntries(
            config.additionalManifestEntries
          ),
          modifyURLPrefix: config.modifyURLPrefix ?? {},
          projectRoot: context.projectDir,
        };

        const manifest = await generatePrecacheManifest(generatorOptions);
        await writePWAManifest(manifest, outputPath, context.projectDir);
      } catch (error) {
        // Don't fail hot reload for PWA issues
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn(`PWA manifest update failed during hot reload: ${errorMessage}`);
      }
    },
  };
}

/**
 * Normalizes additional manifest entries to PrecacheEntry format
 */
function normalizeAdditionalEntries(
  entries: PWAConfig["additionalManifestEntries"]
): PrecacheEntry[] {
  if (!entries) {
    return [];
  }

  return entries.map((entry) => {
    if (typeof entry === "string") {
      return { url: entry, revision: null };
    }
    return {
      url: entry.url,
      revision: entry.revision,
    };
  });
}

/**
 * Applies manifest transform functions to the generated manifest
 */
async function applyManifestTransforms(
  manifest: PrecacheEntry[],
  transforms: NonNullable<PWAConfig["manifestTransforms"]>,
  context: BuildContext
): Promise<PrecacheEntry[]> {
  let currentManifest = manifest;
  const warnings: string[] = [];

  for (const transform of transforms) {
    try {
      const result = await transform(currentManifest, context);

      if (result && "manifest" in result) {
        currentManifest = result.manifest as PrecacheEntry[];

        if (result.warnings) {
          warnings.push(...result.warnings);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`Manifest transform failed: ${errorMessage}`);
    }
  }

  // Log any warnings from transforms
  for (const warning of warnings) {
    logger.warn(warning);
  }

  return currentManifest;
}

/**
 * Helper function to get the default PWA build adapter options
 */
export function getDefaultAdapterOptions(
  config: PWAConfig,
  nextConfig: NextConfig = {}
): PWABuildAdapterOptions {
  return {
    config,
    nextConfig: {
      basePath: nextConfig.basePath ?? "",
      distDir: nextConfig.distDir ?? ".next",
      isProduction: nextConfig.isProduction ?? process.env['NODE_ENV'] === "production",
    },
  };
}

// Re-export types from manifest generator for convenience
export type { PrecacheEntry, ManifestGeneratorOptions };
