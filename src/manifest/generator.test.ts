/**
 * Tests for Web Manifest Generator
 */

import { describe, it, expect } from "vitest";
import {
  generateManifest,
  generateManifestJson,
  validateManifestConfig,
  ManifestValidationError,
  ManifestConfigSchema,
} from "./generator.js";

// =============================================================================
// generateManifest Tests
// =============================================================================

describe("generateManifest", () => {
  describe("required fields", () => {
    it("should generate manifest with only required name field", () => {
      const manifest = generateManifest({ name: "Test App" });

      expect(manifest.name).toBe("Test App");
      expect(manifest.start_url).toBe("/");
      expect(manifest.display).toBe("standalone");
    });

    it("should throw error when name is missing", () => {
      // @ts-expect-error - testing invalid input
      expect(() => generateManifest({})).toThrow(ManifestValidationError);
    });

    it("should throw error when name is empty", () => {
      expect(() => generateManifest({ name: "" })).toThrow(ManifestValidationError);
    });
  });

  describe("optional string fields", () => {
    it("should include short_name when provided", () => {
      const manifest = generateManifest({
        name: "My Application",
        short_name: "MyApp",
      });

      expect(manifest.short_name).toBe("MyApp");
    });

    it("should include description when provided", () => {
      const manifest = generateManifest({
        name: "Test App",
        description: "A test application for PWA functionality",
      });

      expect(manifest.description).toBe("A test application for PWA functionality");
    });

    it("should include theme_color when provided", () => {
      const manifest = generateManifest({
        name: "Test App",
        theme_color: "#3b82f6",
      });

      expect(manifest.theme_color).toBe("#3b82f6");
    });

    it("should include background_color when provided", () => {
      const manifest = generateManifest({
        name: "Test App",
        background_color: "#ffffff",
      });

      expect(manifest.background_color).toBe("#ffffff");
    });

    it("should include lang when provided", () => {
      const manifest = generateManifest({
        name: "Test App",
        lang: "en-US",
      });

      expect(manifest.lang).toBe("en-US");
    });

    it("should include dir when provided", () => {
      const manifest = generateManifest({
        name: "Test App",
        dir: "rtl",
      });

      expect(manifest.dir).toBe("rtl");
    });

    it("should include id when provided", () => {
      const manifest = generateManifest({
        name: "Test App",
        id: "my-app-id",
      });

      expect(manifest.id).toBe("my-app-id");
    });
  });

  describe("display modes", () => {
    it("should default to standalone display", () => {
      const manifest = generateManifest({ name: "Test App" });
      expect(manifest.display).toBe("standalone");
    });

    it("should accept fullscreen display", () => {
      const manifest = generateManifest({
        name: "Test App",
        display: "fullscreen",
      });

      expect(manifest.display).toBe("fullscreen");
    });

    it("should accept minimal-ui display", () => {
      const manifest = generateManifest({
        name: "Test App",
        display: "minimal-ui",
      });

      expect(manifest.display).toBe("minimal-ui");
    });

    it("should accept browser display", () => {
      const manifest = generateManifest({
        name: "Test App",
        display: "browser",
      });

      expect(manifest.display).toBe("browser");
    });

    it("should include display_override when provided", () => {
      const manifest = generateManifest({
        name: "Test App",
        display_override: ["fullscreen", "standalone"],
      });

      expect(manifest.display_override).toEqual(["fullscreen", "standalone"]);
    });
  });

  describe("orientation", () => {
    it("should include orientation when provided", () => {
      const manifest = generateManifest({
        name: "Test App",
        orientation: "portrait",
      });

      expect(manifest.orientation).toBe("portrait");
    });

    it("should accept all valid orientation values", () => {
      const orientations = [
        "any",
        "natural",
        "landscape",
        "landscape-primary",
        "landscape-secondary",
        "portrait",
        "portrait-primary",
        "portrait-secondary",
      ] as const;

      for (const orientation of orientations) {
        const manifest = generateManifest({ name: "Test", orientation });
        expect(manifest.orientation).toBe(orientation);
      }
    });
  });

  describe("icons", () => {
    it("should include icons when provided", () => {
      const manifest = generateManifest({
        name: "Test App",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      });

      expect(manifest.icons).toHaveLength(2);
      expect(manifest.icons![0].src).toBe("/icons/icon-192.png");
      expect(manifest.icons![1].sizes).toBe("512x512");
    });

    it("should include icon purpose when provided", () => {
      const manifest = generateManifest({
        name: "Test App",
        icons: [
          {
            src: "/icons/maskable-icon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      });

      expect(manifest.icons![0].purpose).toBe("maskable");
    });

    it("should accept array of purposes", () => {
      const manifest = generateManifest({
        name: "Test App",
        icons: [
          {
            src: "/icons/icon.png",
            sizes: "512x512",
            purpose: ["any", "maskable"],
          },
        ],
      });

      expect(manifest.icons![0].purpose).toEqual(["any", "maskable"]);
    });
  });

  describe("screenshots", () => {
    it("should include screenshots when provided", () => {
      const manifest = generateManifest({
        name: "Test App",
        screenshots: [
          {
            src: "/screenshots/desktop.png",
            sizes: "1920x1080",
            type: "image/png",
            form_factor: "wide",
          },
          {
            src: "/screenshots/mobile.png",
            sizes: "1080x1920",
            type: "image/png",
            form_factor: "narrow",
            label: "Mobile view",
          },
        ],
      });

      expect(manifest.screenshots).toHaveLength(2);
      expect(manifest.screenshots![0].form_factor).toBe("wide");
      expect(manifest.screenshots![1].label).toBe("Mobile view");
    });
  });

  describe("shortcuts", () => {
    it("should include shortcuts when provided", () => {
      const manifest = generateManifest({
        name: "Test App",
        shortcuts: [
          {
            name: "New Task",
            short_name: "Task",
            description: "Create a new task",
            url: "/new-task",
          },
          {
            name: "Settings",
            url: "/settings",
            icons: [{ src: "/icons/settings.png", sizes: "96x96" }],
          },
        ],
      });

      expect(manifest.shortcuts).toHaveLength(2);
      expect(manifest.shortcuts![0].name).toBe("New Task");
      expect(manifest.shortcuts![1].icons).toHaveLength(1);
    });
  });

  describe("categories", () => {
    it("should include categories when provided", () => {
      const manifest = generateManifest({
        name: "Test App",
        categories: ["productivity", "utilities"],
      });

      expect(manifest.categories).toEqual(["productivity", "utilities"]);
    });
  });

  describe("basePath handling", () => {
    it("should apply basePath to start_url", () => {
      const manifest = generateManifest(
        { name: "Test App", start_url: "/" },
        { basePath: "/app" }
      );

      expect(manifest.start_url).toBe("/app/");
    });

    it("should apply basePath to start_url with path", () => {
      const manifest = generateManifest(
        { name: "Test App", start_url: "/dashboard" },
        { basePath: "/app" }
      );

      expect(manifest.start_url).toBe("/app/dashboard");
    });

    it("should set default scope when basePath is provided", () => {
      const manifest = generateManifest(
        { name: "Test App" },
        { basePath: "/app" }
      );

      expect(manifest.scope).toBe("/app/");
    });

    it("should apply basePath to existing scope", () => {
      const manifest = generateManifest(
        { name: "Test App", scope: "/section" },
        { basePath: "/app" }
      );

      expect(manifest.scope).toBe("/app/section");
    });

    it("should not modify absolute URLs in start_url", () => {
      const manifest = generateManifest(
        { name: "Test App", start_url: "https://example.com/start" },
        { basePath: "/app" }
      );

      expect(manifest.start_url).toBe("https://example.com/start");
    });

    it("should handle basePath without leading slash", () => {
      const manifest = generateManifest(
        { name: "Test App", start_url: "/" },
        { basePath: "app" }
      );

      expect(manifest.start_url).toBe("/app/");
    });

    it("should handle basePath with trailing slash", () => {
      const manifest = generateManifest(
        { name: "Test App", start_url: "/dashboard" },
        { basePath: "/app/" }
      );

      expect(manifest.start_url).toBe("/app/dashboard");
    });
  });

  describe("passthrough fields", () => {
    it("should preserve unknown fields", () => {
      const manifest = generateManifest({
        name: "Test App",
        custom_field: "custom_value",
        another_field: { nested: true },
      } as { name: string; custom_field: string; another_field: { nested: boolean } });

      expect(manifest.custom_field).toBe("custom_value");
      expect(manifest.another_field).toEqual({ nested: true });
    });
  });
});

// =============================================================================
// generateManifestJson Tests
// =============================================================================

describe("generateManifestJson", () => {
  it("should return valid JSON string", () => {
    const json = generateManifestJson({ name: "Test App" });
    const parsed = JSON.parse(json);

    expect(parsed.name).toBe("Test App");
    expect(parsed.start_url).toBe("/");
    expect(parsed.display).toBe("standalone");
  });

  it("should pretty print when option is enabled", () => {
    const compactJson = generateManifestJson({ name: "Test App" });
    const prettyJson = generateManifestJson({ name: "Test App" }, { pretty: true });

    expect(prettyJson.includes("\n")).toBe(true);
    expect(compactJson.includes("\n")).toBe(false);
  });

  it("should include indentation in pretty output", () => {
    const prettyJson = generateManifestJson(
      { name: "Test App", theme_color: "#000" },
      { pretty: true }
    );

    expect(prettyJson).toContain('  "name"');
    expect(prettyJson).toContain('  "theme_color"');
  });
});

// =============================================================================
// validateManifestConfig Tests
// =============================================================================

describe("validateManifestConfig", () => {
  it("should return success for valid config", () => {
    const result = validateManifestConfig({
      name: "Test App",
      short_name: "Test",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Test App");
    }
  });

  it("should return error for invalid config", () => {
    const result = validateManifestConfig({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("should reject invalid display value", () => {
    const result = validateManifestConfig({
      name: "Test App",
      display: "invalid-display",
    });

    expect(result.success).toBe(false);
  });

  it("should reject invalid orientation value", () => {
    const result = validateManifestConfig({
      name: "Test App",
      orientation: "sideways",
    });

    expect(result.success).toBe(false);
  });

  it("should reject invalid dir value", () => {
    const result = validateManifestConfig({
      name: "Test App",
      dir: "up",
    });

    expect(result.success).toBe(false);
  });

  it("should reject icons with missing src", () => {
    const result = validateManifestConfig({
      name: "Test App",
      icons: [{ sizes: "192x192" }],
    });

    expect(result.success).toBe(false);
  });

  it("should reject icons with missing sizes", () => {
    const result = validateManifestConfig({
      name: "Test App",
      icons: [{ src: "/icon.png" }],
    });

    expect(result.success).toBe(false);
  });

  it("should reject shortcuts with missing name", () => {
    const result = validateManifestConfig({
      name: "Test App",
      shortcuts: [{ url: "/page" }],
    });

    expect(result.success).toBe(false);
  });

  it("should reject shortcuts with missing url", () => {
    const result = validateManifestConfig({
      name: "Test App",
      shortcuts: [{ name: "Shortcut" }],
    });

    expect(result.success).toBe(false);
  });
});

// =============================================================================
// ManifestValidationError Tests
// =============================================================================

describe("ManifestValidationError", () => {
  it("should have correct name", () => {
    try {
      // @ts-expect-error - testing invalid input
      generateManifest({});
    } catch (error) {
      expect(error).toBeInstanceOf(ManifestValidationError);
      expect((error as ManifestValidationError).name).toBe("ManifestValidationError");
    }
  });

  it("should include issues array", () => {
    try {
      // @ts-expect-error - testing invalid input
      generateManifest({});
    } catch (error) {
      const validationError = error as ManifestValidationError;
      expect(validationError.issues).toBeDefined();
      expect(Array.isArray(validationError.issues)).toBe(true);
      expect(validationError.issues.length).toBeGreaterThan(0);
    }
  });

  it("should include field path in error message", () => {
    try {
      generateManifest({ name: "" });
    } catch (error) {
      const validationError = error as ManifestValidationError;
      expect(validationError.message).toContain("name:");
    }
  });
});

// =============================================================================
// ManifestConfigSchema Tests
// =============================================================================

describe("ManifestConfigSchema", () => {
  it("should parse valid complete config", () => {
    const config = {
      name: "Complete App",
      short_name: "App",
      description: "A complete test application",
      start_url: "/app",
      display: "standalone" as const,
      orientation: "portrait" as const,
      theme_color: "#000000",
      background_color: "#ffffff",
      scope: "/",
      lang: "en",
      dir: "ltr" as const,
      icons: [{ src: "/icon.png", sizes: "192x192" }],
      screenshots: [{ src: "/screen.png", sizes: "1920x1080" }],
      shortcuts: [{ name: "Home", url: "/" }],
      categories: ["utilities"],
      id: "complete-app",
    };

    const result = ManifestConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it("should apply defaults correctly", () => {
    const result = ManifestConfigSchema.parse({ name: "Test" });

    expect(result.start_url).toBe("/");
    expect(result.display).toBe("standalone");
  });
});
