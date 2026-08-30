/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Origine de l'API pour la construction native uniquement. Sur le web, le
   * client et l'API partagent l'origine et cette variable reste vide.
   */
  readonly VITE_API_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
