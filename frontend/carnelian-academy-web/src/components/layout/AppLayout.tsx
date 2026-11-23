import { useCallback, useEffect, useRef, useState, type FocusEvent, type ReactNode } from 'react'
import { Header } from './Header.tsx'
import { Sidebar } from './Sidebar.tsx'

const NAVIGATION_ID = 'primary-navigation'
const DESKTOP_QUERY = '(min-width: 1024px)'

interface AppLayoutProps {
  sectionTitle: string
  children: ReactNode
}

/**
 * Application shell. On narrow screens the navigation is collapsed by default and opened with the
 * header menu button; Escape, the close button, and the backdrop close it and return focus to the
 * menu button. On wide screens CSS keeps the navigation permanently visible.
 */
export function AppLayout({ sectionTitle, children }: AppLayoutProps) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const dashboardLinkRef = useRef<HTMLAnchorElement>(null)
  const desktopMediaRef = useRef<MediaQueryList | null>(null)
  const breakpointBlurRef = useRef<EventTarget | null>(null)

  const rememberBreakpointBlur = (event: FocusEvent<HTMLElement>) => {
    const isMobileControl = event.target === menuButtonRef.current || event.target === closeButtonRef.current
    const isDashboard = event.target === dashboardLinkRef.current
    const becomesHidden = desktopMediaRef.current?.matches
      ? isMobileControl
      : isDashboard
    // CSS may blur a disappearing control before the media-query change event arrives.
    // Ordinary blur/focus changes must not cause focus recovery on a later resize.
    const navigation = event.target.closest('nav')
    const cssAlreadyHidden = (isMobileControl && getComputedStyle(event.target).display === 'none')
      || (isDashboard && navigation !== null && getComputedStyle(navigation).visibility === 'hidden')
    breakpointBlurRef.current = event.relatedTarget === null && (becomesHidden || cssAlreadyHidden)
      ? event.target
      : null
  }

  const closeNavigation = useCallback(() => {
    setIsNavigationOpen(false)
    if (!desktopMediaRef.current?.matches) {
      menuButtonRef.current?.focus()
    }
  }, [])

  const toggleNavigation = () => {
    if (desktopMediaRef.current?.matches) return
    if (isNavigationOpen) {
      closeNavigation()
    } else {
      setIsNavigationOpen(true)
    }
  }

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY)
    desktopMediaRef.current = media

    const handleLayoutChange = () => {
      const focusedElement = document.activeElement === document.body
        ? breakpointBlurRef.current
        : document.activeElement
      breakpointBlurRef.current = null
      if (media.matches) {
        // Transfer focus before unmounting the mobile close button. Other focus stays put.
        if (focusedElement && (focusedElement === menuButtonRef.current || focusedElement === closeButtonRef.current)) {
          dashboardLinkRef.current?.focus()
        }
        setIsNavigationOpen(false)
      } else if (focusedElement === dashboardLinkRef.current) {
        // The desktop link is now in the collapsed mobile sidebar.
        menuButtonRef.current?.focus()
      }
    }

    media.addEventListener('change', handleLayoutChange)
    return () => {
      media.removeEventListener('change', handleLayoutChange)
      desktopMediaRef.current = null
      breakpointBlurRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!isNavigationOpen) {
      return
    }

    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeNavigation()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isNavigationOpen, closeNavigation])

  return (
    <div
      className="app-shell"
      onFocusCapture={(event) => { breakpointBlurRef.current = event.target }}
      onBlurCapture={rememberBreakpointBlur}
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <Header
        sectionTitle={sectionTitle}
        navigationId={NAVIGATION_ID}
        isNavigationOpen={isNavigationOpen}
        onToggleNavigation={toggleNavigation}
        menuButtonRef={menuButtonRef}
      />
      <div className="app-body">
        <Sidebar
          id={NAVIGATION_ID}
          isOpen={isNavigationOpen}
          onClose={closeNavigation}
          closeButtonRef={closeButtonRef}
          dashboardLinkRef={dashboardLinkRef}
        />
        {isNavigationOpen && <div className="sidebar-backdrop" aria-hidden="true" onClick={closeNavigation} />}
        <main id="main-content" className="app-main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}
