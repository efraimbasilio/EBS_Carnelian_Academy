/**
 * Minimal JSON-over-HTTP helper built on native fetch.
 *
 * Responsibilities: build URLs under the configured base path, apply a finite timeout, honor caller
 * cancellation, and convert every failure into a typed error with a fixed, non-sensitive message.
 * It never retries, never sends credentials or cookies, and never surfaces raw exception text,
 * URLs, or response bodies in its error messages.
 */

export type ApiFailureKind = 'network' | 'timeout' | 'http-status' | 'invalid-response'

/** A request that completed unsuccessfully. `message` is safe to log; it contains no response data. */
export class ApiRequestError extends Error {
  readonly kind: ApiFailureKind
  readonly status: number | undefined

  constructor(kind: ApiFailureKind, message: string, status?: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.kind = kind
    this.status = status
  }
}

/** The caller cancelled the request through its AbortSignal. Not a failure to report to users. */
export class ApiRequestAbortedError extends Error {
  constructor() {
    super('The request was cancelled.')
    this.name = 'AbortError'
  }
}

export function isAbortError(error: unknown): error is ApiRequestAbortedError {
  return error instanceof ApiRequestAbortedError
}

/**
 * Resolves an API path relative to the base URL, preserving any base path: with the base
 * `https://localhost:7159/api`, the path `health/database` becomes `https://localhost:7159/api/health/database`.
 * Paths are application constants; absolute URLs, dot segments, queries, and fragments are rejected
 * so a path can never move the request to another origin or outside the base path.
 */
export function buildApiUrl(baseUrl: string, path: string): string {
  const relativePath = path.replace(/^\/+/, '')
  const invalidPath = 'API paths must stay under the configured base path and omit dot segments, encoded separators, queries, and fragments.'
  if (
    !relativePath ||
    /[?#\\\t\r\n]|%2f|%5c/i.test(relativePath) ||
    /^[a-z][a-z\d+.-]*:/i.test(relativePath)
  ) {
    throw new TypeError(invalidPath)
  }

  const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
  const resolved = new URL(relativePath, base)
  if (
    resolved.origin !== base.origin ||
    !resolved.pathname.startsWith(base.pathname) ||
    relativePath !== relativePath.trim() ||
    relativePath.split('/').some((segment) => /^(?:\.|%2e){1,2}$/i.test(segment))
  ) {
    throw new TypeError(invalidPath)
  }
  return resolved.href
}

export interface JsonResponse {
  status: number
  body: unknown
}

export interface GetJsonOptions {
  /** Validated API base URL (see config/env.ts). */
  baseUrl: string
  /** Finite request timeout covering both the response headers and the body. */
  timeoutMs: number
  /** HTTP status codes whose bodies are part of the endpoint contract. Other statuses are failures. */
  acceptedStatuses: readonly number[]
  /** Cancels the request; the returned promise then rejects with ApiRequestAbortedError. */
  signal?: AbortSignal
}

/** Sends one GET request and parses its JSON body. The body still needs contract validation. */
export async function getJson(path: string, options: GetJsonOptions): Promise<JsonResponse> {
  const { baseUrl, timeoutMs, acceptedStatuses, signal } = options
  const url = buildApiUrl(baseUrl, path)
  if (signal?.aborted) {
    throw new ApiRequestAbortedError()
  }

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const abortFromCaller = () => controller.abort()
  signal?.addEventListener('abort', abortFromCaller, { once: true })

  const toRequestError = (): Error => {
    if (signal?.aborted) return new ApiRequestAbortedError()
    if (timedOut) {
      return new ApiRequestError('timeout', `The request did not complete within ${timeoutMs} ms.`)
    }
    // fetch rejects with a TypeError for DNS, connection, TLS certificate, CORS, and redirect failures;
    // browsers deliberately do not tell scripts which one occurred.
    return new ApiRequestError('network', 'The request could not reach the server.')
  }

  try {
    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      })
    } catch {
      throw toRequestError()
    }

    if (signal?.aborted) {
      throw new ApiRequestAbortedError()
    }
    if (!acceptedStatuses.includes(response.status)) {
      throw new ApiRequestError('http-status', `The server returned unexpected HTTP status ${response.status}.`, response.status)
    }

    let text: string
    try {
      text = await response.text()
    } catch {
      throw toRequestError()
    }

    try {
      return { status: response.status, body: JSON.parse(text) as unknown }
    } catch {
      throw new ApiRequestError('invalid-response', 'The server response was not valid JSON.', response.status)
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abortFromCaller)
  }
}
