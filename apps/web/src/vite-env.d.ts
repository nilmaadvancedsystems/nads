/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "banco" = Firestore da Conferência; "exemplos" = dados em memória */
  readonly VITE_FONTE: 'banco' | 'exemplos';
}
