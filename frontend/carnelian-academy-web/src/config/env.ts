/**
 * Typed access to frontend build-time configuration.
 *
 * Values are read lazily and validated when used, so a missing or malformed setting fails
 * with a clear message at the call site instead of at application start. M01-T03 defines the
 * configuration only; no HTTP requests are made yet.
 */

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigurationError'
  }
}

const API_BASE_URL_KEY = 'VITE_API_BASE_URL'

/**
 * Validates and normalizes an API base URL. The rejected value is never echoed in the error,
 * because a malformed value could contain credentials.
 */
export function parseApiBaseUrl(rawValue: string | undefined): string {
  const value = rawValue?.trim()
  if (!value) {
    throw new ConfigurationError(
      `${API_BASE_URL_KEY} is not set. Copy .env.example to .env.local and set it to the local API URL.`,
    )
  }

  const invalidUrlMessage = `${API_BASE_URL_KEY} must be an absolute http or https URL such as https://localhost:7159.`
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new ConfigurationError(invalidUrlMessage)
  }

  // A value without a scheme, such as "localhost:7159", parses with "localhost:" as its protocol.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ConfigurationError(invalidUrlMessage)
  }
  if (url.username || url.password) {
    throw new ConfigurationError(`${API_BASE_URL_KEY} must not contain credentials.`)
  }
  // URL.search and URL.hash are empty for a bare trailing "?" or "#", so also check the raw
  // input. Neither delimiter is valid anywhere in a base URL, including inside a path.
  if (url.search || url.hash || /[?#]/.test(value)) {
    throw new ConfigurationError(`${API_BASE_URL_KEY} must not contain a query string or fragment.`)
  }

  // Drop trailing slashes so callers can append paths such as "/health" consistently.
  return url.href.replace(/\/+$/, '')
}

/** Returns the validated API base URL from the Vite environment. */
export function getApiBaseUrl(env: Pick<ImportMetaEnv, 'VITE_API_BASE_URL'> = import.meta.env): string {
  return parseApiBaseUrl(env.VITE_API_BASE_URL)
}
