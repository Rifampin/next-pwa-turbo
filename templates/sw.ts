/**
 * Default Service Worker Template for next-pwa-turbo
 *
 * This template is compiled by esbuild with injected globals.
 * Users can customize this file or provide their own service worker.
 */

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute, setCatchHandler } from 'workbox-routing';
import {
  CacheFirst,
  CacheOnly,
  NetworkFirst,
  NetworkOnly,
  StaleWhileRevalidate,
} from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { skipWaiting, clientsClaim } from 'workbox-core';

// Injected globals (defined at compile time by esbuild)
declare const __PWA_PRECACHE_MANIFEST__: Array<{ url: string; revision: string | null }>;
declare const __PWA_RUNTIME_CACHING__: Array<{
  urlPattern: string;
  handler: 'CacheFirst' | 'CacheOnly' | 'NetworkFirst' | 'NetworkOnly' | 'StaleWhileRevalidate';
  options?: {
    cacheName?: string;
    expiration?: { maxEntries?: number; maxAgeSeconds?: number };
    networkTimeoutSeconds?: number;
  };
}>;
declare const __PWA_SCOPE__: string;
declare const __PWA_SKIP_WAITING__: boolean;
declare const __PWA_CLIENT_CLAIM__: boolean;
declare const __PWA_OFFLINE_FALLBACK_PAGE__: string | null;

/**
 * Comprehensive fallback configuration for different request types.
 * Each property is a URL to serve when that type of request fails.
 */
declare const __PWA_FALLBACKS__: {
  /** Fallback for navigation requests (HTML pages) */
  document?: string;
  /** Fallback for image requests */
  image?: string;
  /** Fallback for font requests */
  font?: string;
  /** Fallback for audio requests */
  audio?: string;
  /** Fallback for video requests */
  video?: string;
} | null;

// Type the service worker global scope
declare const self: ServiceWorkerGlobalScope;

// ---------------------------------------------------------------------------
// Lifecycle: Skip Waiting and Client Claim
// ---------------------------------------------------------------------------

if (__PWA_SKIP_WAITING__) {
  skipWaiting();
}

if (__PWA_CLIENT_CLAIM__) {
  clientsClaim();
}

// ---------------------------------------------------------------------------
// Precaching
// ---------------------------------------------------------------------------

// Clean up outdated caches from previous versions
cleanupOutdatedCaches();

// Precache and route the manifest entries
precacheAndRoute(__PWA_PRECACHE_MANIFEST__);

// ---------------------------------------------------------------------------
// Runtime Caching
// ---------------------------------------------------------------------------

// Map handler names to Workbox strategy classes
const strategyMap = {
  CacheFirst,
  CacheOnly,
  NetworkFirst,
  NetworkOnly,
  StaleWhileRevalidate,
} as const;

// Register runtime caching routes
for (const route of __PWA_RUNTIME_CACHING__) {
  const StrategyClass = strategyMap[route.handler];

  if (!StrategyClass) {
    console.warn(`[next-pwa] Unknown caching strategy: ${route.handler}`);
    continue;
  }

  // Build strategy options
  const strategyOptions: {
    cacheName?: string;
    plugins?: ExpirationPlugin[];
    networkTimeoutSeconds?: number;
  } = {};

  if (route.options?.cacheName) {
    strategyOptions.cacheName = route.options.cacheName;
  }

  if (route.options?.expiration) {
    strategyOptions.plugins = [
      new ExpirationPlugin({
        maxEntries: route.options.expiration.maxEntries,
        maxAgeSeconds: route.options.expiration.maxAgeSeconds,
      }),
    ];
  }

  if (route.options?.networkTimeoutSeconds) {
    strategyOptions.networkTimeoutSeconds = route.options.networkTimeoutSeconds;
  }

  // Register the route with a RegExp pattern
  registerRoute(new RegExp(route.urlPattern), new StrategyClass(strategyOptions));
}

// ---------------------------------------------------------------------------
// Offline Fallback
// ---------------------------------------------------------------------------

// Cache name for offline fallback assets
const FALLBACK_CACHE_NAME = 'offline-fallbacks';

