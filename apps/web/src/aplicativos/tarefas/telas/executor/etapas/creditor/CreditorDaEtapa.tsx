// A etapa Creditor (Vitor, 06/11/2026: "Creditor, você coloca depois da conferência fiscal para empresas que têm CRED LIQ";
// saiu do Extratudo e fica só aqui): o relatório de liquidação do banco × o sistema, nos meses da Tarefa. O mesmo desenho
// de antes: o título, a linha das etapas do Creditor no Segmentado com o Cancelar e o Próximo, e a tela da etapa.
import { empresas } from '@nads/core';
import { Segmentado } from '@nads/ui';
import { LugarDasAcoes, TopoProvider } from '../../../../../../comum/topo';
import { useCascaCreditor } from '../../../../etapas/creditor/casca/useCascaCreditor';
import { SessaoProvider, useSessao } from '../../../../etapas/creditor/casca/sessao';
import { ETAPAS } from '../../../../etapas/creditor/casca/navegacao';
import { Competencia } from '../../../../etapas/creditor/telas/competencia/Competencia';
import { Contas } from '../../../../etapas/creditor/telas/contas/Contas';
import { Cruzamento } from '../../../../etapas/creditor/telas/cruzamento/Cruzamento';
import { Exclusao } from '../../../../etapas/creditor/telas/exclusao/Exclusao';
import { Lancamentos } from '../../../../etapas/creditor/telas/lancamentos/Lancamentos';
import { ComExtrator } from '../../../../etapas/Provedores';
import { useEtapaAberta } from '../contexto';

function Tela() {
  const s = useSessao();
  // etapa ainda travada: a última liberada
  const id = s.podeAbrir(s.etapa) ? s.etapa : ([...ETAPAS].reverse().find(e => s.podeAbrir(e.id)) || ETAPAS[0]).id;
  switch (id) {
    case 'competencia': return <Competencia />;
    case 'contas': return <Contas />;
    case 'cruzamento': return <Cruzamento />;
    case 'lancamentos': return <Lancamentos />;
    case 'exclusao': return <Exclusao />;
  }
}

function Pagina() {
  const { temDados, cancelar, temProxima, podeSeguir, proximo, ...vm } = useCascaCreditor();
  const atual = vm.paginas.find(p => p.ativa);
  return (
    <section>
      <header className="topbar">
        <div><h2 className="page-title">{vm.titulo}</h2></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><LugarDasAcoes /></div>
      </header>
      {atual && (
        <div className="tarefas-barra-topo">
          <Segmentado valor={atual.id} onMudar={vm.onPagina}
            opcoes={vm.paginas.map(p => ({ valor: p.id, rotulo: p.rotulo, travada: p.travada ? 'Resolva as etapas anteriores primeiro' : false }))} />
          <span className="tarefas-barra-espaco" />
          {/* na última etapa (a Exclusão) sem o Cancelar (Vitor, 06/10/2026) */}
          {temDados && temProxima && <button className="btn btn-outline" type="button" onClick={() => { void cancelar(); }}>Cancelar</button>}
          {temProxima && <button className="btn btn-primary" type="button" disabled={!podeSeguir} onClick={proximo}
            title={podeSeguir ? undefined : 'Resolva as pendências desta etapa primeiro'}>Próximo</button>}
        </div>
      )}
      <Tela />
    </section>
  );
}

export function CreditorDaEtapa() {
  const e = useEtapaAberta();
  const empresa = { nome: e.nome, codigo: e.codigo };
  const rota = empresas.rotaDaEmpresa({ ...empresa, regime: '' });
  return (
    <ComExtrator>
      {/* key = empresa: trocar de empresa começa do zero */}
      <SessaoProvider key={rota} empresa={empresa} rota={rota}>
        <TopoProvider>
          <Pagina />
        </TopoProvider>
      </SessaoProvider>
    </ComExtrator>
  );
}
