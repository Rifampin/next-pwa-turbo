'use client';

import { usePWA } from 'next-pwa-turbo/react';

export default function Home() {
  const [state, actions] = usePWA();

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>next-pwa-turbo Test App</h1>

      <section style={{ marginTop: '1rem' }}>
        <h2>PWA Status</h2>
        <ul>
          <li>Online: {state.isOnline ? 'Yes' : 'No'}</li>
          <li>Installed: {state.isInstalled ? 'Yes' : 'No'}</li>
          <li>Installable: {state.isInstallable ? 'Yes' : 'No'}</li>
          <li>Service Worker Ready: {state.isReady ? 'Yes' : 'No'}</li>
          <li>Update Available: {state.isUpdateAvailable ? 'Yes' : 'No'}</li>
        </ul>
      </section>

      <section style={{ marginTop: '1rem' }}>
        <h2>Actions</h2>
        {state.isInstallable && (
          <button onClick={actions.install} style={{ marginRight: '0.5rem' }}>
            Install App
          </button>
        )}
        <button onClick={actions.update}>Check for Updates</button>
        {state.isUpdateAvailable && (
          <button
            onClick={() => {
              actions.skipWaiting();
              window.location.reload();
            }}
            style={{ marginLeft: '0.5rem' }}
          >
            Update Now
          </button>
        )}
      </section>

      {state.error && (
        <section style={{ marginTop: '1rem', color: 'red' }}>
          <h2>Error</h2>
          <p>{state.error.message}</p>
        </section>
      )}
    </main>
  );
}
