/**
 * next-pwa-turbo Worker Utilities
 *
 * This module exports utilities for service worker runtime caching,
 * including default caching strategies, merge utilities, and offline
 * fallback configuration.
 *
 * @module next-pwa-turbo/worker
 *
 * @example
 * ```ts
 * import {
 *   getDefaultRuntimeCaching,
 *   mergeRuntimeCaching,
 *   getFallbackPrecacheEntries,
 *   validateFallbacks,
 * } from 'next-pwa-turbo/worker';
 *
 * const customRules = [
 *   {
 *     urlPattern: '^/api/special/.*',
 *     handler: 'CacheFirst',
 *     options: { cacheName: 'special-api' },
 *   },
 * ];
 *
 * const allRules = mergeRuntimeCaching(customRules, getDefaultRuntimeCaching());
 *
 * // Configure offline fallbacks
 * const fallbacks = {
 *   document: '/_offline',
 *   image: '/fallback.png',
 * };
 *
 * const precacheUrls = getFallbackPrecacheEntries(fallbacks);
 * ```
 */

export {
  getDefaultRuntimeCaching,
  mergeRuntimeCaching,
  DEFAULT_RUNTIME_CACHING,
} from "./cache-strategies.js";

export type { DefaultRuntimeCachingRule } from "./cache-strategies.js";

// Offline fallback utilities
export {
  getFallbackPrecacheEntries,
  generateCatchHandlerCode,
  validateFallbacks,
  toFallbackConfig,
  hasFallbacks,
  FALLBACK_CACHE_NAME,
} from "./offline-fallback.js";

export type { FallbackConfig } from "./offline-fallback.js";
