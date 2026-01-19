/**
 * next-pwa-turbo - Turbopack-native PWA library for Next.js 16
 *
 * Main entry point providing the withPWA() configuration wrapper
 * and re-exports for common utilities.
 *
 * @module next-pwa-turbo
 *
 * @example
 * ```ts
 * // next.config.ts
 * import { withPWA } from 'next-pwa-turbo';
 *
 * export default withPWA({
 *   dest: 'public',
 *   disable: process.env.NODE_ENV === 'development',
 * })({
 *   // Your Next.js config here
 * });
 * ```
 */

import {
  PWAConfigSchema as _PWAConfigSchema,
  PWAConfigValidationError as _PWAConfigValidationError,
  validateConfig as _validateConfig,
  safeValidateConfig as _safeValidateConfig,
  getDefaultConfig as _getDefaultConfig,
} from "./config/schema.js";

import type {
  PWAConfig as _PWAConfig,
  PWAConfigInput as _PWAConfigInput,
  RuntimeCachingRule as _RuntimeCachingRule,
  CacheStrategy as _CacheStrategy,
  Fallbacks as _Fallbacks,
  DevOptions as _DevOptions,
  RouteMatchCallbackOptions as _RouteMatchCallbackOptions,
  RouteMatchCallback as _RouteMatchCallback,
} from "./config/schema.js";

import {
  createPWABuildAdapter as _createPWABuildAdapter,
} from "./adapter/index.js";

import type {
  BuildAdapter as _BuildAdapter,
  BuildContext as _BuildContext,
  BuildConfig as _BuildConfig,
  PWABuildAdapterOptions as _PWABuildAdapterOptions,
  PWABuildResult as _PWABuildResult,
  PrecacheEntry as _PrecacheEntry,
} from "./adapter/index.js";

import {
  generatePrecacheManifest as _generatePrecacheManifest,
  writePWAManifest as _writePWAManifest,
  readPWAManifest as _readPWAManifest,
} from "./adapter/manifest-generator.js";

import type {
  ManifestGeneratorOptions as _ManifestGeneratorOptions,
} from "./adapter/manifest-generator.js";

import {
  getDefaultRuntimeCaching as _getDefaultRuntimeCaching,
  mergeRuntimeCaching as _mergeRuntimeCaching,
  DEFAULT_RUNTIME_CACHING as _DEFAULT_RUNTIME_CACHING,
} from "./worker/cache-strategies.js";

import type {
  DefaultRuntimeCachingRule as _DefaultRuntimeCachingRule,
} from "./worker/cache-strategies.js";

// =============================================================================
// Re-export Types
// =============================================================================

/** PWA configuration type (after validation with defaults applied) */
export type PWAConfig = _PWAConfig;

/** PWA configuration input type (before defaults are applied) */
export type PWAConfigInput = _PWAConfigInput;

/** Runtime caching rule configuration */
export type RuntimeCachingRule = _RuntimeCachingRule;

/** Workbox caching strategy names */
export type CacheStrategy = _CacheStrategy;

/** Offline fallback URLs configuration */
export type Fallbacks = _Fallbacks;

/** Development mode options */
export type DevOptions = _DevOptions;

/** Options passed to URL pattern matching functions */
export type RouteMatchCallbackOptions = _RouteMatchCallbackOptions;

/** Function type for custom URL pattern matching */
export type RouteMatchCallback = _RouteMatchCallback;

/** Build Adapter interface for Next.js 16 */
export type BuildAdapter = _BuildAdapter;

/** Build context provided during Next.js build */
export type BuildContext = _BuildContext;

/** Build configuration that can be modified by adapters */
export type BuildConfig = _BuildConfig;

/** Options for creating the PWA build adapter */
export type PWABuildAdapterOptions = _PWABuildAdapterOptions;

/** Result of PWA build processing */
export type PWABuildResult = _PWABuildResult;

/** A single entry in the precache manifest */
export type PrecacheEntry = _PrecacheEntry;

/** Options for the manifest generator */
export type ManifestGeneratorOptions = _ManifestGeneratorOptions;

/** Default runtime caching rule with guaranteed cacheName */
export type DefaultRuntimeCachingRule = _DefaultRuntimeCachingRule;

// =============================================================================
// Re-export Values
// =============================================================================

/** Zod schema for PWA configuration validation */
export const PWAConfigSchema = _PWAConfigSchema;

/** Error class for PWA configuration validation errors */
export const PWAConfigValidationError = _PWAConfigValidationError;

/** Validates and parses PWA configuration */
export const validateConfig = _validateConfig;

/** Safely validates PWA configuration without throwing */
export const safeValidateConfig = _safeValidateConfig;

/** Gets the default configuration with all defaults applied */
export const getDefaultConfig = _getDefaultConfig;

/** Creates a Next.js Build Adapter for PWA functionality */
export const createPWABuildAdapter = _createPWABuildAdapter;

/** Generates the precache manifest from build outputs */
export const generatePrecacheManifest = _generatePrecacheManifest;

/** Writes the PWA manifest to disk */
export const writePWAManifest = _writePWAManifest;

/** Reads an existing PWA manifest from disk */
export const readPWAManifest = _readPWAManifest;

