/**
 * Unit tests for PWA configuration Zod schema
 *
 * These tests validate the schema's behavior for all config options,
 * defaults, and error handling.
 */

import { describe, it, expect } from 'vitest';
import {
  PWAConfigSchema,
  validateConfig,
  safeValidateConfig,
  getDefaultConfig,
  PWAConfigValidationError,
} from './schema.js';

// =============================================================================
// Default Configuration Tests
// =============================================================================

describe('getDefaultConfig', () => {
  it('should return default configuration when called with no args', () => {
    const config = getDefaultConfig();

    expect(config.dest).toBe('public');
    expect(config.disable).toBe(false);
    expect(config.register).toBe(true);
    expect(config.scope).toBe('/');
    expect(config.sw).toBe('sw.js');
    expect(config.skipWaiting).toBe(true);
    expect(config.clientsClaim).toBe(true);
    expect(config.cleanupOutdatedCaches).toBe(true);
    expect(config.navigationPreload).toBe(true);
    expect(config.publicExcludes).toEqual([]);
    expect(config.buildExcludes).toEqual([]);
    expect(config.customWorkerPrefix).toBe('worker-');
    expect(config.dynamicStartUrl).toBe(true);
    expect(config.reloadOnOnline).toBe(true);
    expect(config.cacheOnFrontEndNav).toBe(false);
  });

  it('should return a fresh object each time', () => {
    const config1 = getDefaultConfig();
    const config2 = getDefaultConfig();
    expect(config1).not.toBe(config2);
    expect(config1).toEqual(config2);
  });
});

// =============================================================================
// validateConfig Tests
// =============================================================================

describe('validateConfig', () => {
  describe('valid configurations', () => {
    it('should accept empty object and apply defaults', () => {
      const config = validateConfig({});
      expect(config.dest).toBe('public');
      expect(config.sw).toBe('sw.js');
    });

    it('should accept minimal valid config', () => {
      const config = validateConfig({
        disable: true,
      });
      expect(config.disable).toBe(true);
    });

    it('should accept full valid config', () => {
      const config = validateConfig({
        dest: 'dist',
        disable: false,
        register: true,
        scope: '/app/',
        sw: 'service-worker.js',
        runtimeCaching: [
          {
            urlPattern: '^/api/.*',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
            },
          },
        ],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigationPreload: true,
        publicExcludes: ['!robots.txt'],
        buildExcludes: [/chunks\/.*$/],
        fallbacks: {
          document: '/_offline',
          image: '/fallback.png',
        },
        cacheOnFrontEndNav: true,
      });

      expect(config.dest).toBe('dist');
      expect(config.scope).toBe('/app/');
      expect(config.sw).toBe('service-worker.js');
      expect(config.runtimeCaching).toHaveLength(1);
      expect(config.fallbacks?.document).toBe('/_offline');
    });
  });

  describe('invalid configurations', () => {
    it('should throw PWAConfigValidationError for invalid config', () => {
      expect(() => validateConfig({
        sw: 'invalid-no-js-extension',
      })).toThrow(PWAConfigValidationError);
    });

    it('should throw for unknown properties (strict mode)', () => {
      expect(() => validateConfig({
        unknownProperty: 'value',
      })).toThrow(PWAConfigValidationError);
    });
  });
});

// =============================================================================
// safeValidateConfig Tests
// =============================================================================

