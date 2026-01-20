# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-19

### Added

- Initial release of next-pwa-turbo
- **Core**
  - `withPWA()` configuration wrapper for Next.js 16+
  - Zod-validated configuration with 30+ options
  - Next.js Build Adapter integration (Turbopack-native)
  - esbuild-based service worker compilation
- **Caching**
  - 13 default runtime caching strategies
  - Google Fonts, CDN assets, images, audio, video caching
  - API route caching with network timeout
  - Custom `runtimeCaching` configuration support
- **Offline Support**
  - Document fallback pages
  - Asset fallbacks (image, font, audio, video)
  - `setCatchHandler` integration
- **React Hooks** (`next-pwa-turbo/react`)
  - `usePWA()` - combined PWA state and actions
  - `useServiceWorker()` - service worker lifecycle management
  - `useOnlineStatus()` - online/offline state tracking
  - `useInstallPrompt()` - PWA installation flow
  - `useRegisterSW()` - manual service worker registration
  - `UpdatePrompt` component
- **Security**
  - Path traversal protection in configuration
  - Sanitized service worker injection
  - Scope validation
- **TypeScript**
  - Full type definitions
  - Strict mode compatible

### Notes

- Designed for Next.js 16+ with Build Adapter API
- Requires Node.js 20+
- Peer dependencies: Next.js 16+, React 18+/19+
