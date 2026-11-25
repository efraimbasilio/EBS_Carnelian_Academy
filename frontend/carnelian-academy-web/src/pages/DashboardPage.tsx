import { SystemConnectivity } from '../components/dashboard/SystemConnectivity.tsx'

const PLANNED_MODULES = [
  { title: 'Students', description: 'Student information records.' },
  { title: 'Enrollments', description: 'Enrollment management.' },
  { title: 'Payments', description: 'Billing and payment tracking.' },
]

export function DashboardPage() {
  return (
    <div className="dashboard">
      <p className="preview-badge">Development Preview</p>
      <h1 className="dashboard__title">Welcome to Carnelian Academy</h1>
      <p className="dashboard__subtitle">Enrollment &amp; Billing Management System</p>
      <p className="dashboard__intro">
        This system is under development. This preview shows the application layout and the live
        connectivity status of the local API and database. It displays no student or financial data,
        and the modules below are not yet available.
      </p>

      <SystemConnectivity />

      <section className="planned-modules" aria-labelledby="planned-modules-heading">
        <h2 id="planned-modules-heading">Planned modules</h2>
        <ul className="placeholder-grid">
          {PLANNED_MODULES.map(({ title, description }) => (
            <li key={title} className="placeholder-card">
              <h3 className="placeholder-card__title">{title}</h3>
              <p className="placeholder-card__description">{description}</p>
              <p className="placeholder-card__status">Not yet available</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
