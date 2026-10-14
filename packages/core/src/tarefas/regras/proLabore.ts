// Os pagamentos do pró-labore para o razão zerar (Vitor, 14/10/2026: "eu queria importar os pagamentos para esse razão
// zerar, nessa etapa do pró-labore"). O razão do Pró-labore a pagar do Alterdata traz, por competência e sócio, o
// pró-labore a crédito e o INSS descontado a débito, os dois com "<mm/aaaa> NOME DO SÓCIO" no histórico:
//
//     Pelo valor de retirada pró-labore a pagar ?  <01/2026> CARLOS HUMBERTO …          3.242,00 C
//     Pelo valor de INSS a recolher descontado s/ retirada pró-labore  <01/2026> CARLOS …   356,62 D
//
// O que sobra de cada competência e sócio (o líquido) é o pagamento que falta: D Pró-labore a pagar, C a conta que a
// pessoa escolhe (o banco, o caixa), H "Pagamento de pro-labore mm/aaaa SÓCIO". Pagamento sem a competência no
// histórico abate as mais antigas; o saldo de antes do razão entra como a competência anterior à primeira.
import type { RazaoDaConta } from './razao';

export interface PagamentoDoProLabore {
  /** 'aaaa-mm' */
  competencia: string;
  socio: string;
  /** o líquido que falta pagar (positivo) */
  valor: number;
  /** 'aaaa-mm-dd': o último dia da competência */
  data: string;
  historico: string;
  /** veio do saldo de antes do razão (sem os lançamentos para conferir) */
  doSaldoAnterior?: boolean;
}

const centavos = (n: number) => Math.round(n * 100) / 100;
const RE_REF = /<(\d{2})\/(\d{4})>\s*(.*)$/;
const fimDoMes = (m: string) => m + '-' + String(new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate()).padStart(2, '0');
const mesAntes = (m: string) => { const [a, mm] = m.split('-').map(Number); return mm === 1 ? (a - 1) + '-12' : a + '-' + String(mm - 1).padStart(2, '0'); };
const mesBR = (m: string) => m.slice(5, 7) + '/' + m.slice(0, 4);

/** O histórico do pagamento: "Pagamento de pro-labore 01/2026 CARLOS HUMBERTO VOLPONI RODRIGUES". */
export const historicoDoPagamento = (competencia: string, socio: string) => ('Pagamento de pro-labore ' + mesBR(competencia) + ' ' + socio).trim();

/** O que falta pagar de cada competência e sócio, da mais antiga para a mais nova (só o que sobra). */
export function pagamentosDoProLabore(razao: RazaoDaConta): PagamentoDoProLabore[] {
  const grupos = new Map<string, { competencia: string; socio: string; valor: number; anterior?: boolean }>();
  const soltos: number[] = [];
  for (const l of razao.lancamentos) {
    const m = RE_REF.exec(l.historico);
    if (!m) { soltos.push(l.valor); continue; }
    const competencia = m[2] + '-' + m[1];
    const socio = m[3].replace(/\s+/g, ' ').trim();
    const k = competencia + '|' + socio;
    const g = grupos.get(k) || { competencia, socio, valor: 0 };
    g.valor = centavos(g.valor + l.valor);
    grupos.set(k, g);
  }
  const ordem = [...grupos.values()].sort((a, b) => a.competencia.localeCompare(b.competencia) || a.socio.localeCompare(b.socio));
  // o saldo de antes do razão (credor = pró-labore que vinha sem pagar): a competência anterior, com o sócio mais comum
  if (razao.saldoInicial > 0.005 && ordem.length) {
    const conta = new Map<string, number>();
    for (const g of ordem) conta.set(g.socio, (conta.get(g.socio) || 0) + 1);
    const socio = [...conta].sort((a, b) => b[1] - a[1])[0][0];
    ordem.unshift({ competencia: mesAntes(ordem[0].competencia), socio, valor: centavos(razao.saldoInicial), anterior: true });
  }
  // o pagamento (ou crédito) sem a competência no histórico: abate as mais antigas
  let solto = centavos(soltos.reduce((t, v) => t + v, 0));
  for (const g of ordem) {
    if (solto >= -0.005) break;
    const usa = Math.min(g.valor, -solto);
    if (usa <= 0) continue;
    g.valor = centavos(g.valor - usa);
    solto = centavos(solto + usa);
  }
  return ordem.filter(g => g.valor > 0.005).map(g => ({
    competencia: g.competencia, socio: g.socio, valor: g.valor, data: fimDoMes(g.competencia),
    historico: historicoDoPagamento(g.competencia, g.socio), ...(g.anterior ? { doSaldoAnterior: true } : {}),
  }));
}
