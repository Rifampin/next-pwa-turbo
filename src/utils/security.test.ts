/**
 * Unit tests for security utilities
 *
 * These tests cover all security-critical functions with edge cases,
 * attack vectors, and malicious input testing.
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizePath,
  validateScope,
  isValidFilename,
  sanitizeRuntimeCachingRule,
  escapeForServiceWorker,
  isValidHandler,
  hasPathTraversal,
  ALLOWED_HANDLERS,
} from './security.js';

// =============================================================================
// sanitizePath() Tests
// =============================================================================

describe('sanitizePath', () => {
  describe('basic functionality', () => {
    it('should return empty string for non-string input', () => {
      expect(sanitizePath(null as unknown as string)).toBe('');
      expect(sanitizePath(undefined as unknown as string)).toBe('');
      expect(sanitizePath(123 as unknown as string)).toBe('');
      expect(sanitizePath({} as unknown as string)).toBe('');
    });

    it('should trim whitespace', () => {
      expect(sanitizePath('  path/to/file  ')).toBe('path/to/file');
      expect(sanitizePath('\tpath/to/file\n')).toBe('path/to/file');
    });

    it('should normalize backslashes to forward slashes', () => {
      expect(sanitizePath('path\\to\\file')).toBe('path/to/file');
      expect(sanitizePath('path\\\\to\\\\file')).toBe('path/to/file');
    });

    it('should remove duplicate slashes', () => {
      expect(sanitizePath('path//to///file')).toBe('path/to/file');
    });

    it('should remove leading slashes', () => {
      expect(sanitizePath('/path/to/file')).toBe('path/to/file');
      expect(sanitizePath('///path/to/file')).toBe('path/to/file');
    });

    it('should remove trailing slashes', () => {
      expect(sanitizePath('path/to/file/')).toBe('path/to/file');
      expect(sanitizePath('path/to/file///')).toBe('path/to/file');
    });
  });

  describe('path traversal prevention', () => {
    it('should remove basic .. traversal', () => {
      expect(sanitizePath('../etc/passwd')).toBe('etc/passwd');
      expect(sanitizePath('../../etc/passwd')).toBe('etc/passwd');
    });

    it('should remove .. in middle of path', () => {
      expect(sanitizePath('foo/../bar')).toBe('foo/bar');
      expect(sanitizePath('foo/bar/../baz')).toBe('foo/bar/baz');
    });

    it('should remove ./ references', () => {
      expect(sanitizePath('./foo/bar')).toBe('foo/bar');
      expect(sanitizePath('foo/./bar')).toBe('foo/bar');
    });

    it('should handle mixed traversal attempts', () => {
      expect(sanitizePath('./../foo')).toBe('foo');
      // ./ is removed first, leaving ..., which has .. removed, leaving .
      expect(sanitizePath('..././../foo')).toBe('.foo');
    });

    it('should handle encoded-like patterns after normalization', () => {
      // These patterns might appear after URL decoding
      expect(sanitizePath('foo..bar')).toBe('foobar');
    });
  });

  describe('null byte removal', () => {
    it('should remove null bytes', () => {
      expect(sanitizePath('path\0/to/file')).toBe('path/to/file');
      expect(sanitizePath('path/to\0/file\0.txt')).toBe('path/to/file.txt');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(sanitizePath('')).toBe('');
    });

    it('should handle whitespace only', () => {
      expect(sanitizePath('   ')).toBe('');
    });

    it('should handle only dots', () => {
      expect(sanitizePath('..')).toBe('');
      expect(sanitizePath('...')).toBe('.');
    });

    it('should handle complex attack patterns', () => {
      // Windows-style with encoded .. characters won't be decoded here
      // but we should ensure .. is removed
      expect(sanitizePath('..\\..\\windows\\system32')).toBe('windows/system32');
    });
  });
});

// =============================================================================
// validateScope() Tests
// =============================================================================

describe('validateScope', () => {
  describe('basic validation', () => {
    it('should return false for non-string input', () => {
      expect(validateScope(null as unknown as string)).toBe(false);
      expect(validateScope(undefined as unknown as string)).toBe(false);
      expect(validateScope(123 as unknown as string)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(validateScope('')).toBe(false);
    });

    it('should return false for scope not starting with /', () => {
      expect(validateScope('app/')).toBe(false);
      expect(validateScope('app/subpath/')).toBe(false);
    });

    it('should return true for valid scopes', () => {
      expect(validateScope('/')).toBe(true);
      expect(validateScope('/app/')).toBe(true);
      expect(validateScope('/app/sub/')).toBe(true);
    });
  });

  describe('security checks', () => {
    it('should reject path traversal', () => {
      expect(validateScope('/app/../admin/')).toBe(false);
      expect(validateScope('/app/..%2f..%2fadmin/')).toBe(false);
      expect(validateScope('/../')).toBe(false);
    });

    it('should reject null bytes', () => {
      expect(validateScope('/app\0/')).toBe(false);
    });

    it('should reject query strings', () => {
      expect(validateScope('/app/?foo=bar')).toBe(false);
    });

    it('should reject fragments', () => {
      expect(validateScope('/app/#section')).toBe(false);
    });

    it('should reject backslashes', () => {
      expect(validateScope('/app\\admin/')).toBe(false);
    });
  });

  describe('basePath validation', () => {
    it('should validate against basePath', () => {
      expect(validateScope('/app/', '/app')).toBe(true);
      expect(validateScope('/app/sub/', '/app')).toBe(true);
      expect(validateScope('/other/', '/app')).toBe(false);
    });

    it('should handle basePath with trailing slash', () => {
      expect(validateScope('/app/', '/app/')).toBe(true);
      expect(validateScope('/app/sub/', '/app/')).toBe(true);
    });

    it('should return false for non-string basePath', () => {
      expect(validateScope('/app/', 123 as unknown as string)).toBe(false);
    });
  });
});

// =============================================================================
// isValidFilename() Tests
// =============================================================================

describe('isValidFilename', () => {
  describe('basic validation', () => {
    it('should return false for non-string input', () => {
      expect(isValidFilename(null as unknown as string)).toBe(false);
      expect(isValidFilename(undefined as unknown as string)).toBe(false);
      expect(isValidFilename(123 as unknown as string)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidFilename('')).toBe(false);
    });

    it('should require .js extension', () => {
      expect(isValidFilename('sw.ts')).toBe(false);
      expect(isValidFilename('sw.jsx')).toBe(false);
      expect(isValidFilename('sw')).toBe(false);
      expect(isValidFilename('sw.js')).toBe(true);
    });

    it('should return true for valid filenames', () => {
      expect(isValidFilename('sw.js')).toBe(true);
      expect(isValidFilename('service-worker.js')).toBe(true);
      expect(isValidFilename('my_worker.js')).toBe(true);
      expect(isValidFilename('sw123.js')).toBe(true);
    });
  });

  describe('security checks', () => {
    it('should reject path separators', () => {
      expect(isValidFilename('../sw.js')).toBe(false);
      expect(isValidFilename('foo/sw.js')).toBe(false);
      expect(isValidFilename('foo\\sw.js')).toBe(false);
    });

    it('should reject reserved names', () => {
      expect(isValidFilename('.')).toBe(false);
      expect(isValidFilename('..')).toBe(false);
    });

    it('should reject just .js', () => {
      expect(isValidFilename('.js')).toBe(false);
    });

    it('should reject null bytes', () => {
      expect(isValidFilename('sw\0.js')).toBe(false);
    });

    it('should reject filenames exceeding 255 characters', () => {
      const longName = 'a'.repeat(256) + '.js';
      expect(isValidFilename(longName)).toBe(false);
    });
  });

  describe('character validation', () => {
    it('should require alphanumeric start', () => {
      expect(isValidFilename('-sw.js')).toBe(false);
      expect(isValidFilename('_sw.js')).toBe(false);
      expect(isValidFilename('.hidden.js')).toBe(false);
    });

    it('should allow alphanumeric, dash, underscore, dot', () => {
      expect(isValidFilename('sw-v1.js')).toBe(true);
      expect(isValidFilename('sw_v1.js')).toBe(true);
      expect(isValidFilename('sw.min.js')).toBe(true);
    });

    it('should reject special characters', () => {
      expect(isValidFilename('sw@1.js')).toBe(false);
      expect(isValidFilename('sw$1.js')).toBe(false);
      expect(isValidFilename('sw 1.js')).toBe(false);
    });
  });
});

// =============================================================================
// sanitizeRuntimeCachingRule() Tests
// =============================================================================

describe('sanitizeRuntimeCachingRule', () => {
  describe('basic validation', () => {
    it('should return null for non-object input', () => {
      expect(sanitizeRuntimeCachingRule(null)).toBe(null);
      expect(sanitizeRuntimeCachingRule(undefined)).toBe(null);
      expect(sanitizeRuntimeCachingRule('string')).toBe(null);
      expect(sanitizeRuntimeCachingRule(123)).toBe(null);
    });

    it('should return null for missing urlPattern', () => {
      expect(sanitizeRuntimeCachingRule({ handler: 'CacheFirst' })).toBe(null);
    });

    it('should return null for missing handler', () => {
      expect(sanitizeRuntimeCachingRule({ urlPattern: '/api/*' })).toBe(null);
    });

    it('should return valid rule for correct input', () => {
      const result = sanitizeRuntimeCachingRule({
        urlPattern: '/api/*',
        handler: 'NetworkFirst',
      });
      expect(result).toEqual({
        urlPattern: '/api/*',
        handler: 'NetworkFirst',
      });
    });
  });

  describe('urlPattern validation', () => {
    it('should accept string patterns', () => {
      const result = sanitizeRuntimeCachingRule({
        urlPattern: '^/api/.*',
        handler: 'CacheFirst',
      });
      expect(result?.urlPattern).toBe('^/api/.*');
    });

    it('should accept RegExp and convert to string', () => {
      const result = sanitizeRuntimeCachingRule({
        urlPattern: /^\/api\/.*/,
        handler: 'CacheFirst',
      });
      expect(result?.urlPattern).toBe('/^\\/api\\/.*/');
    });

    it('should reject empty string pattern', () => {
      expect(sanitizeRuntimeCachingRule({
        urlPattern: '',
        handler: 'CacheFirst',
      })).toBe(null);
    });

    it('should reject pattern with null bytes', () => {
      expect(sanitizeRuntimeCachingRule({
        urlPattern: '/api/\0foo',
        handler: 'CacheFirst',
      })).toBe(null);
    });
  });

  describe('handler validation', () => {
    it('should accept all valid handlers', () => {
      for (const handler of ALLOWED_HANDLERS) {
        const result = sanitizeRuntimeCachingRule({
          urlPattern: '/test',
          handler,
        });
        expect(result?.handler).toBe(handler);
      }
    });

    it('should reject invalid handlers', () => {
      expect(sanitizeRuntimeCachingRule({
        urlPattern: '/test',
        handler: 'InvalidHandler',
      })).toBe(null);
      expect(sanitizeRuntimeCachingRule({
        urlPattern: '/test',
        handler: 'eval',
      })).toBe(null);
    });

    it('should reject non-string handlers', () => {
      expect(sanitizeRuntimeCachingRule({
        urlPattern: '/test',
        handler: 123,
      })).toBe(null);
    });
  });

  describe('options sanitization', () => {
    it('should include valid cacheName', () => {
      const result = sanitizeRuntimeCachingRule({
        urlPattern: '/test',
        handler: 'CacheFirst',
        options: { cacheName: 'my-cache' },
      });
      expect(result?.options?.cacheName).toBe('my-cache');
    });

    it('should reject invalid cacheName characters', () => {
      const result = sanitizeRuntimeCachingRule({
        urlPattern: '/test',
        handler: 'CacheFirst',
        options: { cacheName: 'my cache!' },
      });
      expect(result?.options?.cacheName).toBeUndefined();
    });

    it('should reject cacheName exceeding 100 characters', () => {
      const result = sanitizeRuntimeCachingRule({
        urlPattern: '/test',
        handler: 'CacheFirst',
        options: { cacheName: 'a'.repeat(101) },
      });
      expect(result?.options?.cacheName).toBeUndefined();
    });

    it('should include valid expiration options', () => {
      const result = sanitizeRuntimeCachingRule({
        urlPattern: '/test',
        handler: 'CacheFirst',
        options: {
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 3600,
          },
        },
      });
      expect(result?.options?.expiration?.maxEntries).toBe(100);
      expect(result?.options?.expiration?.maxAgeSeconds).toBe(3600);
    });

    it('should reject negative expiration values', () => {
      const result = sanitizeRuntimeCachingRule({
        urlPattern: '/test',
        handler: 'CacheFirst',
        options: {
          expiration: {
            maxEntries: -1,
            maxAgeSeconds: -100,
          },
        },
      });
      expect(result?.options?.expiration).toBeUndefined();
    });

    it('should reject maxEntries above 10000', () => {
      const result = sanitizeRuntimeCachingRule({
        urlPattern: '/test',
        handler: 'CacheFirst',
        options: {
          expiration: { maxEntries: 10001 },
        },
      });
      expect(result?.options?.expiration).toBeUndefined();
    });

    it('should reject maxAgeSeconds above 1 year', () => {
      const result = sanitizeRuntimeCachingRule({
        urlPattern: '/test',
        handler: 'CacheFirst',
        options: {
          expiration: { maxAgeSeconds: 31536001 },
        },
      });
      expect(result?.options?.expiration).toBeUndefined();
    });

    it('should include valid networkTimeoutSeconds', () => {
      const result = sanitizeRuntimeCachingRule({
        urlPattern: '/test',
        handler: 'NetworkFirst',
        options: { networkTimeoutSeconds: 10 },
      });
      expect(result?.options?.networkTimeoutSeconds).toBe(10);
    });

    it('should reject networkTimeoutSeconds above 300', () => {
      const result = sanitizeRuntimeCachingRule({
        urlPattern: '/test',
        handler: 'NetworkFirst',
        options: { networkTimeoutSeconds: 301 },
      });
      expect(result?.options?.networkTimeoutSeconds).toBeUndefined();
    });

    it('should strip unknown properties', () => {
      const result = sanitizeRuntimeCachingRule({
        urlPattern: '/test',
        handler: 'CacheFirst',
        options: { maliciousProp: 'eval("attack")' },
      });
      expect(result).not.toHaveProperty('options.maliciousProp');
    });
  });
});