describe('safeValidateConfig', () => {
  it('should return success for valid config', () => {
    const result = safeValidateConfig({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dest).toBe('public');
    }
  });

  it('should return error for invalid config', () => {
    const result = safeValidateConfig({
      sw: 'invalid-extension.ts',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// Core Options Validation
// =============================================================================

describe('Core Options', () => {
  describe('dest', () => {
    it('should accept valid relative paths', () => {
      const config = validateConfig({ dest: 'public' });
      expect(config.dest).toBe('public');

      const config2 = validateConfig({ dest: 'dist/sw' });
      expect(config2.dest).toBe('dist/sw');
    });

    it('should reject path traversal', () => {
      expect(() => validateConfig({ dest: '../secret' })).toThrow(PWAConfigValidationError);
      expect(() => validateConfig({ dest: '../../etc' })).toThrow(PWAConfigValidationError);
    });

    it('should reject absolute paths', () => {
      expect(() => validateConfig({ dest: '/etc/passwd' })).toThrow(PWAConfigValidationError);
    });

    it('should reject URL-encoded traversal', () => {
      expect(() => validateConfig({ dest: '%2e%2e/secret' })).toThrow(PWAConfigValidationError);
    });
  });

  describe('disable', () => {
    it('should accept boolean values', () => {
      expect(validateConfig({ disable: true }).disable).toBe(true);
      expect(validateConfig({ disable: false }).disable).toBe(false);
    });

    it('should reject non-boolean values', () => {
      expect(() => validateConfig({ disable: 'true' })).toThrow();
    });
  });

  describe('register', () => {
    it('should default to true', () => {
      expect(validateConfig({}).register).toBe(true);
    });

    it('should accept boolean values', () => {
      expect(validateConfig({ register: false }).register).toBe(false);
    });
  });

  describe('scope', () => {
    it('should accept valid scopes starting with /', () => {
      expect(validateConfig({ scope: '/' }).scope).toBe('/');
      expect(validateConfig({ scope: '/app/' }).scope).toBe('/app/');
      expect(validateConfig({ scope: '/my-app/v2/' }).scope).toBe('/my-app/v2/');
    });

    it('should reject scopes not starting with /', () => {
      expect(() => validateConfig({ scope: 'app/' })).toThrow(PWAConfigValidationError);
    });

    it('should reject path traversal in scope', () => {
      expect(() => validateConfig({ scope: '/app/../admin/' })).toThrow(PWAConfigValidationError);
    });

    it('should reject encoded traversal', () => {
      expect(() => validateConfig({ scope: '/%2e%2e/admin/' })).toThrow(PWAConfigValidationError);
    });

    it('should reject null bytes', () => {
      expect(() => validateConfig({ scope: '/app\0/' })).toThrow(PWAConfigValidationError);
    });
  });

  describe('sw', () => {
    it('should accept valid .js filenames', () => {
      expect(validateConfig({ sw: 'sw.js' }).sw).toBe('sw.js');
      expect(validateConfig({ sw: 'service-worker.js' }).sw).toBe('service-worker.js');
      expect(validateConfig({ sw: 'worker123.js' }).sw).toBe('worker123.js');
    });

    it('should reject non-.js extensions', () => {
      expect(() => validateConfig({ sw: 'sw.ts' })).toThrow(PWAConfigValidationError);
      expect(() => validateConfig({ sw: 'sw.jsx' })).toThrow(PWAConfigValidationError);
    });

    it('should reject path separators', () => {
      expect(() => validateConfig({ sw: '../sw.js' })).toThrow(PWAConfigValidationError);
      expect(() => validateConfig({ sw: 'path/sw.js' })).toThrow(PWAConfigValidationError);
    });

    it('should reject empty filename', () => {
      expect(() => validateConfig({ sw: '' })).toThrow(PWAConfigValidationError);
    });
  });
});

// =============================================================================
// Caching Options Validation
// =============================================================================

describe('Caching Options', () => {
  describe('runtimeCaching', () => {
    it('should accept valid string URL patterns', () => {
      const config = validateConfig({
        runtimeCaching: [
          {
            urlPattern: '^/api/.*',
            handler: 'NetworkFirst',
          },
        ],
      });
      expect(config.runtimeCaching).toHaveLength(1);
      expect(config.runtimeCaching![0].urlPattern).toBe('^/api/.*');
    });

    it('should accept RegExp URL patterns', () => {
      const config = validateConfig({
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*/,
            handler: 'CacheFirst',
          },
        ],
      });
      expect(config.runtimeCaching![0].urlPattern).toBeInstanceOf(RegExp);
    });

    it('should accept function URL patterns', () => {
      const matcher = ({ sameOrigin }: { sameOrigin: boolean }) => sameOrigin;
      const config = validateConfig({
        runtimeCaching: [
          {
            urlPattern: matcher,
            handler: 'StaleWhileRevalidate',
          },
        ],
      });
      expect(typeof config.runtimeCaching![0].urlPattern).toBe('function');
    });

    it('should accept all valid handler strategies', () => {
      const handlers = [
        'CacheFirst',
        'CacheOnly',
        'NetworkFirst',
        'NetworkOnly',
        'StaleWhileRevalidate',
      ] as const;

      for (const handler of handlers) {
        const config = validateConfig({
          runtimeCaching: [
            { urlPattern: '/test', handler },
          ],
        });
        expect(config.runtimeCaching![0].handler).toBe(handler);
      }
    });

    it('should reject invalid handler strategies', () => {
      expect(() => validateConfig({
        runtimeCaching: [
          { urlPattern: '/test', handler: 'InvalidHandler' as any },
        ],
      })).toThrow();
    });

    it('should accept valid expiration options', () => {
      const config = validateConfig({
        runtimeCaching: [
          {
            urlPattern: '/test',
            handler: 'CacheFirst',
            options: {
              cacheName: 'test-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 3600,
              },
            },
          },
        ],
      });
      expect(config.runtimeCaching![0].options?.expiration?.maxEntries).toBe(100);
    });

    it('should reject negative expiration values', () => {
      expect(() => validateConfig({
        runtimeCaching: [
          {
            urlPattern: '/test',
            handler: 'CacheFirst',
            options: {
              expiration: {
                maxEntries: -1,
              },
            },
          },
        ],
      })).toThrow();
    });
  });

  describe('skipWaiting and clientsClaim', () => {
    it('should default to true', () => {
      const config = validateConfig({});
      expect(config.skipWaiting).toBe(true);
      expect(config.clientsClaim).toBe(true);
    });

    it('should accept false', () => {
      const config = validateConfig({
        skipWaiting: false,
        clientsClaim: false,
      });
      expect(config.skipWaiting).toBe(false);
      expect(config.clientsClaim).toBe(false);
    });
  });
});

// =============================================================================
// Precaching Options Validation
// =============================================================================

describe('Precaching Options', () => {
  describe('publicExcludes', () => {
    it('should default to empty array', () => {
      expect(validateConfig({}).publicExcludes).toEqual([]);
    });

    it('should accept string array', () => {
      const config = validateConfig({
        publicExcludes: ['!robots.txt', '!sitemap.xml'],
      });
      expect(config.publicExcludes).toEqual(['!robots.txt', '!sitemap.xml']);
    });
  });

  describe('buildExcludes', () => {
    it('should accept string patterns', () => {
      const config = validateConfig({
        buildExcludes: ['**/*.map', '**/*.d.ts'],
      });
      expect(config.buildExcludes).toEqual(['**/*.map', '**/*.d.ts']);
    });

    it('should accept RegExp patterns', () => {
      const config = validateConfig({
        buildExcludes: [/\.map$/, /\.d\.ts$/],
      });
      expect(config.buildExcludes[0]).toBeInstanceOf(RegExp);
    });

    it('should accept mixed patterns', () => {
      const config = validateConfig({
        buildExcludes: ['**/*.map', /\.d\.ts$/],
      });
      expect(typeof config.buildExcludes[0]).toBe('string');
      expect(config.buildExcludes[1]).toBeInstanceOf(RegExp);
    });
  });

  describe('additionalManifestEntries', () => {
    it('should accept string entries', () => {
      const config = validateConfig({
        additionalManifestEntries: ['/offline.html', '/icons/icon-192.png'],
      });
      expect(config.additionalManifestEntries).toEqual(['/offline.html', '/icons/icon-192.png']);
    });

    it('should accept object entries with url and revision', () => {
      const config = validateConfig({
        additionalManifestEntries: [
          { url: '/offline.html', revision: 'abc123' },
          { url: '/app.js', revision: null },
        ],
      });
      expect(config.additionalManifestEntries![0]).toEqual({
        url: '/offline.html',
        revision: 'abc123',
      });
    });
  });

  describe('modifyURLPrefix', () => {
    it('should accept string record', () => {
      const config = validateConfig({
        modifyURLPrefix: {
          '/_next/': '/base/_next/',
        },
      });
      expect(config.modifyURLPrefix!['/_next/']).toBe('/base/_next/');
    });
  });
});

// =============================================================================
// Fallback Options Validation
// =============================================================================

describe('Fallback Options', () => {
  describe('fallbacks', () => {
    it('should accept valid fallback URLs', () => {
      const config = validateConfig({
        fallbacks: {
          document: '/_offline',
          image: '/fallback.png',
          font: '/fallback.woff2',
          audio: '/fallback.mp3',
          video: '/fallback.mp4',
        },
      });
      expect(config.fallbacks?.document).toBe('/_offline');
      expect(config.fallbacks?.image).toBe('/fallback.png');
    });

    it('should accept partial fallbacks', () => {
      const config = validateConfig({
        fallbacks: {
          document: '/_offline',
        },
      });
      expect(config.fallbacks?.document).toBe('/_offline');
      expect(config.fallbacks?.image).toBeUndefined();
    });
  });

  describe('cacheOnFrontEndNav', () => {
    it('should default to false', () => {
      expect(validateConfig({}).cacheOnFrontEndNav).toBe(false);
    });

    it('should accept true', () => {
      expect(validateConfig({ cacheOnFrontEndNav: true }).cacheOnFrontEndNav).toBe(true);
    });
  });
});

// =============================================================================
// Development Options Validation
// =============================================================================

describe('Development Options', () => {
  describe('devOptions', () => {
    it('should accept enabled option', () => {
      const config = validateConfig({
        devOptions: {
          enabled: true,
        },
      });
      expect(config.devOptions?.enabled).toBe(true);
    });

    it('should default enabled to false', () => {
      const config = validateConfig({
        devOptions: {},
      });
      expect(config.devOptions?.enabled).toBe(false);
    });

    it('should accept warmCache option', () => {
      const config = validateConfig({
        devOptions: {
          enabled: true,
          warmCache: ['/api/user', '/api/settings'],
        },
      });
      expect(config.devOptions?.warmCache).toEqual(['/api/user', '/api/settings']);
    });

    it('should accept swUrl option', () => {
      const config = validateConfig({
        devOptions: {
          enabled: true,
          swUrl: 'http://localhost:3000/dev-sw.js',
        },
      });
      expect(config.devOptions?.swUrl).toBe('http://localhost:3000/dev-sw.js');
    });
  });
});

// =============================================================================
// Advanced Options Validation
// =============================================================================

describe('Advanced Options', () => {
  describe('customWorkerSrc', () => {
    it('should accept string path', () => {
      const config = validateConfig({
        customWorkerSrc: 'worker/custom-sw.ts',
      });
      expect(config.customWorkerSrc).toBe('worker/custom-sw.ts');
    });
  });

  describe('customWorkerPrefix', () => {
    it('should default to worker-', () => {
      expect(validateConfig({}).customWorkerPrefix).toBe('worker-');
    });

    it('should accept custom prefix', () => {
      const config = validateConfig({
        customWorkerPrefix: 'my-worker-',
      });
      expect(config.customWorkerPrefix).toBe('my-worker-');
    });
  });

  describe('dynamicStartUrl', () => {
    it('should default to true', () => {
      expect(validateConfig({}).dynamicStartUrl).toBe(true);
    });

    it('should accept false', () => {
      expect(validateConfig({ dynamicStartUrl: false }).dynamicStartUrl).toBe(false);
    });
  });

  describe('dynamicStartUrlRedirect', () => {
    it('should accept string URL', () => {
      const config = validateConfig({
        dynamicStartUrlRedirect: '/home',
      });
      expect(config.dynamicStartUrlRedirect).toBe('/home');
    });
  });

  describe('reloadOnOnline', () => {
    it('should default to true', () => {
      expect(validateConfig({}).reloadOnOnline).toBe(true);
    });

    it('should accept false', () => {
      expect(validateConfig({ reloadOnOnline: false }).reloadOnOnline).toBe(false);
    });
  });

  describe('basePath', () => {
    it('should accept string basePath', () => {
      const config = validateConfig({
        basePath: '/my-app',
      });
      expect(config.basePath).toBe('/my-app');
    });
  });
});

// =============================================================================
// PWAConfigValidationError Tests
// =============================================================================

describe('PWAConfigValidationError', () => {
  it('should include all Zod issues', () => {
    try {
      validateConfig({
        sw: 'invalid.ts',
        scope: 'invalid-scope',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PWAConfigValidationError);
      const validationError = error as PWAConfigValidationError;
      expect(validationError.issues.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('should have descriptive error message', () => {
    try {
      validateConfig({
        sw: 'invalid.ts',
      });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PWAConfigValidationError);
      const validationError = error as PWAConfigValidationError;
      expect(validationError.message).toContain('PWA configuration validation failed');
    }
  });
});

// =============================================================================
// Strict Mode Tests
// =============================================================================

describe('Strict Mode', () => {
  it('should reject unknown properties on root', () => {
    expect(() => validateConfig({
      unknownProperty: 'value',
    })).toThrow(PWAConfigValidationError);
  });

  it('should reject unknown properties in nested objects', () => {
    expect(() => validateConfig({
      devOptions: {
        enabled: true,
        unknownNested: 'value',
      } as any,
    })).toThrow();
  });

  it('should reject unknown properties in fallbacks', () => {
    expect(() => validateConfig({
      fallbacks: {
        document: '/_offline',
        unknownFallback: '/unknown',
      } as any,
    })).toThrow();
  });
});
