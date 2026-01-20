/**
 * Web Manifest Generator
 *
 * Generates a valid web app manifest (manifest.json) from PWA configuration.
 *
 * @module next-pwa-turbo/manifest
 */

import { z } from "zod";

// =============================================================================
// Manifest Icon Configuration
// =============================================================================

/**
 * Purpose of an icon in the manifest
 */
export type IconPurpose = "any" | "maskable" | "monochrome";

/**
 * Configuration for a manifest icon
 */
export interface ManifestIcon {
  /** URL/path to the icon file */
  src: string;
  /** Size(s) of the icon (e.g., "192x192" or "48x48 72x72 96x96") */
  sizes: string;
  /** MIME type of the icon (e.g., "image/png") */
  type?: string;
  /** Purpose of the icon */
  purpose?: IconPurpose | IconPurpose[];
}

/**
 * Icon configuration Zod schema
 */
export const ManifestIconSchema = z.object({
  src: z.string().min(1),
  sizes: z.string().min(1),
  type: z.string().optional(),
  purpose: z
    .union([
      z.enum(["any", "maskable", "monochrome"]),
      z.array(z.enum(["any", "maskable", "monochrome"])),
    ])
    .optional(),
});

// =============================================================================
// Manifest Screenshot Configuration
// =============================================================================

/**
 * Form factor for screenshot
 */
export type ScreenshotFormFactor = "wide" | "narrow";

/**
 * Configuration for a manifest screenshot
 */
export interface ManifestScreenshot {
  /** URL/path to the screenshot */
  src: string;
  /** Size of the screenshot */
  sizes: string;
  /** MIME type */
  type?: string;
  /** Form factor */
  form_factor?: ScreenshotFormFactor;
  /** Label for the screenshot */
  label?: string;
}

export const ManifestScreenshotSchema = z.object({
  src: z.string().min(1),
  sizes: z.string().min(1),
  type: z.string().optional(),
  form_factor: z.enum(["wide", "narrow"]).optional(),
  label: z.string().optional(),
});

// =============================================================================
// Manifest Shortcut Configuration
// =============================================================================

/**
 * Configuration for app shortcuts
 */
export interface ManifestShortcut {
  /** Name of the shortcut */
  name: string;
  /** Short name */
  short_name?: string;
  /** Description */
  description?: string;
  /** URL to open when shortcut is activated */
  url: string;
  /** Icons for the shortcut */
  icons?: ManifestIcon[];
}

export const ManifestShortcutSchema = z.object({
  name: z.string().min(1),
  short_name: z.string().optional(),
  description: z.string().optional(),
  url: z.string().min(1),
  icons: z.array(ManifestIconSchema).optional(),
});

// =============================================================================
// Main Manifest Configuration
// =============================================================================

/**
 * Display mode for the web app
 */
export type ManifestDisplay = "fullscreen" | "standalone" | "minimal-ui" | "browser";

/**
 * Orientation preference for the web app
 */
export type ManifestOrientation =
  | "any"
  | "natural"
  | "landscape"
  | "landscape-primary"
  | "landscape-secondary"
  | "portrait"
  | "portrait-primary"
  | "portrait-secondary";

/**
 * Text direction
 */
export type ManifestDir = "auto" | "ltr" | "rtl";

/**
 * Configuration options for web manifest generation
 */
export interface ManifestConfig {
  /** Full name of the application */
  name: string;
  /** Short name for limited space (e.g., home screen) */
  short_name?: string;
  /** Description of the application */
  description?: string;
  /** Start URL for the application */
  start_url?: string;
  /** Display mode */
  display?: ManifestDisplay;
  /** Display override (experimental) */
  display_override?: ManifestDisplay[];
  /** Preferred orientation */
  orientation?: ManifestOrientation;
  /** Theme color (affects browser UI) */
  theme_color?: string;
  /** Background color (splash screen) */
  background_color?: string;
  /** Scope of the PWA */
  scope?: string;
  /** Primary language */
  lang?: string;
  /** Text direction */
  dir?: ManifestDir;
  /** Icons for the application */
  icons?: ManifestIcon[];
  /** Screenshots for app stores */
  screenshots?: ManifestScreenshot[];
  /** App shortcuts */
  shortcuts?: ManifestShortcut[];
  /** Categories for app stores */
  categories?: string[];
  /** Unique identifier */
  id?: string;
  /** Allow arbitrary additional fields */
  [key: string]: unknown;
}

/**
 * Manifest configuration Zod schema
 */
export const ManifestConfigSchema = z
  .object({
    name: z.string().min(1, "Manifest name is required"),
    short_name: z.string().optional(),
    description: z.string().optional(),
    start_url: z.string().default("/"),
    display: z
      .enum(["fullscreen", "standalone", "minimal-ui", "browser"])
      .default("standalone"),
    display_override: z
      .array(z.enum(["fullscreen", "standalone", "minimal-ui", "browser"]))
      .optional(),
    orientation: z
      .enum([
        "any",
        "natural",
        "landscape",
        "landscape-primary",
        "landscape-secondary",
        "portrait",
        "portrait-primary",
        "portrait-secondary",
      ])
      .optional(),
    theme_color: z.string().optional(),
    background_color: z.string().optional(),
    scope: z.string().optional(),
    lang: z.string().optional(),
    dir: z.enum(["auto", "ltr", "rtl"]).optional(),
    icons: z.array(ManifestIconSchema).optional(),
    screenshots: z.array(ManifestScreenshotSchema).optional(),
    shortcuts: z.array(ManifestShortcutSchema).optional(),
    categories: z.array(z.string()).optional(),
    id: z.string().optional(),
  })
  .passthrough(); // Allow additional fields

