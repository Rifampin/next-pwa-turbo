/**
 * Tests for React PWA hooks
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useOnlineStatus,
  useInstallPrompt,
  useServiceWorker,
  usePWA,
  useRegisterSW,
  type BeforeInstallPromptEvent,
} from "./index.js";

// =============================================================================
// Global Setup - Define missing browser APIs for jsdom
// =============================================================================

// Define matchMedia if it doesn't exist (jsdom doesn't include it)
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }
});

// =============================================================================
// Mock Setup
// =============================================================================

// Mock service worker registration
const createMockServiceWorker = (state: ServiceWorkerState = "activated"): ServiceWorker => ({
  state,
  scriptURL: "/sw.js",
  onstatechange: null,
  onerror: null,
  postMessage: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(() => true),
});

const createMockRegistration = (): ServiceWorkerRegistration => ({
  scope: "/",
  installing: null,
  waiting: null,
  active: createMockServiceWorker(),
  navigationPreload: {} as NavigationPreloadManager,
  pushManager: {} as PushManager,
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

const createMockBeforeInstallPromptEvent = (): BeforeInstallPromptEvent => {
  const event = {
    type: "beforeinstallprompt",
    preventDefault: vi.fn(),
    platforms: ["web"],
    userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
    prompt: vi.fn().mockResolvedValue(undefined),
  } as unknown as BeforeInstallPromptEvent;
  return event;
};

// =============================================================================
// useOnlineStatus Tests
// =============================================================================

describe("useOnlineStatus", () => {
  let originalOnLine: boolean;
  let listeners: { [key: string]: EventListenerOrEventListenerObject[] } = {};

  beforeEach(() => {
    originalOnLine = navigator.onLine;
    listeners = { online: [], offline: [] };

    // Mock navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: vi.fn(() => true),
    });

    // Mock window event listeners
    vi.spyOn(window, "addEventListener").mockImplementation((type, handler) => {
      if (type === "online" || type === "offline") {
        listeners[type].push(handler);
      }
    });
    vi.spyOn(window, "removeEventListener").mockImplementation((type, handler) => {
      if (type === "online" || type === "offline") {
        listeners[type] = listeners[type].filter((h) => h !== handler);
      }
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => originalOnLine,
    });
    vi.restoreAllMocks();
  });

  it("should return initial online status", () => {
    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current.isOnline).toBe(true);
    expect(result.current.wasOffline).toBe(false);
  });

  it("should update when going offline", async () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      // Simulate offline event
      listeners.offline.forEach((handler) => {
        if (typeof handler === "function") handler(new Event("offline"));
      });
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.wasOffline).toBe(true);
  });

  it("should update when coming back online", async () => {
    const { result } = renderHook(() => useOnlineStatus());

    // Go offline first
    act(() => {
      listeners.offline.forEach((handler) => {
        if (typeof handler === "function") handler(new Event("offline"));
      });
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.wasOffline).toBe(true);

    // Come back online
    act(() => {
      listeners.online.forEach((handler) => {
        if (typeof handler === "function") handler(new Event("online"));
      });
    });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.wasOffline).toBe(true);
  });

  it("should cleanup event listeners on unmount", () => {
    const { unmount } = renderHook(() => useOnlineStatus());

    expect(window.addEventListener).toHaveBeenCalledWith("online", expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith("offline", expect.any(Function));

    unmount();

    expect(window.removeEventListener).toHaveBeenCalledWith("online", expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith("offline", expect.any(Function));
  });
});

// =============================================================================
// useInstallPrompt Tests
// =============================================================================

describe("useInstallPrompt", () => {
  let listeners: { [key: string]: EventListenerOrEventListenerObject[] } = {};
  let mediaQueryListeners: ((e: MediaQueryListEvent) => void)[] = [];

  const setupMatchMedia = (matches: boolean) => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: (type: string, handler: (e: MediaQueryListEvent) => void) => {
          if (type === "change") mediaQueryListeners.push(handler);
        },
        removeEventListener: (type: string, handler: (e: MediaQueryListEvent) => void) => {
          if (type === "change") {
            mediaQueryListeners = mediaQueryListeners.filter((h) => h !== handler);
          }
        },
        dispatchEvent: vi.fn(() => true),
      })),
    });
  };

  beforeEach(() => {
    listeners = { beforeinstallprompt: [], appinstalled: [] };
    mediaQueryListeners = [];

    // Mock window event listeners
    vi.spyOn(window, "addEventListener").mockImplementation((type, handler) => {
      if (type === "beforeinstallprompt" || type === "appinstalled") {
        listeners[type].push(handler);
      }
    });
    vi.spyOn(window, "removeEventListener").mockImplementation((type, handler) => {
      if (type === "beforeinstallprompt" || type === "appinstalled") {
        listeners[type] = listeners[type].filter((h) => h !== handler);
      }
    });

    // Setup default matchMedia (not standalone)
    setupMatchMedia(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should return initial install state", () => {
    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current[0].isInstallable).toBe(false);
    expect(result.current[0].isInstalled).toBe(false);
    expect(result.current[0].prompt).toBeNull();
  });

  it("should detect standalone mode as installed", () => {
    setupMatchMedia(true);

    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current[0].isInstalled).toBe(true);
  });

  it("should capture beforeinstallprompt event", () => {
    const { result } = renderHook(() => useInstallPrompt());

    const mockEvent = createMockBeforeInstallPromptEvent();

    act(() => {
      listeners.beforeinstallprompt.forEach((handler) => {
        if (typeof handler === "function") handler(mockEvent as unknown as Event);
      });
    });

    expect(result.current[0].isInstallable).toBe(true);
    expect(result.current[0].prompt).not.toBeNull();
    expect(mockEvent.preventDefault).toHaveBeenCalled();
  });

  it("should handle install action", async () => {
    const { result } = renderHook(() => useInstallPrompt());

    const mockEvent = createMockBeforeInstallPromptEvent();

    act(() => {
      listeners.beforeinstallprompt.forEach((handler) => {
        if (typeof handler === "function") handler(mockEvent as unknown as Event);
      });
    });

    let outcome: "accepted" | "dismissed" | null = null;
    await act(async () => {
      outcome = await result.current[1].install();
    });

    expect(outcome).toBe("accepted");
    expect(mockEvent.prompt).toHaveBeenCalled();
    expect(result.current[0].isInstallable).toBe(false);
    expect(result.current[0].isInstalled).toBe(true);
  });

  it("should return null when install called without prompt", async () => {
    const { result } = renderHook(() => useInstallPrompt());

    let outcome: "accepted" | "dismissed" | null = null;
    await act(async () => {
      outcome = await result.current[1].install();
    });

    expect(outcome).toBeNull();
  });

  it("should handle appinstalled event", () => {
    const { result } = renderHook(() => useInstallPrompt());

    // First capture the install prompt
    const mockEvent = createMockBeforeInstallPromptEvent();
    act(() => {
      listeners.beforeinstallprompt.forEach((handler) => {
        if (typeof handler === "function") handler(mockEvent as unknown as Event);
      });
    });

    expect(result.current[0].isInstallable).toBe(true);

    // Trigger appinstalled event
    act(() => {
      listeners.appinstalled.forEach((handler) => {
        if (typeof handler === "function") handler(new Event("appinstalled"));
      });
    });

    expect(result.current[0].isInstalled).toBe(true);
    expect(result.current[0].isInstallable).toBe(false);
  });

  it("should cleanup event listeners on unmount", () => {
    const { unmount } = renderHook(() => useInstallPrompt());

    expect(window.addEventListener).toHaveBeenCalledWith(
      "beforeinstallprompt",
      expect.any(Function)
    );
    expect(window.addEventListener).toHaveBeenCalledWith(
      "appinstalled",
      expect.any(Function)
    );

    unmount();

    expect(window.removeEventListener).toHaveBeenCalledWith(
      "beforeinstallprompt",
      expect.any(Function)
    );
    expect(window.removeEventListener).toHaveBeenCalledWith(
      "appinstalled",
      expect.any(Function)
    );
  });
});

// =============================================================================
// useServiceWorker Tests
// =============================================================================

describe("useServiceWorker", () => {
  let mockRegistration: ServiceWorkerRegistration;
  let serviceWorkerContainer: {
    register: ReturnType<typeof vi.fn>;
    controller: ServiceWorker | null;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };
  let containerListeners: { [key: string]: EventListenerOrEventListenerObject[] } = {};

  beforeEach(() => {
    mockRegistration = createMockRegistration();
    containerListeners = { controllerchange: [] };

    serviceWorkerContainer = {
      register: vi.fn().mockResolvedValue(mockRegistration),
      controller: mockRegistration.active,
      addEventListener: vi.fn((type, handler) => {
        if (type === "controllerchange") {
          containerListeners[type].push(handler);
        }
      }),
      removeEventListener: vi.fn((type, handler) => {
        if (type === "controllerchange") {
          containerListeners[type] = containerListeners[type].filter((h) => h !== handler);
        }
      }),
    };

    // Mock navigator.serviceWorker
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: serviceWorkerContainer,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should register service worker on mount", async () => {
    const { result } = renderHook(() => useServiceWorker());

    await waitFor(() => {
      expect(result.current[0].registration).not.toBeNull();
    });

    expect(serviceWorkerContainer.register).toHaveBeenCalledWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  });

  it("should use custom path and scope", async () => {
    const { result } = renderHook(() =>
      useServiceWorker({ path: "/custom-sw.js", scope: "/app/" })
    );

    await waitFor(() => {
      expect(result.current[0].registration).not.toBeNull();
    });

    expect(serviceWorkerContainer.register).toHaveBeenCalledWith("/custom-sw.js", {
      scope: "/app/",
      updateViaCache: "none",
    });
  });

  it("should track active service worker", async () => {
    const { result } = renderHook(() => useServiceWorker());

    await waitFor(() => {
      expect(result.current[0].active).not.toBeNull();
      expect(result.current[0].isReady).toBe(true);
    });
  });

  it("should provide update action", async () => {
    const { result } = renderHook(() => useServiceWorker());

    await waitFor(() => {
      expect(result.current[0].registration).not.toBeNull();
    });

    await act(async () => {
      await result.current[1].update();
    });

    expect(mockRegistration.update).toHaveBeenCalled();
  });

  it("should provide unregister action", async () => {
    const { result } = renderHook(() => useServiceWorker());

    await waitFor(() => {
      expect(result.current[0].registration).not.toBeNull();
    });

    let success = false;
    await act(async () => {
      success = await result.current[1].unregister();
    });

    expect(success).toBe(true);
    expect(mockRegistration.unregister).toHaveBeenCalled();
  });

  it("should provide skipWaiting action for waiting worker", async () => {
    const waitingWorker = createMockServiceWorker("installed");
    mockRegistration.waiting = waitingWorker;

    const { result } = renderHook(() => useServiceWorker());

    await waitFor(() => {
      expect(result.current[0].waiting).not.toBeNull();
    });

    act(() => {
      result.current[1].skipWaiting();
    });

    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
  });

  it("should handle registration error", async () => {
    const error = new Error("Registration failed");
    serviceWorkerContainer.register = vi.fn().mockRejectedValue(error);

    const { result } = renderHook(() => useServiceWorker());

    await waitFor(() => {
      expect(result.current[0].error).not.toBeNull();
    });

    expect(result.current[0].error?.message).toBe("Registration failed");
  });
});

// =============================================================================
// usePWA Tests
// =============================================================================

describe("usePWA", () => {
  let mockRegistration: ServiceWorkerRegistration;

  beforeEach(() => {
    mockRegistration = createMockRegistration();

    // Mock navigator.serviceWorker
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: vi.fn().mockResolvedValue(mockRegistration),
        controller: mockRegistration.active,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    // Mock navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => true,
    });

    // Mock window events
    vi.spyOn(window, "addEventListener").mockImplementation(() => {});
    vi.spyOn(window, "removeEventListener").mockImplementation(() => {});

    // Mock matchMedia using Object.defineProperty
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should combine all PWA state", async () => {
    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current[0].isReady).toBe(true);
    });

    expect(result.current[0].isOnline).toBe(true);
    expect(result.current[0].isInstallable).toBe(false);
    expect(result.current[0].isInstalled).toBe(false);
    expect(result.current[0].isUpdateAvailable).toBe(false);
    expect(result.current[0].error).toBeNull();
  });

  it("should detect update available when worker is waiting", async () => {
    const waitingWorker = createMockServiceWorker("installed");
    mockRegistration.waiting = waitingWorker;

    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current[0].isUpdateAvailable).toBe(true);
    });
  });

  it("should provide combined actions", async () => {
    const { result } = renderHook(() => usePWA());

    await waitFor(() => {
      expect(result.current[0].isReady).toBe(true);
    });

    expect(typeof result.current[1].install).toBe("function");
    expect(typeof result.current[1].update).toBe("function");
    expect(typeof result.current[1].skipWaiting).toBe("function");
  });
});

// =============================================================================
// useRegisterSW Tests
// =============================================================================

describe("useRegisterSW", () => {
  let mockRegistration: ServiceWorkerRegistration;

  beforeEach(() => {
    mockRegistration = createMockRegistration();

    // Mock navigator.serviceWorker
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: vi.fn().mockResolvedValue(mockRegistration),
        controller: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should not register automatically", () => {
    renderHook(() => useRegisterSW());

    expect((navigator.serviceWorker as { register: ReturnType<typeof vi.fn> }).register)
      .not.toHaveBeenCalled();
  });

  it("should register when register function is called", async () => {
    const { result } = renderHook(() => useRegisterSW("/sw.js"));

    expect(result.current.registered).toBe(false);

    await act(async () => {
      await result.current.register();
    });

    expect(result.current.registered).toBe(true);
    expect(result.current.registration).not.toBeNull();
    expect((navigator.serviceWorker as { register: ReturnType<typeof vi.fn> }).register)
      .toHaveBeenCalledWith("/sw.js", undefined);
  });

  it("should handle registration error", async () => {
    const error = new Error("Registration failed");
    (navigator.serviceWorker as { register: ReturnType<typeof vi.fn> }).register =
      vi.fn().mockRejectedValue(error);

    const { result } = renderHook(() => useRegisterSW());

    await act(async () => {
      await result.current.register();
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe("Registration failed");
    expect(result.current.registered).toBe(false);
  });

  it("should accept custom options", async () => {
    const options: RegistrationOptions = { scope: "/app/" };

    const { result } = renderHook(() => useRegisterSW("/sw.js", options));

    await act(async () => {
      await result.current.register();
    });

    expect((navigator.serviceWorker as { register: ReturnType<typeof vi.fn> }).register)
      .toHaveBeenCalledWith("/sw.js", options);
  });
});

// =============================================================================
// SSR Safety Tests
// =============================================================================

describe("SSR Safety", () => {
  // Note: These tests verify hooks don't crash when window is undefined
  // In a real SSR environment, window would be undefined
  // We can't easily test that here, but we verify the hooks handle
  // the client-side checks properly

  it("useOnlineStatus should have safe initial state", () => {
    const { result } = renderHook(() => useOnlineStatus());

    // Should have a defined state even if navigator is mocked
    expect(result.current).toHaveProperty("isOnline");
    expect(result.current).toHaveProperty("wasOffline");
  });

  it("useInstallPrompt should have safe initial state", () => {
    const { result } = renderHook(() => useInstallPrompt());

    expect(result.current[0]).toHaveProperty("isInstallable");
    expect(result.current[0]).toHaveProperty("isInstalled");
    expect(result.current[0]).toHaveProperty("prompt");
  });
});
