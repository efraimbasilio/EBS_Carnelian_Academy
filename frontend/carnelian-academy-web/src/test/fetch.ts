import { vi } from 'vitest'

/** Synthetic base URL used by tests. Requests are answered by stubs; nothing is sent over the network. */
export const TEST_API_BASE_URL = 'https://localhost:7159'

type FetchHandler = (url: string, init: RequestInit | undefined) => Promise<Response>

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

/** Replaces global fetch for the current test. Restored by vi.unstubAllGlobals() in setup.ts. */
export function stubFetch(handler: FetchHandler) {
  const mock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => handler(requestUrl(input), init))
  vi.stubGlobal('fetch', mock)
  return mock
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function abortError() {
  return new DOMException('The operation was aborted.', 'AbortError')
}

/** A request that stays pending until its signal aborts, as a real fetch does. */
export function pendingUntilAborted(init: RequestInit | undefined): Promise<Response> {
  return new Promise((_, reject) => {
    const signal = init?.signal
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    signal?.addEventListener('abort', () => reject(abortError()), { once: true })
  })
}

export interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

export const HEALTHY_API = { status: 'Healthy', application: 'Carnelian Academy API' }
export const DATABASE_CONNECTED = { status: 'Healthy', database: 'Connected' }
export const DATABASE_UNAVAILABLE = { status: 'Unhealthy', database: 'Unavailable' }

/** Routes /health and /health/database to the given responses; any other URL fails the test. */
export function stubHealthEndpoints(responses: {
  api: () => Promise<Response>
  database: () => Promise<Response>
}) {
  return stubFetch((url) => {
    if (url === `${TEST_API_BASE_URL}/health`) return responses.api()
    if (url === `${TEST_API_BASE_URL}/health/database`) return responses.database()
    throw new Error(`Unexpected request in test: ${url}`)
  })
}
