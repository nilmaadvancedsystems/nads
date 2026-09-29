/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "banco" = Firestore da Conferência; "exemplos" = dados em memória */
  readonly VITE_FONTE: 'banco' | 'exemplos';
  /** site com um aplicativo só (prévia): "concilia-ai", "conciliadorzinho", "cheque-especial" ou "creditor" */
  readonly VITE_APLICATIVO?: string;
}
