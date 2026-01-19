/**
 * Offline Fallback Utilities for next-pwa-turbo
 *
 * This module provides utilities for generating offline fallback handlers
 * in the service worker. It supports fallbacks for different request types:
 * - document: Navigation requests (HTML pages)
 * - image: Image requests
 * - font: Font requests
 * - audio: Audio requests
 * - video: Video requests
 *
 * @module next-pwa-turbo/worker/offline-fallback
 */

import type { Fallbacks } from "../config/schema.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Configuration for offline fallback URLs.
 * Each property specifies a URL to serve when the corresponding
 * request type fails (e.g., due to being offline).
 */
export interface FallbackConfig {
  /** Fallback page for navigation requests (e.g., '/_offline') */
  document?: string;
  /** Fallback image (e.g., '/fallback.png') */
  image?: string;
  /** Fallback font (e.g., '/fallback.woff2') */
  font?: string;
  /** Fallback audio file (e.g., '/fallback.mp3') */
  audio?: string;
  /** Fallback video file (e.g., '/fallback.mp4') */
  video?: string;
}

/**
 * Cache name used for storing offline fallback assets.
 * This is a dedicated cache separate from other caching strategies.
 */
export const FALLBACK_CACHE_NAME = "offline-fallbacks";

// =============================================================================
// Precache Entry Generation
// =============================================================================

/**
 * Get URLs that need to be precached for offline fallbacks.
 *
 * Returns an array of fallback URLs that should be cached during
 * service worker installation to ensure they're available offline.
 *
 * @param fallbacks - The fallback configuration
 * @returns Array of fallback URLs to precache
 *
 * @example
 * ```ts
 * const fallbacks = {
 *   document: '/_offline',
 *   image: '/fallback.png',
 * };
 *
 * const urls = getFallbackPrecacheEntries(fallbacks);
 * // Returns ['/_offline', '/fallback.png']
 * ```
 */
export function getFallbackPrecacheEntries(fallbacks: FallbackConfig): string[] {
  const entries: string[] = [];

  if (fallbacks.document) {
    entries.push(fallbacks.document);
  }
  if (fallbacks.image) {
    entries.push(fallbacks.image);
  }
  if (fallbacks.font) {
    entries.push(fallbacks.font);
  }
  if (fallbacks.audio) {
    entries.push(fallbacks.audio);
  }
  if (fallbacks.video) {
    entries.push(fallbacks.video);
  }

  return entries;
}

// =============================================================================
// Catch Handler Code Generation
// =============================================================================

/**
 * Generate the catch handler code for the service worker.
 *
 * This code runs when a request fails (network error, offline, etc.)
 * and attempts to serve an appropriate fallback based on the request
 * destination type.
 *
 * The generated code:
 * 1. Checks the request destination (document, image, font, audio, video)
 * 2. Attempts to serve the corresponding fallback from the fallback cache
 * 3. Returns Response.error() if no fallback is available or cached
 *
 * @param fallbacks - The fallback configuration
 * @returns JavaScript code string to be injected into the service worker
 *
 * @example
 * ```ts
 * const fallbacks = {
 *   document: '/_offline',
 *   image: '/fallback.png',
 * };
 *
 * const code = generateCatchHandlerCode(fallbacks);
 * // Returns code that handles failed requests with appropriate fallbacks
 * ```
 */
