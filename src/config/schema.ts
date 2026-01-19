/**
 * PWA Configuration Schema for next-pwa-turbo
 *
 * Zod-based validation for all PWA configuration options.
 * Compatible with Next.js 16 and Turbopack.
 */

import { z } from "zod";

// =============================================================================
// Security Validators
// =============================================================================

/**
 * Validates that a path does not contain path traversal sequences
 */
const safePathString = z.string().refine(
  (val) => {
    // Reject path traversal patterns
    const dangerousPatterns = [
      /\.\./,           // Parent directory traversal
      /^\//, // Absolute paths (for dest/scope that should be relative)
      /^[a-zA-Z]:\\/, // Windows absolute paths
      /%2e%2e/i,        // URL-encoded ..
      /%252e%252e/i,    // Double URL-encoded ..
    ];
    return !dangerousPatterns.some((pattern) => pattern.test(val));
  },
  { message: "Path contains potentially dangerous traversal sequences" }
);

/**
 * Validates that a filename is simple (no path separators)
 */
const simpleFilename = z.string().refine(
  (val) => {
    // Must not contain path separators or be empty
    if (!val || val.length === 0) return false;
    if (val.includes("/") || val.includes("\\")) return false;
    if (val.includes("..")) return false;
    // Must end with .js
    if (!val.endsWith(".js")) return false;
    // Reject null bytes and other control characters
    if (/[\x00-\x1f]/.test(val)) return false;
    return true;
  },
  {
    message:
      "Service worker filename must be a simple .js filename without path separators",
  }
);

/**
 * Validates scope is a valid URL path
 */
const scopePath = z.string().refine(
  (val) => {
    // Scope must start with /
    if (!val.startsWith("/")) return false;
    // Reject path traversal
    if (val.includes("..")) return false;
    // Reject encoded traversal
    if (/%2e%2e/i.test(val)) return false;
    // Reject null bytes
    if (/[\x00-\x1f]/.test(val)) return false;
    return true;
  },
  { message: "Scope must be a valid URL path starting with /" }
);

// =============================================================================
// Caching Strategy Types
// =============================================================================

const CacheStrategySchema = z.enum([
  "CacheFirst",
  "CacheOnly",
  "NetworkFirst",
  "NetworkOnly",
  "StaleWhileRevalidate",
]);

/**
 * Expiration plugin options
 */
const ExpirationOptionsSchema = z
  .object({
    maxEntries: z.number().int().positive().optional(),
    maxAgeSeconds: z.number().int().positive().optional(),
    matchOptions: z
      .object({
        ignoreSearch: z.boolean().optional(),
        ignoreMethod: z.boolean().optional(),
        ignoreVary: z.boolean().optional(),
      })
      .strict()
      .optional(),
    purgeOnQuotaError: z.boolean().optional(),
  })
  .strict();

/**
 * Broadcast update plugin options
 */
const BroadcastUpdateOptionsSchema = z
  .object({
    channelName: z.string().optional(),
    headersToCheck: z.array(z.string()).optional(),
    generatePayload: z.function().optional(),
  })
  .strict();

/**
 * Cacheable response plugin options
 */
const CacheableResponseOptionsSchema = z
  .object({
    statuses: z.array(z.number().int().min(0).max(599)).optional(),
    headers: z.record(z.string(), z.string()).optional(),
  })
  .strict();

/**
 * Background sync plugin options
 */
const BackgroundSyncOptionsSchema = z
  .object({
    name: z.string(),
    forceSyncFallback: z.boolean().optional(),
    maxRetentionTime: z.number().int().positive().optional(),
    onSync: z.function().optional(),
  })
  .strict();

/**
 * Runtime caching options
 */
const RuntimeCachingOptionsSchema = z
  .object({
    cacheName: z.string().optional(),
    expiration: ExpirationOptionsSchema.optional(),
    networkTimeoutSeconds: z.number().positive().optional(),
    plugins: z.array(z.unknown()).optional(),
    fetchOptions: z
      .object({
        credentials: z
          .enum(["omit", "same-origin", "include"])
          .optional(),
        headers: z.record(z.string(), z.string()).optional(),
        integrity: z.string().optional(),
        mode: z
          .enum(["cors", "no-cors", "same-origin", "navigate"])
          .optional(),
        redirect: z.enum(["follow", "error", "manual"]).optional(),
        referrer: z.string().optional(),
        referrerPolicy: z
          .enum([
            "no-referrer",
            "no-referrer-when-downgrade",
            "origin",
            "origin-when-cross-origin",
            "same-origin",
            "strict-origin",
            "strict-origin-when-cross-origin",
            "unsafe-url",
          ])
          .optional(),
      })
      .strict()
      .optional(),
    matchOptions: z
      .object({
        ignoreSearch: z.boolean().optional(),
        ignoreMethod: z.boolean().optional(),
        ignoreVary: z.boolean().optional(),
      })
      .strict()
      .optional(),
    broadcastUpdate: BroadcastUpdateOptionsSchema.optional(),
    cacheableResponse: CacheableResponseOptionsSchema.optional(),
    backgroundSync: BackgroundSyncOptionsSchema.optional(),
    rangeRequests: z.boolean().optional(),
  })
  .strict();