/**
 * Input type for manifest configuration
 */
export type ManifestConfigInput = z.input<typeof ManifestConfigSchema>;

// =============================================================================
// Output Types
// =============================================================================

/**
 * Generated web app manifest
 */
export interface WebAppManifest {
  name: string;
  short_name?: string;
  description?: string;
  start_url: string;
  display: ManifestDisplay;
  display_override?: ManifestDisplay[];
  orientation?: ManifestOrientation;
  theme_color?: string;
  background_color?: string;
  scope?: string;
  lang?: string;
  dir?: ManifestDir;
  icons?: ManifestIcon[];
  screenshots?: ManifestScreenshot[];
  shortcuts?: ManifestShortcut[];
  categories?: string[];
  id?: string;
  [key: string]: unknown;
}

// =============================================================================
// Generator Function
// =============================================================================

/**
 * Options for the manifest generator
 */
export interface GenerateManifestOptions {
  /** Apply basePath to start_url and scope */
  basePath?: string;
  /** Pretty print the JSON output */
  pretty?: boolean;
}

/**
 * Error class for manifest validation errors
 */
export class ManifestValidationError extends Error {
  public readonly issues: z.ZodIssue[];

  constructor(issues: z.ZodIssue[]) {
    const message = issues
      .map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
        return `${path}${issue.message}`;
      })
      .join("\n");

    super(`Manifest configuration validation failed:\n${message}`);
    this.name = "ManifestValidationError";
    this.issues = issues;
  }
}

/**
 * Generates a web app manifest from configuration.
 *
 * @param config - The manifest configuration
 * @param options - Generation options
 * @returns The generated manifest object
 * @throws {ManifestValidationError} If validation fails
 *
 * @example
 * ```ts
 * import { generateManifest } from 'next-pwa-turbo/manifest';
 *
 * const manifest = generateManifest({
 *   name: 'My App',
 *   short_name: 'MyApp',
 *   theme_color: '#000000',
 *   background_color: '#ffffff',
 *   icons: [
 *     { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
 *     { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
 *   ],
 * });
 * ```
 */
export function generateManifest(
  config: ManifestConfigInput,
  options: GenerateManifestOptions = {}
): WebAppManifest {
  const { basePath } = options;

  // Validate configuration
  const result = ManifestConfigSchema.safeParse(config);
  if (!result.success) {
    throw new ManifestValidationError(result.error.issues);
  }

  const validated = result.data;

  // Build the manifest object
  const manifest: WebAppManifest = {
    name: validated.name,
    start_url: validated.start_url ?? "/",
    display: validated.display ?? "standalone",
  };

  // Add optional string fields
  if (validated.short_name) manifest.short_name = validated.short_name;
  if (validated.description) manifest.description = validated.description;
  if (validated.theme_color) manifest.theme_color = validated.theme_color;
  if (validated.background_color) manifest.background_color = validated.background_color;
  if (validated.scope) manifest.scope = validated.scope;
  if (validated.lang) manifest.lang = validated.lang;
  if (validated.dir) manifest.dir = validated.dir;
  if (validated.orientation) manifest.orientation = validated.orientation;
  if (validated.id) manifest.id = validated.id;

  // Add optional array fields
  if (validated.display_override) manifest.display_override = validated.display_override;
  if (validated.icons) manifest.icons = validated.icons as ManifestIcon[];
  if (validated.screenshots) manifest.screenshots = validated.screenshots as ManifestScreenshot[];
  if (validated.shortcuts) manifest.shortcuts = validated.shortcuts as ManifestShortcut[];
  if (validated.categories) manifest.categories = validated.categories;

  // Apply basePath to start_url and scope if provided
  if (basePath) {
    // Ensure basePath starts with / and doesn't end with /
    const normalizedBase = basePath.startsWith("/") ? basePath : `/${basePath}`;
    const cleanBase = normalizedBase.endsWith("/")
      ? normalizedBase.slice(0, -1)
      : normalizedBase;

    // Apply to start_url
    if (manifest.start_url && !manifest.start_url.startsWith("http")) {
      manifest.start_url = `${cleanBase}${manifest.start_url}`;
    }

    // Apply to scope if not already absolute
    if (manifest.scope && !manifest.scope.startsWith("http")) {
      manifest.scope = `${cleanBase}${manifest.scope}`;
    } else if (!manifest.scope) {
      // Set default scope to basePath
      manifest.scope = `${cleanBase}/`;
    }
  }

  // Copy any additional passthrough fields
  for (const [key, value] of Object.entries(validated)) {
    if (!(key in manifest) && value !== undefined) {
      manifest[key] = value;
    }
  }

  return manifest;
}

/**
 * Generates a web app manifest and returns it as a JSON string.
 *
 * @param config - The manifest configuration
 * @param options - Generation options
 * @returns The generated manifest as a JSON string
 *
 * @example
 * ```ts
 * import { generateManifestJson } from 'next-pwa-turbo/manifest';
 *
 * const json = generateManifestJson({
 *   name: 'My App',
 *   short_name: 'MyApp',
 * }, { pretty: true });
 *
 * fs.writeFileSync('public/manifest.json', json);
 * ```
 */
export function generateManifestJson(
  config: ManifestConfigInput,
  options: GenerateManifestOptions = {}
): string {
  const manifest = generateManifest(config, options);
  return options.pretty ? JSON.stringify(manifest, null, 2) : JSON.stringify(manifest);
}

/**
 * Validates manifest configuration without generating.
 *
 * @param config - The configuration to validate
 * @returns Validation result with data or error
 */
export function validateManifestConfig(config: unknown) {
  return ManifestConfigSchema.safeParse(config);
}
