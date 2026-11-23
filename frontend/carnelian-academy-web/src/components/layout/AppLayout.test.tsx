import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { AppLayout } from './AppLayout.tsx'
import { mockDesktopMediaQuery } from '../../test/matchMedia.ts'

function renderLayout() {
  const user = userEvent.setup()
  render(
    <AppLayout sectionTitle="Dashboard">
      <p>Page content</p>
      <button type="button">Content action</button>
    </AppLayout>,
  )
  const menuButton = screen.getByRole('button', { name: 'Navigation menu' })
  return { user, menuButton }
}

describe('Mobile navigation menu', () => {
  it('is collapsed by default and controls the navigation', () => {
    const { menuButton } = renderLayout()

    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton).toHaveAttribute('aria-controls', screen.getByRole('navigation', { name: 'Main' }).id)
    expect(screen.queryByRole('button', { name: 'Close navigation menu' })).not.toBeInTheDocument()
  })

  it('opens with the menu button and moves focus to the close button', async () => {
    const { user, menuButton } = renderLayout()

    await user.click(menuButton)

    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Close navigation menu' })).toHaveFocus()
  })

  it('closes with the close button and returns focus to the menu button', async () => {
    const { user, menuButton } = renderLayout()
    await user.click(menuButton)

    await user.click(screen.getByRole('button', { name: 'Close navigation menu' }))

    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Close navigation menu' })).not.toBeInTheDocument()
    expect(menuButton).toHaveFocus()
  })

  it('closes when the menu button is pressed again', async () => {
    const { user, menuButton } = renderLayout()
    await user.click(menuButton)

    await user.click(menuButton)

    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton).toHaveFocus()
  })
})

describe('Menu keyboard interaction', () => {
  it('can be reached with Tab and opened with Enter', async () => {
    const { user, menuButton } = renderLayout()

    await user.tab() // skip link
    await user.tab()
    expect(menuButton).toHaveFocus()

    await user.keyboard('{Enter}')

    expect(menuButton).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'Close navigation menu' })).toHaveFocus()
  })

  it('opens with Space and closes with Escape, returning focus to the menu button', async () => {
    const { user, menuButton } = renderLayout()
    menuButton.focus()

    await user.keyboard(' ')
    expect(menuButton).toHaveAttribute('aria-expanded', 'true')

    await user.keyboard('{Escape}')

    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Close navigation menu' })).not.toBeInTheDocument()
    expect(menuButton).toHaveFocus()
  })

  it('closes with Enter on the focused close button', async () => {
    const { user, menuButton } = renderLayout()
    await user.click(menuButton)

    await user.keyboard('{Enter}')

    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton).toHaveFocus()
  })

  it('moves from the close button to the Dashboard link with Tab', async () => {
    const { user, menuButton } = renderLayout()
    await user.click(menuButton)

    await user.tab()

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveFocus()
  })

  it('ignores Escape while the menu is closed', async () => {
    const { user, menuButton } = renderLayout()
    menuButton.focus()

    await user.keyboard('{Escape}')

    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton).toHaveFocus()
  })
})

