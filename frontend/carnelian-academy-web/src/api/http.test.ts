import { describe, expect, it, vi } from 'vitest'
import { jsonResponse, pendingUntilAborted, stubFetch, TEST_API_BASE_URL } from '../test/fetch.ts'
import { ApiRequestAbortedError, ApiRequestError, buildApiUrl, getJson } from './http.ts'

const OPTIONS = { baseUrl: TEST_API_BASE_URL, timeoutMs: 5_000, acceptedStatuses: [200] }

describe('buildApiUrl', () => {
  it.each([
    ['https://localhost:7159', 'health', 'https://localhost:7159/health'],
    ['https://localhost:7159', '/health/database', 'https://localhost:7159/health/database'],
    ['https://localhost:7159/api', 'health', 'https://localhost:7159/api/health'],
    ['https://localhost:7159/api/v1', 'health/database', 'https://localhost:7159/api/v1/health/database'],
    ['https://localhost:7159/api/', '//health', 'https://localhost:7159/api/health'],
  ])('joins %j and %j under the base path', (baseUrl, path, expected) => {
    expect(buildApiUrl(baseUrl, path)).toBe(expected)
  })

  it('keeps a protocol-relative-looking path on the configured origin and base path', () => {
    expect(buildApiUrl('https://localhost:7159/api', '//example.com/health')).toBe(
      'https://localhost:7159/api/example.com/health',
    )
  })

  it.each([
    '%2e%2e/health',
    '%2E./health',
    'nested/%2e/health',
    'nested%2Fhealth',
    'nested%5chealth',
    ' /health',
    ' \t//example.invalid/health',
  ])('rejects unsafe path normalization (%j)', (path) => {
    expect(() => buildApiUrl('https://localhost:7159/api', path)).toThrow(TypeError)
  })

  it.each(['', '/', 'https://example.com/health', '../health', 'a/../../health', './health', 'health?x=1', 'health#x', 'health\\x'])(
    'rejects a path that could leave the base path (%j)',
    (path) => {
      expect(() => buildApiUrl('https://localhost:7159/api', path)).toThrow(TypeError)
    },
  )
})

describe('getJson', () => {
  it('sends a credential-free GET request with an Accept header and returns the parsed body', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse({ ok: true })))

    await expect(getJson('health', OPTIONS)).resolves.toEqual({ status: 200, body: { ok: true } })

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${TEST_API_BASE_URL}/health`)
    expect(init).toMatchObject({
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'omit',
      redirect: 'error',
    })
    expect(init?.signal).toBeInstanceOf(AbortSignal)
  })

  it('returns a body for an accepted non-2xx status', async () => {
    stubFetch(() => Promise.resolve(jsonResponse({ state: 'down' }, 503)))

    await expect(getJson('health', { ...OPTIONS, acceptedStatuses: [200, 503] })).resolves.toEqual({
      status: 503,
      body: { state: 'down' },
    })
  })

  it('reports a network failure without exposing the underlying error', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch https://localhost:7159 secret-detail')))

    const error = await getJson('health', OPTIONS).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error).toMatchObject({ kind: 'network' })
    expect((error as Error).message).not.toMatch(/secret-detail|localhost|7159/)
  })

  it.each([500, 404, 302, 401])('reports an unexpected HTTP %i status without reading the body', async (status) => {
    stubFetch(() => Promise.resolve(new Response('Internal detail: stack trace', { status })))

    const error = await getJson('health', OPTIONS).catch((caught: unknown) => caught)

    expect(error).toMatchObject({ kind: 'http-status', status })
    expect((error as Error).message).not.toMatch(/Internal detail|stack/)
  })

  it.each(['', 'not json', '<html>Error</html>', '{"status":'])('reports invalid JSON (%j) on HTTP 200', async (body) => {
    stubFetch(() => Promise.resolve(new Response(body, { status: 200 })))

    const error = await getJson('health', OPTIONS).catch((caught: unknown) => caught)

    expect(error).toMatchObject({ kind: 'invalid-response', status: 200 })
    expect((error as Error).message).not.toContain('html')
  })

  it('times out a request that never responds and aborts it', async () => {
    vi.useFakeTimers()
    let requestSignal: AbortSignal | null | undefined
    stubFetch((_url, init) => {
      requestSignal = init?.signal
      return pendingUntilAborted(init)
    })

    const result = getJson('health', { ...OPTIONS, timeoutMs: 1_500 }).catch((caught: unknown) => caught)
    await vi.advanceTimersByTimeAsync(1_499)
    expect(requestSignal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(1)

    await expect(result).resolves.toMatchObject({ kind: 'timeout' })
    expect(requestSignal?.aborted).toBe(true)
  })

  it('applies the timeout while reading the response body', async () => {
    vi.useFakeTimers()
    stubFetch((_url, init) =>
      Promise.resolve({
        status: 200,
        text: () => pendingUntilAborted(init).then(() => ''),
      } as Response),
    )

    const result = getJson('health', { ...OPTIONS, timeoutMs: 1_000 }).catch((caught: unknown) => caught)
    await vi.advanceTimersByTimeAsync(1_000)

    await expect(result).resolves.toMatchObject({ kind: 'timeout' })
  })

  it('rejects with ApiRequestAbortedError when the caller aborts, and clears the timeout', async () => {
    vi.useFakeTimers()
    let requestSignal: AbortSignal | null | undefined
    stubFetch((_url, init) => {
      requestSignal = init?.signal
      return pendingUntilAborted(init)
    })
    const controller = new AbortController()

    const result = getJson('health', { ...OPTIONS, signal: controller.signal }).catch((caught: unknown) => caught)
    controller.abort()

    await expect(result).resolves.toBeInstanceOf(ApiRequestAbortedError)
    expect(requestSignal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not send a request when the signal is already aborted', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse({})))
    const controller = new AbortController()
    controller.abort()

    await expect(getJson('health', { ...OPTIONS, signal: controller.signal })).rejects.toBeInstanceOf(
      ApiRequestAbortedError,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('treats a response that arrives after the caller aborted as cancelled', async () => {
    const controller = new AbortController()
    stubFetch(() => {
      controller.abort()
      return Promise.resolve(jsonResponse({ late: true }))
    })

    await expect(getJson('health', { ...OPTIONS, signal: controller.signal })).rejects.toBeInstanceOf(
      ApiRequestAbortedError,
    )
  })

  it('does not retry a failed request', async () => {
    const fetchMock = stubFetch(() => Promise.reject(new TypeError('Failed to fetch')))

    await getJson('health', OPTIONS).catch(() => undefined)

    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
