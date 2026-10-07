// Os honorários do escritório na etapa Honorários (Vitor, 07/10/2026): a pessoa importa o razão do Honorários a pagar e vê
// se está zerando. Quando o escritório não emite nota de honorário para a empresa (no Cadastro), a provisão não chega pelo
// Fiscal: a pessoa importa o "Extrato por cobrança" do Alterdata (o PDF das cobranças da Nilma para o cliente) e o sistema
// monta os lançamentos na data de emissão de cada cobrança (D despesa de honorários / C honorários a pagar), no arquivo de
// importação do Alterdata (as 8 colunas, o mesmo do Creditor).
import type { RazaoDaConta } from './razao';

/** Uma cobrança do "Extrato por cobrança" (Alterdata, módulo de cobrança do escritório). */
export interface CobrancaDeHonorario {
  /** o cliente do bloco: "(00292) FITO…" → 292 (null = o extrato não disse) */
  codigoCliente: number | null;
  /** AAAA-MM-DD */
  emissao: string;
  /** o número da cobrança, como no extrato ("000013074") */
  numero: string;
  vencimento: string;
  /** AAAA-MM-DD; '' = ainda não paga */
  pagamento: string;
  valor: number;
  recebido: number;
  aReceber: number;
}

const DATA = /\d{2}\/\d{2}\/\d{4}/;
const RE_COBRANCA = /^(\d{2}\/\d{2}\/\d{4}) (\d{4,}) (\d{2}\/\d{2}\/\d{4})(?: (\d{2}\/\d{2}\/\d{4}))? ((?:[\d.]+,\d{2} ?)+)$/;
const RE_CLIENTE = /^\((\d+)\)\s/;

const iso = (br: string) => (DATA.test(br) ? br.slice(6, 10) + '-' + br.slice(3, 5) + '-' + br.slice(0, 2) : '');
const numero = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));

/**
 * As linhas do PDF (uma lista por página) → as cobranças. Cada linha de cobrança: emissão, número, vencimento, pagamento
 * (some quando não foi paga) e os valores (Valor, Juros, Multa, Desconto, Crédito utilizado, Recebido, A receber). O
 * cliente vem da linha "(00292) NOME" acima das cobranças dele.
 */
export function cobrancasDasLinhas(paginas: readonly (readonly string[])[]): CobrancaDeHonorario[] {
  const out: CobrancaDeHonorario[] = [];
  let cliente: number | null = null;
  for (const linhas of paginas) {
    for (const bruta of linhas) {
      const linha = bruta.replace(/\s+/g, ' ').trim();
      const c = linha.match(RE_CLIENTE);
      if (c) { cliente = Number(c[1]); continue; }
      const m = linha.match(RE_COBRANCA);
      if (!m) continue;
      const valores = m[5].trim().split(' ').map(numero);
      if (valores.length < 3) continue;
      out.push({
        codigoCliente: cliente, emissao: iso(m[1]), numero: m[2], vencimento: iso(m[3]), pagamento: m[4] ? iso(m[4]) : '',
        valor: valores[0], recebido: valores[valores.length - 2], aReceber: valores[valores.length - 1],
      });
    }
  }
  return out;
}

/** Só as cobranças emitidas nos meses do período (a provisão é do mês da emissão). */
export function cobrancasDoPeriodo(cobrancas: readonly CobrancaDeHonorario[], meses: readonly string[]): CobrancaDeHonorario[] {
  return cobrancas.filter(c => meses.includes(c.emissao.slice(0, 7))).sort((a, b) => a.emissao.localeCompare(b.emissao) || a.numero.localeCompare(b.numero));
}

/** Uma linha do arquivo de importação do Alterdata (as 8 colunas do Creditor; data DD/MM/AAAA). */
export interface LancamentoDeHonorario { data: string; debito: string; credito: string; historico: string; valor: number; documento: string }

/** O número da cobrança sem os zeros da frente ("000013074" → "13074"). */
const semZeros = (n: string) => n.replace(/^0+(?=\d)/, '');

/** A provisão de cada cobrança, na data de emissão: D despesa de honorários / C honorários a pagar. */
export function lancamentosDosHonorarios(cobrancas: readonly CobrancaDeHonorario[], contaDespesa: string, contaAPagar: string): LancamentoDeHonorario[] {
  return cobrancas.map(c => ({
    data: c.emissao.slice(8, 10) + '/' + c.emissao.slice(5, 7) + '/' + c.emissao.slice(0, 4),
    debito: contaDespesa.trim(), credito: contaAPagar.trim(),
    historico: 'Honorários contábeis conf. cobrança nº ' + semZeros(c.numero),
    valor: c.valor, documento: semZeros(c.numero),
  }));
}

/**
 * A conta de despesa que o razão já usa: a contrapartida mais comum dos créditos do Honorários a pagar (as provisões de
 * antes). '' = o razão não tem provisão.
 */
export function despesaDoRazao(r: RazaoDaConta | null): string {
  if (!r) return '';
  const conta = new Map<string, number>();
  for (const l of r.lancamentos) if (l.valor > 0 && l.contrapartida) conta.set(l.contrapartida, (conta.get(l.contrapartida) || 0) + 1);
  return [...conta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

/** As cobranças de teste (o ⚡): uma por mês, emitida no último dia útil, paga no dia 10 do mês seguinte. */
export function cobrancasDeTeste(meses: readonly string[], codigo: number | null): CobrancaDeHonorario[] {
  return meses.map((mes, i) => {
    const [a, m] = mes.split('-').map(Number);
    const fim = new Date(a, m, 0).getDate();
    const seguinte = new Date(a, m, 10);
    const pago = seguinte.getFullYear() + '-' + String(seguinte.getMonth() + 1).padStart(2, '0') + '-10';
    const valor = i === meses.length - 2 ? 2050 : 1650;
    const ultimo = i === meses.length - 1;
    return {
      codigoCliente: codigo, emissao: mes + '-' + String(Math.min(fim, 30)).padStart(2, '0'), numero: String(13074 + i * 200).padStart(9, '0'),
      vencimento: pago, pagamento: ultimo ? '' : pago, valor, recebido: ultimo ? 0 : valor, aReceber: ultimo ? valor : 0,
    };
  });
}
