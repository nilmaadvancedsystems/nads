// Linhas dos arquivos finais: troca Bruto/Taxa pelas contas (devedora/credora) e monta
// as Saídas (vendas sem cartão) separadas por mês.
// Origem: conciliadorZINHO.html buildFinalOutputs (~L1817, a parte das linhas e o filenameBase)
// e buildSaidaOutputs (~L2077).
import { bandeira } from '../tabelas/bandeiras';
import type { Contas, IdBandeira, LinhaArquivo, Mes, ResultadoBandeira, SaidaDoMes, Venda } from '../tipos';
import { pad2, rotuloMes } from './formatos';
import { chaveMes, slugMeses } from './meses';

/** Conta de caixa quando o usuário diz que usa a padrão. */
export const CAIXA_PADRAO = '10101';

export function contaCaixa(contas: Contas): string {
  return contas.caixaPadrao ? CAIXA_PADRAO : contas.caixa.trim();
}

/**
 * Bruto: D conta da bandeira / C vendas (casou) ou caixa (não casou).
 * Taxa:  D conta de taxas    / C conta da bandeira.
 */
export function linhasDaBandeira(r: ResultadoBandeira, contaBandeira: string, contas: Contas): LinhaArquivo[] {
  const contaB = contaBandeira.trim();
  const caixa = contaCaixa(contas);
  return r.linhas.map(l => {
    const bruto = l.tipo === 'Bruto';
    return {
      devedora: bruto ? contaB : contas.taxas.trim(),
      credora: bruto ? (l.casou ? contas.vendas.trim() : caixa) : contaB,
      data: l.chaveData, valor: l.valor, historico: l.historico, complemento: l.complemento, nota: l.nota,
      tipo: l.tipo, casou: l.casou,
    };
  });
}

/** 'conciliacao-<slug>-<meses>' (filenameBase do buildFinalOutputs; os meses são os do resultado da bandeira). */
export function nomeBaseBandeira(id: IdBandeira, meses: Mes[]): string {
  return 'conciliacao-' + bandeira(id).slug + '-' + slugMeses(meses);
}

/**
 * Um arquivo de Saídas por mês (buildSaidaOutputs): D contrapartida (coluna E) / C conta de vendas,
 * histórico = código da coluna H, complemento = histórico limpo, nota = NF. Dentro do mês, por data
 * (empate mantém a ordem das sobras). Meses em ordem de chave como TEXTO, como o original.
 */
export function saidasPorMes(sobras: Venda[], contaVendas: string): SaidaDoMes[] {
  const conta = contaVendas.trim();
  const porMes: Record<string, Venda[]> = {};
  for (const v of sobras) {
    const k = chaveMes({ ano: v.data.getFullYear(), mes: v.data.getMonth() + 1 });
    (porMes[k] = porMes[k] || []).push(v);
  }
  return Object.keys(porMes).sort().map(k => {
    const vendas = porMes[k].slice().sort((a, b) => a.data.getTime() - b.data.getTime());
    const m: Mes = { ano: vendas[0].data.getFullYear(), mes: vendas[0].data.getMonth() + 1 };
    const linhas: LinhaArquivo[] = vendas.map(v => ({
      devedora: v.contrapartida, credora: conta, data: v.chaveData, valor: v.bruto,
      historico: v.codigoHistorico, complemento: v.historico, nota: v.nf, tipo: 'Saida', casou: false,
    }));
    return { chave: k, mes: m, rotulo: rotuloMes(m), linhas, nomeBase: 'saidas-vendas-' + m.ano + '-' + pad2(m.mes) };
  });
}
