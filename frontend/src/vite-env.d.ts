/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL, e.g. `https://portfolio-ledger-api.onrender.com` (no path, no trailing slash). */
  readonly VITE_API_URL?: string
}
