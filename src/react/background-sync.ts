/**
 * Background Sync React Hook
 *
 * Provides a hook for registering background sync tasks.
 *
 * @module next-pwa-turbo/react
 */

import { useState, useEffect, useCallback, useMemo } from "react";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Background sync registration info
 */
export interface SyncRegistration {
  /** The sync tag name */
  tag: string;
}

/**
 * Background sync state
 */
export interface BackgroundSyncState {
  /** Whether background sync is supported in this browser */
  isSupported: boolean;
  /** List of pending sync tags */
  pendingSyncs: string[];
  /** Any error that occurred */
  error: Error | null;
  /** Whether an operation is in progress */
  isLoading: boolean;
}

/**
 * Background sync actions
 */
export interface BackgroundSyncActions {
  /** Register a background sync with the given tag */
  registerSync: (tag: string) => Promise<boolean>;
  /** Get all registered sync tags */
  getSyncs: () => Promise<string[]>;
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
 * Check if background sync is supported
 */
function isSyncSupported(): boolean {
  return isClient() && "serviceWorker" in navigator && "SyncManager" in window;
}

// =============================================================================
// useBackgroundSync Hook
// =============================================================================

/**
 * Hook for managing background sync registrations.
 *
 * Background sync allows you to defer actions until the user has stable
 * connectivity. This is useful for ensuring that requests are sent even
 * if the user goes offline temporarily.
 *
 * @returns Tuple of [state, actions]
 *
 * @example
 * ```tsx
 * import { useBackgroundSync } from 'next-pwa-turbo/react';
 *
 * function SyncButton() {
 *   const [state, actions] = useBackgroundSync();
 *
 *   if (!state.isSupported) {
 *     return <p>Background sync not supported</p>;
 *   }
 *
 *   const handleSync = async () => {
 *     const success = await actions.registerSync('submit-form');
 *     if (success) {
 *       console.log('Background sync registered!');
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleSync} disabled={state.isLoading}>
 *         {state.isLoading ? 'Registering...' : 'Queue Offline Action'}
 *       </button>
 *       {state.pendingSyncs.length > 0 && (
 *         <p>Pending syncs: {state.pendingSyncs.join(', ')}</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useBackgroundSync(): [BackgroundSyncState, BackgroundSyncActions] {
  const [state, setState] = useState<BackgroundSyncState>(() => ({
    isSupported: isSyncSupported(),
    pendingSyncs: [],
    error: null,
    isLoading: false,
  }));

  // Get current sync tags on mount
  useEffect(() => {
    if (!isSyncSupported()) {
      return;
    }

    let mounted = true;

    const fetchSyncs = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;

        // TypeScript doesn't have SyncManager types by default
        const syncManager = (registration as ServiceWorkerRegistration & { sync?: SyncManager }).sync;
        if (!syncManager) {
          return;
        }

        const tags = await syncManager.getTags();

        if (!mounted) return;

        setState((prev) => ({
          ...prev,
          pendingSyncs: tags,
        }));
      } catch (error) {
        if (!mounted) return;
        // Silently fail if we can't get tags - sync may still work
      }
    };

    fetchSyncs();

    return () => {
      mounted = false;
    };
  }, []);

  // Register a background sync
  const registerSync = useCallback(async (tag: string): Promise<boolean> => {
    if (!isSyncSupported()) {
      setState((prev) => ({
        ...prev,
        error: new Error("Background sync not supported"),
      }));
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const registration = await navigator.serviceWorker.ready;

      // TypeScript doesn't have SyncManager types by default
      const syncManager = (registration as ServiceWorkerRegistration & { sync?: SyncManager }).sync;
      if (!syncManager) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: new Error("SyncManager not available"),
        }));
        return false;
      }

      await syncManager.register(tag);

      // Update pending syncs list
      const tags = await syncManager.getTags();

      setState((prev) => ({
        ...prev,
        pendingSyncs: tags,
        isLoading: false,
      }));

      return true;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
      return false;
    }
  }, []);

  // Get all registered sync tags
  const getSyncs = useCallback(async (): Promise<string[]> => {
    if (!isSyncSupported()) {
      return [];
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      const syncManager = (registration as ServiceWorkerRegistration & { sync?: SyncManager }).sync;
      if (!syncManager) {
        return [];
      }

      const tags = await syncManager.getTags();

      setState((prev) => ({
        ...prev,
        pendingSyncs: tags,
      }));

      return tags;
    } catch {
      return [];
    }
  }, []);

  const actions: BackgroundSyncActions = useMemo(
    () => ({
      registerSync,
      getSyncs,
    }),
    [registerSync, getSyncs]
  );

  return [state, actions];
}

// =============================================================================
// SyncManager Type Declaration
// =============================================================================

/**
 * SyncManager interface (not included in standard TypeScript lib)
 */
interface SyncManager {
  register(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}
