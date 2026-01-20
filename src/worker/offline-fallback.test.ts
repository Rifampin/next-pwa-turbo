/**
 * Unit tests for offline fallback utilities
 *
 * These tests verify the fallback configuration, code generation, and validation.
 */

import { describe, it, expect } from 'vitest';
import {
  getFallbackPrecacheEntries,
  generateCatchHandlerCode,
  validateFallbacks,
  toFallbackConfig,
  hasFallbacks,
  FALLBACK_CACHE_NAME,
  type FallbackConfig,
} from './offline-fallback.js';

// =============================================================================
// Constants Tests
// =============================================================================

describe('FALLBACK_CACHE_NAME', () => {
  it('should be a string constant', () => {
    expect(typeof FALLBACK_CACHE_NAME).toBe('string');
    expect(FALLBACK_CACHE_NAME).toBe('offline-fallbacks');
  });
});

// =============================================================================
// getFallbackPrecacheEntries() Tests
// =============================================================================

describe('getFallbackPrecacheEntries', () => {
  it('should return empty array for empty config', () => {
    const entries = getFallbackPrecacheEntries({});
    expect(entries).toEqual([]);
  });

  it('should return document fallback URL', () => {
    const entries = getFallbackPrecacheEntries({
      document: '/_offline',
    });
    expect(entries).toEqual(['/_offline']);
  });

  it('should return all configured fallback URLs', () => {
    const entries = getFallbackPrecacheEntries({
      document: '/_offline',
      image: '/fallback.png',
      font: '/fallback.woff2',
      audio: '/fallback.mp3',
      video: '/fallback.mp4',
    });
    expect(entries).toHaveLength(5);
    expect(entries).toContain('/_offline');
    expect(entries).toContain('/fallback.png');
    expect(entries).toContain('/fallback.woff2');
    expect(entries).toContain('/fallback.mp3');
    expect(entries).toContain('/fallback.mp4');
  });

  it('should only return URLs that are defined', () => {
    const entries = getFallbackPrecacheEntries({
      document: '/_offline',
      image: '/fallback.png',
      // font, audio, video not defined
    });
    expect(entries).toHaveLength(2);
    expect(entries).toEqual(['/_offline', '/fallback.png']);
  });

  it('should preserve the order: document, image, font, audio, video', () => {
    const entries = getFallbackPrecacheEntries({
      video: '/fallback.mp4',
      document: '/_offline',
      audio: '/fallback.mp3',
      image: '/fallback.png',
      font: '/fallback.woff2',
    });
    expect(entries).toEqual([
      '/_offline',
      '/fallback.png',
      '/fallback.woff2',
      '/fallback.mp3',
      '/fallback.mp4',
    ]);
  });
});

// =============================================================================
// generateCatchHandlerCode() Tests
// =============================================================================

