/**
 * Push Notifications React Hook
 *
 * Provides a hook for managing push notification subscriptions.
 *
 * @module next-pwa-turbo/react
 */

import { useState, useEffect, useCallback, useMemo } from "react";

// =============================================================================
// Type Definitions
// =============================================================================

/**
 * Options for push notification subscription
 */
export interface PushNotificationOptions {
  /** VAPID public key for push notifications (required for subscription) */
  vapidPublicKey?: string;
  /** User-visible text for the notification permission request */
  userVisibleOnly?: boolean;
}

/**
 * Push notification permission state
 */
export type PushPermission = "default" | "granted" | "denied";

/**
 * Push notification state
 */
export interface PushNotificationState {
  /** Whether push notifications are supported in this browser */
  isSupported: boolean;
  /** Whether the user is currently subscribed to push notifications */
  isSubscribed: boolean;
  /** Current notification permission state */
  permission: PushPermission;
  /** The current push subscription (if any) */
  subscription: PushSubscription | null;
  /** Any error that occurred */
  error: Error | null;
  /** Whether an operation is in progress */
  isLoading: boolean;
}

/**
 * Push notification actions
 */
export interface PushNotificationActions {
  /** Subscribe to push notifications */
  subscribe: () => Promise<PushSubscription | null>;
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<boolean>;
  /** Request notification permission */
  requestPermission: () => Promise<PushPermission>;
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
 * Check if push notifications are supported
 */
function isPushSupported(): boolean {
  return (
    isClient() &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Convert a URL-safe base64 string to a Uint8Array
 * Used for converting VAPID public keys
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Get the current notification permission
 */
function getNotificationPermission(): PushPermission {
  if (!isClient() || !("Notification" in window)) {
    return "default";
  }
  return Notification.permission as PushPermission;
}

// =============================================================================
// usePushNotifications Hook
// =============================================================================

/**
 * Hook for managing push notification subscriptions.
 *
 * Provides state and methods for subscribing to and unsubscribing from
 * push notifications through the service worker.
 *
 * @param options - Configuration options including VAPID public key
 * @returns Tuple of [state, actions]
 *
 * @example
 * ```tsx
 * import { usePushNotifications } from 'next-pwa-turbo/react';
 *
 * function PushNotificationButton() {
 *   const [state, actions] = usePushNotifications({
 *     vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
 *   });
 *
 *   if (!state.isSupported) {
 *     return <p>Push notifications not supported</p>;
 *   }
 *
 *   if (state.permission === 'denied') {
 *     return <p>Notifications blocked. Please enable in browser settings.</p>;
 *   }
 *
 *   if (state.isSubscribed) {
 *     return (
 *       <button onClick={actions.unsubscribe}>
 *         Disable Notifications
 *       </button>
 *     );
 *   }
 *
 *   return (
 *     <button onClick={actions.subscribe} disabled={state.isLoading}>
 *       {state.isLoading ? 'Subscribing...' : 'Enable Notifications'}
 *     </button>
 *   );
 * }
 * ```
 */
export function usePushNotifications(
  options: PushNotificationOptions = {}
): [PushNotificationState, PushNotificationActions] {
  const { vapidPublicKey, userVisibleOnly = true } = options;

  const [state, setState] = useState<PushNotificationState>(() => ({
    isSupported: isPushSupported(),
    isSubscribed: false,
    permission: getNotificationPermission(),
    subscription: null,
    error: null,
    isLoading: false,
  }));

  // Check for existing subscription on mount
  useEffect(() => {
    if (!isPushSupported()) {
      return;
    }

    let mounted = true;

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (!mounted) return;

        setState((prev) => ({
          ...prev,
          isSubscribed: subscription !== null,
          subscription,
          permission: getNotificationPermission(),
        }));
      } catch (error) {
        if (!mounted) return;
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error : new Error(String(error)),
        }));
      }
    };

    checkSubscription();

    return () => {
      mounted = false;
    };
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<PushPermission> => {
    if (!isClient() || !("Notification" in window)) {
      return "default";
    }

    try {
      const permission = await Notification.requestPermission();
      const normalizedPermission = permission as PushPermission;

      setState((prev) => ({
        ...prev,
        permission: normalizedPermission,
      }));

      return normalizedPermission;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
      return "default";
    }
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<PushSubscription | null> => {
    if (!isPushSupported()) {
      setState((prev) => ({
        ...prev,
        error: new Error("Push notifications not supported"),
      }));
      return null;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request permission if not already granted
      let permission = Notification.permission as PushPermission;
      if (permission === "default") {
        permission = await requestPermission();
      }

      if (permission !== "granted") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: new Error("Notification permission denied"),
        }));
        return null;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Build subscription options
      const subscriptionOptions: PushSubscriptionOptionsInit = {
        userVisibleOnly,
      };

      // Add VAPID key if provided
      if (vapidPublicKey) {
        const keyArray = urlBase64ToUint8Array(vapidPublicKey);
        // The buffer is always an ArrayBuffer from our conversion, but TypeScript can't infer this
        subscriptionOptions.applicationServerKey = keyArray.buffer as ArrayBuffer;
      }

      // Subscribe
      const subscription = await registration.pushManager.subscribe(subscriptionOptions);

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        subscription,
        isLoading: false,
      }));

      return subscription;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
      return null;
    }
  }, [vapidPublicKey, userVisibleOnly, requestPermission]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!state.subscription) {
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const success = await state.subscription.unsubscribe();

      setState((prev) => ({
        ...prev,
        isSubscribed: false,
        subscription: null,
        isLoading: false,
      }));

      return success;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
      return false;
    }
  }, [state.subscription]);

  const actions: PushNotificationActions = useMemo(
    () => ({
      subscribe,
      unsubscribe,
      requestPermission,
    }),
    [subscribe, unsubscribe, requestPermission]
  );

  return [state, actions];
}
