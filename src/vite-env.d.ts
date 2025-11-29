/// <reference types="vite/client" />

interface Window {
  gtag: (command: string, action: string, params?: any) => void;
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
  // add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