/**
 * Arguments passed to URL pattern matching functions.
 * Based on Workbox's RouteMatchCallback parameters.
 *
 * Note: The `event` field is typed loosely since FetchEvent is only
 * available in ServiceWorker context. At runtime in the service worker,
 * it will be a proper FetchEvent.
 */
export interface RouteMatchCallbackOptions {
  /** The URL being matched */
  url: URL;
  /** The Request object being matched */
  request: Request;
  /**
   * The FetchEvent triggering the request.
   * Typed as Event for compatibility outside ServiceWorker context.
   * At runtime in the SW, this will be a FetchEvent.
   */
  event?: Event;
  /** Whether the request is to the same origin */
  sameOrigin: boolean;
}

/**
 * Function type for custom URL pattern matching.
 * Returns true if the route should handle this request.
 */
export type RouteMatchCallback = (options: RouteMatchCallbackOptions) => boolean;

/**
 * Runtime caching rule
 */
const RuntimeCachingRuleSchema = z
  .object({
    urlPattern: z.union([
      z.string(),
      z.instanceof(RegExp),
      // Also accept a function for dynamic matching (Workbox RouteMatchCallback)
      z.custom<RouteMatchCallback>(
        (val) => typeof val === "function",
        { message: "urlPattern function must return boolean" }
      ),
    ]),
    handler: CacheStrategySchema,
    method: z
      .enum(["GET", "POST", "PUT", "DELETE", "HEAD", "PATCH", "OPTIONS"])
      .optional(),
    options: RuntimeCachingOptionsSchema.optional(),
  })
  .strict();

// =============================================================================
// Precaching Types
// =============================================================================

/**
 * Additional manifest entry
 */
const ManifestEntrySchema = z.union([
  z.string(),
  z
    .object({
      url: z.string(),
      revision: z.string().nullable(),
      integrity: z.string().optional(),
    })
    .strict(),
]);

/**
 * Manifest transform function type
 */
const ManifestTransformSchema = z.function().args(
  z.array(ManifestEntrySchema),
  z.unknown() // compilation context
).returns(
  z.union([
    z.object({
      manifest: z.array(ManifestEntrySchema),
      warnings: z.array(z.string()).optional(),
    }),
    z.promise(
      z.object({
        manifest: z.array(ManifestEntrySchema),
        warnings: z.array(z.string()).optional(),
      })
    ),
  ])
);

// =============================================================================
// Fallbacks Configuration
// =============================================================================

const FallbacksSchema = z
  .object({
    document: z.string().optional(),
    image: z.string().optional(),
    audio: z.string().optional(),
    video: z.string().optional(),
    font: z.string().optional(),
  })
  .strict();

// =============================================================================
// Development Options
// =============================================================================

const DevOptionsSchema = z
  .object({
    enabled: z.boolean().default(false),
    warmCache: z.array(z.string()).optional(),
    swUrl: z.string().optional(),
  })
  .strict();

// =============================================================================
// Main PWA Config Schema
// =============================================================================

