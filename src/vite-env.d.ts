/// <reference types="vite/client" />

interface Window {
  optimiserEditor?: {
    openTrace: () => Promise<{ filePath: string; contents: string } | null>;
    platform: string;
  };
}
