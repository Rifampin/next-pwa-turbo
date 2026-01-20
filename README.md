# next-pwa-turbo

Turbopack-native PWA library for Next.js 16+. Built on Workbox with a security-first design.

## Features

- **Next.js 16+ Native** - Uses the Build Adapter API (no webpack/turbopack plugins)
- **Zod-Validated Config** - Catch configuration errors at build time
- **Security-First** - Path traversal protection, sanitized service worker injection
- **13 Default Caching Strategies** - Google Fonts, CDN assets, images, API routes, and more
- **React Hooks** - `usePWA`, `useServiceWorker`, `useOnlineStatus`, `useInstallPrompt`
- **Offline Support** - Fallback pages for documents, images, fonts, audio, video
- **TypeScript** - Full type definitions included

## Installation

```bash
npm install next-pwa-turbo
# or
pnpm add next-pwa-turbo
```

**Peer Dependencies**: Next.js 16+ and React 18+/19+

## Quick Start

### 1. Configure Next.js

```ts
// next.config.ts
import { withPWA } from 'next-pwa-turbo';

export default withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
})({
  // Your Next.js config here
});
```

### 2. Add manifest.json

```json
// public/manifest.json
{
  "name": "My PWA App",
  "short_name": "PWA App",
  "description": "A progressive web application",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### 3. Build

```bash
npm run build
```

The service worker (`sw.js`) is generated in `/public` and precaches your build assets.

## Configuration

```ts
withPWA({
  // Core
  dest: 'public',           // Output directory for sw.js
  sw: 'sw.js',              // Service worker filename
  scope: '/',               // Service worker scope
  disable: false,           // Disable PWA generation
  register: true,           // Auto-register service worker

  // Caching
  skipWaiting: true,        // Activate new SW immediately
  clientsClaim: true,       // Take control of all pages
  cleanupOutdatedCaches: true,
  navigationPreload: true,

  // Precaching
  publicExcludes: [],       // Glob patterns to exclude from public/
  buildExcludes: [],        // Patterns to exclude from build output

  // Offline
  fallbacks: {
    document: '/_offline',  // Fallback page when offline
    image: '/fallback.png',
    font: '/fallback.woff2',
  },

  // Runtime Caching (optional - defaults provided)
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.example\.com\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
      },
    },
  ],
})
```

## React Hooks

Import from `next-pwa-turbo/react`:

### usePWA

Combined hook for common PWA functionality:

```tsx
import { usePWA } from 'next-pwa-turbo/react';

function PWAStatus() {
  const [state, actions] = usePWA();

  return (
    <div>
      <p>Online: {state.isOnline ? 'Yes' : 'No'}</p>
      <p>Installed: {state.isInstalled ? 'Yes' : 'No'}</p>

      {state.isInstallable && (
        <button onClick={actions.install}>Install App</button>
      )}

      {state.isUpdateAvailable && (
        <button onClick={() => {
          actions.skipWaiting();
          window.location.reload();
        }}>
          Update Available
        </button>
      )}
    </div>
  );
}
```

### useServiceWorker

Manage service worker lifecycle:

```tsx
import { useServiceWorker } from 'next-pwa-turbo/react';

function UpdatePrompt() {
  const [state, actions] = useServiceWorker();

  if (state.waiting) {
    return (
      <button onClick={actions.skipWaiting}>
        New version available - Update
      </button>
    );
  }
  return null;
}
```

### useOnlineStatus

Track online/offline state:

```tsx
import { useOnlineStatus } from 'next-pwa-turbo/react';

function OnlineIndicator() {
  const { isOnline, wasOffline } = useOnlineStatus();

  if (!isOnline) return <div>You are offline</div>;
  if (wasOffline) return <div>Connection restored!</div>;
  return null;
}
```

### useInstallPrompt

Handle PWA installation:

```tsx
import { useInstallPrompt } from 'next-pwa-turbo/react';

function InstallButton() {
  const [state, actions] = useInstallPrompt();

  if (state.isInstalled) return <span>App installed</span>;
  if (!state.isInstallable) return null;

  return <button onClick={actions.install}>Install App</button>;
}
```

### UpdatePrompt Component

Pre-built (unstyled) component for update notifications:

```tsx
import { UpdatePrompt } from 'next-pwa-turbo/react';

function App() {
  return (
    <UpdatePrompt
      message="New version available!"
      updateText="Update now"
      dismissText="Later"
      className="my-update-prompt"
    />
  );
}
```

## Default Caching Strategies

13 strategies are included by default:

| Resource | Strategy | Cache Name |
|----------|----------|------------|
| Google Fonts CSS | StaleWhileRevalidate | google-fonts-stylesheets |
| Google Fonts files | CacheFirst (1 year) | google-fonts-webfonts |
| CDN static assets | CacheFirst | static-cdn-assets |
| Images | CacheFirst (60 entries) | images |
| Audio | CacheFirst (32 entries) | audio |
| Video | CacheFirst (32 entries) | video |
| Same-origin JS | StaleWhileRevalidate | same-origin-js |
| Same-origin CSS | StaleWhileRevalidate | same-origin-css |
| API routes | NetworkFirst (10s timeout) | api-cache |
| Same-origin GET | NetworkFirst | same-origin |
| Cross-origin GET | NetworkFirst | cross-origin |
| Static files | CacheFirst (200 entries) | static-resources |
| Catch-all | NetworkFirst | others |

Override with your own `runtimeCaching` configuration.

## TypeScript

Full type definitions are included:

```ts
import type {
  PWAConfig,
  PWAConfigInput,
  RuntimeCachingRule,
  CacheStrategy,
  Fallbacks,
} from 'next-pwa-turbo';
```

## Migration from next-pwa

1. Replace `next-pwa` with `next-pwa-turbo`
2. Update config syntax:
   ```ts
   // Before (next-pwa)
   const withPWA = require('next-pwa')({ dest: 'public' });
   module.exports = withPWA({ /* config */ });

   // After (next-pwa-turbo)
   import { withPWA } from 'next-pwa-turbo';
   export default withPWA({ dest: 'public' })({ /* config */ });
   ```
3. Configuration options are mostly compatible
4. React hooks are now included (no separate package needed)

## Requirements

- Node.js 20+
- Next.js 16+
- React 18+ or 19+

## License

MIT
