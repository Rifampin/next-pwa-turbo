/**
 * React hooks for PWA functionality
 *
 * This module provides React hooks for interacting with PWA features
 * from your Next.js application components.
 *
 * @module next-pwa-turbo/react
 */

import { useState, useEffect, useCallback, useMemo } from "react";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * BeforeInstallPromptEvent - Browser event for PWA install prompt
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

/**
 * Options for useServiceWorker hook
 */
export interface ServiceWorkerOptions {
  /** Path to the service worker file (default: '/sw.js') */
  path?: string;
  /** Scope for the service worker (default: '/') */
  scope?: string;
  /** Whether to check for updates on page reload (default: true) */
  updateOnReload?: boolean;
}

/**
 * Service worker registration state
 */
export interface ServiceWorkerState {
  /** The current service worker registration */
  registration: ServiceWorkerRegistration | null;
  /** The installing service worker (if any) */
  installing: ServiceWorker | null;
  /** The waiting service worker (if any) */
  waiting: ServiceWorker | null;
  /** The active service worker (if any) */
  active: ServiceWorker | null;
  /** Any error that occurred during registration */
  error: Error | null;
  /** Whether the service worker is ready and active */
  isReady: boolean;
}

/**
 * Service worker control actions
 */
export interface ServiceWorkerActions {
  /** Check for service worker updates */
  update: () => Promise<void>;
  /** Unregister the service worker */
  unregister: () => Promise<boolean>;
  /** Tell the waiting service worker to skip waiting and activate */
  skipWaiting: () => void;
}

/**
 * Online status state
 */
export interface OnlineStatus {
  /** Whether the browser is currently online */
  isOnline: boolean;
  /** Whether the browser was offline at any point since mount */
  wasOffline: boolean;
}

/**
 * Install prompt state
 */
export interface InstallPromptState {
  /** Whether the app can be installed (prompt available) */
  isInstallable: boolean;
  /** Whether the app is already installed (running in standalone mode) */
  isInstalled: boolean;
  /** The captured beforeinstallprompt event */
  prompt: BeforeInstallPromptEvent | null;
}

/**
 * Install prompt actions
 */
export interface InstallPromptActions {
  /** Trigger the install prompt, returns the user's choice */
  install: () => Promise<"accepted" | "dismissed" | null>;
}

/**
 * Combined PWA state
 */
export interface PWAState {
  /** Whether the app can be installed */
  isInstallable: boolean;
  /** Whether the app is already installed */
  isInstalled: boolean;
  /** Whether the browser is online */
  isOnline: boolean;
  /** Whether a service worker update is available */
  isUpdateAvailable: boolean;
  /** Whether the service worker is ready */
  isReady: boolean;
  /** Any error from service worker registration */
  error: Error | null;
}

/**
 * Combined PWA actions
 */
export interface PWAActions {
  /** Trigger the install prompt */
  install: () => Promise<"accepted" | "dismissed" | null>;
  /** Check for service worker updates */
  update: () => Promise<void>;
  /** Skip waiting and activate the new service worker */
  skipWaiting: () => void;
}

// Legacy types for backwards compatibility
export interface PWAStatus {
  isInstalled: boolean;
  isStandalone: boolean;
  isOnline: boolean;
  hasServiceWorker: boolean;
  updateAvailable: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if code is running on the client side
 */
function isClient(): boolean {
  return typeof window !== "undefined";
}

/**
 * Check if the app is running in standalone mode (installed)
 */
function isStandaloneMode(): boolean {
  if (!isClient()) return false;

  // Check display-mode media query
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }

  // Check iOS standalone mode
  if ((navigator as { standalone?: boolean }).standalone === true) {
    return true;
  }

  // Check if launched from home screen on Android
  if (window.matchMedia("(display-mode: fullscreen)").matches) {
    return true;
  }

  return false;
}

/**
 * Check if service workers are supported
 */
function isServiceWorkerSupported(): boolean {
  return isClient() && "serviceWorker" in navigator;
}

// =============================================================================
// useServiceWorker Hook
// =============================================================================