export const PWAConfigSchema = z
  .object({
    // =========================================================================
    // Core Options
    // =========================================================================

    /**
     * Output directory for the service worker file.
     * @default 'public'
     */
    dest: safePathString.default("public"),

    /**
     * Disable PWA functionality entirely.
     * Useful for conditional enabling based on environment.
     * @default false
     */
    disable: z.boolean().default(false),

    /**
     * Automatically register the service worker on page load.
     * Set to false if you want to handle registration manually.
     * @default true
     */
    register: z.boolean().default(true),

    /**
     * The scope of the service worker.
     * Controls which pages the SW can control.
     * @default '/'
     */
    scope: scopePath.default("/"),

    /**
     * The filename for the generated service worker.
     * @default 'sw.js'
     */
    sw: simpleFilename.default("sw.js"),

    // =========================================================================
    // Caching Options
    // =========================================================================

    /**
     * Runtime caching rules for handling fetch requests.
     * Each rule specifies a URL pattern and caching strategy.
     */
    runtimeCaching: z.array(RuntimeCachingRuleSchema).optional(),

    /**
     * Whether the service worker should skip waiting and activate immediately.
     * @default true
     */
    skipWaiting: z.boolean().default(true),

    /**
     * Whether to claim all clients immediately after activation.
     * @default true
     */
    clientsClaim: z.boolean().default(true),

    /**
     * Whether to clean up outdated caches from previous versions.
     * @default true
     */
    cleanupOutdatedCaches: z.boolean().default(true),

    /**
     * Enable navigation preload for faster navigation requests.
     * @default true
     */
    navigationPreload: z.boolean().default(true),

    // =========================================================================
    // Precaching Options
    // =========================================================================

    /**
     * Glob patterns for files in the public directory to exclude from precaching.
     * @default []
     */
    publicExcludes: z.array(z.string()).default([]),

    /**
     * Patterns for build output files to exclude from precaching.
     * Can be strings (glob patterns) or RegExp objects.
     * @default []
     */
    buildExcludes: z
      .array(z.union([z.string(), z.instanceof(RegExp)]))
      .default([]),

    /**
     * Additional entries to add to the precache manifest.
     */
    additionalManifestEntries: z.array(ManifestEntrySchema).optional(),

    /**
     * URL prefix modifications for precached assets.
     * Keys are the original prefixes, values are the replacement prefixes.
     */
    modifyURLPrefix: z.record(z.string(), z.string()).optional(),

    /**
     * Functions to transform the precache manifest before it's used.
     */
    manifestTransforms: z.array(ManifestTransformSchema).optional(),

    // =========================================================================
    // Offline Fallback Options
    // =========================================================================

    /**
     * Fallback URLs for different types of requests when offline.
     */
    fallbacks: FallbacksSchema.optional(),

    /**
     * Whether to cache pages during frontend navigation.
     * When enabled, pages visited via client-side navigation will be cached.
     * @default false
     */
    cacheOnFrontEndNav: z.boolean().default(false),

    // =========================================================================
    // Development Options
    // =========================================================================

    /**
     * Configuration for development mode.
     */
    devOptions: DevOptionsSchema.optional(),

    // =========================================================================
    // Advanced Options
    // =========================================================================

    /**
     * Path to a custom service worker source file.
     * The custom code will be bundled with the generated SW.
     */
    customWorkerSrc: z.string().optional(),

    /**
     * Custom destination path for the custom worker.
     */
    customWorkerDest: z.string().optional(),

    /**
     * Prefix for custom worker output files.
     * @default 'worker-'
     */
    customWorkerPrefix: z.string().default("worker-"),

    /**
     * Whether to enable dynamic start URL handling.
     * When true, the start_url can be dynamic based on user session.
     * @default true
     */
    dynamicStartUrl: z.boolean().default(true),

    /**
     * URL to redirect to for dynamic start URL when offline.
     */
    dynamicStartUrlRedirect: z.string().optional(),

    /**
     * Whether to reload the page when coming back online.
     * @default true
     */
    reloadOnOnline: z.boolean().default(true),

    /**
     * Next.js basePath configuration.
     * Must match the basePath in next.config.js if set.
     */
    basePath: z.string().optional(),
  })
  .strict();

// =============================================================================
// Type Exports
// =============================================================================

/**
 * TypeScript type for PWA configuration.
 * Inferred from the Zod schema.
 */
export type PWAConfig = z.infer<typeof PWAConfigSchema>;

/**
 * Input type for PWA configuration (before defaults are applied).
 */
export type PWAConfigInput = z.input<typeof PWAConfigSchema>;

/**
 * Runtime caching rule type
 */
export type RuntimeCachingRule = z.infer<typeof RuntimeCachingRuleSchema>;

/**
 * Cache strategy type
 */
export type CacheStrategy = z.infer<typeof CacheStrategySchema>;

/**
 * Fallbacks configuration type
 */
export type Fallbacks = z.infer<typeof FallbacksSchema>;

/**
 * Development options type
 */
export type DevOptions = z.infer<typeof DevOptionsSchema>;

// =============================================================================
// Validation Function
// =============================================================================

/**
 * Error class for PWA configuration validation errors
 */
export class PWAConfigValidationError extends Error {
  public readonly issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    const message = issues
      .map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
        return `${path}${issue.message}`;
      })
      .join("\n");

    super(`PWA configuration validation failed:\n${message}`);
    this.name = "PWAConfigValidationError";
    this.issues = issues;
  }
}

/**
 * Validates and parses PWA configuration.
 *
 * @param config - The configuration object to validate
 * @returns The validated and parsed configuration with defaults applied
 * @throws {PWAConfigValidationError} If validation fails
 *
 * @example
 * ```ts
 * import { validateConfig } from 'next-pwa-turbo/config';
 *
 * const config = validateConfig({
 *   disable: process.env.NODE_ENV === 'development',
 *   dest: 'public',
 *   sw: 'sw.js',
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
 * });
 * ```
 */
export function validateConfig(config: unknown): PWAConfig {
  const result = PWAConfigSchema.safeParse(config);

  if (!result.success) {
    throw new PWAConfigValidationError(result.error.issues);
  }

  return result.data;
}

/**
 * Safely validates PWA configuration without throwing.
 *
 * @param config - The configuration object to validate
 * @returns A result object with either the parsed config or error details
 *
 * @example
 * ```ts
 * const result = safeValidateConfig(userConfig);
 * if (result.success) {
 *   console.log('Valid config:', result.data);
 * } else {
 *   console.error('Invalid config:', result.error.issues);
 * }
 * ```
 */
export function safeValidateConfig(config: unknown): z.SafeParseReturnType<unknown, PWAConfig> {
  return PWAConfigSchema.safeParse(config);
}

/**
 * Get the default configuration with all defaults applied.
 *
 * @returns The default PWA configuration
 */
export function getDefaultConfig(): PWAConfig {
  return PWAConfigSchema.parse({});
}
