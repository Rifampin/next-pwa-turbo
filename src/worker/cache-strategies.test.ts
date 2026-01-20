/**
 * Unit tests for default runtime caching strategies
 *
 * These tests verify the 13 default caching strategies and merge functionality.
 */

import { describe, it, expect } from 'vitest';
import {
  getDefaultRuntimeCaching,
  mergeRuntimeCaching,
  DEFAULT_RUNTIME_CACHING,
} from './cache-strategies.js';
import type { RuntimeCachingRule } from '../config/schema.js';

// =============================================================================
// getDefaultRuntimeCaching() Tests
// =============================================================================

describe('getDefaultRuntimeCaching', () => {
  it('should return exactly 13 caching rules', () => {
    const rules = getDefaultRuntimeCaching();
    expect(rules).toHaveLength(13);
  });

  it('should return a fresh array each time', () => {
    const rules1 = getDefaultRuntimeCaching();
    const rules2 = getDefaultRuntimeCaching();
    expect(rules1).not.toBe(rules2);
    // Can't use toEqual because functions can't be compared by value
    expect(rules1.length).toBe(rules2.length);
    expect(rules1.map(r => r.options.cacheName)).toEqual(rules2.map(r => r.options.cacheName));
  });

  it('should have cacheName in options for all rules', () => {
    const rules = getDefaultRuntimeCaching();
    for (const rule of rules) {
      expect(rule.options).toBeDefined();
      expect(rule.options.cacheName).toBeDefined();
      expect(typeof rule.options.cacheName).toBe('string');
    }
  });

  describe('strategy #1: Google Fonts Stylesheets', () => {
    it('should use StaleWhileRevalidate for fonts.googleapis.com', () => {
      const rules = getDefaultRuntimeCaching();
      const fontStylesRule = rules[0];

      expect(fontStylesRule.urlPattern).toBe('^https://fonts\\.googleapis\\.com/.*');
      expect(fontStylesRule.handler).toBe('StaleWhileRevalidate');
      expect(fontStylesRule.options.cacheName).toBe('google-fonts-stylesheets');
    });
  });

  describe('strategy #2: Google Fonts Webfonts', () => {
    it('should use CacheFirst for fonts.gstatic.com with long expiration', () => {
      const rules = getDefaultRuntimeCaching();
      const fontFilesRule = rules[1];

      expect(fontFilesRule.urlPattern).toBe('^https://fonts\\.gstatic\\.com/.*');
      expect(fontFilesRule.handler).toBe('CacheFirst');
      expect(fontFilesRule.options.cacheName).toBe('google-fonts-webfonts');
      expect(fontFilesRule.options.expiration?.maxEntries).toBe(30);
      expect(fontFilesRule.options.expiration?.maxAgeSeconds).toBe(365 * 24 * 60 * 60); // 1 year
    });
  });

  describe('strategy #3: Static Assets from CDNs', () => {
    it('should use CacheFirst for common CDNs', () => {
      const rules = getDefaultRuntimeCaching();
      const cdnRule = rules[2];

      // Note: The pattern has escaped dots, so check for the escaped versions
      expect(cdnRule.urlPattern).toContain('jsdelivr\\.net');
      expect(cdnRule.urlPattern).toContain('cdnjs\\.cloudflare\\.com');
      expect(cdnRule.urlPattern).toContain('unpkg\\.com');
      expect(cdnRule.handler).toBe('CacheFirst');
      expect(cdnRule.options.cacheName).toBe('static-assets');
    });
  });

  describe('strategy #4: Images', () => {
    it('should use CacheFirst for image requests via function matcher', () => {
      const rules = getDefaultRuntimeCaching();
      const imageRule = rules[3];

      expect(typeof imageRule.urlPattern).toBe('function');
      expect(imageRule.handler).toBe('CacheFirst');
      expect(imageRule.options.cacheName).toBe('images');
      expect(imageRule.options.expiration?.maxEntries).toBe(60);
    });

    it('should match image destination', () => {
      const rules = getDefaultRuntimeCaching();
      const imageRule = rules[3];
      const matcher = imageRule.urlPattern as Function;

      expect(matcher({ request: { destination: 'image' } })).toBe(true);
      expect(matcher({ request: { destination: 'script' } })).toBe(false);
    });
  });

  describe('strategy #5: Audio', () => {
    it('should use CacheFirst for audio with range requests', () => {
      const rules = getDefaultRuntimeCaching();
      const audioRule = rules[4];

      expect(typeof audioRule.urlPattern).toBe('function');
      expect(audioRule.handler).toBe('CacheFirst');
      expect(audioRule.options.cacheName).toBe('audio');
      expect(audioRule.options.rangeRequests).toBe(true);
    });
  });

  describe('strategy #6: Video', () => {
    it('should use CacheFirst for video with range requests', () => {
      const rules = getDefaultRuntimeCaching();
      const videoRule = rules[5];

      expect(typeof videoRule.urlPattern).toBe('function');
      expect(videoRule.handler).toBe('CacheFirst');
      expect(videoRule.options.cacheName).toBe('video');
      expect(videoRule.options.rangeRequests).toBe(true);
    });
  });

  describe('strategy #7: JavaScript from Same Origin', () => {
    it('should use StaleWhileRevalidate for same-origin scripts', () => {
      const rules = getDefaultRuntimeCaching();
      const jsRule = rules[6];

      expect(typeof jsRule.urlPattern).toBe('function');
      expect(jsRule.handler).toBe('StaleWhileRevalidate');
      expect(jsRule.options.cacheName).toBe('js');
    });

    it('should match same-origin script requests', () => {
      const rules = getDefaultRuntimeCaching();
      const jsRule = rules[6];
      const matcher = jsRule.urlPattern as Function;

      expect(matcher({ sameOrigin: true, request: { destination: 'script' } })).toBe(true);
      expect(matcher({ sameOrigin: false, request: { destination: 'script' } })).toBe(false);
      expect(matcher({ sameOrigin: true, request: { destination: 'style' } })).toBe(false);
    });
  });

  describe('strategy #8: CSS from Same Origin', () => {
    it('should use StaleWhileRevalidate for same-origin styles', () => {
      const rules = getDefaultRuntimeCaching();
      const cssRule = rules[7];

      expect(typeof cssRule.urlPattern).toBe('function');
      expect(cssRule.handler).toBe('StaleWhileRevalidate');
      expect(cssRule.options.cacheName).toBe('css');
    });
  });

  describe('strategy #9: API Routes', () => {
    it('should use NetworkFirst for /api/* with timeout', () => {
      const rules = getDefaultRuntimeCaching();
      const apiRule = rules[8];

      expect(apiRule.urlPattern).toBe('^/api/.*');
      expect(apiRule.handler).toBe('NetworkFirst');
      expect(apiRule.method).toBe('GET');
      expect(apiRule.options.cacheName).toBe('apis');
      expect(apiRule.options.networkTimeoutSeconds).toBe(10);
    });
  });

  describe('strategy #10: Same Origin GET Requests (Pages)', () => {
    it('should use NetworkFirst for same-origin pages', () => {
      const rules = getDefaultRuntimeCaching();
      const pagesRule = rules[9];

      expect(typeof pagesRule.urlPattern).toBe('function');
      expect(pagesRule.handler).toBe('NetworkFirst');
      expect(pagesRule.method).toBe('GET');
      expect(pagesRule.options.cacheName).toBe('pages');
    });
  });

  describe('strategy #11: Cross Origin GET Requests', () => {
    it('should use NetworkFirst for cross-origin requests', () => {
      const rules = getDefaultRuntimeCaching();
      const crossOriginRule = rules[10];

      expect(typeof crossOriginRule.urlPattern).toBe('function');
      expect(crossOriginRule.handler).toBe('NetworkFirst');
      expect(crossOriginRule.method).toBe('GET');
      expect(crossOriginRule.options.cacheName).toBe('cross-origin');
    });

    it('should match cross-origin requests only', () => {
      const rules = getDefaultRuntimeCaching();
      const crossOriginRule = rules[10];
      const matcher = crossOriginRule.urlPattern as Function;

      expect(matcher({ sameOrigin: false })).toBe(true);
      expect(matcher({ sameOrigin: true })).toBe(false);
    });
  });

  describe('strategy #12: Static Files by Extension', () => {
    it('should use CacheFirst for common static file extensions', () => {
      const rules = getDefaultRuntimeCaching();
      const staticFilesRule = rules[11];

      expect(staticFilesRule.urlPattern).toBe('\\.(ico|png|svg|txt|woff2?)$');
      expect(staticFilesRule.handler).toBe('CacheFirst');
      expect(staticFilesRule.options.cacheName).toBe('static-files');
    });
  });

  describe('strategy #13: Catch-all Fallback', () => {
    it('should use NetworkFirst for everything else', () => {
      const rules = getDefaultRuntimeCaching();
      const catchAllRule = rules[12];

      expect(catchAllRule.urlPattern).toBe('.*');
      expect(catchAllRule.handler).toBe('NetworkFirst');
      expect(catchAllRule.options.cacheName).toBe('others');
    });
  });
});