// =============================================================================
// escapeForServiceWorker() Tests
// =============================================================================

describe('escapeForServiceWorker', () => {
  describe('basic types', () => {
    it('should handle undefined', () => {
      expect(escapeForServiceWorker(undefined)).toBe('undefined');
    });

    it('should handle null', () => {
      expect(escapeForServiceWorker(null)).toBe('null');
    });

    it('should handle booleans', () => {
      expect(escapeForServiceWorker(true)).toBe('true');
      expect(escapeForServiceWorker(false)).toBe('false');
    });

    it('should handle numbers', () => {
      expect(escapeForServiceWorker(123)).toBe('123');
      expect(escapeForServiceWorker(0)).toBe('0');
      expect(escapeForServiceWorker(-1)).toBe('-1');
    });

    it('should handle strings', () => {
      // JSON.stringify wraps in quotes, then backslashes are doubled
      expect(escapeForServiceWorker('hello')).toBe('"hello"');
    });

    it('should handle objects', () => {
      const result = escapeForServiceWorker({ key: 'value' });
      // JSON.stringify produces {"key":"value"}, then backslashes are doubled
      expect(result).toBe('{"key":"value"}');
    });

    it('should handle arrays', () => {
      const result = escapeForServiceWorker([1, 2, 3]);
      expect(result).toBe('[1,2,3]');
    });
  });

  describe('special types', () => {
    it('should return null for functions', () => {
      expect(escapeForServiceWorker(() => {})).toBe('null');
    });

    it('should return null for symbols', () => {
      expect(escapeForServiceWorker(Symbol('test'))).toBe('null');
    });

    it('should handle BigInt by converting to string', () => {
      expect(escapeForServiceWorker(BigInt(123))).toBe('"123"');
    });
  });

  describe('XSS prevention', () => {
    it('should escape </script> tags', () => {
      const result = escapeForServiceWorker('</script>');
      expect(result).toContain('<\\/script>');
    });

    it('should escape <!-- HTML comments', () => {
      const result = escapeForServiceWorker('<!--comment-->');
      expect(result).toContain('<\\!--');
    });
  });

  describe('template literal safety', () => {
    it('should escape backticks', () => {
      const result = escapeForServiceWorker('test`string');
      expect(result).toContain('\\`');
    });

    it('should escape ${} interpolation', () => {
      const result = escapeForServiceWorker('${dangerous}');
      expect(result).toContain('\\${');
    });
  });

  describe('line terminators', () => {
    it('should escape line separator U+2028', () => {
      const result = escapeForServiceWorker('test\u2028line');
      expect(result).toContain('\\u2028');
    });

    it('should escape paragraph separator U+2029', () => {
      const result = escapeForServiceWorker('test\u2029para');
      expect(result).toContain('\\u2029');
    });
  });

  describe('circular references', () => {
    it('should return null for circular objects', () => {
      const obj: Record<string, unknown> = { foo: 'bar' };
      obj['self'] = obj;
      expect(escapeForServiceWorker(obj)).toBe('null');
    });
  });
});

