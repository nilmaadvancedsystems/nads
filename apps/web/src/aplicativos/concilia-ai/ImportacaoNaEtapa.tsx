// A Importação da Conferência dentro da primeira etapa da Tarefas (Vitor, 30/09/2026: "transfira tudo para a
// primeira etapa"): Balancete, Entradas, Saídas, Tomados e Prestados, uma linha cada, embaixo dos bancos. Liga o
// repositório da Conferência (o mesmo banco dela) e a sessão da empresa, como o AppConciliaAi e a EmpresaAberta
// fazem; cada linha usa o ViewModel da página de Importação.
import { conferencia as c, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect } from 'react';
import { SessaoProvider, useSessao } from './casca/sessao';
import { avisarErrosDoBanco, repoDaConferencia } from './dados/fonte';
import { RepoProvider, useRepo, useVersaoDoRepo } from './dados/repo';
import { LinhaDaImportacao } from './telas/importacao/partes/LinhaDaImportacao';

export function ImportacaoNaEtapa({ nome }: { nome: string }) {
  const repo = repoDaConferencia();
  const { toast } = useRetorno();
  useEffect(() => { avisarErrosDoBanco(repo, toast); }, [repo, toast]);
  return <RepoProvider repo={repo}><DaEmpresa nome={nome} /></RepoProvider>;
}

function DaEmpresa({ nome }: { nome: string }) {
  const repo = useRepo();
  useVersaoDoRepo();
  if (!repo.pronto()) return null;
  const achada = repo.empresaPelaRota(formatos.slug(nome));
  return (
    <SessaoProvider nome={achada?.nome || nome} rota={achada?.rota || formatos.slug(nome)} codigo={achada?.codigo ?? null} pagina="importacao/balancete">
      <Linhas />
    </SessaoProvider>
  );
}

function Linhas() {
  const s = useSessao();
  // os serviços prestados só para quem presta serviço (como na Conferência)
  const tipos: c.PaginaImportacao[] = ['balancete', 'entradas', 'saidas', 'tomados', ...(c.semPrest(s.empresa) ? [] : ['prestados' as const])];
  return (
    <div className="imp-conf">
      <p className="imp-conf-titulo">Conferência</p>
      <div className="imp-lista">{tipos.map(t => <LinhaDaImportacao key={t} tipo={t} />)}</div>
    </div>
  );
}