/**
 * Helper function to attempt serving a fallback from cache.
 * Returns the cached response if found, or null if not cached.
 */
async function tryServeFallback(fallbackUrl: string | undefined): Promise<Response | null> {
  if (!fallbackUrl) {
    return null;
  }

  try {
    const cachedResponse = await caches.match(fallbackUrl);
    return cachedResponse || null;
  } catch {
    // Cache match failed - return null to fall through to Response.error()
    return null;
  }
}

/**
 * Comprehensive fallback handler supporting multiple request types.
 * Uses __PWA_FALLBACKS__ if configured, otherwise falls back to legacy
 * __PWA_OFFLINE_FALLBACK_PAGE__ for backwards compatibility.
 */
if (__PWA_FALLBACKS__) {
  const fallbacks = __PWA_FALLBACKS__;

  // Register a catch handler that serves appropriate fallbacks based on request type
  setCatchHandler(async ({ request }) => {
    // Navigation requests (HTML pages) - check both mode and destination
    if (request.mode === 'navigate' || request.destination === 'document') {
      const response = await tryServeFallback(fallbacks.document);
      if (response) {
        return response;
      }
    }

    // Image requests
    if (request.destination === 'image') {
      const response = await tryServeFallback(fallbacks.image);
      if (response) {
        return response;
      }
    }

    // Font requests
    if (request.destination === 'font') {
      const response = await tryServeFallback(fallbacks.font);
      if (response) {
        return response;
      }
    }

    // Audio requests
    if (request.destination === 'audio') {
      const response = await tryServeFallback(fallbacks.audio);
      if (response) {
        return response;
      }
    }

    // Video requests
    if (request.destination === 'video') {
      const response = await tryServeFallback(fallbacks.video);
      if (response) {
        return response;
      }
    }

    // No matching fallback or fallback not cached - return error response
    return Response.error();
  });

  // Ensure all fallback assets are cached on install
  self.addEventListener('install', (event) => {
    const fallbackUrls: string[] = [];

    if (fallbacks.document) fallbackUrls.push(fallbacks.document);
    if (fallbacks.image) fallbackUrls.push(fallbacks.image);
    if (fallbacks.font) fallbackUrls.push(fallbacks.font);
    if (fallbacks.audio) fallbackUrls.push(fallbacks.audio);
    if (fallbacks.video) fallbackUrls.push(fallbacks.video);

    if (fallbackUrls.length > 0) {
      event.waitUntil(
        caches.open(FALLBACK_CACHE_NAME).then((cache) => {
          // Add all fallback URLs to cache, ignoring failures for individual URLs
          return Promise.allSettled(
            fallbackUrls.map((url) => cache.add(url))
          ).then((results) => {
            // Log any failed precache attempts
            results.forEach((result, index) => {
              if (result.status === 'rejected') {
                console.warn(
                  `[next-pwa] Failed to cache fallback: ${fallbackUrls[index]}`,
                  result.reason
                );
              }
            });
          });
        })
      );
    }
  });
} else if (__PWA_OFFLINE_FALLBACK_PAGE__) {
  // Legacy fallback support for backwards compatibility
  const offlineFallbackPage = __PWA_OFFLINE_FALLBACK_PAGE__;

  setCatchHandler(async ({ request }) => {
    // Only handle navigation requests (HTML pages)
    if (request.mode === 'navigate' || request.destination === 'document') {
      const response = await tryServeFallback(offlineFallbackPage);
      if (response) {
        return response;
      }
    }

    // For non-navigation requests or if fallback not cached, return error response
    return Response.error();
  });

  // Ensure the offline fallback page is cached on install
  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(FALLBACK_CACHE_NAME).then((cache) => {
        return cache.add(offlineFallbackPage);
      })
    );
  });
}

// ---------------------------------------------------------------------------
// Lifecycle Events (Debug Logging)
// ---------------------------------------------------------------------------

self.addEventListener('install', (event) => {
  console.log('[next-pwa] Service worker installing...', event);
});

self.addEventListener('activate', (event) => {
  console.log('[next-pwa] Service worker activated', event);
});

// Export empty object to satisfy TypeScript module requirements
export {};