// =============================================================================
// isValidHandler() Tests
// =============================================================================

describe('isValidHandler', () => {
  it('should return true for all allowed handlers', () => {
    for (const handler of ALLOWED_HANDLERS) {
      expect(isValidHandler(handler)).toBe(true);
    }
  });

  it('should return false for invalid handlers', () => {
    expect(isValidHandler('InvalidHandler')).toBe(false);
    expect(isValidHandler('cacheFirst')).toBe(false); // case sensitive
    expect(isValidHandler('')).toBe(false);
  });

  it('should return false for non-string input', () => {
    expect(isValidHandler(123)).toBe(false);
    expect(isValidHandler(null)).toBe(false);
    expect(isValidHandler(undefined)).toBe(false);
    expect(isValidHandler({})).toBe(false);
  });
});

// =============================================================================
// hasPathTraversal() Tests
// =============================================================================

describe('hasPathTraversal', () => {
  describe('basic patterns', () => {
    it('should detect basic .. traversal', () => {
      expect(hasPathTraversal('../etc/passwd')).toBe(true);
      expect(hasPathTraversal('foo/../bar')).toBe(true);
    });

    it('should detect Windows-style traversal', () => {
      expect(hasPathTraversal('..\\windows\\system32')).toBe(true);
    });

    it('should return false for safe paths', () => {
      expect(hasPathTraversal('foo/bar/baz')).toBe(false);
      expect(hasPathTraversal('/absolute/path')).toBe(false);
    });
  });

  describe('encoded patterns', () => {
    it('should detect URL-encoded ..', () => {
      expect(hasPathTraversal('%2e%2e/etc/passwd')).toBe(true);
      expect(hasPathTraversal('%2E%2E/etc/passwd')).toBe(true);
    });

    it('should detect double URL-encoded ..', () => {
      expect(hasPathTraversal('%252e%252e/etc/passwd')).toBe(true);
    });

    it('should detect mixed encoding', () => {
      expect(hasPathTraversal('.%2e/etc/passwd')).toBe(true);
      expect(hasPathTraversal('%2e./etc/passwd')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should return false for non-string input', () => {
      expect(hasPathTraversal(null as unknown as string)).toBe(false);
      expect(hasPathTraversal(123 as unknown as string)).toBe(false);
    });

    it('should handle empty string', () => {
      expect(hasPathTraversal('')).toBe(false);
    });

    it('should not flag legitimate use of dots', () => {
      expect(hasPathTraversal('file.txt')).toBe(false);
      expect(hasPathTraversal('file.min.js')).toBe(false);
      expect(hasPathTraversal('.hidden')).toBe(false);
    });
  });
});

// =============================================================================
// ALLOWED_HANDLERS Export Test
// =============================================================================

describe('ALLOWED_HANDLERS', () => {
  it('should export the 5 valid Workbox handlers', () => {
    expect(ALLOWED_HANDLERS).toEqual([
      'CacheFirst',
      'CacheOnly',
      'NetworkFirst',
      'NetworkOnly',
      'StaleWhileRevalidate',
    ]);
  });
});
