// A etapa Importação (a primeira do Contábil e a do Fiscal; Vitor, 06/11/2026: o Extrator saiu do Extratudo e fica só aqui):
// os extratos e os razões de cada banco e as notas, no período da Tarefa. A empresa vem da Tarefa (antes, o iframe a
// procurava na lista do Extratudo e, sem achar, abria a escolha de empresa).
import { SessaoProvider } from '../../../../etapas/extrator/casca/sessao';
import { TarefaExtratos } from '../../../../etapas/extrator/telas/tarefa/TarefaExtratos';
import { ComExtrator } from '../../../../etapas/Provedores';
import { ParametrosDaEtapa } from '../ponte';
import { useEmpresaDaImportacao } from './useEmpresaDaImportacao';

function Empresa() {
  const e = useEmpresaDaImportacao();
  if (!e.carregada) return null;
  return (
    // key = empresa: trocar de empresa zera a sessão
    <SessaoProvider key={e.nome} nome={e.nome} rota={e.rota} codigo={e.codigo}>
      <TarefaExtratos />
    </SessaoProvider>
  );
}

export function ImportacaoDaEtapa({ fiscal = false }: { fiscal?: boolean }) {
  return (
    <ComExtrator>
      <ParametrosDaEtapa extra={fiscal ? { etapa: 'fiscal' } : {}}>
        <Empresa />
      </ParametrosDaEtapa>
    </ComExtrator>
  );
}
