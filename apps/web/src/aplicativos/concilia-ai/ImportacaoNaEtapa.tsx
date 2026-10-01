// A Importação da Conferência dentro da primeira etapa da Tarefas (Vitor, 30/09/2026: "transfira tudo para a
// primeira etapa"; depois, "separe em menu superior"): cada aba de cima (Balancete, Entradas, Saídas, Tomados,
// Prestados) abre a página de Importação da Conferência daquele tipo, exatamente como ela é. Liga o repositório da
// Conferência (o mesmo banco dela), a sessão da empresa e o lugar das ações do topo (o "Reimportar"), como o
// AppConciliaAi e a EmpresaAberta fazem.
import { conferencia as c, formatos } from '@nads/core';
import { useCarregando, useRetorno } from '@nads/ui';
import { useEffect } from 'react';
import { LugarDasAcoes, TopoProvider } from '../../comum/topo';
import { paginaPorId } from './casca/navegacao';
import { SessaoProvider, useSincronizarPrestaServico } from './casca/sessao';
import { avisarErrosDoBanco, repoDaConferencia } from './dados/fonte';
import { RepoProvider, useRepo, useVersaoDoRepo } from './dados/repo';
import { Importacao } from './telas/importacao/Importacao';

/** prestaServico: a regra do Cadastro da empresa (a Conferência fica igual); null = não informado. */
export function ImportacaoNaEtapa({ nome, tipo, prestaServico }: { nome: string; tipo: c.PaginaImportacao; prestaServico: boolean | null }) {
  const repo = repoDaConferencia();
  const { toast } = useRetorno();
  useEffect(() => { avisarErrosDoBanco(repo, toast); }, [repo, toast]);
  return <RepoProvider repo={repo}><DaEmpresa nome={nome} tipo={tipo} prestaServico={prestaServico} /></RepoProvider>;
}

function DaEmpresa({ nome, tipo, prestaServico }: { nome: string; tipo: c.PaginaImportacao; prestaServico: boolean | null }) {
  const repo = useRepo();
  useVersaoDoRepo();
  useCarregando(!repo.pronto());
  if (!repo.pronto()) return null;
  const achada = repo.empresaPelaRota(formatos.slug(nome));
  const pagina = 'importacao/' + tipo;
  return (
    <SessaoProvider nome={achada?.nome || nome} rota={achada?.rota || formatos.slug(nome)} codigo={achada?.codigo ?? null} pagina={pagina}>
      <SincronizarServicos valor={prestaServico} />
      <TopoProvider>
        <header className="topbar imp-conf-topo">
          <div><h2 className="page-title">{paginaPorId(pagina)?.titulo || ''}</h2></div>
          <div className="imp-conf-acoes"><LugarDasAcoes /></div>
        </header>
        <Importacao key={tipo} tipo={tipo} naEtapa />
      </TopoProvider>
    </SessaoProvider>
  );
}

function SincronizarServicos({ valor }: { valor: boolean | null }) {
  useSincronizarPrestaServico(valor);
  return null;
}
