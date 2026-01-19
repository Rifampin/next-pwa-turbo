/**
 * Default Runtime Caching Strategies for next-pwa-turbo
 *
 * This module provides the 13 default caching strategies that cover common
 * PWA caching patterns. These strategies are based on the original next-pwa
 * defaults but optimized for Next.js 16 and Turbopack.
 *
 * Strategies are ordered from most specific to least specific (catch-all last).
 */

import type { RuntimeCachingRule, RouteMatchCallbackOptions } from "../config/schema.js";

// =============================================================================
// Constants
// =============================================================================

/** Seconds in a day */
const DAY_IN_SECONDS = 24 * 60 * 60;

/** Seconds in a year */
const YEAR_IN_SECONDS = 365 * DAY_IN_SECONDS;

// =============================================================================
// Type Exports
// =============================================================================

/**
 * Runtime caching rule with required cacheName for defaults.
 * All default rules have a cacheName defined.
 */
export type DefaultRuntimeCachingRule = RuntimeCachingRule & {
  options: {
    cacheName: string;
  };
};

// =============================================================================
// Default Runtime Caching Strategies
// =============================================================================

/**
 * Returns the 13 default runtime caching strategies for PWA.
 *
 * These strategies cover:
 * 1. Google Fonts stylesheets (StaleWhileRevalidate)
 * 2. Google Fonts webfonts (CacheFirst with long expiration)
 * 3. Static assets from CDNs (CacheFirst)
 * 4. Images (CacheFirst)
 * 5. Audio (CacheFirst)
 * 6. Video (CacheFirst)
 * 7. JavaScript from same origin (StaleWhileRevalidate)
 * 8. CSS from same origin (StaleWhileRevalidate)
 * 9. API routes (NetworkFirst with timeout)
 * 10. Same origin GET requests (NetworkFirst)
 * 11. Cross origin GET requests (NetworkFirst)
 * 12. Static files by extension (CacheFirst)
 * 13. Catch-all fallback (NetworkFirst)
 *
 * @returns Array of runtime caching rules
 *
 * @example
 * ```ts
 * import { getDefaultRuntimeCaching } from 'next-pwa-turbo/worker';
 *
 * const config = {
 *   runtimeCaching: getDefaultRuntimeCaching(),
 * };
 * ```
 */
