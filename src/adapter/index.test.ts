/**
 * Tests for Build Adapter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createPWABuildAdapter,
  getDefaultAdapterOptions,
  type BuildContext,
  type BuildConfig,
  type PWABuildAdapterOptions,
} from "./index.js";
import type { PWAConfig } from "../config/schema.js";

// =============================================================================
// Mock Setup
// =============================================================================

// Mock manifest generator module
vi.mock("./manifest-generator.js", () => ({
  generatePrecacheManifest: vi.fn().mockResolvedValue([
    { url: "/_next/static/chunks/main.js", revision: "abc123" },
    { url: "/_next/static/css/styles.css", revision: "def456" },
  ]),
  writePWAManifest: vi.fn().mockResolvedValue(undefined),
}));

// =============================================================================
// Test Fixtures
// =============================================================================

const createMockConfig = (overrides: Partial<PWAConfig> = {}): PWAConfig => ({
  dest: "public",
  disable: false,
  register: true,
  scope: "/",
  sw: "sw.js",
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  navigationPreload: true,
  publicExcludes: [],
  buildExcludes: [],
  cacheOnFrontEndNav: false,
  dynamicStartUrl: true,
  reloadOnOnline: true,
  customWorkerPrefix: "worker-",
  ...overrides,
});

const createMockBuildContext = (overrides: Partial<BuildContext> = {}): BuildContext => ({
  projectDir: "/project",
  outputDir: "/project/.next",
  isProduction: true,
  buildId: "test-build-123",
  target: "server",
  ...overrides,
});

// =============================================================================
// createPWABuildAdapter Tests
// =============================================================================

describe("createPWABuildAdapter", () => {
  let consoleSpy: { info: ReturnType<typeof vi.spyOn>; warn: ReturnType<typeof vi.spyOn>; error: ReturnType<typeof vi.spyOn> };

  beforeEach(() => {
    consoleSpy = {
      info: vi.spyOn(console, "log").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("adapter creation", () => {
    it("should create adapter with correct name", () => {
      const config = createMockConfig();
      const adapter = createPWABuildAdapter({ config, nextConfig: {} });

      expect(adapter.name).toBe("next-pwa-turbo");
    });

    it("should throw error when config is missing", () => {
      expect(() =>
        createPWABuildAdapter({} as PWABuildAdapterOptions)
      ).toThrow("PWA config is required");
    });

    it("should throw error for path traversal in dest", () => {
      const config = createMockConfig({ dest: "../../../etc" });

      expect(() =>
        createPWABuildAdapter({ config, nextConfig: {} })
      ).toThrow("PWA config dest contains invalid path traversal");
    });

    it("should throw error for path traversal in scope", () => {
      const config = createMockConfig({ scope: "/../../../etc" });

      expect(() =>
        createPWABuildAdapter({ config, nextConfig: {} })
      ).toThrow("PWA config scope contains invalid path traversal");
    });

    it("should provide all lifecycle methods", () => {
      const config = createMockConfig();
      const adapter = createPWABuildAdapter({ config, nextConfig: {} });

      expect(typeof adapter.onBuildComplete).toBe("function");
      expect(typeof adapter.modifyBuildConfig).toBe("function");
      expect(typeof adapter.onBuildError).toBe("function");
      expect(typeof adapter.onHotReload).toBe("function");
    });
  });

  describe("onBuildComplete", () => {
    it("should skip when PWA is disabled", async () => {
      const config = createMockConfig({ disable: true });
      const adapter = createPWABuildAdapter({ config, nextConfig: {} });
      const context = createMockBuildContext();

      await adapter.onBuildComplete?.(context);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining("PWA is disabled")
      );
    });

    it("should skip in development without devOptions enabled", async () => {
      const config = createMockConfig();
      const adapter = createPWABuildAdapter({ config, nextConfig: {} });
      const context = createMockBuildContext({ isProduction: false });

      await adapter.onBuildComplete?.(context);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining("Skipping PWA manifest in development")
      );
    });

    it("should process in development when devOptions.enabled is true", async () => {
      const config = createMockConfig({ devOptions: { enabled: true } });
      const adapter = createPWABuildAdapter({ config, nextConfig: {} });
      const context = createMockBuildContext({ isProduction: false });

      await adapter.onBuildComplete?.(context);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining("Processing build outputs for PWA")
      );
    });

    it("should process build outputs in production", async () => {
      const config = createMockConfig();
      const adapter = createPWABuildAdapter({ config, nextConfig: {} });
      const context = createMockBuildContext();

      await adapter.onBuildComplete?.(context);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining("Processing build outputs for PWA")
      );
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining("PWA build complete: 2 entries")
      );
    });

    it("should apply manifest transforms when configured", async () => {
      const transform = vi.fn().mockReturnValue({
        manifest: [{ url: "/transformed.js", revision: "xyz" }],
        warnings: ["Test warning"],
      });

      const config = createMockConfig({
        manifestTransforms: [transform],
      });
      const adapter = createPWABuildAdapter({ config, nextConfig: {} });
      const context = createMockBuildContext();

      await adapter.onBuildComplete?.(context);

      expect(transform).toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining("Test warning")
      );
    });

    it("should log error and throw on failure", async () => {
      // Mock the manifest generator to throw
      const { generatePrecacheManifest } = await import("./manifest-generator.js");
      (generatePrecacheManifest as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Test error")
      );

      const config = createMockConfig();
      const adapter = createPWABuildAdapter({ config, nextConfig: {} });
      const context = createMockBuildContext();

      await expect(adapter.onBuildComplete?.(context)).rejects.toThrow("Test error");
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to generate PWA manifest: Test error")
      );
    });
  });

  describe("modifyBuildConfig", () => {
    it("should return config unchanged", () => {
      const config = createMockConfig();
      const adapter = createPWABuildAdapter({ config, nextConfig: {} });

      const buildConfig: BuildConfig = {
        outputFileExtensions: [".js", ".css"],
        additionalOutputFiles: [],
      };

      const result = adapter.modifyBuildConfig?.(buildConfig);

      expect(result).toEqual(buildConfig);
    });
  });

  describe("onBuildError", () => {
    it("should log error message", async () => {
      const config = createMockConfig();
      const adapter = createPWABuildAdapter({ config, nextConfig: {} });
      const context = createMockBuildContext();
      const error = new Error("Build failed");

      await adapter.onBuildError?.(error, context);

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("Build failed")
      );
    });
  });

  describe("onHotReload", () => {
    it("should skip when devOptions not enabled", async () => {
      const config = createMockConfig();
      const adapter = createPWABuildAdapter({ config, nextConfig: {} });
      const context = createMockBuildContext({ isProduction: false });

      await adapter.onHotReload?.(context);

      // Should not log hot reload message
      expect(consoleSpy.info).not.toHaveBeenCalledWith(
        expect.stringContaining("Hot reload detected")
      );
    });

    it("should process when devOptions.enabled is true", async () => {
      const config = createMockConfig({ devOptions: { enabled: true } });
      const adapter = createPWABuildAdapter({ config, nextConfig: {} });
      const context = createMockBuildContext({ isProduction: false });

      await adapter.onHotReload?.(context);

      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining("Hot reload detected")
      );
    });

    it("should not fail on error during hot reload", async () => {
      const { generatePrecacheManifest } = await import("./manifest-generator.js");
      (generatePrecacheManifest as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error("Hot reload error")
      );

      const config = createMockConfig({ devOptions: { enabled: true } });
      const adapter = createPWABuildAdapter({ config, nextConfig: {} });
      const context = createMockBuildContext({ isProduction: false });

      // Should not throw
      await expect(adapter.onHotReload?.(context)).resolves.toBeUndefined();
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining("PWA manifest update failed during hot reload")
      );
    });
  });
});

// =============================================================================
// getDefaultAdapterOptions Tests
// =============================================================================

describe("getDefaultAdapterOptions", () => {
  const originalEnv = process.env['NODE_ENV'];

  afterEach(() => {
    process.env['NODE_ENV'] = originalEnv;
  });

  it("should use default values when nextConfig is empty", () => {
    const config = createMockConfig();
    const options = getDefaultAdapterOptions(config);

    expect(options.nextConfig.basePath).toBe("");
    expect(options.nextConfig.distDir).toBe(".next");
  });

  it("should use provided nextConfig values", () => {
    const config = createMockConfig();
    const options = getDefaultAdapterOptions(config, {
      basePath: "/app",
      distDir: "build",
    });

    expect(options.nextConfig.basePath).toBe("/app");
    expect(options.nextConfig.distDir).toBe("build");
  });

  it("should detect production from NODE_ENV", () => {
    process.env['NODE_ENV'] = "production";
    const config = createMockConfig();
    const options = getDefaultAdapterOptions(config);

    expect(options.nextConfig.isProduction).toBe(true);
  });

  it("should detect development from NODE_ENV", () => {
    process.env['NODE_ENV'] = "development";
    const config = createMockConfig();
    const options = getDefaultAdapterOptions(config);

    expect(options.nextConfig.isProduction).toBe(false);
  });

  it("should use explicit isProduction over NODE_ENV", () => {
    process.env['NODE_ENV'] = "development";
    const config = createMockConfig();
    const options = getDefaultAdapterOptions(config, { isProduction: true });

    expect(options.nextConfig.isProduction).toBe(true);
  });
});

// =============================================================================
// Integration with basePath Tests
// =============================================================================

describe("basePath handling", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should use nextConfig.basePath over config.basePath", async () => {
    const { generatePrecacheManifest } = await import("./manifest-generator.js");

    const config = createMockConfig({ basePath: "/config-path" });
    const adapter = createPWABuildAdapter({
      config,
      nextConfig: { basePath: "/next-path" },
    });
    const context = createMockBuildContext();

    await adapter.onBuildComplete?.(context);

    expect(generatePrecacheManifest).toHaveBeenCalledWith(
      expect.objectContaining({
        basePath: "/next-path",
      })
    );
  });

  it("should use empty string basePath when nextConfig.basePath is empty (no fallback)", async () => {
    const { generatePrecacheManifest } = await import("./manifest-generator.js");

    const config = createMockConfig({ basePath: "/config-path" });
    const adapter = createPWABuildAdapter({
      config,
      nextConfig: { basePath: "" },
    });
    const context = createMockBuildContext();

    await adapter.onBuildComplete?.(context);

    // Empty string is a valid basePath (root), so no fallback occurs
    // This matches the ?? operator behavior (only null/undefined trigger fallback)
    expect(generatePrecacheManifest).toHaveBeenCalledWith(
      expect.objectContaining({
        basePath: "",
      })
    );
  });

  it("should fall back to config.basePath when nextConfig.basePath is undefined", async () => {
    const { generatePrecacheManifest } = await import("./manifest-generator.js");

    const config = createMockConfig({ basePath: "/config-path" });
    const adapter = createPWABuildAdapter({
      config,
      nextConfig: {}, // basePath is undefined
    });
    const context = createMockBuildContext();

    await adapter.onBuildComplete?.(context);

    // undefined triggers ?? fallback to config.basePath
    expect(generatePrecacheManifest).toHaveBeenCalledWith(
      expect.objectContaining({
        basePath: "/config-path",
      })
    );
  });
});

// =============================================================================
// Additional Manifest Entries Tests
// =============================================================================

describe("additionalManifestEntries normalization", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should normalize string entries to PrecacheEntry format", async () => {
    const { generatePrecacheManifest } = await import("./manifest-generator.js");

    const config = createMockConfig({
      additionalManifestEntries: ["/extra.js", "/another.css"],
    });
    const adapter = createPWABuildAdapter({ config, nextConfig: {} });
    const context = createMockBuildContext();

    await adapter.onBuildComplete?.(context);

    expect(generatePrecacheManifest).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalManifestEntries: [
          { url: "/extra.js", revision: null },
          { url: "/another.css", revision: null },
        ],
      })
    );
  });

  it("should preserve object entries with revision", async () => {
    const { generatePrecacheManifest } = await import("./manifest-generator.js");

    const config = createMockConfig({
      additionalManifestEntries: [
        { url: "/versioned.js", revision: "v1" },
        { url: "/unversioned.js", revision: null },
      ],
    });
    const adapter = createPWABuildAdapter({ config, nextConfig: {} });
    const context = createMockBuildContext();

    await adapter.onBuildComplete?.(context);

    expect(generatePrecacheManifest).toHaveBeenCalledWith(
      expect.objectContaining({
        additionalManifestEntries: [
          { url: "/versioned.js", revision: "v1" },
          { url: "/unversioned.js", revision: null },
        ],
      })
    );
  });
});
