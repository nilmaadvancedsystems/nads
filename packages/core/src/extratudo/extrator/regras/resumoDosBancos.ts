// O relatório dos bancos no período (Vitor, 06/10/2026: a etapa Bancos da Tarefa vira só um relatório "com gráficos de
// tudo o que foi feito em bancos" — despesas bancárias, CRÉD.LIQ.COBRANÇA, pagamento de boletos, transferência para o
// sócio, água e luz; a pessoa vê os saldos e dá Próximo). Lê só o extrato (lado banco) de cada banco: o saldo do começo
// e do fim do período, as entradas e saídas mês a mês e cada lançamento numa categoria pelo histórico. Valores em
// centavos.
import { normalizarTexto } from '../../../formatos';
import type { EmpresaExtrator } from '../tipos';
import { movimentoDoExtrato } from './movimento';

export type CategoriaBancaria = 'credliq' | 'despesas' | 'boletos' | 'socio' | 'agua' | 'luz' | 'outras-entradas' | 'outras-saidas';

export const ROTULO_CATEGORIA: Record<CategoriaBancaria, string> = {
  credliq: 'CRÉD.LIQ.COBRANÇA', despesas: 'Despesas bancárias', boletos: 'Pagamento de boletos', socio: 'Transferência para o sócio',
  agua: 'Água', luz: 'Luz', 'outras-entradas': 'Outras entradas', 'outras-saidas': 'Outras saídas',
};

const CREDLIQ = /\bcred\s*\.?\s*liq/;
const DESPESAS = /\btarifa|\btar\b|\bcesta\b|\biof\b|\bjuros\b|\bencargo|\bmanut|\bmensalidade pacote|\banuidade/;
const BOLETOS = /\bboleto|\bpag(to|amento)?\.? ?(de )?tit(ulo)?\b|\bpag(to|amento)? cobranca|\bdeb\.? ?tit/;
const AGUA = /\bcopasa\b|\bsaae\b|\bsaneamento|\bagua\b/;
const LUZ = /\bcemig\b|\benergia\b|\beletric|\bluz\b/;
const RETIRADA = /distribuicao de lucro|\bpro.?labore|\bretirada (de )?socio/;

/** Um sócio do Cadastro: o nome e o CPF (só dígitos). */
export interface SocioDoCadastro { nome: string; cpf?: string }

/** O CPF mascarado do PIX ("***.405.586-**"): os 6 dígitos do meio. */
const CPF_MASCARADO = /\*{3}\.?(\d{3})\.?(\d{3})-?\*{2}/;

/**
 * O lançamento do extrato numa categoria. socios: os do Cadastro da empresa — bate pelo nome inteiro, pelo nome +
 * último sobrenome, pelo CPF inteiro ou pelos 6 dígitos do meio do CPF mascarado do PIX.
 */
export function categoriaDoLancamento(historico: string, valor: number, socios: readonly SocioDoCadastro[] = []): CategoriaBancaria {
  const h = ' ' + normalizarTexto(historico) + ' ';
  if (valor > 0) return CREDLIQ.test(h) ? 'credliq' : 'outras-entradas';
  const digitos = historico.replace(/\D/g, '');
  const mascarado = CPF_MASCARADO.exec(historico);
  const doSocio = socios.some(s => {
    const cpf = (s.cpf || '').replace(/\D/g, '');
    if (cpf.length === 11 && (digitos.includes(cpf) || (mascarado && mascarado[1] + mascarado[2] === cpf.slice(3, 9)))) return true;
    const p = normalizarTexto(s.nome).split(' ').filter(w => w.length > 2);
    if (!p.length) return false;
    return h.includes(' ' + p.join(' ') + ' ') || (p.length > 1 && h.includes(' ' + p[0] + ' ') && h.includes(' ' + p[p.length - 1] + ' '));
  });
  if (doSocio || RETIRADA.test(h)) return 'socio';
  if (AGUA.test(h)) return 'agua';
  if (LUZ.test(h)) return 'luz';
  if (BOLETOS.test(h)) return 'boletos';
  if (DESPESAS.test(h)) return 'despesas';
  return 'outras-saidas';
}

export interface CategoriaNoPeriodo { id: CategoriaBancaria; rotulo: string; total: number; qtd: number }
export interface MesDoBanco { mes: string; entradas: number; saidas: number; saldoFinal: number }
export interface ResumoDoBanco {
  id: string; nome: string;
  saldoInicial: number; saldoFinal: number; entradas: number; saidas: number;
  meses: MesDoBanco[];
  categorias: CategoriaNoPeriodo[];
  /** tem extrato no período */
  temExtrato: boolean;
}

/** Os bancos no período: saldos, mês a mês e as categorias (as de saída em valor positivo, da maior para a menor). */
export function resumoDosBancos(e: EmpresaExtrator, bancos: readonly { id: string; nome: string }[], primeiro: string, meses: readonly string[], socios: readonly SocioDoCadastro[] = []): ResumoDoBanco[] {
  const ms = [...new Set(meses)].sort();
  if (!ms.length) return [];
  return bancos.map(b => {
    const mov = movimentoDoExtrato(e, b.id, primeiro, ms[0], ms[ms.length - 1]);
    const linhas = mov.linhas.filter(l => ms.includes(l.data.slice(0, 7)));
    const porCat = new Map<CategoriaBancaria, { total: number; qtd: number }>();
    for (const l of linhas) {
      const c = categoriaDoLancamento(l.historico, l.valor, socios);
      const a = porCat.get(c) || { total: 0, qtd: 0 };
      porCat.set(c, { total: a.total + Math.abs(l.valor), qtd: a.qtd + 1 });
    }
    let saldo = mov.saldoAnterior;
    const porMes: MesDoBanco[] = ms.map(m => {
      const doMes = linhas.filter(l => l.data.startsWith(m));
      if (doMes.length) saldo = doMes[doMes.length - 1].saldo;
      return {
        mes: m, saldoFinal: saldo,
        entradas: doMes.filter(l => l.valor > 0).reduce((t, l) => t + l.valor, 0),
        saidas: doMes.filter(l => l.valor < 0).reduce((t, l) => t - l.valor, 0),
      };
    });
    return {
      id: b.id, nome: b.nome, saldoInicial: mov.saldoAnterior, saldoFinal: saldo, temExtrato: linhas.length > 0,
      entradas: porMes.reduce((t, m) => t + m.entradas, 0), saidas: porMes.reduce((t, m) => t + m.saidas, 0), meses: porMes,
      categorias: [...porCat.entries()].map(([id, v]) => ({ id, rotulo: ROTULO_CATEGORIA[id], ...v })).sort((a, c) => c.total - a.total),
    };
  });
}
