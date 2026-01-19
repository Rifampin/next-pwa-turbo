/**
 * Security utilities for next-pwa-turbo
 *
 * These utilities provide input validation and sanitization for
 * service worker configuration and file operations.
 *
 * Security principles:
 * - No eval() or new Function()
 * - All inputs treated as untrusted
 * - Fail closed (reject invalid input rather than try to fix it)
 * - Comprehensive validation
 * - Handle edge cases (empty strings, null bytes, unicode)
 */

/**
 * Allowed Workbox caching strategies
 */
const ALLOWED_HANDLERS = [
  'CacheFirst',
  'CacheOnly',
  'NetworkFirst',
  'NetworkOnly',
  'StaleWhileRevalidate',
] as const;

type CachingHandler = (typeof ALLOWED_HANDLERS)[number];

/**
 * Sanitizes a file path by removing traversal attempts and normalizing format.
 *
 * @param path - The path to sanitize
 * @returns Sanitized path string
 *
 * @example
 * sanitizePath('../secret/file.txt') // Returns 'secret/file.txt'
 * sanitizePath('./foo//bar') // Returns 'foo/bar'
 * sanitizePath('  path/to/file  ') // Returns 'path/to/file'
 */
export function sanitizePath(path: string): string {
  if (typeof path !== 'string') {
    return '';
  }

  let sanitized = path
    // Strip leading/trailing whitespace
    .trim()
    // Normalize path separators to forward slashes
    .replace(/\\/g, '/')
    // Remove null bytes (security risk)
    .replace(/\0/g, '')
    // Remove any path traversal sequences (..)
    .replace(/\.\.(?:\/|$)/g, '')
    // Remove current directory references (./)
    .replace(/\.\/+/g, '')
    // Remove duplicate slashes
    .replace(/\/+/g, '/')
    // Remove leading slashes to prevent absolute path escape
    .replace(/^\/+/, '');

  // Second pass to catch any remaining traversal attempts after normalization
  // This handles cases like '....//' which might resolve to '..' after first pass
  while (sanitized.includes('..')) {
    sanitized = sanitized.replace(/\.\./g, '');
  }

  // Clean up any artifacts from removal
  sanitized = sanitized.replace(/\/+/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');

  return sanitized;
}

/**
 * Validates a service worker scope string.
 *
 * @param scope - The scope to validate
 * @param basePath - Optional base path the scope must start with
 * @returns true if the scope is valid, false otherwise
 *
 * @example
 * validateScope('/app/') // Returns true
 * validateScope('/app/../admin/') // Returns false (contains ..)
 * validateScope('app/') // Returns false (doesn't start with /)
 * validateScope('/app/', '/app') // Returns true
 * validateScope('/other/', '/app') // Returns false (doesn't start with basePath)
 */
export function validateScope(scope: string, basePath?: string): boolean {
  // Must be a string
  if (typeof scope !== 'string') {
    return false;
  }

  // Must not be empty
  if (scope.length === 0) {
    return false;
  }

  // Must start with /
  if (!scope.startsWith('/')) {
    return false;
  }

  // Must not contain path traversal
  if (scope.includes('..')) {
    return false;
  }

  // Must not contain null bytes
  if (scope.includes('\0')) {
    return false;
  }

  // Must not contain query strings
  if (scope.includes('?')) {
    return false;
  }

  // Must not contain fragments
  if (scope.includes('#')) {
    return false;
  }

  // Must not contain backslashes (Windows-style paths)
  if (scope.includes('\\')) {
    return false;
  }

  // If basePath is provided, scope must start with it
  if (basePath !== undefined) {
    if (typeof basePath !== 'string') {
      return false;
    }

    // Normalize basePath for comparison
    const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
    const normalizedScope = scope.endsWith('/') ? scope : `${scope}/`;

    if (!normalizedScope.startsWith(normalizedBase)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates a filename for service worker or asset files.
 *
 * @param filename - The filename to validate
 * @returns true if the filename is valid, false otherwise
 *
 * @example
 * isValidFilename('sw.js') // Returns true
 * isValidFilename('../sw.js') // Returns false (contains path separator)
 * isValidFilename('.') // Returns false (reserved name)
 * isValidFilename('sw.ts') // Returns false (must end with .js)
 * isValidFilename('a'.repeat(256) + '.js') // Returns false (too long)
 */
export function isValidFilename(filename: string): boolean {
  // Must be a string
  if (typeof filename !== 'string') {
    return false;
  }

  // Must not be empty
  if (filename.length === 0) {
    return false;
  }

  // Must not exceed 255 characters
  if (filename.length > 255) {
    return false;
  }

  // Must not contain null bytes
  if (filename.includes('\0')) {
    return false;
  }

  // Must not contain forward slashes
  if (filename.includes('/')) {
    return false;
  }

  // Must not contain backslashes
  if (filename.includes('\\')) {
    return false;
  }

  // Must not be . or ..
  if (filename === '.' || filename === '..') {
    return false;
  }

  // Must end with .js
  if (!filename.endsWith('.js')) {
    return false;
  }

  // Must have a name before .js (not just ".js")
  if (filename === '.js') {
    return false;
  }

  // Validate characters - allow alphanumeric, dash, underscore, dot
  // This is a conservative allowlist approach
  const validFilenamePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.js$/;
  if (!validFilenamePattern.test(filename)) {
    return false;
  }

  return true;
}

/**
 * Validated and sanitized runtime caching rule structure
 */
interface SanitizedRuntimeCachingRule {
  urlPattern: string;
  handler: CachingHandler;
  options?: {
    cacheName?: string;
    expiration?: {
      maxEntries?: number;
      maxAgeSeconds?: number;
    };
    networkTimeoutSeconds?: number;
  };
}

/**
 * Sanitizes a runtime caching rule, removing potentially dangerous properties.
 *
 * @param rule - The rule to sanitize (unknown type, will be validated)
 * @returns Sanitized rule object or null if invalid
 *
 * @example
 * sanitizeRuntimeCachingRule({ urlPattern: '/api/*', handler: 'NetworkFirst' })
 * // Returns { urlPattern: '/api/*', handler: 'NetworkFirst' }
 *
 * sanitizeRuntimeCachingRule({ urlPattern: '/api/*', handler: 'InvalidHandler' })
 * // Returns null (invalid handler)
 *
 * sanitizeRuntimeCachingRule({ urlPattern: /^\/api\//, handler: 'CacheFirst' })
 * // Returns { urlPattern: '/^\\/api\\//', handler: 'CacheFirst' } (regex stringified)
 */
export function sanitizeRuntimeCachingRule(rule: unknown): SanitizedRuntimeCachingRule | null {
  // Must be an object
  if (rule === null || typeof rule !== 'object') {
    return null;
  }

  const ruleObj = rule as Record<string, unknown>;

  // Validate urlPattern
  let urlPattern: string;

  if (typeof ruleObj['urlPattern'] === 'string') {
    urlPattern = ruleObj['urlPattern'];

    // Basic validation - must not be empty
    if (urlPattern.length === 0) {
      return null;
    }

    // Must not contain null bytes
    if (urlPattern.includes('\0')) {
      return null;
    }
  } else if (ruleObj['urlPattern'] instanceof RegExp) {
    // Safely stringify regex
    urlPattern = ruleObj['urlPattern'].toString();
  } else {
    return null;
  }

  // Validate handler
  const handler = ruleObj['handler'];

  if (typeof handler !== 'string') {
    return null;
  }

  if (!ALLOWED_HANDLERS.includes(handler as CachingHandler)) {
    return null;
  }

  // Build sanitized rule with only allowed properties
  const sanitized: SanitizedRuntimeCachingRule = {
    urlPattern,
    handler: handler as CachingHandler,
  };

  // Optionally include safe options
  if (ruleObj['options'] !== undefined && typeof ruleObj['options'] === 'object' && ruleObj['options'] !== null) {
    const options = ruleObj['options'] as Record<string, unknown>;
    const sanitizedOptions: SanitizedRuntimeCachingRule['options'] = {};

    // cacheName - must be a safe string
    if (typeof options['cacheName'] === 'string') {
      const cacheName = options['cacheName'];
      // Allow only alphanumeric, dash, underscore
      if (/^[a-zA-Z0-9_-]+$/.test(cacheName) && cacheName.length <= 100) {
        sanitizedOptions.cacheName = cacheName;
      }
    }

    // expiration options
    if (typeof options['expiration'] === 'object' && options['expiration'] !== null) {
      const expiration = options['expiration'] as Record<string, unknown>;
      const sanitizedExpiration: NonNullable<SanitizedRuntimeCachingRule['options']>['expiration'] = {};

      if (typeof expiration['maxEntries'] === 'number' && Number.isInteger(expiration['maxEntries']) && expiration['maxEntries'] > 0 && expiration['maxEntries'] <= 10000) {
        sanitizedExpiration.maxEntries = expiration['maxEntries'];
      }

      if (typeof expiration['maxAgeSeconds'] === 'number' && Number.isInteger(expiration['maxAgeSeconds']) && expiration['maxAgeSeconds'] > 0 && expiration['maxAgeSeconds'] <= 31536000) {
        // Max 1 year
        sanitizedExpiration.maxAgeSeconds = expiration['maxAgeSeconds'];
      }

      if (Object.keys(sanitizedExpiration).length > 0) {
        sanitizedOptions.expiration = sanitizedExpiration;
      }
    }

    // networkTimeoutSeconds
    if (
      typeof options['networkTimeoutSeconds'] === 'number' &&
      Number.isInteger(options['networkTimeoutSeconds']) &&
      options['networkTimeoutSeconds'] > 0 &&
      options['networkTimeoutSeconds'] <= 300
    ) {
      sanitizedOptions.networkTimeoutSeconds = options['networkTimeoutSeconds'];
    }

    if (Object.keys(sanitizedOptions).length > 0) {
      sanitized.options = sanitizedOptions;
    }
  }

  return sanitized;
}

/**
 * Safely escapes a value for injection into service worker code.
 * Uses JSON.stringify with additional escaping for template literal safety.
 *
 * @param value - The value to escape
 * @returns Safely escaped string representation
 *
 * @example
 * escapeForServiceWorker({ key: 'value' }) // Returns '{"key":"value"}'
 * escapeForServiceWorker('</script>') // Returns '"<\\/script>"' (escaped)
 * escapeForServiceWorker('`${dangerous}`') // Backticks and ${} safely escaped
 */
export function escapeForServiceWorker(value: unknown): string {
  // Handle undefined explicitly
  if (value === undefined) {
    return 'undefined';
  }

  // Handle functions - reject them, don't serialize
  if (typeof value === 'function') {
    return 'null';
  }

  // Handle symbols - reject them
  if (typeof value === 'symbol') {
    return 'null';
  }

  // Handle BigInt - convert to string representation
  if (typeof value === 'bigint') {
    return `"${value.toString()}"`;
  }

  let serialized: string;

  try {
    serialized = JSON.stringify(value);
  } catch {
    // If JSON.stringify fails (circular references, etc.), return null
    return 'null';
  }

  // Handle case where JSON.stringify returns undefined (shouldn't happen after our checks, but be safe)
  if (serialized === undefined) {
    return 'null';
  }

  // Escape characters that could break template literals or cause XSS
  return (
    serialized
      // Escape backslashes first (must be done first to avoid double-escaping)
      .replace(/\\/g, '\\\\')
      // Escape backticks (template literal delimiter)
      .replace(/`/g, '\\`')
      // Escape ${} (template literal interpolation)
      .replace(/\$\{/g, '\\${')
      // Escape </script> tags (XSS prevention)
      .replace(/<\/script>/gi, '<\\/script>')
      // Escape <!-- (HTML comment injection)
      .replace(/<!--/g, '<\\!--')
      // Escape line terminators that could break string literals
      .replace(/\u2028/g, '\\u2028')
      .replace(/\u2029/g, '\\u2029')
  );
}

/**
 * Type guard to check if a value is a valid caching handler
 */
export function isValidHandler(handler: unknown): handler is CachingHandler {
  return typeof handler === 'string' && ALLOWED_HANDLERS.includes(handler as CachingHandler);
}

/**
 * Checks if a string contains potential path traversal attempts
 *
 * @param input - String to check
 * @returns true if path traversal is detected
 *
 * @example
 * hasPathTraversal('../etc/passwd') // Returns true
 * hasPathTraversal('normal/path') // Returns false
 * hasPathTraversal('..\\windows\\system32') // Returns true
 */
export function hasPathTraversal(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  // Check for various traversal patterns
  const traversalPatterns = [
    /\.\./,              // Basic ..
    /\.\.\\/,            // Windows-style ..\
    /%2e%2e/i,          // URL-encoded ..
    /%252e%252e/i,      // Double URL-encoded ..
    /\.%2e/i,           // Mixed encoding
    /%2e\./i,           // Mixed encoding
  ];

  return traversalPatterns.some(pattern => pattern.test(input));
}

// Re-export the allowed handlers for external use
export { ALLOWED_HANDLERS };
export type { CachingHandler, SanitizedRuntimeCachingRule };
