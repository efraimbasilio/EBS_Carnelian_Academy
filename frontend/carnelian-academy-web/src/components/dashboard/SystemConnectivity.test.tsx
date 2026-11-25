import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DashboardPage } from '../../pages/DashboardPage.tsx'
import {
  DATABASE_CONNECTED,
  DATABASE_UNAVAILABLE,
  deferred,
  HEALTHY_API,
  jsonResponse,
  pendingUntilAborted,
  stubFetch,
  stubHealthEndpoints,
  TEST_API_BASE_URL,
} from '../../test/fetch.ts'
import { SystemConnectivity } from './SystemConnectivity.tsx'

const connected = () => Promise.resolve(jsonResponse(HEALTHY_API))
const databaseConnected = () => Promise.resolve(jsonResponse(DATABASE_CONNECTED))
const databaseUnavailable = () => Promise.resolve(jsonResponse(DATABASE_UNAVAILABLE, 503))
const unreachable = () => Promise.reject(new TypeError('Failed to fetch https://localhost:7159/health ERR_CERT_AUTHORITY_INVALID'))

function statusRegion() {
  return screen.getByRole('status')
}

/** Returns the status label and detail shown for one service. */
function serviceStatus(name: 'Backend API' | 'Database') {
  const term = within(statusRegion()).getByText(name, { selector: 'dt' })
  const value = term.nextElementSibling as HTMLElement
  return {
    label: value.querySelector('.status-pill')?.textContent,
    text: value.textContent,
  }
}

async function waitForStatus(name: 'Backend API' | 'Database', label: string) {
  await waitFor(() => expect(serviceStatus(name).label).toBe(label))
}

function refreshButton() {
  return screen.getByRole('button', { name: 'Refresh status' })
}

