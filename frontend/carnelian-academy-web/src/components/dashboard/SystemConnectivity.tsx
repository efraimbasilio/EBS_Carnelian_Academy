import { type ServiceState, type ServiceStatus, useSystemHealth } from './useSystemHealth.ts'

const STATE_LABELS: Record<ServiceState, string> = {
  checking: 'Checking',
  connected: 'Connected',
  unavailable: 'Unavailable',
  'not-checked': 'Not checked',
  'configuration-error': 'Configuration error',
}

function ServiceRow({ name, status }: { name: string; status: ServiceStatus }) {
  return (
    <div className="connectivity__item">
      <dt className="connectivity__name">{name}</dt>
      <dd className="connectivity__value">
        <span className="status-pill" data-state={status.state}>
          {STATE_LABELS[status.state]}
        </span>
        <span className="connectivity__detail">{status.detail}</span>
      </dd>
    </div>
  )
}

/** Live status of the local API and database, read from the backend health endpoints. */
export function SystemConnectivity() {
  const { health, isChecking, refresh } = useSystemHealth()

  return (
    <section className="connectivity" aria-labelledby="connectivity-heading">
      <div className="connectivity__header">
        <h2 id="connectivity-heading">System connectivity</h2>
        {/* aria-disabled rather than disabled keeps keyboard focus on the button during a check. */}
        <button
          type="button"
          className="button"
          aria-disabled={isChecking}
          onClick={refresh}
        >
          Refresh status
        </button>
      </div>
      <div role="status" aria-busy={isChecking}>
        <dl className="connectivity__list">
          <ServiceRow name="Backend API" status={health.api} />
          <ServiceRow name="Database" status={health.database} />
        </dl>
      </div>
    </section>
  )
}
