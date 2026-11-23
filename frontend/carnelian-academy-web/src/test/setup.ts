import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import { mockDesktopMediaQuery } from './matchMedia.ts'

beforeEach(() => {
  mockDesktopMediaQuery()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