describe('System connectivity', () => {
  it('shows a checking state for both services while requests are pending', () => {
    stubFetch((_url, init) => pendingUntilAborted(init))
    render(<SystemConnectivity />)

    expect(screen.getByRole('heading', { level: 2, name: 'System connectivity' })).toBeInTheDocument()
    expect(serviceStatus('Backend API').label).toBe('Checking')
    expect(serviceStatus('Database').label).toBe('Checking')
    expect(statusRegion()).toHaveAttribute('aria-busy', 'true')
    expect(refreshButton()).toHaveAttribute('aria-disabled', 'true')
  })

  it('shows both services connected', async () => {
    const fetchMock = stubHealthEndpoints({ api: connected, database: databaseConnected })
    render(<SystemConnectivity />)

    await waitForStatus('Database', 'Connected')
    expect(serviceStatus('Backend API').label).toBe('Connected')
    expect(serviceStatus('Database').text).toContain('The API reports that the database is connected.')
    expect(statusRegion()).toHaveAttribute('aria-busy', 'false')
    expect(refreshButton()).toHaveAttribute('aria-disabled', 'false')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shows the API connected and the database unavailable for the HTTP 503 contract', async () => {
    stubHealthEndpoints({ api: connected, database: databaseUnavailable })
    render(<SystemConnectivity />)

    await waitForStatus('Database', 'Unavailable')
    expect(serviceStatus('Backend API').label).toBe('Connected')
    expect(serviceStatus('Database').text).toContain('The API reports that the database is unavailable.')
  })

  it('shows the API unavailable and does not check or infer the database when the API is unreachable', async () => {
    const fetchMock = stubHealthEndpoints({ api: unreachable, database: databaseConnected })
    render(<SystemConnectivity />)

    await waitForStatus('Backend API', 'Unavailable')
    expect(serviceStatus('Backend API').text).toContain('could not be reached')
    expect(serviceStatus('Database').label).toBe('Not checked')
    expect(serviceStatus('Database').text).toContain('Not checked because the API is unavailable.')
    expect(fetchMock).toHaveBeenCalledOnce()
    // The raw browser error is never shown.
    expect(statusRegion()).not.toHaveTextContent(/ERR_CERT|Failed to fetch|localhost/)
  })

  it.each([
    ['HTTP 500', () => Promise.resolve(new Response('Server error details', { status: 500 })), 'unexpected response (HTTP 500)'],
    ['invalid JSON', () => Promise.resolve(new Response('<html>Proxy</html>', { status: 200 })), 'unexpected format'],
    ['an unexpected shape', () => Promise.resolve(jsonResponse({ status: 'Healthy' })), 'unexpected format'],
  ])('shows the API unavailable for %s without leaking the response', async (_label, api, message) => {
    stubHealthEndpoints({ api, database: databaseConnected })
    render(<SystemConnectivity />)

    await waitForStatus('Backend API', 'Unavailable')
    expect(serviceStatus('Backend API').text).toContain(message)
    expect(serviceStatus('Database').label).toBe('Not checked')
    expect(statusRegion()).not.toHaveTextContent(/Server error details|Proxy/)
  })

  it('shows the database unavailable when its check fails after the API responded', async () => {
    stubHealthEndpoints({ api: connected, database: () => Promise.resolve(new Response('', { status: 502 })) })
    render(<SystemConnectivity />)

    await waitForStatus('Database', 'Unavailable')
    expect(serviceStatus('Backend API').label).toBe('Connected')
    expect(serviceStatus('Database').text).toContain('The database status check returned an unexpected response (HTTP 502).')
  })

  it('shows a configuration error and sends no request when VITE_API_BASE_URL is missing', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    const fetchMock = stubFetch(connected)
    render(<SystemConnectivity />)

    await waitForStatus('Backend API', 'Configuration error')
    expect(serviceStatus('Backend API').text).toContain('VITE_API_BASE_URL is not set')
    expect(serviceStatus('Database').label).toBe('Not checked')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows a timeout as unavailable', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.stubEnv('VITE_API_TIMEOUT_MS', '2000')
    stubFetch((_url, init) => pendingUntilAborted(init))
    render(<SystemConnectivity />)

    await vi.advanceTimersByTimeAsync(2_000)

    await waitForStatus('Backend API', 'Unavailable')
    expect(serviceStatus('Backend API').text).toContain('did not respond within 2 seconds')
    expect(serviceStatus('Database').label).toBe('Not checked')
  })

  it('refreshes on demand and recovers the current statuses', async () => {
    const user = userEvent.setup()
    let apiUp = false
    const fetchMock = stubHealthEndpoints({
      api: () => (apiUp ? connected() : unreachable()),
      database: databaseConnected,
    })
    render(<SystemConnectivity />)
    await waitForStatus('Backend API', 'Unavailable')

    apiUp = true
    await user.click(refreshButton())

    await waitForStatus('Database', 'Connected')
    expect(serviceStatus('Backend API').label).toBe('Connected')
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(refreshButton()).toHaveFocus()
  })

  it('shows the checking state again during a refresh', async () => {
    const user = userEvent.setup()
    const second = deferred<Response>()
    let calls = 0
    stubHealthEndpoints({
      api: () => (++calls === 1 ? connected() : second.promise),
      database: databaseConnected,
    })
    render(<SystemConnectivity />)
    await waitForStatus('Database', 'Connected')

    await user.click(refreshButton())

    expect(serviceStatus('Backend API').label).toBe('Checking')
    expect(serviceStatus('Database').label).toBe('Checking')
    second.resolve(jsonResponse(HEALTHY_API))
    await waitForStatus('Database', 'Connected')
  })

  it('ignores rapid repeated refreshes while a check is in flight', async () => {
    const user = userEvent.setup()
    const pending: ReturnType<typeof deferred<Response>>[] = []
    const fetchMock = stubHealthEndpoints({
      api: () => {
        const next = deferred<Response>()
        pending.push(next)
        return next.promise
      },
      database: databaseConnected,
    })
    render(<SystemConnectivity />)

    await user.click(refreshButton())
    await user.click(refreshButton())
    refreshButton().focus()
    await user.keyboard('{Enter}')

    expect(pending).toHaveLength(1)
    pending[0].resolve(jsonResponse(HEALTHY_API))
    await waitForStatus('Database', 'Connected')

    await user.click(refreshButton())
    await user.click(refreshButton())
    expect(pending).toHaveLength(2)
    pending[1].resolve(jsonResponse(HEALTHY_API))
    await waitForStatus('Database', 'Connected')
    expect(fetchMock.mock.calls.filter(([input]) => input === `${TEST_API_BASE_URL}/health`)).toHaveLength(2)
  })

  it('discards a superseded check whose response arrives late', async () => {
    // StrictMode mounts, unmounts, and remounts: the first check is aborted and superseded.
    // This stub ignores abort signals so the first response still arrives, after the second.
    const responses = [deferred<Response>(), deferred<Response>()]
    let call = 0
    stubHealthEndpoints({ api: () => responses[call++].promise, database: databaseConnected })
    render(
      <StrictMode>
        <SystemConnectivity />
      </StrictMode>,
    )
    expect(call).toBe(2)

    responses[1].resolve(jsonResponse(HEALTHY_API))
    await waitForStatus('Database', 'Connected')
    responses[0].resolve(new Response('', { status: 500 }))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(serviceStatus('Backend API').label).toBe('Connected')
    expect(serviceStatus('Database').label).toBe('Connected')
  })

  it('aborts the in-flight request on unmount without updating state', async () => {
    const consoleError = vi.spyOn(console, 'error')
    const signals: (AbortSignal | null | undefined)[] = []
    stubFetch((_url, init) => {
      signals.push(init?.signal)
      return pendingUntilAborted(init)
    })
    const view = render(<SystemConnectivity />)
    expect(signals).toHaveLength(1)
    expect(signals[0]?.aborted).toBe(false)

    view.unmount()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(signals[0]?.aborted).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('exposes statuses as text in a polite live region and keeps the button keyboard operable', async () => {
    const user = userEvent.setup()
    const fetchMock = stubHealthEndpoints({ api: connected, database: databaseUnavailable })
    render(<SystemConnectivity />)
    await waitForStatus('Database', 'Unavailable')

    const region = statusRegion()
    expect(region).toHaveTextContent('Backend API')
    expect(region).toHaveTextContent('Connected')
    expect(region).toHaveTextContent('Database')
    expect(region).toHaveTextContent('Unavailable')
    expect(within(region).getAllByRole('term').map((term) => term.textContent)).toEqual(['Backend API', 'Database'])

    await user.tab()
    expect(refreshButton()).toHaveFocus()
    await user.keyboard('{Enter}')
    await waitForStatus('Database', 'Unavailable')
    await user.keyboard(' ')
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(6))
    expect(refreshButton()).toHaveFocus()
    expect(refreshButton()).not.toBeDisabled()
  })
})

describe('Dashboard page integration', () => {
  it('fetches live connectivity on load and shows no invented statistics', async () => {
    stubHealthEndpoints({ api: connected, database: databaseConnected })
    render(<DashboardPage />)

    expect(screen.getByText('Development Preview')).toBeInTheDocument()
    await waitForStatus('Database', 'Connected')
    const section = screen.getByRole('region', { name: 'System connectivity' })
    expect(section).not.toHaveTextContent(/\d/)
    expect(screen.getByRole('region', { name: 'Planned modules' })).toBeInTheDocument()
  })
})