describe('generateCatchHandlerCode', () => {
  it('should return simple error handler for empty config', () => {
    const code = generateCatchHandlerCode({});
    expect(code).toContain('async ({ request })');
    expect(code).toContain('Response.error()');
    expect(code).not.toContain('caches.match');
  });

  it('should generate document fallback handler', () => {
    const code = generateCatchHandlerCode({
      document: '/_offline',
    });
    expect(code).toContain('async ({ request })');
    expect(code).toContain("request.mode === 'navigate'");
    expect(code).toContain("request.destination === 'document'");
    expect(code).toContain('caches.match("/_offline")');
    expect(code).toContain('Response.error()');
  });

  it('should generate image fallback handler', () => {
    const code = generateCatchHandlerCode({
      image: '/fallback.png',
    });
    expect(code).toContain("request.destination === 'image'");
    expect(code).toContain('caches.match("/fallback.png")');
  });

  it('should generate font fallback handler', () => {
    const code = generateCatchHandlerCode({
      font: '/fallback.woff2',
    });
    expect(code).toContain("request.destination === 'font'");
    expect(code).toContain('caches.match("/fallback.woff2")');
  });

  it('should generate audio fallback handler', () => {
    const code = generateCatchHandlerCode({
      audio: '/fallback.mp3',
    });
    expect(code).toContain("request.destination === 'audio'");
    expect(code).toContain('caches.match("/fallback.mp3")');
  });

  it('should generate video fallback handler', () => {
    const code = generateCatchHandlerCode({
      video: '/fallback.mp4',
    });
    expect(code).toContain("request.destination === 'video'");
    expect(code).toContain('caches.match("/fallback.mp4")');
  });

  it('should generate handler with multiple fallbacks', () => {
    const code = generateCatchHandlerCode({
      document: '/_offline',
      image: '/fallback.png',
      font: '/fallback.woff2',
    });
    expect(code).toContain('caches.match("/_offline")');
    expect(code).toContain('caches.match("/fallback.png")');
    expect(code).toContain('caches.match("/fallback.woff2")');
  });

  it('should properly escape special characters in URLs', () => {
    const code = generateCatchHandlerCode({
      document: '/offline?test=1',
    });
    // JSON.stringify should handle the escaping
    expect(code).toContain('"/offline?test=1"');
  });

  it('should always end with Response.error() fallback', () => {
    const code = generateCatchHandlerCode({
      document: '/_offline',
    });
    expect(code.trim().endsWith('Response.error();\n}')).toBe(true);
  });

  it('should use await with caches.match', () => {
    const code = generateCatchHandlerCode({
      document: '/_offline',
    });
    expect(code).toContain('await caches.match');
  });

  it('should check if fallbackResponse exists before returning', () => {
    const code = generateCatchHandlerCode({
      document: '/_offline',
    });
    expect(code).toContain('if (fallbackResponse)');
    expect(code).toContain('return fallbackResponse');
  });
});

// =============================================================================
// validateFallbacks() Tests
// =============================================================================

