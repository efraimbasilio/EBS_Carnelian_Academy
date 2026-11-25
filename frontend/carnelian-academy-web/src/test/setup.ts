import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { pendingUntilAborted, stubFetch, TEST_API_BASE_URL } from './fetch.ts'
import { mockDesktopMediaQuery } from './matchMedia.ts'

beforeEach(() => {
  mockDesktopMediaQuery()
  // Deterministic configuration regardless of a developer's .env.local (restored by unstubEnvs).
  vi.stubEnv('VITE_API_BASE_URL', TEST_API_BASE_URL)
  vi.stubEnv('VITE_API_TIMEOUT_MS', '')
  // Tests never reach the network or a backend. Unless a test installs its own stub, requests
  // stay pending until aborted, so components rendered for unrelated tests remain "Checking".
  stubFetch((_url, init) => pendingUntilAborted(init))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
