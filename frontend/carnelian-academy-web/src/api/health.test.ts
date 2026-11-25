import { describe, expect, it, vi } from 'vitest'
import { ConfigurationError } from '../config/env.ts'
import {
  DATABASE_CONNECTED,
  DATABASE_UNAVAILABLE,
  HEALTHY_API,
  jsonResponse,
  stubFetch,
  TEST_API_BASE_URL,
} from '../test/fetch.ts'
import { getApiHealth, getDatabaseHealth, parseApiHealth, parseDatabaseHealth } from './health.ts'
import { ApiRequestError } from './http.ts'

describe('GET /health client', () => {
  it('returns the validated backend health contract', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(HEALTHY_API)))

    await expect(getApiHealth()).resolves.toEqual(HEALTHY_API)
    expect(fetchMock.mock.calls[0][0]).toBe(`${TEST_API_BASE_URL}/health`)
  })

  it('uses a configured base path', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://localhost:7159/carnelian/')
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(HEALTHY_API)))

    await getApiHealth()

    expect(fetchMock.mock.calls[0][0]).toBe('https://localhost:7159/carnelian/health')
  })

  it('rejects with ConfigurationError and sends nothing when the base URL is invalid', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'localhost:7159')
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(HEALTHY_API)))

    await expect(getApiHealth()).rejects.toBeInstanceOf(ConfigurationError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects with ConfigurationError when the timeout is invalid', async () => {
    vi.stubEnv('VITE_API_TIMEOUT_MS', 'soon')
    stubFetch(() => Promise.resolve(jsonResponse(HEALTHY_API)))

    await expect(getApiHealth()).rejects.toBeInstanceOf(ConfigurationError)
  })

  it('treats HTTP 503 from /health as an unexpected status', async () => {
    stubFetch(() => Promise.resolve(jsonResponse(HEALTHY_API, 503)))

    await expect(getApiHealth()).rejects.toMatchObject({ kind: 'http-status', status: 503 })
  })

  it.each([
    ['an empty object', {}],
    ['an array', [HEALTHY_API]],
    ['null', null],
    ['a string', 'Healthy'],
    ['an unhealthy status', { status: 'Unhealthy', application: 'Carnelian Academy API' }],
    ['another application', { status: 'Healthy', application: 'Other Service' }],
    ['different casing', { Status: 'Healthy', Application: 'Carnelian Academy API' }],
  ])('rejects an HTTP 200 body with %s as an invalid response', async (_label, body) => {
    stubFetch(() => Promise.resolve(jsonResponse(body)))

    await expect(getApiHealth()).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('tolerates additional properties', () => {
    expect(parseApiHealth({ ...HEALTHY_API, version: '1' })).toEqual(HEALTHY_API)
  })
})

describe('GET /health/database client', () => {
  it('returns Connected for the HTTP 200 contract', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(jsonResponse(DATABASE_CONNECTED)))

    await expect(getDatabaseHealth()).resolves.toEqual(DATABASE_CONNECTED)
    expect(fetchMock.mock.calls[0][0]).toBe(`${TEST_API_BASE_URL}/health/database`)
  })

  it('resolves Unavailable for the HTTP 503 contract', async () => {
    stubFetch(() => Promise.resolve(jsonResponse(DATABASE_UNAVAILABLE, 503)))

    await expect(getDatabaseHealth()).resolves.toEqual(DATABASE_UNAVAILABLE)
  })

  it.each([
    ['HTTP 200 with the unavailable body', 200, DATABASE_UNAVAILABLE],
    ['HTTP 503 with the connected body', 503, DATABASE_CONNECTED],
    ['HTTP 503 with an empty object', 503, {}],
    ['HTTP 200 with an unexpected database value', 200, { status: 'Healthy', database: 'Maybe' }],
  ])('rejects %s as an invalid response', async (_label, status, body) => {
    stubFetch(() => Promise.resolve(jsonResponse(body, status)))

    await expect(getDatabaseHealth()).rejects.toMatchObject({ kind: 'invalid-response', status })
  })

  it('rejects a non-JSON HTTP 503 body as an invalid response', async () => {
    stubFetch(() => Promise.resolve(new Response('<html>Service Unavailable</html>', { status: 503 })))

    await expect(getDatabaseHealth()).rejects.toMatchObject({ kind: 'invalid-response', status: 503 })
  })

  it.each([500, 502, 404])('rejects HTTP %i as an unexpected status', async (status) => {
    stubFetch(() => Promise.resolve(jsonResponse(DATABASE_UNAVAILABLE, status)))

    await expect(getDatabaseHealth()).rejects.toMatchObject({ kind: 'http-status', status })
  })

  it('reports an unreachable API as a network failure', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')))

    const error = await getDatabaseHealth().catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiRequestError)
    expect(error).toMatchObject({ kind: 'network' })
  })

  it('validates the status and body together', () => {
    expect(parseDatabaseHealth(200, { ...DATABASE_CONNECTED, extra: true })).toEqual(DATABASE_CONNECTED)
    expect(() => parseDatabaseHealth(204, DATABASE_CONNECTED)).toThrow(ApiRequestError)
  })
})
