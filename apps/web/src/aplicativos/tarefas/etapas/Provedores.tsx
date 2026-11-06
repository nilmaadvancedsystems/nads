// Os repositórios das ferramentas das etapas (Vitor, 06/11/2026: os aplicativos à parte saíram; as ferramentas ficam só nas
// etapas da Tarefa). O que o AppExtratudo e o AppConciliaAi ligavam por cima das rotas deles, agora em volta da tela da
// etapa: o Extrator (o mesmo repositório da Tarefa, o leitor de PDF e o OCR) e a Conferência (com a janela "Salvando as notas").
import { extrator } from '@nads/core';
import { useRetorno } from '@nads/ui';
import workerDoPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useEffect, type ReactNode } from 'react';
import { ocrDoArquivo } from '../../../comum/ocr';
import { GravacaoNaNuvem } from './conferencia/casca/GravacaoNaNuvem';
import { avisarErrosDoBanco as avisarDaConferencia, repoDaConferencia } from './conferencia/dados/fonte';
import { RepoProvider as RepoDaConferencia } from './conferencia/dados/repo';
import { avisarErrosDoBanco as avisarDoExtrator, repoDoExtrator } from './extrator/dados/fonte';
import { RepoProvider as RepoDoExtrator } from './extrator/dados/repo';

extrator.definirWorkerDoPdf(workerDoPdf);
// o extrato escaneado (PDF sem texto ou foto) passa pelo OCR do navegador (Vitor, 13/10/2026)
extrator.definirOcr(ocrDoArquivo);

/** O repositório do Extrator (a Importação, o Creditor e o Cartões). */
export function ComExtrator({ children }: { children: ReactNode }) {
  const repo = repoDoExtrator();
  const { toast } = useRetorno();
  useEffect(() => { avisarDoExtrator(repo, toast); }, [repo, toast]);
  return <RepoDoExtrator repo={repo}>{children}</RepoDoExtrator>;
}

/** O repositório da Conferência (a Conferência fiscal). */
export function ComConferencia({ children }: { children: ReactNode }) {
  const repo = repoDaConferencia();
  const { toast } = useRetorno();
  useEffect(() => { avisarDaConferencia(repo, toast); }, [repo, toast]);
  return (
    <RepoDaConferencia repo={repo}>
      {children}
      <GravacaoNaNuvem />
    </RepoDaConferencia>
  );
}