describe('validateFallbacks', () => {
  describe('valid configurations', () => {
    it('should accept empty config', () => {
      const result = validateFallbacks({});
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid document fallback', () => {
      const result = validateFallbacks({
        document: '/_offline',
      });
      expect(result.isValid).toBe(true);
    });

    it('should accept all valid fallbacks', () => {
      const result = validateFallbacks({
        document: '/_offline',
        image: '/fallback.png',
        font: '/fallback.woff2',
        audio: '/fallback.mp3',
        video: '/fallback.mp4',
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should accept paths with multiple segments', () => {
      const result = validateFallbacks({
        document: '/pages/offline/index.html',
        image: '/assets/images/fallback.png',
      });
      expect(result.isValid).toBe(true);
    });
  });

  describe('invalid configurations', () => {
    it('should reject URLs not starting with /', () => {
      const result = validateFallbacks({
        document: 'offline.html',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('document fallback must start with /');
    });

    it('should reject empty string', () => {
      const result = validateFallbacks({
        document: '',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('document fallback cannot be empty');
    });

    it('should reject path traversal', () => {
      const result = validateFallbacks({
        document: '/../secret/file',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('document fallback contains invalid path traversal');
    });

    it('should reject null bytes', () => {
      const result = validateFallbacks({
        document: '/offline\0.html',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('document fallback contains null bytes');
    });

    it('should reject non-string values', () => {
      const result = validateFallbacks({
        document: 123 as unknown as string,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('document fallback must be a string');
    });

    it('should collect multiple errors', () => {
      const result = validateFallbacks({
        document: '',
        image: 'no-slash.png',
        font: '/../traversal.woff2',
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe('edge cases', () => {
    it('should allow query strings in URLs', () => {
      // Query strings might be valid for cache busting
      const result = validateFallbacks({
        document: '/_offline?v=1',
      });
      expect(result.isValid).toBe(true);
    });

    it('should allow hash fragments in URLs', () => {
      const result = validateFallbacks({
        document: '/_offline#content',
      });
      expect(result.isValid).toBe(true);
    });
  });
});

// =============================================================================
// toFallbackConfig() Tests
// =============================================================================

describe('toFallbackConfig', () => {
  it('should convert empty Fallbacks to empty FallbackConfig', () => {
    const config = toFallbackConfig({});
    expect(config).toEqual({});
  });

  it('should convert all Fallbacks properties', () => {
    const fallbacks = {
      document: '/_offline',
      image: '/fallback.png',
      font: '/fallback.woff2',
      audio: '/fallback.mp3',
      video: '/fallback.mp4',
    };
    const config = toFallbackConfig(fallbacks);
    expect(config).toEqual(fallbacks);
  });

  it('should only include defined properties', () => {
    const fallbacks = {
      document: '/_offline',
      image: undefined,
    };
    const config = toFallbackConfig(fallbacks as any);
    expect(config).toEqual({ document: '/_offline' });
    expect(config).not.toHaveProperty('image');
  });

  it('should be identity function for valid Fallbacks', () => {
    const fallbacks = {
      document: '/_offline',
      image: '/fallback.png',
    };
    const config = toFallbackConfig(fallbacks);
    expect(config.document).toBe(fallbacks.document);
    expect(config.image).toBe(fallbacks.image);
  });
});

// =============================================================================
// hasFallbacks() Tests
// =============================================================================

describe('hasFallbacks', () => {
  it('should return false for undefined', () => {
    expect(hasFallbacks(undefined)).toBe(false);
  });

  it('should return false for null', () => {
    expect(hasFallbacks(null)).toBe(false);
  });

  it('should return false for empty object', () => {
    expect(hasFallbacks({})).toBe(false);
  });

  it('should return true for document fallback', () => {
    expect(hasFallbacks({ document: '/_offline' })).toBe(true);
  });

  it('should return true for image fallback', () => {
    expect(hasFallbacks({ image: '/fallback.png' })).toBe(true);
  });

  it('should return true for font fallback', () => {
    expect(hasFallbacks({ font: '/fallback.woff2' })).toBe(true);
  });

  it('should return true for audio fallback', () => {
    expect(hasFallbacks({ audio: '/fallback.mp3' })).toBe(true);
  });

  it('should return true for video fallback', () => {
    expect(hasFallbacks({ video: '/fallback.mp4' })).toBe(true);
  });

  it('should return true for multiple fallbacks', () => {
    expect(hasFallbacks({
      document: '/_offline',
      image: '/fallback.png',
    })).toBe(true);
  });

  it('should return false for object with only undefined values', () => {
    expect(hasFallbacks({
      document: undefined,
      image: undefined,
    } as unknown as FallbackConfig)).toBe(false);
  });

  it('should return true for object with at least one defined value', () => {
    expect(hasFallbacks({
      document: undefined,
      image: '/fallback.png',
    } as unknown as FallbackConfig)).toBe(true);
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('Integration', () => {
  it('should work together: validate -> toConfig -> getPrecacheEntries', () => {
    const fallbacks = {
      document: '/_offline',
      image: '/fallback.png',
    };

    // Step 1: Validate
    const validation = validateFallbacks(fallbacks);
    expect(validation.isValid).toBe(true);

    // Step 2: Convert to config
    const config = toFallbackConfig(fallbacks);
    expect(config.document).toBe('/_offline');

    // Step 3: Get precache entries
    const entries = getFallbackPrecacheEntries(config);
    expect(entries).toEqual(['/_offline', '/fallback.png']);
  });

  it('should generate valid JavaScript code', () => {
    const config: FallbackConfig = {
      document: '/_offline',
      image: '/fallback.png',
    };

    const code = generateCatchHandlerCode(config);

    // The generated code should be syntactically valid
    // We can't easily execute it without a service worker context,
    // but we can check for common syntax issues
    expect(code).not.toContain('undefined');
    expect(code).not.toContain('NaN');

    // Should be a complete async function
    expect(code).toContain('async ({ request })');
    expect(code.trim()).toMatch(/^\s*async.*\}\s*$/s);
  });
});