/**
 * Hook for managing service worker lifecycle.
 *
 * Provides access to the service worker registration and methods
 * for checking updates and activating new versions.
 *
 * @param options - Configuration options
 * @returns Tuple of [state, actions]
 *
 * @example
 * ```tsx
 * import { useServiceWorker } from 'next-pwa-turbo/react';
 *
 * function UpdatePrompt() {
 *   const [state, actions] = useServiceWorker();
 *
 *   if (state.waiting) {
 *     return (
 *       <div>
 *         <p>A new version is available!</p>
 *         <button onClick={actions.skipWaiting}>Update Now</button>
 *       </div>
 *     );
 *   }
 *
 *   return null;
 * }
 * ```
 */
export function useServiceWorker(
  options: ServiceWorkerOptions = {}
): [ServiceWorkerState, ServiceWorkerActions] {
  const { path = "/sw.js", scope = "/", updateOnReload = true } = options;

  const [state, setState] = useState<ServiceWorkerState>({
    registration: null,
    installing: null,
    waiting: null,
    active: null,
    error: null,
    isReady: false,
  });

  // Track state changes on a service worker
  const trackWorkerState = useCallback(
    (worker: ServiceWorker | null, type: "installing" | "waiting" | "active") => {
      if (!worker) return;

      const handleStateChange = () => {
        setState((prev) => {
          const newState = { ...prev };

          // Update based on current worker state
          if (worker.state === "installed") {
            newState.waiting = worker;
            newState.installing = null;
          } else if (worker.state === "activating" || worker.state === "activated") {
            newState.active = worker;
            newState.waiting = null;
            newState.isReady = worker.state === "activated";
          } else if (worker.state === "redundant") {
            // Worker has been replaced
            if (prev.installing === worker) newState.installing = null;
            if (prev.waiting === worker) newState.waiting = null;
            if (prev.active === worker) newState.active = null;
          }

          return newState;
        });
      };

      worker.addEventListener("statechange", handleStateChange);
      return () => worker.removeEventListener("statechange", handleStateChange);
    },
    []
  );

  // Register service worker on mount
  useEffect(() => {
    if (!isServiceWorkerSupported()) {
      return;
    }

    let mounted = true;
    const cleanupFns: Array<() => void> = [];

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register(path, {
          scope,
          updateViaCache: updateOnReload ? "none" : "imports",
        });

        if (!mounted) return;

        // Update state with registration
        setState((prev) => ({
          ...prev,
          registration,
          installing: registration.installing,
          waiting: registration.waiting,
          active: registration.active,
          isReady: registration.active?.state === "activated",
        }));

        // Track existing workers
        if (registration.installing) {
          const cleanup = trackWorkerState(registration.installing, "installing");
          if (cleanup) cleanupFns.push(cleanup);
        }
        if (registration.waiting) {
          const cleanup = trackWorkerState(registration.waiting, "waiting");
          if (cleanup) cleanupFns.push(cleanup);
        }
        if (registration.active) {
          const cleanup = trackWorkerState(registration.active, "active");
          if (cleanup) cleanupFns.push(cleanup);
        }

        // Listen for new workers (updates)
        const handleUpdateFound = () => {
          const newWorker = registration.installing;
          if (newWorker) {
            setState((prev) => ({ ...prev, installing: newWorker }));
            const cleanup = trackWorkerState(newWorker, "installing");
            if (cleanup) cleanupFns.push(cleanup);
          }
        };

        registration.addEventListener("updatefound", handleUpdateFound);
        cleanupFns.push(() =>
          registration.removeEventListener("updatefound", handleUpdateFound)
        );

        // Check for updates if updateOnReload is enabled
        if (updateOnReload) {
          registration.update().catch(() => {
            // Silently ignore update check failures
          });
        }
      } catch (error) {
        if (!mounted) return;
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error : new Error(String(error)),
        }));
      }
    };

    // Also handle controller change (when a new SW takes over)
    const handleControllerChange = () => {
      // Optionally reload the page when a new SW takes control
      // Users can handle this in their code if they want auto-reload
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange
    );
    cleanupFns.push(() =>
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange
      )
    );

    registerSW();

    return () => {
      mounted = false;
      cleanupFns.forEach((fn) => fn());
    };
  }, [path, scope, updateOnReload, trackWorkerState]);

  // Actions
  const update = useCallback(async () => {
    if (state.registration) {
      await state.registration.update();
    }
  }, [state.registration]);

  const unregister = useCallback(async () => {
    if (state.registration) {
      return state.registration.unregister();
    }
    return false;
  }, [state.registration]);

  const skipWaiting = useCallback(() => {
    if (state.waiting) {
      state.waiting.postMessage({ type: "SKIP_WAITING" });
    }
  }, [state.waiting]);

  const actions: ServiceWorkerActions = useMemo(
    () => ({
      update,
      unregister,
      skipWaiting,
    }),
    [update, unregister, skipWaiting]
  );

  return [state, actions];
}

