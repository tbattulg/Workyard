/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUBLIC_APP_NAME?: string
  readonly VITE_PUBLIC_APP_URL?: string
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