export function getDefaultRuntimeCaching(): DefaultRuntimeCachingRule[] {
  return [
    // =========================================================================
    // 1. Google Fonts Stylesheets
    // =========================================================================
    // Google Fonts serves CSS that references the actual font files.
    // StaleWhileRevalidate ensures fast loads while keeping styles fresh.
    {
      urlPattern: "^https://fonts\\.googleapis\\.com/.*",
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "google-fonts-stylesheets",
      },
    },

    // =========================================================================
    // 2. Google Fonts Webfonts
    // =========================================================================
    // The actual font files from Google Fonts. These rarely change,
    // so CacheFirst with long expiration is ideal.
    {
      urlPattern: "^https://fonts\\.gstatic\\.com/.*",
      handler: "CacheFirst",
      options: {
        cacheName: "google-fonts-webfonts",
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: YEAR_IN_SECONDS,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },

    // =========================================================================
    // 3. Static Assets from CDNs
    // =========================================================================
    // Common CDN patterns for static assets (js, css, images, etc.)
    // CacheFirst with long expiration since CDN assets are typically versioned.
    {
      urlPattern:
        "^https://cdn\\.jsdelivr\\.net/.*|^https://cdnjs\\.cloudflare\\.com/.*|^https://unpkg\\.com/.*",
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: YEAR_IN_SECONDS,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },

    // =========================================================================
    // 4. Images
    // =========================================================================
    // Match requests by destination type 'image'.
    // CacheFirst is appropriate since images are typically immutable once deployed.
    // Uses a function matcher to check request.destination.
    {
      urlPattern: ({ request }: RouteMatchCallbackOptions) =>
        request.destination === "image",
      handler: "CacheFirst",
      options: {
        cacheName: "images",
        expiration: {
          maxEntries: 60,
          maxAgeSeconds: 30 * DAY_IN_SECONDS,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },

    // =========================================================================
    // 5. Audio
    // =========================================================================
    // Match audio requests by destination.
    // CacheFirst for offline playback capability.
    {
      urlPattern: ({ request }: RouteMatchCallbackOptions) =>
        request.destination === "audio",
      handler: "CacheFirst",
      options: {
        cacheName: "audio",
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 30 * DAY_IN_SECONDS,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
        rangeRequests: true,
      },
    },

    // =========================================================================
    // 6. Video
    // =========================================================================
    // Match video requests by destination.
    // CacheFirst with range request support for streaming.
    {
      urlPattern: ({ request }: RouteMatchCallbackOptions) =>
        request.destination === "video",
      handler: "CacheFirst",
      options: {
        cacheName: "video",
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 30 * DAY_IN_SECONDS,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
        rangeRequests: true,
      },
    },

    // =========================================================================
    // 7. JavaScript from Same Origin
    // =========================================================================
    // JS files from same origin (Next.js bundles).
    // StaleWhileRevalidate ensures fast loads while checking for updates.
    {
      urlPattern: ({ request, sameOrigin }: RouteMatchCallbackOptions) =>
        sameOrigin && request.destination === "script",
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "js",
      },
    },

    // =========================================================================
    // 8. CSS from Same Origin
    // =========================================================================
    // CSS files from same origin.
    // StaleWhileRevalidate for fast loads with background updates.
    {
      urlPattern: ({ request, sameOrigin }: RouteMatchCallbackOptions) =>
        sameOrigin && request.destination === "style",
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "css",
      },
    },

    // =========================================================================
    // 9. API Routes
    // =========================================================================
    // Next.js API routes need to be network-first to ensure fresh data.
    // Timeout ensures we fallback to cache if network is slow.
    {
      urlPattern: "^/api/.*",
      handler: "NetworkFirst",
      method: "GET",
      options: {
        cacheName: "apis",
        networkTimeoutSeconds: 10,
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },

    // =========================================================================
    // 10. Same Origin GET Requests (Pages)
    // =========================================================================
    // HTML pages and other same-origin resources.
    // NetworkFirst ensures users get fresh content when online.
    {
      urlPattern: ({ sameOrigin }: RouteMatchCallbackOptions) => sameOrigin,
      handler: "NetworkFirst",
      method: "GET",
      options: {
        cacheName: "pages",
        networkTimeoutSeconds: 10,
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },

    // =========================================================================
    // 11. Cross Origin GET Requests
    // =========================================================================
    // External API calls and resources from other domains.
    // NetworkFirst with timeout for API reliability.
    {
      urlPattern: ({ sameOrigin }: RouteMatchCallbackOptions) => !sameOrigin,
      handler: "NetworkFirst",
      method: "GET",
      options: {
        cacheName: "cross-origin",
        networkTimeoutSeconds: 10,
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },

    // =========================================================================
    // 12. Static Files by Extension
    // =========================================================================
    // Common static file extensions (icons, fonts, etc.)
    // CacheFirst since these files rarely change.
    {
      urlPattern: "\\.(ico|png|svg|txt|woff2?)$",
      handler: "CacheFirst",
      options: {
        cacheName: "static-files",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: YEAR_IN_SECONDS,
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },

    // =========================================================================
    // 13. Catch-all Fallback
    // =========================================================================
    // Matches any request not handled by the above rules.
    // NetworkFirst ensures we try to get fresh content first.
    {
      urlPattern: ".*",
      handler: "NetworkFirst",
      options: {
        cacheName: "others",
        networkTimeoutSeconds: 10,
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
  ];
}

// =============================================================================
// Merge Utilities
// =============================================================================

/**
 * Normalizes a URL pattern to a string for comparison.
 * Functions are converted to their string representation.
 * RegExp objects are converted to their source.
 *
 * @param pattern - The URL pattern to normalize
 * @returns A string representation for comparison
 */
function normalizeUrlPattern(
  pattern: RuntimeCachingRule["urlPattern"]
): string {
  if (typeof pattern === "string") {
    return pattern;
  }
  if (pattern instanceof RegExp) {
    return pattern.source;
  }
  if (typeof pattern === "function") {
    // For functions, use toString() for comparison
    // This allows detecting duplicate function matchers
    return pattern.toString();
  }
  return String(pattern);
}

/**
 * Merges custom runtime caching rules with default rules.
 *
 * Custom rules take precedence over defaults with the same urlPattern.
 * This allows users to override specific strategies while keeping
 * the rest of the defaults.
 *
 * @param custom - User-defined caching rules
 * @param defaults - Default caching rules (from getDefaultRuntimeCaching)
 * @returns Merged array with custom rules first, then non-conflicting defaults
 *
 * @example
 * ```ts
 * import { mergeRuntimeCaching, getDefaultRuntimeCaching } from 'next-pwa-turbo/worker';
 *
 * const customRules = [
 *   {
 *     urlPattern: '^/api/.*',
 *     handler: 'CacheFirst', // Override default NetworkFirst for APIs
 *     options: { cacheName: 'my-api-cache' },
 *   },
 * ];
 *
 * const allRules = mergeRuntimeCaching(customRules, getDefaultRuntimeCaching());
 * ```
 */
export function mergeRuntimeCaching(
  custom: RuntimeCachingRule[],
  defaults: RuntimeCachingRule[]
): RuntimeCachingRule[] {
  // Create a Set of normalized custom patterns for fast lookup
  const customPatterns = new Set(
    custom.map((rule) => normalizeUrlPattern(rule.urlPattern))
  );

  // Filter out defaults that have the same pattern as custom rules
  const filteredDefaults = defaults.filter(
    (defaultRule) =>
      !customPatterns.has(normalizeUrlPattern(defaultRule.urlPattern))
  );

  // Custom rules come first (higher priority), then non-conflicting defaults
  return [...custom, ...filteredDefaults];
}

// =============================================================================
// Convenience Exports
// =============================================================================

/**
 * Pre-built default caching rules.
 * Use getDefaultRuntimeCaching() if you need a fresh copy to modify.
 */
export const DEFAULT_RUNTIME_CACHING = getDefaultRuntimeCaching();