/** Returns the 13 default runtime caching strategies */
export const getDefaultRuntimeCaching = _getDefaultRuntimeCaching;

/** Merges custom runtime caching rules with defaults (custom takes precedence) */
export const mergeRuntimeCaching = _mergeRuntimeCaching;

/** Pre-built default caching rules constant */
export const DEFAULT_RUNTIME_CACHING = _DEFAULT_RUNTIME_CACHING;

// =============================================================================
// NextConfig Type Definition
// =============================================================================

/**
 * Simplified Next.js configuration interface
 * Contains the properties relevant to PWA integration
 */
export interface NextConfig {
  /** Base path for the application */
  basePath?: string;
  /** Output directory (typically .next) */
  distDir?: string;
  /** Build adapters registered with Next.js */
  buildAdapters?: BuildAdapter[];
  /** Allow other Next.js config properties */
  [key: string]: unknown;
}

// =============================================================================
// withPWA Configuration Wrapper
// =============================================================================

/**
 * Logger for the PWA wrapper
 */
const logger = {
  info: (msg: string) => console.log(`[next-pwa-turbo] ${msg}`),
  warn: (msg: string) => console.warn(`[next-pwa-turbo] WARNING: ${msg}`),
  error: (msg: string) => console.error(`[next-pwa-turbo] ERROR: ${msg}`),
};

/**
 * Formats Zod validation errors into a readable message
 */
function formatValidationError(error: InstanceType<typeof _PWAConfigValidationError>): string {
  const lines = [
    "Invalid PWA configuration:",
    "",
    ...error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `  - ${issue.path.join(".")}: ` : "  - ";
      return `${path}${issue.message}`;
    }),
    "",
    "Please check your withPWA() configuration and fix the above issues.",
  ];

  return lines.join("\n");
}

/**
 * Creates a PWA-enabled Next.js configuration wrapper.
 *
 * This function returns a curried configuration function that wraps
 * your Next.js config with PWA functionality, integrating with Next.js 16's
 * Build Adapter system.
 *
 * @param pwaConfig - PWA configuration options
 * @returns A function that accepts a Next.js config and returns the enhanced config
 *
 * @throws {Error} If the PWA configuration is invalid
 *
 * @example
 * ```ts
 * // Basic usage
 * import { withPWA } from 'next-pwa-turbo';
 *
 * export default withPWA({
 *   dest: 'public',
 *   disable: process.env.NODE_ENV === 'development',
 * })({
 *   reactStrictMode: true,
 * });
 * ```
 *
 * @example
 * ```ts
 * // With runtime caching
 * import { withPWA } from 'next-pwa-turbo';
 *
 * export default withPWA({
 *   dest: 'public',
 *   runtimeCaching: [
 *     {
 *       urlPattern: /^https:\/\/api\.example\.com\/.* /,
 *       handler: 'NetworkFirst',
 *       options: {
 *         cacheName: 'api-cache',
 *         networkTimeoutSeconds: 10,
 *       },
 *     },
 *   ],
 * })(nextConfig);
 * ```
 */
export function withPWA(pwaConfig: PWAConfigInput) {
  // Validate and parse the PWA configuration
  let validatedConfig: PWAConfig;

  try {
    validatedConfig = _validateConfig(pwaConfig);
  } catch (error) {
    if (error instanceof _PWAConfigValidationError) {
      const message = formatValidationError(error);
      throw new Error(message);
    }
    throw error;
  }

  /**
   * Returns the Next.js configuration enhanced with PWA functionality
   */
  return function withPWAConfig(nextConfig: NextConfig = {}): NextConfig {
    // If PWA is disabled, return the original config unchanged
    if (validatedConfig.disable) {
      logger.info("PWA is disabled, skipping PWA setup");
      return nextConfig;
    }

    // Extract relevant Next.js config for the adapter
    const nextConfigForAdapter = {
      basePath: nextConfig.basePath ?? "",
      distDir: nextConfig.distDir ?? ".next",
      isProduction: process.env["NODE_ENV"] === "production",
    };

    // Create the PWA build adapter
    const pwaAdapter = _createPWABuildAdapter({
      config: validatedConfig,
      nextConfig: nextConfigForAdapter,
    });

    // Get existing build adapters or initialize empty array
    const existingAdapters = nextConfig.buildAdapters ?? [];

    // Check if PWA adapter is already registered (avoid duplicates)
    const hasPWAAdapter = existingAdapters.some(
      (adapter) => adapter.name === "next-pwa-turbo"
    );

    if (hasPWAAdapter) {
      logger.warn(
        "PWA adapter is already registered. Skipping duplicate registration."
      );
      return nextConfig;
    }

    // Return the enhanced configuration
    return {
      ...nextConfig,
      buildAdapters: [...existingAdapters, pwaAdapter],
    };
  };
}

// =============================================================================
// Default Export
// =============================================================================

/**
 * Default export is the withPWA function for convenient importing
 *
 * @example
 * ```ts
 * import withPWA from 'next-pwa-turbo';
 *
 * export default withPWA({ dest: 'public' })(nextConfig);
 * ```
 */
export default withPWA;
