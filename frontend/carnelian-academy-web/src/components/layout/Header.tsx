import type { Ref } from 'react'

interface HeaderProps {
  sectionTitle: string
  navigationId: string
  isNavigationOpen: boolean
  onToggleNavigation: () => void
  menuButtonRef: Ref<HTMLButtonElement>
}

export function Header({
  sectionTitle,
  navigationId,
  isNavigationOpen,
  onToggleNavigation,
  menuButtonRef,
}: HeaderProps) {
  return (
    <header className="app-header">
      <button
        ref={menuButtonRef}
        type="button"
        className="menu-toggle"
        aria-label="Navigation menu"
        aria-controls={navigationId}
        aria-expanded={isNavigationOpen}
        onClick={onToggleNavigation}
      >
        <span className="menu-toggle__icon" aria-hidden="true" />
      </button>

      <div className="brand">
        <span className="brand__mark" aria-hidden="true">
          CA
        </span>
        <div className="brand__text">
          <p className="brand__name">Carnelian Academy</p>
          <p className="brand__subtitle">Enrollment &amp; Billing Management System</p>
        </div>
      </div>

      <p className="app-header__section">
        <span className="visually-hidden">Current section: </span>
        {sectionTitle}
      </p>
    </header>
  )
}
