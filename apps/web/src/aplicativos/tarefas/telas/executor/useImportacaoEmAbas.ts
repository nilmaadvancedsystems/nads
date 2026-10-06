// ViewModel da aba da Importação no Alterdata (Fiscal): quantas notas do tipo o SIEG tem no mês (das contagens da
// madrugada), para comparar com o que entrou no Alterdata.
import { tarefas as t } from '@nads/core';
import { useSieg } from '../../dados/repo';

function notasDoSieg(id: string, c: t.sieg.ContagemSieg | null): number | null {
  if (!c) return null;
  switch (id) {
    case 'entradas': return c.recebidas.NFe;
    case 'saidas': return c.emitidas.NFe + c.emitidas.NFCe;
    case 'tomados': return c.recebidas.NFSe;
    case 'prestados': return c.emitidas.NFSe;
    case 'cte': return c.recebidas.CTe + c.emitidas.CTe;
    default: return null;
  }
}

export function useImportacaoEmAbas(item: string, codigo: string, competencia: string) {
  const sieg = useSieg();
  const cont = codigo ? sieg.contagem(codigo, competencia) : null;
  const n = notasDoSieg(item, cont?.dados ?? null);
  return { textoSieg: n == null ? 'SIEG: sem a contagem deste mês' : 'SIEG: ' + n + (n === 1 ? ' nota' : ' notas') + ' no mês' };
}
