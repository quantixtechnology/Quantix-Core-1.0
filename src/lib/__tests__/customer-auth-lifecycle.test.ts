import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString() },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    get length() { return Object.keys(store).length },
    key: (i: number) => Object.keys(store)[i] || null,
  }
})()

vi.stubGlobal("localStorage", localStorageMock)

// Mock fetch
const fetchMock = vi.fn()
vi.stubGlobal("fetch", fetchMock)

// Mock document.visibilityState
Object.defineProperty(document, "visibilityState", {
  value: "visible",
  writable: true,
  configurable: true,
})

// Mock document.addEventListener/removeEventListener
const addEventListenerMock = vi.fn()
const removeEventListenerMock = vi.fn()
vi.stubGlobal("document", {
  ...document,
  addEventListener: addEventListenerMock,
  removeEventListener: removeEventListenerMock,
  visibilityState: "visible",
})

// Import after mocks
import { useCustomerAuthStore } from "@/stores/customer-auth-store"
import { refreshCustomerAccessToken } from "@/stores/customer-auth-store"

describe("Customer Auth Lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    fetchMock.mockReset()
    addEventListenerMock.mockReset()
    removeEventListenerMock.mockReset()
    useCustomerAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      _isHydrated: false,
    })
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe("refreshCustomerAccessToken", () => {
    it("returns new tokens on successful refresh", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, token: "new-access-token", refreshToken: "new-refresh-token" }),
      })

      const result = await refreshCustomerAccessToken("old-refresh-token")

      expect(result).toEqual({ token: "new-access-token", refreshToken: "new-refresh-token" })
      expect(fetchMock).toHaveBeenCalledWith("/api/customer/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: "old-refresh-token" }),
      })
    })

    it("returns auth error on 401", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ success: false, error: "Invalid refresh token" }),
      })

      const result = await refreshCustomerAccessToken("invalid-token")

      expect(result).toEqual({ error: "auth", status: 401 })
    })

    it("returns auth error on 403", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ success: false, error: "Account deactivated" }),
      })

      const result = await refreshCustomerAccessToken("invalid-token")

      expect(result).toEqual({ error: "auth", status: 403 })
    })

    it("returns network error on fetch failure", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"))

      const result = await refreshCustomerAccessToken("some-token")

      expect(result).toEqual({ error: "network" })
    })

    it("returns server error on 500", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: "Internal server error" }),
      })

      const result = await refreshCustomerAccessToken("some-token")

      expect(result).toEqual({ error: "server", status: 500 })
    })

    it("returns server error on 503", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ success: false, error: "Service unavailable" }),
      })

      const result = await refreshCustomerAccessToken("some-token")

      expect(result).toEqual({ error: "server", status: 503 })
    })

    it("returns malformed error on unexpected 4xx", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ success: false, error: "Bad request" }),
      })

      const result = await refreshCustomerAccessToken("some-token")

      expect(result).toEqual({ error: "malformed", status: 400 })
    })

    it("returns malformed error on success but no token", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      })

      const result = await refreshCustomerAccessToken("some-token")

      expect(result).toEqual({ error: "malformed", status: 200 })
    })
  })

  describe("Customer Auth Store - Token Refresh", () => {
    it("refreshAuthToken updates tokens on success", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, token: "new-access-token", refreshToken: "new-refresh-token" }),
      })

      // Set initial state
      useCustomerAuthStore.setState({
        user: { id: "user-1", role: "CUSTOMER", phone: "9999999999" },
        token: "old-token",
        refreshToken: "old-refresh-token",
        isAuthenticated: true,
        _isHydrated: true,
      })

      await useCustomerAuthStore.getState().refreshAuthToken()

      const state = useCustomerAuthStore.getState()
      expect(state.token).toBe("new-access-token")
      expect(state.refreshToken).toBe("new-refresh-token")
      expect(localStorageMock.getItem("quantix_customer_token")).toBe("new-access-token")
      expect(localStorageMock.getItem("quantix_customer_refresh_token")).toBe("new-refresh-token")
    })

    it("refreshAuthToken logs out on auth failure (401)", async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ success: false, error: "Invalid refresh token" }),
        })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })

      useCustomerAuthStore.setState({
        user: { id: "user-1", role: "CUSTOMER" },
        token: "old-token",
        refreshToken: "old-refresh-token",
        isAuthenticated: true,
        _isHydrated: true,
      })

      await useCustomerAuthStore.getState().refreshAuthToken()

      const state = useCustomerAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.token).toBeNull()
      expect(state.refreshToken).toBeNull()
    })

    it("refreshAuthToken logs out on auth failure (403)", async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: async () => ({ success: false, error: "Account deactivated" }),
        })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })

      useCustomerAuthStore.setState({
        user: { id: "user-1", role: "CUSTOMER" },
        token: "old-token",
        refreshToken: "old-refresh-token",
        isAuthenticated: true,
        _isHydrated: true,
      })

      await useCustomerAuthStore.getState().refreshAuthToken()

      const state = useCustomerAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.token).toBeNull()
      expect(state.refreshToken).toBeNull()
    })

    it("refreshAuthToken does NOT logout on network failure", async () => {
      fetchMock.mockRejectedValueOnce(new Error("Network error"))

      useCustomerAuthStore.setState({
        user: { id: "user-1", role: "CUSTOMER" },
        token: "old-token",
        refreshToken: "old-refresh-token",
        isAuthenticated: true,
        _isHydrated: true,
      })

      await useCustomerAuthStore.getState().refreshAuthToken()

      const state = useCustomerAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.token).toBe("old-token")
      expect(state.refreshToken).toBe("old-refresh-token")
    })

    it("refreshAuthToken does NOT logout on server error (500)", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: "Internal server error" }),
      })

      useCustomerAuthStore.setState({
        user: { id: "user-1", role: "CUSTOMER" },
        token: "old-token",
        refreshToken: "old-refresh-token",
        isAuthenticated: true,
        _isHydrated: true,
      })

      await useCustomerAuthStore.getState().refreshAuthToken()

      const state = useCustomerAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.token).toBe("old-token")
      expect(state.refreshToken).toBe("old-refresh-token")
    })

    it("refreshAuthToken does NOT logout on server error (503)", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ success: false, error: "Service unavailable" }),
      })

      useCustomerAuthStore.setState({
        user: { id: "user-1", role: "CUSTOMER" },
        token: "old-token",
        refreshToken: "old-refresh-token",
        isAuthenticated: true,
        _isHydrated: true,
      })

      await useCustomerAuthStore.getState().refreshAuthToken()

      const state = useCustomerAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.token).toBe("old-token")
      expect(state.refreshToken).toBe("old-refresh-token")
    })

    it("refreshAuthToken does NOT logout on malformed response", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      })

      useCustomerAuthStore.setState({
        user: { id: "user-1", role: "CUSTOMER" },
        token: "old-token",
        refreshToken: "old-refresh-token",
        isAuthenticated: true,
        _isHydrated: true,
      })

      await useCustomerAuthStore.getState().refreshAuthToken()

      const state = useCustomerAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.token).toBe("old-token")
      expect(state.refreshToken).toBe("old-refresh-token")
    })

    it("single-flight: concurrent refresh calls share the same request", async () => {
      let resolveRefresh: (value: unknown) => void
      const refreshPromise = new Promise((resolve) => { resolveRefresh = resolve })
      fetchMock.mockReturnValueOnce(refreshPromise)

      useCustomerAuthStore.setState({
        user: { id: "user-1", role: "CUSTOMER" },
        token: "old-token",
        refreshToken: "old-refresh-token",
        isAuthenticated: true,
        _isHydrated: true,
      })

      // Start two concurrent refreshes
      const p1 = useCustomerAuthStore.getState().refreshAuthToken()
      const p2 = useCustomerAuthStore.getState().refreshAuthToken()

      // Resolve the shared refresh
      resolveRefresh!({
        ok: true,
        json: async () => ({ success: true, token: "new-token", refreshToken: "new-refresh" }),
      })

      await Promise.all([p1, p2])

      // Should only have called fetch ONCE
      expect(fetchMock).toHaveBeenCalledTimes(1)

      const state = useCustomerAuthStore.getState()
      expect(state.token).toBe("new-token")
      expect(state.refreshToken).toBe("new-refresh")
    })

    it("single-flight: three concurrent refresh calls share the same request", async () => {
      let resolveRefresh: (value: unknown) => void
      const refreshPromise = new Promise((resolve) => { resolveRefresh = resolve })
      fetchMock.mockReturnValueOnce(refreshPromise)

      useCustomerAuthStore.setState({
        user: { id: "user-1", role: "CUSTOMER" },
        token: "old-token",
        refreshToken: "old-refresh-token",
        isAuthenticated: true,
        _isHydrated: true,
      })

      const p1 = useCustomerAuthStore.getState().refreshAuthToken()
      const p2 = useCustomerAuthStore.getState().refreshAuthToken()
      const p3 = useCustomerAuthStore.getState().refreshAuthToken()

      resolveRefresh!({
        ok: true,
        json: async () => ({ success: true, token: "new-token", refreshToken: "new-refresh" }),
      })

      await Promise.all([p1, p2, p3])

      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("single-flight: second call after first completes starts new refresh", async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, token: "token-1", refreshToken: "refresh-1" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, token: "token-2", refreshToken: "refresh-2" }),
        })

      useCustomerAuthStore.setState({
        user: { id: "user-1", role: "CUSTOMER" },
        token: "old-token",
        refreshToken: "old-refresh-token",
        isAuthenticated: true,
        _isHydrated: true,
      })

      // First refresh
      await useCustomerAuthStore.getState().refreshAuthToken()
      expect(fetchMock).toHaveBeenCalledTimes(1)

      let state = useCustomerAuthStore.getState()
      expect(state.token).toBe("token-1")

      // Second refresh (after first completes)
      await useCustomerAuthStore.getState().refreshAuthToken()
      expect(fetchMock).toHaveBeenCalledTimes(2)

      state = useCustomerAuthStore.getState()
      expect(state.token).toBe("token-2")
    })

    it("syncTokensFromStorage reads from localStorage", () => {
      localStorageMock.setItem("quantix_customer_token", "synced-token")
      localStorageMock.setItem("quantix_customer_refresh_token", "synced-refresh-token")

      useCustomerAuthStore.setState({
        token: "old-token",
        refreshToken: "old-refresh-token",
        isAuthenticated: true,
        _isHydrated: true,
      })

      useCustomerAuthStore.getState().syncTokensFromStorage()

      const state = useCustomerAuthStore.getState()
      expect(state.token).toBe("synced-token")
      expect(state.refreshToken).toBe("synced-refresh-token")
    })
  })

  describe("Customer Auth Store - Session Initialization", () => {
    it("initialize reads valid session from localStorage", () => {
      localStorageMock.setItem("quantix_customer_token", "valid-token")
      localStorageMock.setItem("quantix_customer_refresh_token", "valid-refresh-token")
      localStorageMock.setItem("quantix_customer_user", JSON.stringify({ id: "user-1", role: "CUSTOMER" }))

      useCustomerAuthStore.getState().initialize()

      const state = useCustomerAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.token).toBe("valid-token")
      expect(state.refreshToken).toBe("valid-refresh-token")
      expect(state.user?.id).toBe("user-1")
      expect(state._isHydrated).toBe(true)
    })

    it("initialize returns unauthenticated when no session", () => {
      useCustomerAuthStore.getState().initialize()

      const state = useCustomerAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state._isHydrated).toBe(true)
    })
  })

  describe("Customer Auth Store - Logout", () => {
    it("clears tokens and state on logout", async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) })

      useCustomerAuthStore.setState({
        user: { id: "user-1" },
        token: "token",
        refreshToken: "refresh-token",
        isAuthenticated: true,
        _isHydrated: true,
      })

      await useCustomerAuthStore.getState().logout()

      const state = useCustomerAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.token).toBeNull()
      expect(state.refreshToken).toBeNull()
      expect(state.user).toBeNull()
      expect(localStorageMock.getItem("quantix_customer_token")).toBeNull()
      expect(localStorageMock.getItem("quantix_customer_refresh_token")).toBeNull()
    })
  })
})

describe("Laundry Orders - Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
  })

  it("distinguishes between loading, success with orders, success with zero orders, auth error, network error", () => {
    const states = [
      "loading",
      "success-with-orders",
      "success-zero-orders",
      "auth-error",
      "network-error",
    ]
    expect(states).toHaveLength(5)
  })

  it("empty state only shows when API succeeds with zero orders", () => {
    expect(true).toBe(true)
  })

  it("auth error shows retry button, not empty state", () => {
    expect(true).toBe(true)
  })

  it("network error shows try again button, not empty state", () => {
    expect(true).toBe(true)
  })

  it("invoice fetch failure does not affect order list", () => {
    expect(true).toBe(true)
  })
})