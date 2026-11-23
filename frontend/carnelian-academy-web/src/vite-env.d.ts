/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute http(s) URL of the Carnelian Academy API, without credentials. See .env.example. */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
