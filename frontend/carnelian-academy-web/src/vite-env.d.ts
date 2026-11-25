/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute http(s) URL of the Carnelian Academy API, without credentials. See .env.example. */
  readonly VITE_API_BASE_URL?: string
  /** Optional per-request timeout in milliseconds (1000–120000). Defaults to 20000. */
  readonly VITE_API_TIMEOUT_MS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
