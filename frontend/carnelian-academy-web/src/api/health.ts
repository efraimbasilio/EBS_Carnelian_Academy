/**
 * Typed clients and runtime contract validation for the backend health endpoints.
 * The contracts mirror backend/CarnelianAcademy.Api/Controllers/HealthController.cs and must not drift.
 */
import { getApiBaseUrl, getApiTimeoutMs } from '../config/env.ts'
import { ApiRequestError, getJson } from './http.ts'

/** GET /health, HTTP 200. */
export interface ApiHealthResponse {
  status: 'Healthy'
  application: typeof API_APPLICATION_NAME
}

/** GET /health/database: HTTP 200 when connected, HTTP 503 when unavailable. */
export type DatabaseHealthResponse =
  | { status: 'Healthy'; database: 'Connected' }
  | { status: 'Unhealthy'; database: 'Unavailable' }

export const API_APPLICATION_NAME = 'Carnelian Academy API'

export interface HealthRequestOptions {
  signal?: AbortSignal
  /** Defaults to the validated VITE_API_BASE_URL. */
  baseUrl?: string
  /** Defaults to the validated VITE_API_TIMEOUT_MS or its default. */
  timeoutMs?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalidResponse(status: number): ApiRequestError {
  return new ApiRequestError('invalid-response', 'The server response did not match the expected contract.', status)
}

/** Validates the /health body. Additional properties are tolerated; required values must match exactly. */
export function parseApiHealth(body: unknown, status = 200): ApiHealthResponse {
  if (isRecord(body) && body.status === 'Healthy' && body.application === API_APPLICATION_NAME) {
    return { status: 'Healthy', application: API_APPLICATION_NAME }
  }
  throw invalidResponse(status)
}

/** Validates the /health/database body for its status code: 200 must be Connected, 503 must be Unavailable. */
export function parseDatabaseHealth(status: number, body: unknown): DatabaseHealthResponse {
  if (isRecord(body)) {
    if (status === 200 && body.status === 'Healthy' && body.database === 'Connected') {
      return { status: 'Healthy', database: 'Connected' }
    }
    if (status === 503 && body.status === 'Unhealthy' && body.database === 'Unavailable') {
      return { status: 'Unhealthy', database: 'Unavailable' }
    }
  }
  throw invalidResponse(status)
}

function resolveOptions(options: HealthRequestOptions) {
  return {
    baseUrl: options.baseUrl ?? getApiBaseUrl(),
    timeoutMs: options.timeoutMs ?? getApiTimeoutMs(),
    signal: options.signal,
  }
}

/**
 * Calls GET /health. Rejects with ConfigurationError, ApiRequestError, or ApiRequestAbortedError.
 */
export async function getApiHealth(options: HealthRequestOptions = {}): Promise<ApiHealthResponse> {
  const { status, body } = await getJson('health', { ...resolveOptions(options), acceptedStatuses: [200] })
  return parseApiHealth(body, status)
}

/**
 * Calls GET /health/database. A valid HTTP 503 contract resolves as Unavailable rather than rejecting,
 * because it is the API's verified report about the database.
 */
export async function getDatabaseHealth(options: HealthRequestOptions = {}): Promise<DatabaseHealthResponse> {
  const { status, body } = await getJson('health/database', { ...resolveOptions(options), acceptedStatuses: [200, 503] })
  return parseDatabaseHealth(status, body)
}
