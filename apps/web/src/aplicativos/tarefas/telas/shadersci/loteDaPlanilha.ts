// O lote de cada planilha do minimum para o SCI (27/11/2026, a regra final do Vitor: empresa + lote + ano, sem repetir): o nads
// reserva no banco o próximo número da empresa no ano antes de baixar a planilha. Uma planilha é de um ano só (a exclusão no SCI
// filtra o lote dentro do ano); com dois anos, ela não sai e o aviso diz para separar.
import { sci } from '@nads/core';
import type { OpcoesAviso } from '@nads/ui';
import { reservarLoteDoMinimum } from '../../dados/lotesDoMinimum.firestore';

let reservando = false;

/**
 * O lote para a planilha (M000001), ou null quando não dá (o aviso já foi mostrado). Sem a empresa com código, '' (a planilha
 * sai sem lote, como antes do controle).
 */
export async function loteParaAPlanilha(o: {
  codigo: number | null | undefined; empresa: string; lancamentos: readonly sci.LancamentoSci[]; origem: string; aviso: (a: OpcoesAviso) => void;
}): Promise<string | null> {
  if (o.codigo == null) return '';
  const prontos = o.lancamentos.filter(l => !l.problemas.length).length;
  if (prontos > sci.MAX_LANCAMENTOS_POR_LOTE) {
    o.aviso({ tom: 'info', titulo: 'Planilha grande demais para um lote', texto: 'São ' + prontos + ' lançamentos prontos; cabem ' + sci.MAX_LANCAMENTOS_POR_LOTE + ' por planilha. Divida em duas.' });
    return null;
  }
  const { ano, anos } = sci.anoDaPlanilha(o.lancamentos);
  if (anos.length > 1) {
    o.aviso({ tom: 'info', titulo: 'Um ano por planilha', texto: 'Os lançamentos prontos são de ' + anos.join(' e ') + '. O lote vale para a empresa num ano: exporte cada ano numa planilha.' });
    return null;
  }
  if (reservando) return null;
  reservando = true;
  try {
    return await reservarLoteDoMinimum({ codigo: o.codigo, empresa: o.empresa, ano, lancamentos: prontos, origem: o.origem });
  } catch (e) {
    o.aviso({ tom: 'erro', titulo: 'Não consegui pegar o lote no banco', texto: (e instanceof Error ? e.message : String(e)) + ' A planilha não foi baixada.' });
    return null;
  } finally { reservando = false; }
}
