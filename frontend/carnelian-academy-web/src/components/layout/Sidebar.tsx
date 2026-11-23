import type { Ref } from 'react'

/** Sections planned for later milestones. They are listed but intentionally not links. */
const COMING_SOON_SECTIONS = ['Students', 'Enrollment', 'Billing & Payments', 'Reports', 'Settings']

interface SidebarProps {
  id: string
  isOpen: boolean
  onClose: () => void
  closeButtonRef: Ref<HTMLButtonElement>
  dashboardLinkRef: Ref<HTMLAnchorElement>
}

export function Sidebar({ id, isOpen, onClose, closeButtonRef, dashboardLinkRef }: SidebarProps) {
  return (
    <nav id={id} className="sidebar" data-open={isOpen} aria-label="Main">
      {isOpen && (
        <button ref={closeButtonRef} type="button" className="sidebar__close" onClick={onClose}>
          Close navigation menu
        </button>
      )}
      <ul className="nav-list">
        <li>
          <a ref={dashboardLinkRef} className="nav-link" href="/" aria-current="page" onClick={isOpen ? onClose : undefined}>
            Dashboard
          </a>
        </li>
        {COMING_SOON_SECTIONS.map((label) => (
          <li key={label}>
            <span className="nav-item--unavailable">
              <span>{label}</span>
              <span className="visually-hidden">, </span>
              <span className="nav-badge">Coming soon</span>
            </span>
          </li>
        ))}
      </ul>
    </nav>
  )
}
