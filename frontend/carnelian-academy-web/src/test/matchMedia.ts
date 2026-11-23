import { vi } from 'vitest'

/** Controls media-query events only; jsdom does not evaluate CSS breakpoints. */
export function mockDesktopMediaQuery(initialMatches = false) {
  const target = new EventTarget()
  const query = {
    media: '(min-width: 1024px)',
    matches: initialMatches,
    addEventListener: vi.fn(target.addEventListener.bind(target)),
    removeEventListener: vi.fn(target.removeEventListener.bind(target)),
  }
  vi.stubGlobal('matchMedia', vi.fn((media: string) => {
    if (media !== query.media) throw new Error(`Unexpected media query in test: ${media}`)
    return query
  }))

  return {
    addEventListener: query.addEventListener,
    removeEventListener: query.removeEventListener,
    setDesktop(matches: boolean, beforeChange?: () => void) {
      if (query.matches === matches) return
      query.matches = matches
      beforeChange?.()
      target.dispatchEvent(Object.assign(new Event('change'), { matches, media: query.media }))
    },
  }
}
