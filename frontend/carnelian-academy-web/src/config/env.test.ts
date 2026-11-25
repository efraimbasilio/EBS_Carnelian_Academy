import { describe, expect, it, vi } from 'vitest'
import {
  ConfigurationError,
  DEFAULT_API_TIMEOUT_MS,
  getApiBaseUrl,
  getApiTimeoutMs,
  parseApiBaseUrl,
  parseApiTimeoutMs,
} from './env.ts'

describe('parseApiBaseUrl', () => {
  it.each([
    ['https://localhost:7159', 'https://localhost:7159'],
    ['http://localhost:5082', 'http://localhost:5082'],
    ['https://localhost:7159/', 'https://localhost:7159'],
    ['  https://localhost:7159//  ', 'https://localhost:7159'],
    ['https://localhost:7159/api/', 'https://localhost:7159/api'],
  ])('accepts %j as %j', (raw, expected) => {
    expect(parseApiBaseUrl(raw)).toBe(expected)
  })

  it.each([undefined, '', '   '])('rejects a missing value (%j) with setup guidance', (raw) => {
    expect(() => parseApiBaseUrl(raw)).toThrow(ConfigurationError)
    expect(() => parseApiBaseUrl(raw)).toThrow(/VITE_API_BASE_URL is not set.*\.env\.example/)
  })

  it.each(['localhost:7159', '/api', 'not a url'])('rejects a value that is not an absolute URL (%j)', (raw) => {
    expect(() => parseApiBaseUrl(raw)).toThrow(/must be an absolute http or https URL/)
  })

  it.each(['ftp://localhost:21', 'file:///C:/api', 'javascript:alert(1)'])('rejects a non-http(s) scheme (%j)', (raw) => {
    expect(() => parseApiBaseUrl(raw)).toThrow(/must be an absolute http or https URL/)
  })

  it('rejects embedded credentials without echoing them', () => {
    const attempt = () => parseApiBaseUrl('https://example-user:example-secret@localhost:7159')

    expect(attempt).toThrow(/must not contain credentials/)
    expect(attempt).not.toThrow(/example-secret|example-user/)
  })

  it.each(['https://localhost:7159?key=value', 'https://localhost:7159#section'])(
    'rejects a query string or fragment (%j)',
    (raw) => {
      expect(() => parseApiBaseUrl(raw)).toThrow(/must not contain a query string or fragment/)
    },
  )

  // CG-T03-F01: URL.search and URL.hash are empty strings for these inputs.
  it.each([
    'https://localhost:7159?',
    'https://localhost:7159#',
    'https://localhost:7159/?',
    'https://localhost:7159/api#',
    'https://localhost:7159?#',
    'http://localhost:5082?',
  ])('rejects an empty query or fragment delimiter (%j)', (raw) => {
    expect(() => parseApiBaseUrl(raw)).toThrow(ConfigurationError)
    expect(() => parseApiBaseUrl(raw)).toThrow(/must not contain a query string or fragment/)
  })

  it('rejects a nonempty query and fragment together', () => {
    expect(() => parseApiBaseUrl('https://localhost:7159/api?key=value#section')).toThrow(
      /must not contain a query string or fragment/,
    )
  })

  it('does not echo a rejected query or fragment value', () => {
    const attempt = () => parseApiBaseUrl('https://localhost:7159/?token=example-secret#example-fragment')

    expect(attempt).toThrow(/must not contain a query string or fragment/)
    expect(attempt).not.toThrow(/example-secret|example-fragment|localhost/)
  })

  it('still rejects credentials when a trailing delimiter is present, without echoing them', () => {
    const attempt = () => parseApiBaseUrl('https://example-user:example-secret@localhost:7159?')

    expect(attempt).toThrow(/must not contain credentials/)
    expect(attempt).not.toThrow(/example-secret|example-user/)
  })
})

describe('parseApiTimeoutMs', () => {
  it.each([undefined, '', '  '])('uses the 20-second default when unset (%j)', (raw) => {
    expect(parseApiTimeoutMs(raw)).toBe(DEFAULT_API_TIMEOUT_MS)
    expect(DEFAULT_API_TIMEOUT_MS).toBe(20_000)
  })

  it.each([
    ['1000', 1_000],
    [' 15000 ', 15_000],
    ['120000', 120_000],
  ])('accepts %j', (raw, expected) => {
    expect(parseApiTimeoutMs(raw)).toBe(expected)
  })

  it.each(['0', '999', '120001', '-5000', '1.5', '1e4', '5s', 'Infinity', 'NaN', '0x3e8', '99999999999999999999'])(
    'rejects %j with a range message',
    (raw) => {
      expect(() => parseApiTimeoutMs(raw)).toThrow(ConfigurationError)
      expect(() => parseApiTimeoutMs(raw)).toThrow(/VITE_API_TIMEOUT_MS must be a whole number of milliseconds from 1000 to 120000/)
    },
  )

  it('reads VITE_API_TIMEOUT_MS from the Vite environment', () => {
    vi.stubEnv('VITE_API_TIMEOUT_MS', '5000')

    expect(getApiTimeoutMs()).toBe(5_000)
  })
})

describe('getApiBaseUrl', () => {
  it('reads VITE_API_BASE_URL from the Vite environment', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://localhost:7159/')

    expect(getApiBaseUrl()).toBe('https://localhost:7159')
  })

  it('fails clearly when VITE_API_BASE_URL is not configured', () => {
    vi.stubEnv('VITE_API_BASE_URL', '')

    expect(() => getApiBaseUrl()).toThrow(ConfigurationError)
  })

  it('accepts an explicit environment object', () => {
    expect(getApiBaseUrl({ VITE_API_BASE_URL: 'http://127.0.0.1:5082' })).toBe('http://127.0.0.1:5082')
  })
})
