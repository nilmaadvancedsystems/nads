// A guia paga confirmada pelo extrato (plano do Acessórias, 18/11/2026, ficha guia-paga-confirmada; frase do dono:
// "Seguir"). O robô do PC já tem os lançamentos dos extratos que o escritório lê (os últimos 6 meses com extrato, a aba
// Banco do Faturamento); quando acha uma saída do MESMO valor da guia perto do vencimento, grava `pagoEm` na guia do
// espelho e a Área do Cliente a tira de "a pagar" e mostra na aba Pagas.
// Na dúvida, não marca (a mesma regra do robo/parcela-paga.js): duas saídas candidatas para a guia, ou uma saída que
// serve a duas guias, e nenhuma é marcada. O pagamento com juros não bate o valor e fica sem marcar. A janela (de 20 dias
// antes a 3 depois do vencimento) foi aprovada pelo dono em 18/11/2026 ("Serve"). Só a lógica.
import { dataDoVencimento } from './guias';
import type { LancamentoDoCliente } from './faturamento';

/** Uma saída do extrato, com a data inteira. */
export interface SaidaDoExtrato { /** 'aaaa-mm-dd' */ data: string; /** em reais; negativo = saiu */ valor: number; historico: string }

/** A janela em dias em volta do vencimento (aprovada pelo dono em 18/11/2026). */
export const DIAS_ANTES_DO_VENCIMENTO = 20;
export const DIAS_DEPOIS_DO_VENCIMENTO = 3;

/** O histórico com cara de imposto ou de pagamento de guia: na disputa, ganha das outras saídas. */
const DE_GUIA = /FGTS|GRF|\bDAS\b|DARF|\bDAE\b|\bDAM\b|SIMPLES|TRIBUT|IMPOST|RECEITA|INSS|\bGPS\b|\bISS|ICMS|SEFAZ|ARRECAD|CONVENIO|CONVÊNIO|GUIA/i;

/** Os lançamentos do cache do robô (mês -> { lancamentos }) com a data inteira; só as saídas. */
export function saidasDosMeses(porMes: Iterable<readonly [string, { lancamentos: readonly LancamentoDoCliente[] }]>): SaidaDoExtrato[] {
  const saidas: SaidaDoExtrato[] = [];
  for (const [mes, l] of porMes) {
    if (!/^\d{4}-\d{2}$/.test(mes)) continue;
    for (const x of l.lancamentos) {
      if (!(x.valor < 0) || !(x.dia >= 1 && x.dia <= 31)) continue;
      saidas.push({ data: mes + '-' + String(x.dia).padStart(2, '0'), valor: x.valor, historico: x.historico || '' });
    }
  }
  return saidas;
}

const centavos = (v: number) => Math.round(Math.abs(v) * 100);
const isoDe = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const brDe = (iso: string) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);

/** As saídas que podem ser o pagamento da guia: o mesmo valor, na janela; as de cara de guia, se houver, ficam só elas. */
function candidatas(g: { valor: number; vencimento: string }, saidas: readonly SaidaDoExtrato[]): SaidaDoExtrato[] {
  const v = dataDoVencimento(g.vencimento);
  if (!v || !Number.isFinite(g.valor) || g.valor <= 0) return [];
  const de = isoDe(new Date(v.getFullYear(), v.getMonth(), v.getDate() - DIAS_ANTES_DO_VENCIMENTO));
  const ate = isoDe(new Date(v.getFullYear(), v.getMonth(), v.getDate() + DIAS_DEPOIS_DO_VENCIMENTO));
  const alvo = centavos(g.valor);
  const todas = saidas.filter(s => s.valor < 0 && centavos(s.valor) === alvo && s.data >= de && s.data <= ate);
  const deGuia = todas.filter(s => DE_GUIA.test(s.historico));
  return deGuia.length ? deGuia : todas;
}

/**
 * As guias pagas pelo extrato: id -> 'dd/mm/aaaa' (a data da saída). Só a guia com UMA candidata, e só se essa saída
 * não for candidata de outra guia. A guia que já tem `pagoEm` fica como está (não entra nem disputa).
 */
export function guiasPagasPeloExtrato(
  guias: readonly { id: string; valor: number; vencimento: string; pagoEm?: string }[],
  saidas: readonly SaidaDoExtrato[],
): Map<string, string> {
  const abertas = guias.filter(g => !g.pagoEm);
  const porGuia = abertas.map(g => ({ id: g.id, c: candidatas(g, saidas) }));
  const usos = new Map<SaidaDoExtrato, number>();
  for (const { c } of porGuia) for (const s of c) usos.set(s, (usos.get(s) ?? 0) + 1);
  const pagas = new Map<string, string>();
  for (const { id, c } of porGuia) if (c.length === 1 && usos.get(c[0]) === 1) pagas.set(id, brDe(c[0].data));
  return pagas;
}
