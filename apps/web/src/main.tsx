// Entrada do nads: design da Conferência, repositório e rotas.
// Fonte dos dados (VITE_FONTE):
//   "banco"    → o mesmo Firestore da conferencia-nilma.web.app (site publicado, `npm run dev:banco`)
//   "exemplos" → empresas de exemplo em memória, nada vai para o banco (`npm run dev`, prévias)
import '@nads/ui/estilo.css';
import { conferencia } from '@nads/core';
import { DefsMarca, RetornoProvider, useRetorno } from '@nads/ui';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { criarRepoConferenciaFirestore, type RepoConferenciaFirestore } from './dados/conferencia.firestore';
import { RepoProvider } from './dados/repo';
import { roteador } from './rotas';

const noBanco = import.meta.env.VITE_FONTE === 'banco';
const repo: conferencia.RepoConferencia = noBanco ? criarRepoConferenciaFirestore() : conferencia.criarRepoConferenciaMemoria();

/** Os erros do banco (salvar/conectar) aparecem no toast da tela. */
function AvisosDoBanco() {
  const { toast } = useRetorno();
  useEffect(() => { if (noBanco) (repo as RepoConferenciaFirestore).definirAviso(toast); }, [toast]);
  return null;
}

createRoot(document.getElementById('raiz') as HTMLElement).render(
  <StrictMode>
    <DefsMarca />
    <RepoProvider repo={repo}>
      <RetornoProvider>
        <AvisosDoBanco />
        <RouterProvider router={roteador} />
      </RetornoProvider>
    </RepoProvider>
  </StrictMode>,
);
