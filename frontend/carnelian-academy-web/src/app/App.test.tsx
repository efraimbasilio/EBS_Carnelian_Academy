import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App.tsx'

const NAVIGATION_LABELS = ['Dashboard', 'Students', 'Enrollment', 'Billing & Payments', 'Reports', 'Settings']
const UNAVAILABLE_LABELS = NAVIGATION_LABELS.slice(1)

describe('App shell', () => {
  it('renders the header, navigation, and main landmarks', () => {
    render(<App />)

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main-content')
  })

  it('displays Carnelian Academy branding in the header', () => {
    render(<App />)

    const header = screen.getByRole('banner')
    expect(within(header).getByText('Carnelian Academy')).toBeInTheDocument()
    expect(within(header).getByText('Enrollment & Billing Management System')).toBeInTheDocument()
    expect(within(header).getByText('Dashboard')).toBeInTheDocument()
  })

  it('does not display a signed-in user or role', () => {
    render(<App />)

    expect(screen.queryByText(/sign(ed)? in|log ?out|administrator|admin/i)).not.toBeInTheDocument()
  })
})

describe('Dashboard page', () => {
  it('shows the welcome heading and the Development Preview label', () => {
    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome to Carnelian Academy' })).toBeInTheDocument()
    expect(screen.getByText('Development Preview')).toBeVisible()
    expect(screen.getByText(/this system is under development/i)).toBeInTheDocument()
  })

  it('shows module placeholders without statistics or live data', () => {
    render(<App />)

    const modules = screen.getByRole('region', { name: 'Planned modules' })
    for (const title of ['Students', 'Enrollments', 'Payments']) {
      expect(within(modules).getByRole('heading', { level: 3, name: title })).toBeInTheDocument()
    }
    expect(within(modules).getAllByText('Not yet available')).toHaveLength(3)
    expect(modules).not.toHaveTextContent(/\d/)
  })
})

describe('Navigation', () => {
  it('lists every navigation label', () => {
    render(<App />)

    const navigation = screen.getByRole('navigation', { name: 'Main' })
    for (const label of NAVIGATION_LABELS) {
      expect(within(navigation).getByText(label)).toBeInTheDocument()
    }
  })

  it('links only to the implemented Dashboard page and marks it as current', () => {
    render(<App />)

    const navigation = screen.getByRole('navigation', { name: 'Main' })
    const links = within(navigation).getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAccessibleName('Dashboard')
    expect(links[0]).toHaveAttribute('href', '/')
    expect(links[0]).toHaveAttribute('aria-current', 'page')
  })

  it('marks unimplemented sections as coming soon instead of linking to them', () => {
    render(<App />)

    const navigation = screen.getByRole('navigation', { name: 'Main' })
    for (const label of UNAVAILABLE_LABELS) {
      expect(within(navigation).queryByRole('link', { name: new RegExp(label) })).not.toBeInTheDocument()
      expect(within(navigation).queryByRole('button', { name: new RegExp(label) })).not.toBeInTheDocument()
      const item = within(navigation).getByText(label).closest('li')
      expect(item).toHaveTextContent(`${label}, Coming soon`)
    }
    expect(within(navigation).getAllByText('Coming soon')).toHaveLength(UNAVAILABLE_LABELS.length)
  })
})
