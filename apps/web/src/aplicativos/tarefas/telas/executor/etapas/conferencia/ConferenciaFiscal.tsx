// A etapa Conferência fiscal (Vitor, 06/11/2026: o Concilia aí saiu do site dele e fica só aqui): o balancete × as notas,
// no período da Tarefa. As páginas dela (Balancete, Relatório, Consulta, Cadastro, Auditoria) ficam nas abas do
// cabeçalho da Tarefa, como quando ela abria inteira dentro da etapa.
import type { conferencia as c } from '@nads/core';
import { LugarDasAcoes, TopoProvider } from '../../../../../../comum/topo';
import { useCascaConciliaAi } from '../../../../etapas/conferencia/casca/useCascaConciliaAi';
import { SessaoProvider, useSessao } from '../../../../etapas/conferencia/casca/sessao';
import { Auditoria } from '../../../../etapas/conferencia/telas/auditoria/Auditoria';
import { Configuracoes } from '../../../../etapas/conferencia/telas/cadastro/Configuracoes';
import { Consulta } from '../../../../etapas/conferencia/telas/consulta/Consulta';
import { Importacao } from '../../../../etapas/conferencia/telas/importacao/Importacao';
import { LancamentosAutomaticos } from '../../../../etapas/conferencia/telas/lancamentos/LancamentosAutomaticos';
import { Relatorio } from '../../../../etapas/conferencia/telas/relatorio/Relatorio';
import { VerificarConta } from '../../../../etapas/conferencia/telas/verificar/VerificarConta';
import { ComConferencia } from '../../../../etapas/Provedores';
import { useAbasDaEtapa, useEtapaAberta } from '../contexto';
import { ParametrosDaEtapa } from '../ponte';
import { useEmpresaDaConferencia } from './useEmpresaDaConferencia';

function Tela({ pagina }: { pagina: string }) {
  if (pagina.startsWith('importacao/')) return <Importacao key={pagina} tipo={pagina.split('/')[1] as c.PaginaImportacao} />;
  switch (pagina) {
    case 'cadastro/configuracoes': return <Configuracoes />;
    case 'cadastro/lancamentos-automaticos': return <LancamentosAutomaticos />;
    case 'movimento/relatorio': return <Relatorio />;
    case 'movimento/consulta': return <Consulta />;
    case 'movimento/verificar': return <VerificarConta />;
    case 'auditoria/historico': return <Auditoria />;
    default: return null;
  }
}

function Pagina() {
  const s = useSessao();
  const vm = useCascaConciliaAi();
  useAbasDaEtapa(vm.abasNaEtapa, vm.onAbaNaEtapa);
  return (
    <section>
      <header className="topbar">
        <div><h2 className="page-title">{vm.titulo}</h2></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><LugarDasAcoes /></div>
      </header>
      <Tela pagina={s.pagina} />
    </section>
  );
}

function Empresa() {
  const e = useEmpresaDaConferencia();
  if (!e.pronto) return null; // só a barra do topo, sem texto
  return (
    // key = empresa: trocar de empresa zera a sessão (como o entrar() do original)
    <SessaoProvider key={e.nome} nome={e.nome} rota={e.rota} codigo={e.codigo} pagina="movimento/relatorio">
      <TopoProvider>
        <Pagina />
      </TopoProvider>
    </SessaoProvider>
  );
}

export function ConferenciaFiscal() {
  const e = useEtapaAberta();
  return (
    <ComConferencia>
      {/* a Conferência roda no período que a pessoa está fazendo (o mês, ou os meses do Em lote) */}
      <ParametrosDaEtapa extra={{ meses: e.meses.join(',') }}>
        <Empresa />
      </ParametrosDaEtapa>
    </ComConferencia>
  );
}
