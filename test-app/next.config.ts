import { withPWA } from 'next-pwa-turbo';

export default withPWA({
  dest: 'public',
  disable: false,
  sw: 'sw.js',
  scope: '/',
  skipWaiting: true,
  clientsClaim: true,
  fallbacks: {
    document: '/_offline',
  },
})({
  // Next.js config
});