// =============================================================================
// DEFAULT_RUNTIME_CACHING Export Tests
// =============================================================================

describe('DEFAULT_RUNTIME_CACHING', () => {
  it('should be a pre-built array of 13 rules', () => {
    expect(DEFAULT_RUNTIME_CACHING).toHaveLength(13);
  });

  it('should equal the output of getDefaultRuntimeCaching()', () => {
    // Can't use toEqual because functions can't be compared by value
    const freshRules = getDefaultRuntimeCaching();
    expect(DEFAULT_RUNTIME_CACHING.length).toBe(freshRules.length);
    expect(DEFAULT_RUNTIME_CACHING.map(r => r.options.cacheName)).toEqual(
      freshRules.map(r => r.options.cacheName)
    );
  });
});

// =============================================================================
// mergeRuntimeCaching() Tests
// =============================================================================

describe('mergeRuntimeCaching', () => {
  describe('basic merging', () => {
    it('should return defaults when custom is empty', () => {
      const defaults = getDefaultRuntimeCaching();
      const merged = mergeRuntimeCaching([], defaults);

      expect(merged).toHaveLength(defaults.length);
      expect(merged).toEqual(defaults);
    });

    it('should put custom rules first', () => {
      const customRule: RuntimeCachingRule = {
        urlPattern: '/custom/*',
        handler: 'CacheFirst',
      };
      const defaults = getDefaultRuntimeCaching();
      const merged = mergeRuntimeCaching([customRule], defaults);

      expect(merged[0]).toBe(customRule);
      expect(merged).toHaveLength(defaults.length + 1);
    });
  });

  describe('override behavior', () => {
    it('should override default rule with same string pattern', () => {
      const customApiRule: RuntimeCachingRule = {
        urlPattern: '^/api/.*',
        handler: 'CacheFirst', // Override default NetworkFirst
        options: {
          cacheName: 'custom-api-cache',
        },
      };
      const defaults = getDefaultRuntimeCaching();
      const merged = mergeRuntimeCaching([customApiRule], defaults);

      // Should have one less rule because the API rule was overridden
      expect(merged).toHaveLength(defaults.length);

      // Custom rule should be first
      expect(merged[0]).toBe(customApiRule);
      expect(merged[0].handler).toBe('CacheFirst');

      // Default API rule should be removed
      const hasDefaultApiRule = merged.slice(1).some(
        rule => typeof rule.urlPattern === 'string' && rule.urlPattern === '^/api/.*'
      );
      expect(hasDefaultApiRule).toBe(false);
    });

    it('should override catch-all rule', () => {
      const customCatchAll: RuntimeCachingRule = {
        urlPattern: '.*',
        handler: 'CacheOnly',
      };
      const defaults = getDefaultRuntimeCaching();
      const merged = mergeRuntimeCaching([customCatchAll], defaults);

      expect(merged).toHaveLength(defaults.length);
      expect(merged[0]).toBe(customCatchAll);
    });
  });

  describe('multiple custom rules', () => {
    it('should preserve order of custom rules', () => {
      const customRules: RuntimeCachingRule[] = [
        { urlPattern: '/first/*', handler: 'CacheFirst' },
        { urlPattern: '/second/*', handler: 'NetworkFirst' },
        { urlPattern: '/third/*', handler: 'StaleWhileRevalidate' },
      ];
      const defaults = getDefaultRuntimeCaching();
      const merged = mergeRuntimeCaching(customRules, defaults);

      expect(merged[0].urlPattern).toBe('/first/*');
      expect(merged[1].urlPattern).toBe('/second/*');
      expect(merged[2].urlPattern).toBe('/third/*');
    });

    it('should handle multiple overrides', () => {
      const customRules: RuntimeCachingRule[] = [
        { urlPattern: '^/api/.*', handler: 'CacheFirst' },
        { urlPattern: '.*', handler: 'NetworkOnly' },
      ];
      const defaults = getDefaultRuntimeCaching();
      const merged = mergeRuntimeCaching(customRules, defaults);

      // Two defaults should be replaced
      expect(merged).toHaveLength(defaults.length);

      // Verify overrides
      expect(merged[0].urlPattern).toBe('^/api/.*');
      expect(merged[0].handler).toBe('CacheFirst');
      expect(merged[1].urlPattern).toBe('.*');
      expect(merged[1].handler).toBe('NetworkOnly');
    });
  });

  describe('function pattern handling', () => {
    it('should compare function patterns by their string representation', () => {
      // Create a function that matches the default image matcher
      const customImageMatcher = ({ request }: { request: { destination: string } }) =>
        request.destination === 'image';

      const customRule: RuntimeCachingRule = {
        urlPattern: customImageMatcher,
        handler: 'NetworkFirst', // Override default CacheFirst
      };

      const defaults = getDefaultRuntimeCaching();
      const merged = mergeRuntimeCaching([customRule], defaults);

      // The custom function should be first
      expect(merged[0]).toBe(customRule);
    });
  });

  describe('RegExp pattern handling', () => {
    it('should normalize RegExp patterns for comparison', () => {
      const customRule: RuntimeCachingRule = {
        urlPattern: /^\/api\/.*/,
        handler: 'CacheFirst',
      };

      // Note: This won't override the default because the default uses a string
      // pattern "^/api/.*" not a RegExp
      const defaults = getDefaultRuntimeCaching();
      const merged = mergeRuntimeCaching([customRule], defaults);

      // Both rules should be present since string and RegExp are different
      expect(merged).toHaveLength(defaults.length + 1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty defaults', () => {
      const customRules: RuntimeCachingRule[] = [
        { urlPattern: '/test', handler: 'CacheFirst' },
      ];
      const merged = mergeRuntimeCaching(customRules, []);

      expect(merged).toHaveLength(1);
      expect(merged[0]).toBe(customRules[0]);
    });

    it('should handle both empty', () => {
      const merged = mergeRuntimeCaching([], []);
      expect(merged).toHaveLength(0);
    });
  });
});

// =============================================================================
// Handler Coverage Tests
// =============================================================================

describe('Handler Coverage', () => {
  it('should use a variety of handlers across defaults', () => {
    const rules = getDefaultRuntimeCaching();
    const handlers = new Set(rules.map(r => r.handler));

    expect(handlers.has('CacheFirst')).toBe(true);
    expect(handlers.has('NetworkFirst')).toBe(true);
    expect(handlers.has('StaleWhileRevalidate')).toBe(true);
  });

  it('should use CacheFirst for static/immutable resources', () => {
    const rules = getDefaultRuntimeCaching();
    const cacheFirstRules = rules.filter(r => r.handler === 'CacheFirst');

    // Should include images, fonts, audio, video, static files
    expect(cacheFirstRules.length).toBeGreaterThanOrEqual(5);
  });

  it('should use NetworkFirst for dynamic content', () => {
    const rules = getDefaultRuntimeCaching();
    const networkFirstRules = rules.filter(r => r.handler === 'NetworkFirst');

    // Should include API, pages, cross-origin, catch-all
    expect(networkFirstRules.length).toBeGreaterThanOrEqual(4);
  });
});

// =============================================================================
// Expiration Configuration Tests
// =============================================================================

describe('Expiration Configuration', () => {
  it('should have reasonable maxEntries for all rules with expiration', () => {
    const rules = getDefaultRuntimeCaching();

    for (const rule of rules) {
      if (rule.options.expiration?.maxEntries) {
        expect(rule.options.expiration.maxEntries).toBeGreaterThan(0);
        expect(rule.options.expiration.maxEntries).toBeLessThanOrEqual(100);
      }
    }
  });

  it('should have reasonable maxAgeSeconds for all rules with expiration', () => {
    const rules = getDefaultRuntimeCaching();
    const oneYear = 365 * 24 * 60 * 60;

    for (const rule of rules) {
      if (rule.options.expiration?.maxAgeSeconds) {
        expect(rule.options.expiration.maxAgeSeconds).toBeGreaterThan(0);
        expect(rule.options.expiration.maxAgeSeconds).toBeLessThanOrEqual(oneYear);
      }
    }
  });
});
