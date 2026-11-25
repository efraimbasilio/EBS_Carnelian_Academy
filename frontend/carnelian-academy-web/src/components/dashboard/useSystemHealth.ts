import { useCallback, useEffect, useRef, useState } from 'react'
import { getApiHealth, getDatabaseHealth } from '../../api/health.ts'
import { ApiRequestError, isAbortError } from '../../api/http.ts'
import { ConfigurationError, getApiBaseUrl, getApiTimeoutMs } from '../../config/env.ts'

export type ServiceState = 'checking' | 'connected' | 'unavailable' | 'not-checked' | 'configuration-error'

export interface ServiceStatus {
  state: ServiceState
  /** Fixed, user-facing explanation. Never contains exception text, URLs, or response bodies. */
  detail: string
}

export interface SystemHealth {
  api: ServiceStatus
  database: ServiceStatus
}

export const CHECKING_HEALTH: SystemHealth = {
  api: { state: 'checking', detail: 'Contacting the API…' },
  database: { state: 'checking', detail: 'Waiting for the API…' },
}

function describeFailure(error: unknown, timeoutMs: number): string {
  if (error instanceof ApiRequestError) {
    switch (error.kind) {
      case 'network':
        return 'could not be reached. Check that the API is running and that its development HTTPS certificate is trusted.'
      case 'timeout':
        return `did not respond within ${timeoutMs / 1000} seconds.`
      case 'http-status':
        return `returned an unexpected response (HTTP ${error.status ?? 'unknown'}).`
      case 'invalid-response':
        return 'returned a response in an unexpected format.'
    }
  }
  return 'could not be checked because of an unexpected error.'
}

/**
 * Checks the API first and the database only through a reachable API. The database is reported
 * Unavailable only by the API's own verdict or a failed database check after the API answered;
 * when the API is unreachable the database is "Not checked", never inferred.
 * Rejects only with ApiRequestAbortedError when `signal` is aborted.
 */
export async function checkSystemHealth(signal: AbortSignal): Promise<SystemHealth> {
  let baseUrl: string
  let timeoutMs: number
  try {
    baseUrl = getApiBaseUrl()
    timeoutMs = getApiTimeoutMs()
  } catch (error) {
    if (!(error instanceof ConfigurationError)) throw error
    return {
      api: { state: 'configuration-error', detail: error.message },
      database: { state: 'not-checked', detail: 'Not checked until the API address is configured.' },
    }
  }

  const options = { baseUrl, timeoutMs, signal }
  try {
    await getApiHealth(options)
  } catch (error) {
    if (isAbortError(error)) throw error
    return {
      api: { state: 'unavailable', detail: `The API ${describeFailure(error, timeoutMs)}` },
      database: { state: 'not-checked', detail: 'Not checked because the API is unavailable.' },
    }
  }

  const api: ServiceStatus = { state: 'connected', detail: 'The API responded.' }
  try {
    const database = await getDatabaseHealth(options)
    return database.database === 'Connected'
      ? { api, database: { state: 'connected', detail: 'The API reports that the database is connected.' } }
      : { api, database: { state: 'unavailable', detail: 'The API reports that the database is unavailable.' } }
  } catch (error) {
    if (isAbortError(error)) throw error
    return {
      api,
      database: { state: 'unavailable', detail: `The database status check ${describeFailure(error, timeoutMs)}` },
    }
  }
}

/**
 * Runs the connectivity check on mount and on demand. Only one check runs at a time: refresh is
 * ignored while a check is in flight, results from a superseded check are discarded, and the
 * in-flight check is aborted on unmount. There is no polling or automatic retry.
 */
export function useSystemHealth() {
  const [health, setHealth] = useState<SystemHealth>(CHECKING_HEALTH)
  const activeCheck = useRef<AbortController | null>(null)

  const startCheck = useCallback((): boolean => {
    if (activeCheck.current) return false

    const controller = new AbortController()
    activeCheck.current = controller
    const settle = (result: SystemHealth) => {
      if (activeCheck.current !== controller) return // superseded or unmounted
      activeCheck.current = null
      setHealth(result)
    }
    checkSystemHealth(controller.signal).then(settle, (error: unknown) => {
      if (isAbortError(error)) return
      settle({
        api: { state: 'unavailable', detail: 'The connectivity check failed unexpectedly.' },
        database: { state: 'not-checked', detail: 'Not checked because the connectivity check failed.' },
      })
    })
    return true
  }, [])

  useEffect(() => {
    startCheck()
    return () => {
      activeCheck.current?.abort()
      activeCheck.current = null
    }
  }, [startCheck])

  const refresh = useCallback(() => {
    if (startCheck()) setHealth(CHECKING_HEALTH)
  }, [startCheck])

  return { health, isChecking: health.api.state === 'checking', refresh }
}