export function generateCatchHandlerCode(fallbacks: FallbackConfig): string {
  // Build the switch cases for each fallback type
  const cases: string[] = [];

  // Document fallback - handles both 'document' destination and navigate mode
  if (fallbacks.document) {
    cases.push(`
    // Navigation requests (HTML pages)
    if (request.mode === 'navigate' || request.destination === 'document') {
      const fallbackResponse = await caches.match(${JSON.stringify(fallbacks.document)});
      if (fallbackResponse) {
        return fallbackResponse;
      }
    }`);
  }

  // Image fallback
  if (fallbacks.image) {
    cases.push(`
    // Image requests
    if (request.destination === 'image') {
      const fallbackResponse = await caches.match(${JSON.stringify(fallbacks.image)});
      if (fallbackResponse) {
        return fallbackResponse;
      }
    }`);
  }

  // Font fallback
  if (fallbacks.font) {
    cases.push(`
    // Font requests
    if (request.destination === 'font') {
      const fallbackResponse = await caches.match(${JSON.stringify(fallbacks.font)});
      if (fallbackResponse) {
        return fallbackResponse;
      }
    }`);
  }

  // Audio fallback
  if (fallbacks.audio) {
    cases.push(`
    // Audio requests
    if (request.destination === 'audio') {
      const fallbackResponse = await caches.match(${JSON.stringify(fallbacks.audio)});
      if (fallbackResponse) {
        return fallbackResponse;
      }
    }`);
  }

  // Video fallback
  if (fallbacks.video) {
    cases.push(`
    // Video requests
    if (request.destination === 'video') {
      const fallbackResponse = await caches.match(${JSON.stringify(fallbacks.video)});
      if (fallbackResponse) {
        return fallbackResponse;
      }
    }`);
  }

  // If no fallbacks configured, return a simple handler
  if (cases.length === 0) {
    return `
async ({ request }) => {
  return Response.error();
}`;
  }

  // Build the complete handler function
  return `
async ({ request }) => {
  ${cases.join("\n")}

  // No matching fallback or fallback not cached - return error response
  return Response.error();
}`;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validates a fallback configuration.
 *
 * Checks that:
 * - All fallback URLs are valid (non-empty strings starting with /)
 * - No path traversal attempts
 *
 * @param fallbacks - The fallback configuration to validate
 * @returns Object with isValid boolean and any error messages
 *
 * @example
 * ```ts
 * const result = validateFallbacks({ document: '/_offline' });
 * // Returns { isValid: true, errors: [] }
 *
 * const result = validateFallbacks({ document: '../etc/passwd' });
 * // Returns { isValid: false, errors: ['document fallback contains invalid path'] }
 * ```
 */
export function validateFallbacks(
  fallbacks: FallbackConfig
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  const validateUrl = (key: keyof FallbackConfig, url: string | undefined) => {
    if (url === undefined) {
      return;
    }

    if (typeof url !== "string") {
      errors.push(`${key} fallback must be a string`);
      return;
    }

    if (url.length === 0) {
      errors.push(`${key} fallback cannot be empty`);
      return;
    }

    if (!url.startsWith("/")) {
      errors.push(`${key} fallback must start with /`);
      return;
    }

    if (url.includes("..")) {
      errors.push(`${key} fallback contains invalid path traversal`);
      return;
    }

    if (url.includes("\0")) {
      errors.push(`${key} fallback contains null bytes`);
      return;
    }
  };

  validateUrl("document", fallbacks.document);
  validateUrl("image", fallbacks.image);
  validateUrl("font", fallbacks.font);
  validateUrl("audio", fallbacks.audio);
  validateUrl("video", fallbacks.video);

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// =============================================================================
// Type Conversion
// =============================================================================

/**
 * Converts the Zod Fallbacks type from config/schema.ts to FallbackConfig.
 *
 * This is essentially an identity function since the types are compatible,
 * but provides a clear boundary between configuration parsing and
 * service worker generation.
 *
 * @param fallbacks - Fallbacks from validated config
 * @returns FallbackConfig for service worker generation
 */
export function toFallbackConfig(fallbacks: Fallbacks): FallbackConfig {
  const config: FallbackConfig = {};

  if (fallbacks.document !== undefined) {
    config.document = fallbacks.document;
  }
  if (fallbacks.image !== undefined) {
    config.image = fallbacks.image;
  }
  if (fallbacks.font !== undefined) {
    config.font = fallbacks.font;
  }
  if (fallbacks.audio !== undefined) {
    config.audio = fallbacks.audio;
  }
  if (fallbacks.video !== undefined) {
    config.video = fallbacks.video;
  }

  return config;
}

/**
 * Checks if any fallbacks are configured.
 *
 * @param fallbacks - The fallback configuration
 * @returns true if at least one fallback is configured
 */
export function hasFallbacks(fallbacks: FallbackConfig | undefined | null): boolean {
  if (!fallbacks) {
    return false;
  }

  return !!(
    fallbacks.document ||
    fallbacks.image ||
    fallbacks.font ||
    fallbacks.audio ||
    fallbacks.video
  );
}
