// A etapa Vendas no cartão (Vitor, 06/11/2026: "o Conciliadorzinho também, ele vai estar se a empresa vender por cartões,
// depois da Conferência fiscal"): o Conciliadorzinho inteiro aqui dentro, sem o site dele. As etapas do passo a passo
// (Bandeiras, o extrato de cada bandeira, Notas, Contas, Totais, Arquivos) ficam nas abas do cabeçalho.
import { empresas } from '@nads/core';
import { LugarDasAcoes, TopoProvider } from '../../../../../../comum/topo';
import { useCascaConciliador } from '../../../../etapas/conciliadorzinho/casca/useCascaConciliador';
import { SessaoProvider, useSessao } from '../../../../etapas/conciliadorzinho/casca/sessao';
import { Arquivos } from '../../../../etapas/conciliadorzinho/telas/arquivos/Arquivos';
import { Bandeiras } from '../../../../etapas/conciliadorzinho/telas/bandeiras/Bandeiras';
import { Contas } from '../../../../etapas/conciliadorzinho/telas/contas/Contas';
import { Extrato } from '../../../../etapas/conciliadorzinho/telas/extrato/Extrato';
import { Notas } from '../../../../etapas/conciliadorzinho/telas/notas/Notas';
import { Totais } from '../../../../etapas/conciliadorzinho/telas/totais/Totais';
import { useAbasDaEtapa, useEtapaAberta, useRequisitosDaEtapa } from '../contexto';

function Tela() {
  const s = useSessao();
  // etapa que saiu da lista (trocou as bandeiras) ou ainda travada: a última possível
  const atual = s.lista.find(x => x.id === s.etapa && s.podeAbrir(x.id)) || s.lista[Math.min(s.estado.alcancada, s.lista.length - 1)];
  if (atual.bandeira) return <Extrato key={atual.bandeira} bandeira={atual.bandeira} />;
  switch (atual.id) {
    case 'bandeiras': return <Bandeiras />;
    case 'notas': return <Notas />;
    case 'contas': return <Contas />;
    case 'totais': return <Totais />;
    case 'arquivos': return <Arquivos />;
    default: return null;
  }
}

function Pagina() {
  const vm = useCascaConciliador();
  useAbasDaEtapa(vm.abas, vm.onAba);
  // como antes, a etapa não trava o Próximo: a pessoa confere e segue
  useRequisitosDaEtapa({ pronto: true, faltam: [] });
  return (
    <section>
      <header className="topbar">
        <div><h2 className="page-title">{vm.titulo}</h2></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {vm.temArquivos && <button className="btn btn-outline" type="button" onClick={() => { void vm.cancelar(); }}>Cancelar</button>}
          <LugarDasAcoes />
        </div>
      </header>
      <p className="page-eyebrow" style={{ marginBottom: 12 }}>{vm.etapaDeTotal}</p>
      <Tela />
    </section>
  );
}

export function VendasNoCartao() {
  const e = useEtapaAberta();
  const empresa = { nome: e.nome, codigo: e.codigo };
  const rota = empresas.rotaDaEmpresa({ ...empresa, regime: '' });
  return (
    // key = empresa: trocar de empresa começa do zero (nada é guardado)
    <SessaoProvider key={rota} empresa={empresa} rota={rota}>
      <TopoProvider>
        <Pagina />
      </TopoProvider>
    </SessaoProvider>
  );
}
