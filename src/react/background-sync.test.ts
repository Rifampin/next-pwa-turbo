/**
 * Tests for Background Sync React Hook
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useBackgroundSync } from "./background-sync.js";

// =============================================================================
// Mock Setup
// =============================================================================

// Mock SyncManager
const createMockSyncManager = (tags: string[] = []) => ({
  register: vi.fn().mockResolvedValue(undefined),
  getTags: vi.fn().mockResolvedValue(tags),
});

// Mock ServiceWorkerRegistration with sync
const createMockRegistration = (syncManager: ReturnType<typeof createMockSyncManager>) => ({
  scope: "/",
  installing: null,
  waiting: null,
  active: { state: "activated" } as ServiceWorker,
  sync: syncManager,
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

// =============================================================================
// useBackgroundSync Tests
// =============================================================================

describe("useBackgroundSync", () => {
  let mockSyncManager: ReturnType<typeof createMockSyncManager>;
  let mockRegistration: ReturnType<typeof createMockRegistration>;

  beforeEach(() => {
    mockSyncManager = createMockSyncManager();
    mockRegistration = createMockRegistration(mockSyncManager);

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

    // Mock SyncManager on window
    Object.defineProperty(window, "SyncManager", {
      configurable: true,
      value: class MockSyncManager {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initial state", () => {
    it("should return initial state with isSupported true", () => {
      const { result } = renderHook(() => useBackgroundSync());

      expect(result.current[0].isSupported).toBe(true);
      expect(result.current[0].pendingSyncs).toEqual([]);
      expect(result.current[0].error).toBeNull();
      expect(result.current[0].isLoading).toBe(false);
    });

    it("should fetch existing sync tags on mount", async () => {
      mockSyncManager = createMockSyncManager(["sync-1", "sync-2"]);
      mockRegistration = createMockRegistration(mockSyncManager);

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

      const { result } = renderHook(() => useBackgroundSync());

      await waitFor(() => {
        expect(result.current[0].pendingSyncs).toEqual(["sync-1", "sync-2"]);
      });
    });

    it("should return isSupported false when SyncManager not available", () => {
      // Remove SyncManager before rendering
      const originalSyncManager = (window as { SyncManager?: unknown }).SyncManager;
      // @ts-expect-error - testing undefined SyncManager
      delete window.SyncManager;

      const { result } = renderHook(() => useBackgroundSync());

      expect(result.current[0].isSupported).toBe(false);

      // Restore
      Object.defineProperty(window, "SyncManager", {
        configurable: true,
        value: originalSyncManager,
      });
    });
  });

  describe("registerSync", () => {
    it("should register a background sync", async () => {
      // Update getTags to return the registered tag
      mockSyncManager.getTags.mockResolvedValue(["my-sync"]);

      const { result } = renderHook(() => useBackgroundSync());

      let success = false;
      await act(async () => {
        success = await result.current[1].registerSync("my-sync");
      });

      expect(success).toBe(true);
      expect(mockSyncManager.register).toHaveBeenCalledWith("my-sync");
      expect(result.current[0].pendingSyncs).toEqual(["my-sync"]);
    });

    it("should set loading state during registration", async () => {
      const { result } = renderHook(() => useBackgroundSync());

      expect(result.current[0].isLoading).toBe(false);

      let registerPromise: Promise<boolean>;
      act(() => {
        registerPromise = result.current[1].registerSync("test-sync");
      });

      expect(result.current[0].isLoading).toBe(true);

      await act(async () => {
        await registerPromise;
      });

      expect(result.current[0].isLoading).toBe(false);
    });

    it("should handle registration error", async () => {
      mockSyncManager.register.mockRejectedValue(new Error("Registration failed"));

      const { result } = renderHook(() => useBackgroundSync());

      let success = true;
      await act(async () => {
        success = await result.current[1].registerSync("failing-sync");
      });

      expect(success).toBe(false);
      expect(result.current[0].error).not.toBeNull();
      expect(result.current[0].error?.message).toBe("Registration failed");
      expect(result.current[0].isLoading).toBe(false);
    });

    it("should fail when sync not supported", async () => {
      // Remove SyncManager before rendering
      const originalSyncManager = (window as { SyncManager?: unknown }).SyncManager;
      // @ts-expect-error - testing undefined SyncManager
      delete window.SyncManager;

      const { result } = renderHook(() => useBackgroundSync());

      let success = true;
      await act(async () => {
        success = await result.current[1].registerSync("test-sync");
      });

      expect(success).toBe(false);
      expect(result.current[0].error?.message).toBe("Background sync not supported");

      // Restore
      Object.defineProperty(window, "SyncManager", {
        configurable: true,
        value: originalSyncManager,
      });
    });

    it("should fail when SyncManager not available on registration", async () => {
      // Create registration without sync property
      const registrationWithoutSync = {
        ...mockRegistration,
        sync: undefined,
      };

      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          ready: Promise.resolve(registrationWithoutSync),
          register: vi.fn().mockResolvedValue(registrationWithoutSync),
          controller: registrationWithoutSync.active,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
      });

      const { result } = renderHook(() => useBackgroundSync());

      let success = true;
      await act(async () => {
        success = await result.current[1].registerSync("test-sync");
      });

      expect(success).toBe(false);
      expect(result.current[0].error?.message).toBe("SyncManager not available");
    });
  });

  describe("getSyncs", () => {
    it("should get all registered sync tags", async () => {
      mockSyncManager.getTags.mockResolvedValue(["sync-a", "sync-b", "sync-c"]);

      const { result } = renderHook(() => useBackgroundSync());

      let tags: string[] = [];
      await act(async () => {
        tags = await result.current[1].getSyncs();
      });

      expect(tags).toEqual(["sync-a", "sync-b", "sync-c"]);
      expect(result.current[0].pendingSyncs).toEqual(["sync-a", "sync-b", "sync-c"]);
    });

    it("should return empty array when sync not supported", async () => {
      // Remove SyncManager before rendering
      const originalSyncManager = (window as { SyncManager?: unknown }).SyncManager;
      // @ts-expect-error - testing undefined SyncManager
      delete window.SyncManager;

      const { result } = renderHook(() => useBackgroundSync());

      let tags: string[] = ["should-be-cleared"];
      await act(async () => {
        tags = await result.current[1].getSyncs();
      });

      expect(tags).toEqual([]);

      // Restore
      Object.defineProperty(window, "SyncManager", {
        configurable: true,
        value: originalSyncManager,
      });
    });

    it("should return empty array when SyncManager not available on registration", async () => {
      const registrationWithoutSync = {
        ...mockRegistration,
        sync: undefined,
      };

      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          ready: Promise.resolve(registrationWithoutSync),
          register: vi.fn().mockResolvedValue(registrationWithoutSync),
          controller: registrationWithoutSync.active,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        },
      });

      const { result } = renderHook(() => useBackgroundSync());

      let tags: string[] = ["should-be-cleared"];
      await act(async () => {
        tags = await result.current[1].getSyncs();
      });

      expect(tags).toEqual([]);
    });

    it("should handle error when getting tags", async () => {
      mockSyncManager.getTags.mockRejectedValue(new Error("Failed to get tags"));

      const { result } = renderHook(() => useBackgroundSync());

      let tags: string[] = ["should-be-cleared"];
      await act(async () => {
        tags = await result.current[1].getSyncs();
      });

      expect(tags).toEqual([]);
    });
  });
});

// =============================================================================
// SSR Safety Tests
// =============================================================================

describe("useBackgroundSync SSR Safety", () => {
  beforeEach(() => {
    // Mock SyncManager on window
    Object.defineProperty(window, "SyncManager", {
      configurable: true,
      value: class MockSyncManager {},
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({}),
      },
    });
  });

  it("should have safe initial state structure", () => {
    const { result } = renderHook(() => useBackgroundSync());

    expect(result.current[0]).toHaveProperty("isSupported");
    expect(result.current[0]).toHaveProperty("pendingSyncs");
    expect(result.current[0]).toHaveProperty("error");
    expect(result.current[0]).toHaveProperty("isLoading");

    expect(result.current[1]).toHaveProperty("registerSync");
    expect(result.current[1]).toHaveProperty("getSyncs");
  });
});