// =============================================================================
// useOnlineStatus Hook
// =============================================================================

/**
 * Hook for tracking online/offline status.
 *
 * Monitors the browser's online/offline state and triggers
 * re-renders when the status changes.
 *
 * @returns Online status object
 *
 * @example
 * ```tsx
 * import { useOnlineStatus } from 'next-pwa-turbo/react';
 *
 * function OnlineIndicator() {
 *   const { isOnline, wasOffline } = useOnlineStatus();
 *
 *   return (
 *     <div>
 *       <span>{isOnline ? 'Online' : 'Offline'}</span>
 *       {wasOffline && isOnline && <span>Connection restored!</span>}
 *     </div>
 *   );
 * }
 * ```
 */
export function useOnlineStatus(): OnlineStatus {
  const [status, setStatus] = useState<OnlineStatus>(() => ({
    isOnline: isClient() ? navigator.onLine : true,
    wasOffline: false,
  }));

  useEffect(() => {
    if (!isClient()) return;

    const handleOnline = () => {
      setStatus((prev) => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setStatus({ isOnline: false, wasOffline: true });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Sync initial state (in case it changed before effect ran)
    setStatus((prev) => ({
      ...prev,
      isOnline: navigator.onLine,
    }));

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return status;
}

// =============================================================================
// useInstallPrompt Hook
// =============================================================================

/**
 * Hook for managing the PWA install prompt.
 *
 * Captures the `beforeinstallprompt` event and provides methods
 * to trigger the installation flow.
 *
 * @returns Tuple of [state, actions]
 *
 * @example
 * ```tsx
 * import { useInstallPrompt } from 'next-pwa-turbo/react';
 *
 * function InstallButton() {
 *   const [state, actions] = useInstallPrompt();
 *
 *   if (state.isInstalled) {
 *     return <span>App is installed!</span>;
 *   }
 *
 *   if (!state.isInstallable) {
 *     return null;
 *   }
 *
 *   return (
 *     <button onClick={actions.install}>
 *       Install App
 *     </button>
 *   );
 * }
 * ```
 */
export function useInstallPrompt(): [InstallPromptState, InstallPromptActions] {
  const [state, setState] = useState<InstallPromptState>(() => ({
    isInstallable: false,
    isInstalled: isStandaloneMode(),
    prompt: null,
  }));

  useEffect(() => {
    if (!isClient()) return;

    // Handle beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setState((prev) => ({
        ...prev,
        isInstallable: true,
        prompt: promptEvent,
      }));
    };

    // Handle successful installation
    const handleAppInstalled = () => {
      setState((prev) => ({
        ...prev,
        isInstallable: false,
        isInstalled: true,
        prompt: null,
      }));
    };

    // Listen for display-mode changes (in case user installs through browser UI)
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setState((prev) => ({
          ...prev,
          isInstalled: true,
          isInstallable: false,
          prompt: null,
        }));
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    mediaQuery.addEventListener("change", handleDisplayModeChange);

    // Check initial standalone state
    setState((prev) => ({
      ...prev,
      isInstalled: isStandaloneMode(),
    }));

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      mediaQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  const install = useCallback(async (): Promise<"accepted" | "dismissed" | null> => {
    if (!state.prompt) {
      return null;
    }

    try {
      await state.prompt.prompt();
      const { outcome } = await state.prompt.userChoice;

      // Clear the prompt after use (it can only be used once)
      setState((prev) => ({
        ...prev,
        prompt: null,
        isInstallable: false,
        isInstalled: outcome === "accepted",
      }));

      return outcome;
    } catch {
      return null;
    }
  }, [state.prompt]);

  const actions: InstallPromptActions = useMemo(
    () => ({
      install,
    }),
    [install]
  );

  return [state, actions];
}

// =============================================================================
// usePWA Hook
// =============================================================================

/**
 * Convenience hook combining service worker, online status, and install prompt.
 *
 * Provides a unified interface for common PWA functionality.
 *
 * @param options - Service worker configuration options
 * @returns Tuple of [state, actions]
 *
 * @example
 * ```tsx
 * import { usePWA } from 'next-pwa-turbo/react';
 *
 * function PWAStatus() {
 *   const [state, actions] = usePWA();
 *
 *   return (
 *     <div>
 *       <p>Online: {state.isOnline ? 'Yes' : 'No'}</p>
 *       <p>Installed: {state.isInstalled ? 'Yes' : 'No'}</p>
 *       {state.isInstallable && (
 *         <button onClick={actions.install}>Install App</button>
 *       )}
 *       {state.isUpdateAvailable && (
 *         <button onClick={() => { actions.skipWaiting(); window.location.reload(); }}>
 *           Update Available - Click to Update
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePWA(
  options?: ServiceWorkerOptions
): [PWAState, PWAActions] {
  const [swState, swActions] = useServiceWorker(options);
  const onlineStatus = useOnlineStatus();
  const [installState, installActions] = useInstallPrompt();

  const state: PWAState = useMemo(
    () => ({
      isInstallable: installState.isInstallable,
      isInstalled: installState.isInstalled,
      isOnline: onlineStatus.isOnline,
      isUpdateAvailable: swState.waiting !== null,
      isReady: swState.isReady,
      error: swState.error,
    }),
    [
      installState.isInstallable,
      installState.isInstalled,
      onlineStatus.isOnline,
      swState.waiting,
      swState.isReady,
      swState.error,
    ]
  );

  const actions: PWAActions = useMemo(
    () => ({
      install: installActions.install,
      update: swActions.update,
      skipWaiting: swActions.skipWaiting,
    }),
    [installActions.install, swActions.update, swActions.skipWaiting]
  );

  return [state, actions];
}

// =============================================================================
// useRegisterSW Hook (for manual registration)
// =============================================================================

/**
 * Hook for registering a service worker manually.
 *
 * Use this hook when you've set `register: false` in your PWA config
 * and want to control when the service worker is registered.
 *
 * @param swUrl - URL to the service worker file
 * @param options - Registration options
 * @returns Registration state and methods
 *
 * @example
 * ```tsx
 * import { useRegisterSW } from 'next-pwa-turbo/react';
 *
 * function App() {
 *   const { register, registered, error } = useRegisterSW('/sw.js');
 *
 *   useEffect(() => {
 *     // Register SW after user interaction
 *     if (userHasInteracted) {
 *       register();
 *     }
 *   }, [userHasInteracted, register]);
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useRegisterSW(
  swUrl: string = "/sw.js",
  options?: RegistrationOptions
): {
  register: () => Promise<ServiceWorkerRegistration | undefined>;
  registered: boolean;
  registration: ServiceWorkerRegistration | null;
  error: Error | null;
} {
  const [state, setState] = useState<{
    registered: boolean;
    registration: ServiceWorkerRegistration | null;
    error: Error | null;
  }>({
    registered: false,
    registration: null,
    error: null,
  });

  const register = useCallback(async () => {
    if (!isServiceWorkerSupported()) {
      return undefined;
    }

    try {
      const registration = await navigator.serviceWorker.register(swUrl, options);
      setState({
        registered: true,
        registration,
        error: null,
      });
      return registration;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      setState((prev) => ({
        ...prev,
        error: err,
      }));
      return undefined;
    }
  }, [swUrl, options]);

  return {
    register,
    registered: state.registered,
    registration: state.registration,
    error: state.error,
  };
}

// =============================================================================
// Re-export UpdatePrompt component
// =============================================================================

export { UpdatePrompt } from "./components/UpdatePrompt.js";
export type { UpdatePromptProps } from "./components/UpdatePrompt.js";
