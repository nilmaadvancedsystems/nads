// O motor da conciliação: cada bandeira, na ordem, tira do MESMO monte de notas a venda
// com a mesma data e o mesmo valor (FIFO). O que sobra no monte vai para o arquivo de Saídas.
// Origem: conciliadorZINHO.html computeBrandOrder (~L1369) e generateMultiBrandDatasets (~L1477).
import type { Conciliacao, IdBandeira, LinhaConciliada, Mes, ResultadoBandeira, Transacao, Venda } from '../tipos';
import { chaveMes, contarMeses, noPeriodo } from './meses';

/** Históricos do Alterdata usados nas linhas. */
export const HISTORICO_BRUTO_COM_NOTA = '15';
export const HISTORICO_BRUTO_SEM_NOTA = '181';
export const HISTORICO_TAXA = '92060';

/**
 * Quem pega primeiro quando duas bandeiras têm a mesma data+valor: a que tem mais lançamentos
 * (todos os meses, antes do filtro de meses); empate mantém a ordem da seleção (computeBrandOrder).
 */
export function ordemDasBandeiras(transacoes: Partial<Record<IdBandeira, Transacao[]>>, selecionadas: IdBandeira[]): IdBandeira[] {
  const qtd = (id: IdBandeira) => (transacoes[id] ?? []).length;
  return selecionadas.slice().sort((a, b) => qtd(b) - qtd(a));
}

/** Chave do monte: 'dd/mm/aaaa|valor com 2 casas'. */
function chaveDoMonte(chaveData: string, valor: number): string {
  return chaveData + '|' + valor.toFixed(2);
}

/**
 * Concilia todas as bandeiras contra a planilha de vendas (generateMultiBrandDatasets).
 * mesesPermitidos null (ou vazio) = todos os meses do cartão; senão só os lançamentos desses meses
 * entram nos arquivos. As vendas também são filtradas pelos mesmos meses (corrigido no nads: no
 * original, vendas de meses fora do cartão iam para as Saídas, contrariando o aviso de que o
 * arquivo final teria "apenas os meses em comum").
 */
export function conciliar(entrada: {
  ordem: IdBandeira[];
  transacoes: Partial<Record<IdBandeira, Transacao[]>>;
  vendas: Venda[];
  mesesPermitidos: Mes[] | null;
}): Conciliacao {
  const { ordem, transacoes, vendas, mesesPermitidos } = entrada;
  let permitidos: Record<string, true> | null = null;
  if (mesesPermitidos && mesesPermitidos.length) {
    permitidos = {};
    for (const m of mesesPermitidos) permitidos[chaveMes(m)] = true;
  }

  // cópias: o monte é consumido (shift) e não pode mexer nas vendas de quem chamou
  const monte = new Map<string, Venda[]>();
  const vendaNoPeriodo = noPeriodo(mesesPermitidos);
  for (const v of vendas) {
    if (!vendaNoPeriodo(v.data)) continue;
    const copia: Venda = { ...v };
    const k = chaveDoMonte(copia.chaveData, copia.bruto);
    const fila = monte.get(k);
    if (fila) fila.push(copia); else monte.set(k, [copia]);
  }

  const porBandeira: Partial<Record<IdBandeira, ResultadoBandeira>> = {};
  for (const id of ordem) {
    let aprovadas: Transacao[] = (transacoes[id] ?? []).map(t => ({ data: t.data, chaveData: t.chaveData, bruto: t.bruto, taxa: t.taxa }));
    aprovadas.sort((a, b) => a.data.getTime() - b.data.getTime());
    if (permitidos) {
      const p = permitidos;
      aprovadas = aprovadas.filter(t => p[t.data.getFullYear() + '-' + (t.data.getMonth() + 1)]);
    }

    const linhas: LinhaConciliada[] = [];
    let casadas = 0, semNota = 0, totalBruto = 0, totalTaxa = 0;
    for (const t of aprovadas) {
      const fila = monte.get(chaveDoMonte(t.chaveData, t.bruto));
      const venda = fila && fila.length ? fila.shift() ?? null : null;
      if (venda) casadas++; else semNota++;
      totalBruto += t.bruto;
      totalTaxa += t.taxa;
      // Complemento: o histórico real da venda casada; vazio quando não casou (nunca inventado)
      linhas.push({
        tipo: 'Bruto', casou: !!venda, chaveData: t.chaveData, valor: t.bruto,
        historico: venda ? HISTORICO_BRUTO_COM_NOTA : HISTORICO_BRUTO_SEM_NOTA,
        complemento: venda ? venda.historico : '',
        nota: venda ? venda.nf : '',
      });
      linhas.push({
        tipo: 'Taxa', casou: !!venda, chaveData: t.chaveData, valor: t.taxa,
        historico: HISTORICO_TAXA,
        complemento: venda ? venda.historico : '',
        nota: venda ? venda.nf : '',
      });
    }

    porBandeira[id] = {
      meses: contarMeses(aprovadas),
      aprovadas: aprovadas.length,
      casadas,
      semNota,
      totalBruto: Math.round(totalBruto * 100) / 100,
      totalTaxa: Math.round(totalTaxa * 100) / 100,
      linhas,
    };
  }

  // o que ficou no monte nenhuma bandeira pegou: vendas sem cartão (arquivo de Saídas),
  // na ordem em que cada data+valor apareceu pela primeira vez na planilha
  let sobras: Venda[] = [];
  for (const fila of monte.values()) sobras = sobras.concat(fila);
  return { porBandeira, sobras };
}
