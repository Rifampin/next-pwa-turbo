/**
 * Tests for Push Notifications React Hook
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePushNotifications } from "./push-notifications.js";

// =============================================================================
// Mock Setup
// =============================================================================

// Mock PushSubscription
const createMockPushSubscription = (): PushSubscription => ({
  endpoint: "https://push.example.com/subscription/123",
  expirationTime: null,
  options: {
    userVisibleOnly: true,
    applicationServerKey: new ArrayBuffer(65),
  },
  getKey: vi.fn((name: string) => {
    if (name === "p256dh" || name === "auth") {
      return new ArrayBuffer(16);
    }
    return null;
  }),
  toJSON: vi.fn(() => ({
    endpoint: "https://push.example.com/subscription/123",
    keys: { p256dh: "test-p256dh", auth: "test-auth" },
  })),
  unsubscribe: vi.fn().mockResolvedValue(true),
});

// Mock PushManager
const createMockPushManager = (existingSubscription: PushSubscription | null = null) => ({
  getSubscription: vi.fn().mockResolvedValue(existingSubscription),
  subscribe: vi.fn().mockResolvedValue(createMockPushSubscription()),
  permissionState: vi.fn().mockResolvedValue("granted"),
});

// Mock ServiceWorkerRegistration
const createMockRegistration = (pushManager: ReturnType<typeof createMockPushManager>) => ({
  scope: "/",
  installing: null,
  waiting: null,
  active: { state: "activated" } as ServiceWorker,
  pushManager,
  navigationPreload: {} as NavigationPreloadManager,
  updateViaCache: "imports" as ServiceWorkerUpdateViaCache,
  onupdatefound: null,
  getNotifications: vi.fn().mockResolvedValue([]),
  showNotification: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue(undefined),
  unregister: vi.fn().mockResolvedValue(true),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(() => true),
});

// =============================================================================
// usePushNotifications Tests
// =============================================================================

describe("usePushNotifications", () => {
  let mockPushManager: ReturnType<typeof createMockPushManager>;
  let mockRegistration: ReturnType<typeof createMockRegistration>;
  let notificationPermission: NotificationPermission;

  beforeEach(() => {
    notificationPermission = "default";
    mockPushManager = createMockPushManager();
    mockRegistration = createMockRegistration(mockPushManager);

    // Mock navigator.serviceWorker
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve(mockRegistration),
        register: vi.fn().mockResolvedValue(mockRegistration),
        controller: mockRegistration.active,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    // Mock Notification
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        permission: notificationPermission,
        requestPermission: vi.fn().mockResolvedValue("granted"),
      },
    });

    // Override permission getter
    Object.defineProperty(Notification, "permission", {
      configurable: true,
      get: () => notificationPermission,
    });

    // Mock PushManager on window
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: class MockPushManager {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("should return initial state with isSupported true", () => {
      const { result } = renderHook(() => usePushNotifications());

      expect(result.current[0].isSupported).toBe(true);
      expect(result.current[0].isSubscribed).toBe(false);
      expect(result.current[0].permission).toBe("default");
      expect(result.current[0].subscription).toBeNull();
      expect(result.current[0].error).toBeNull();
      expect(result.current[0].isLoading).toBe(false);
    });

    it("should check for existing subscription on mount", async () => {
      const existingSubscription = createMockPushSubscription();
      mockPushManager = createMockPushManager(existingSubscription);
      mockRegistration = createMockRegistration(mockPushManager);

      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          ready: Promise.resolve(mockRegistration),
          register: vi.fn().mockResolvedValue(mockRegistration),
          controller: mockRegistration.active,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
      });

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current[0].isSubscribed).toBe(true);
      });

      expect(result.current[0].subscription).not.toBeNull();
    });

    it("should return isSupported false when PushManager not available", () => {
      // Remove PushManager before rendering
      const originalPushManager = window.PushManager;
      // @ts-expect-error - testing undefined PushManager
      delete window.PushManager;

      const { result } = renderHook(() => usePushNotifications());

      expect(result.current[0].isSupported).toBe(false);

      // Restore
      Object.defineProperty(window, "PushManager", {
        configurable: true,
        value: originalPushManager,
      });
    });
  });

  describe("requestPermission", () => {
    it("should request notification permission and return granted result", async () => {
      const { result } = renderHook(() => usePushNotifications());

      // Mock requestPermission to return "granted"
      (Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue("granted");

      let permission: NotificationPermission | null = null;
      await act(async () => {
        permission = await result.current[1].requestPermission();
      });

      expect(permission).toBe("granted");
      expect(Notification.requestPermission).toHaveBeenCalled();
    });

    it("should request notification permission and return denied result", async () => {
      const { result } = renderHook(() => usePushNotifications());

      // Mock requestPermission to return "denied"
      (Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue("denied");

      let permission: NotificationPermission | null = null;
      await act(async () => {
        permission = await result.current[1].requestPermission();
      });

      expect(permission).toBe("denied");
      expect(Notification.requestPermission).toHaveBeenCalled();
    });
  });

  describe("subscribe", () => {
    it("should subscribe to push notifications", async () => {
      notificationPermission = "granted";

      const { result } = renderHook(() =>
        usePushNotifications({ vapidPublicKey: "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U" })
      );

      let subscription: PushSubscription | null = null;
      await act(async () => {
        subscription = await result.current[1].subscribe();
      });

      expect(subscription).not.toBeNull();
      expect(result.current[0].isSubscribed).toBe(true);
      expect(result.current[0].subscription).not.toBeNull();
      expect(mockPushManager.subscribe).toHaveBeenCalled();
    });

    it("should set loading state during subscription", async () => {
      notificationPermission = "granted";

      const { result } = renderHook(() => usePushNotifications());

      expect(result.current[0].isLoading).toBe(false);

      // Start subscribe but don't await immediately
      let subscribePromise: Promise<PushSubscription | null>;
      act(() => {
        subscribePromise = result.current[1].subscribe();
      });

      // isLoading should be true during the operation
      expect(result.current[0].isLoading).toBe(true);

      await act(async () => {
        await subscribePromise;
      });

      expect(result.current[0].isLoading).toBe(false);
    });

    it("should request permission if default", async () => {
      notificationPermission = "default";
      (Notification.requestPermission as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        notificationPermission = "granted";
        return "granted";
      });

      const { result } = renderHook(() => usePushNotifications());

      await act(async () => {
        await result.current[1].subscribe();
      });

      expect(Notification.requestPermission).toHaveBeenCalled();
      expect(result.current[0].isSubscribed).toBe(true);
    });

    it("should fail when permission is denied", async () => {
      notificationPermission = "default";
      (Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue("denied");

      const { result } = renderHook(() => usePushNotifications());

      let subscription: PushSubscription | null = null;
      await act(async () => {
        subscription = await result.current[1].subscribe();
      });

      expect(subscription).toBeNull();
      expect(result.current[0].isSubscribed).toBe(false);
      expect(result.current[0].error).not.toBeNull();
      expect(result.current[0].error?.message).toBe("Notification permission denied");
    });

    it("should handle subscription error", async () => {
      notificationPermission = "granted";
      mockPushManager.subscribe.mockRejectedValue(new Error("Subscription failed"));

      const { result } = renderHook(() => usePushNotifications());

      await act(async () => {
        await result.current[1].subscribe();
      });

      expect(result.current[0].error).not.toBeNull();
      expect(result.current[0].error?.message).toBe("Subscription failed");
      expect(result.current[0].isSubscribed).toBe(false);
      expect(result.current[0].isLoading).toBe(false);
    });

    it("should fail when push not supported", async () => {
      // Remove PushManager before rendering
      const originalPushManager = window.PushManager;
      // @ts-expect-error - testing undefined PushManager
      delete window.PushManager;

      const { result } = renderHook(() => usePushNotifications());

      await act(async () => {
        await result.current[1].subscribe();
      });

      expect(result.current[0].error?.message).toBe("Push notifications not supported");

      // Restore
      Object.defineProperty(window, "PushManager", {
        configurable: true,
        value: originalPushManager,
      });
    });
  });

  describe("unsubscribe", () => {
    it("should unsubscribe from push notifications", async () => {
      // Setup with existing subscription
      const existingSubscription = createMockPushSubscription();
      mockPushManager = createMockPushManager(existingSubscription);
      mockRegistration = createMockRegistration(mockPushManager);

      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          ready: Promise.resolve(mockRegistration),
          register: vi.fn().mockResolvedValue(mockRegistration),
          controller: mockRegistration.active,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
      });

      const { result } = renderHook(() => usePushNotifications());

      // Wait for existing subscription to be detected
      await waitFor(() => {
        expect(result.current[0].isSubscribed).toBe(true);
      });

      let success = false;
      await act(async () => {
        success = await result.current[1].unsubscribe();
      });

      expect(success).toBe(true);
      expect(result.current[0].isSubscribed).toBe(false);
      expect(result.current[0].subscription).toBeNull();
      expect(existingSubscription.unsubscribe).toHaveBeenCalled();
    });

    it("should return false when no subscription exists", async () => {
      const { result } = renderHook(() => usePushNotifications());

      let success = true;
      await act(async () => {
        success = await result.current[1].unsubscribe();
      });

      expect(success).toBe(false);
    });

    it("should handle unsubscribe error", async () => {
      const existingSubscription = createMockPushSubscription();
      existingSubscription.unsubscribe = vi.fn().mockRejectedValue(new Error("Unsubscribe failed"));
      mockPushManager = createMockPushManager(existingSubscription);
      mockRegistration = createMockRegistration(mockPushManager);

      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          ready: Promise.resolve(mockRegistration),
          register: vi.fn().mockResolvedValue(mockRegistration),
          controller: mockRegistration.active,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
      });

      const { result } = renderHook(() => usePushNotifications());

      await waitFor(() => {
        expect(result.current[0].isSubscribed).toBe(true);
      });

      let success = true;
      await act(async () => {
        success = await result.current[1].unsubscribe();
      });

      expect(success).toBe(false);
      expect(result.current[0].error?.message).toBe("Unsubscribe failed");
    });
  });

  describe("VAPID key handling", () => {
    it("should pass VAPID key to subscribe options", async () => {
      notificationPermission = "granted";
      const vapidKey = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

      const { result } = renderHook(() =>
        usePushNotifications({ vapidPublicKey: vapidKey })
      );

      await act(async () => {
        await result.current[1].subscribe();
      });

      expect(mockPushManager.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({
          userVisibleOnly: true,
          applicationServerKey: expect.any(ArrayBuffer),
        })
      );
    });

    it("should work without VAPID key", async () => {
      notificationPermission = "granted";

      const { result } = renderHook(() => usePushNotifications());

      await act(async () => {
        await result.current[1].subscribe();
      });

      expect(mockPushManager.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({
          userVisibleOnly: true,
        })
      );

      // Should not have applicationServerKey
      const callArgs = mockPushManager.subscribe.mock.calls[0][0];
      expect(callArgs.applicationServerKey).toBeUndefined();
    });
  });

  describe("userVisibleOnly option", () => {
    it("should default userVisibleOnly to true", async () => {
      notificationPermission = "granted";

      const { result } = renderHook(() => usePushNotifications());

      await act(async () => {
        await result.current[1].subscribe();
      });

      expect(mockPushManager.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({
          userVisibleOnly: true,
        })
      );
    });

    it("should respect custom userVisibleOnly value", async () => {
      notificationPermission = "granted";

      const { result } = renderHook(() =>
        usePushNotifications({ userVisibleOnly: false })
      );

      await act(async () => {
        await result.current[1].subscribe();
      });

      expect(mockPushManager.subscribe).toHaveBeenCalledWith(
        expect.objectContaining({
          userVisibleOnly: false,
        })
      );
    });
  });
});

// =============================================================================
// SSR Safety Tests
// =============================================================================

describe("usePushNotifications SSR Safety", () => {
  it("should have safe initial state structure", () => {
    // Mock as if push is supported
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: class MockPushManager {},
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: {
        permission: "default",
        requestPermission: vi.fn(),
      },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({}),
      },
    });

    const { result } = renderHook(() => usePushNotifications());

    expect(result.current[0]).toHaveProperty("isSupported");
    expect(result.current[0]).toHaveProperty("isSubscribed");
    expect(result.current[0]).toHaveProperty("permission");
    expect(result.current[0]).toHaveProperty("subscription");
    expect(result.current[0]).toHaveProperty("error");
    expect(result.current[0]).toHaveProperty("isLoading");

    expect(result.current[1]).toHaveProperty("subscribe");
    expect(result.current[1]).toHaveProperty("unsubscribe");
    expect(result.current[1]).toHaveProperty("requestPermission");
  });
});