describe('Responsive navigation transitions (mocked media-query events, not CSS)', () => {
  it.each(['close', 'toggle'])('recovers focus when CSS blurs the %s button before the media event', async (target) => {
    const viewport = mockDesktopMediaQuery()
    const { user, menuButton } = renderLayout()
    await user.click(menuButton)
    const button = target === 'close'
      ? screen.getByRole('button', { name: 'Close navigation menu' })
      : menuButton
    button.focus()

    act(() => viewport.setDesktop(true, () => button.blur()))

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveFocus()
  })

  it('recovers focus when CSS blurs Dashboard before the mobile media event', () => {
    const viewport = mockDesktopMediaQuery(true)
    const { menuButton } = renderLayout()
    const dashboard = screen.getByRole('link', { name: 'Dashboard' })
    dashboard.focus()

    act(() => viewport.setDesktop(false, () => dashboard.blur()))

    expect(menuButton).toHaveFocus()
  })

  it('does not recover a toggle focus that was deliberately cleared before resizing', () => {
    const viewport = mockDesktopMediaQuery()
    const { menuButton } = renderLayout()
    menuButton.focus()
    menuButton.blur()

    act(() => viewport.setDesktop(true))

    expect(document.body).toHaveFocus()
  })

  it('removes its media-query change listener on unmount', () => {
    const viewport = mockDesktopMediaQuery()
    const view = render(<AppLayout sectionTitle="Dashboard">Page content</AppLayout>)
    const listener = viewport.addEventListener.mock.calls[0][1]

    view.unmount()

    expect(viewport.removeEventListener).toHaveBeenCalledWith('change', listener)
  })
  it('closes an open mobile menu on desktop and removes its backdrop', async () => {
    const viewport = mockDesktopMediaQuery()
    const { user, menuButton } = renderLayout()
    await user.click(menuButton)

    act(() => viewport.setDesktop(true))

    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: 'Close navigation menu' })).not.toBeInTheDocument()
    expect(document.querySelector('.sidebar-backdrop')).not.toBeInTheDocument()
  })

  it('moves focus from the mobile close button to Dashboard on desktop', async () => {
    const viewport = mockDesktopMediaQuery()
    const { user, menuButton } = renderLayout()
    await user.click(menuButton)
    expect(screen.getByRole('button', { name: 'Close navigation menu' })).toHaveFocus()

    act(() => viewport.setDesktop(true))

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveFocus()
  })

  it('moves focus from the mobile toggle to Dashboard even when the menu is closed', () => {
    const viewport = mockDesktopMediaQuery()
    const { menuButton } = renderLayout()
    menuButton.focus()

    act(() => viewport.setDesktop(true))

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveFocus()
  })

  it('preserves focus on the still-visible Dashboard link when switching to desktop', async () => {
    const viewport = mockDesktopMediaQuery()
    const { user, menuButton } = renderLayout()
    await user.click(menuButton)
    const dashboard = screen.getByRole('link', { name: 'Dashboard' })
    dashboard.focus()

    act(() => viewport.setDesktop(true))

    expect(dashboard).toHaveFocus()
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('preserves focus on unrelated visible content across both transitions', () => {
    const viewport = mockDesktopMediaQuery()
    renderLayout()
    const action = screen.getByRole('button', { name: 'Content action' })
    action.focus()

    act(() => viewport.setDesktop(true))
    expect(action).toHaveFocus()
    act(() => viewport.setDesktop(false))
    expect(action).toHaveFocus()
  })

  it('does not move focus on initial desktop mount', () => {
    mockDesktopMediaQuery(true)
    renderLayout()

    expect(document.body).toHaveFocus()
  })

  it('returns to mobile closed and moves focus out of the newly hidden Dashboard link', async () => {
    const viewport = mockDesktopMediaQuery()
    const { user, menuButton } = renderLayout()
    await user.click(menuButton)
    act(() => viewport.setDesktop(true))
    screen.getByRole('link', { name: 'Dashboard' }).focus()

    act(() => viewport.setDesktop(false))

    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
    expect(menuButton).toHaveFocus()
    expect(document.querySelector('.sidebar-backdrop')).not.toBeInTheDocument()
  })

  it('does not redirect desktop Escape to the hidden toggle after an open-menu transition', async () => {
    const viewport = mockDesktopMediaQuery()
    const { user, menuButton } = renderLayout()
    await user.click(menuButton)
    act(() => viewport.setDesktop(true))
    const dashboard = screen.getByRole('link', { name: 'Dashboard' })
    dashboard.focus()

    await user.keyboard('{Escape}')

    expect(dashboard).toHaveFocus()
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('restores normal mobile Escape behavior after a round trip through desktop', async () => {
    const viewport = mockDesktopMediaQuery()
    const { user, menuButton } = renderLayout()
    await user.click(menuButton)
    await user.keyboard('{Escape}')
    expect(menuButton).toHaveFocus()
    act(() => viewport.setDesktop(true))
    act(() => viewport.setDesktop(false))

    await user.click(menuButton)
    await user.keyboard('{Escape}')

    expect(menuButton).toHaveFocus()
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('does not focus the hidden toggle when Dashboard is activated on desktop', async () => {
    const viewport = mockDesktopMediaQuery()
    const { user, menuButton } = renderLayout()
    await user.click(menuButton)
    act(() => viewport.setDesktop(true))
    const dashboard = screen.getByRole('link', { name: 'Dashboard' })
    // Keep this test in jsdom rather than navigating away from the test document.
    dashboard.addEventListener('click', (event) => event.preventDefault())

    await user.click(dashboard)

    expect(dashboard).toHaveFocus()
  })
})
