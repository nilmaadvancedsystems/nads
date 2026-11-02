// Aplicativo Extratudo: liga o repositório (a lista de empresas e os lançamentos do Extrator; no site
// ligado ao banco, o Firestore da Conferência) e o leitor de PDF, e mostra a rota aberta. As três ferramentas ficam debaixo dele.
// No banco, a trava vem antes (29/10/2026): só quem entrou com a conta do Entregas e pode usar alguma das ferramentas.
// Dentro do Entregas (iframe) não pede: a pessoa já entrou lá, e o Entregas só mostra o Extratudo no módulo Contábil.
import { extrator } from '@nads/core';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { ocrDoArquivo } from '../../comum/ocr';
import { useRetorno } from '@nads/ui';
import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { TravaDeAcesso } from '../tarefas/casca/TravaDeAcesso';
import { dentroDoEntregas } from './dados/drive.firestore';
import { avisarErrosDoBanco, repoDoExtrator } from './ferramentas/extrator/dados/fonte';
import { RepoProvider } from './ferramentas/extrator/dados/repo';

extrator.definirWorkerDoPdf(workerDoPdf);
// o extrato escaneado (PDF sem texto ou foto) passa pelo OCR do navegador (Vitor, 13/10/2026)
extrator.definirOcr(ocrDoArquivo);

const NO_ENTREGAS = dentroDoEntregas();

export function AppExtratudo() {
  return (
    <TravaDeAcesso recursos={['extrator', 'cheque-especial', 'creditor']} nome="Extratudo" livre={NO_ENTREGAS}>
      <ExtratudoLiberado />
    </TravaDeAcesso>
  );
}

/** Depois da trava: só aqui o repositório abre (no banco, a conexão com a Conferência). */
function ExtratudoLiberado() {
  const repo = repoDoExtrator();
  const { toast } = useRetorno();
  useEffect(() => { avisarErrosDoBanco(repo, toast); }, [repo, toast]);
  return (
    <RepoProvider repo={repo}>
      <Outlet />
    </RepoProvider>
  );
}
