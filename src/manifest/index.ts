/**
 * Web Manifest Module
 *
 * Provides utilities for generating and validating web app manifests.
 *
 * @module next-pwa-turbo/manifest
 */

export {
  generateManifest,
  generateManifestJson,
  validateManifestConfig,
  ManifestValidationError,
  ManifestConfigSchema,
  ManifestIconSchema,
  ManifestScreenshotSchema,
  ManifestShortcutSchema,
} from "./generator.js";

export type {
  ManifestConfig,
  ManifestConfigInput,
  ManifestIcon,
  ManifestScreenshot,
  ManifestShortcut,
  ManifestDisplay,
  ManifestOrientation,
  ManifestDir,
  IconPurpose,
  ScreenshotFormFactor,
  WebAppManifest,
  GenerateManifestOptions,
} from "./generator.js";
