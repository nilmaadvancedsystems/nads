// O caixa × os bancos (Vitor, 16/10/2026: "upar o razão do caixa e procurar nos bancos valores e datas semelhantes, que às
// vezes pagou com caixa, mas tinha no banco"). Cada pagamento do caixa no período (o que saiu do caixa) procura, nos
// extratos importados, o que saiu do banco com o mesmo valor, até alguns dias de diferença. A transferência entre o caixa
// e o banco (a contrapartida é o banco) fica de fora. Só sugere: a pessoa confere e corrige no Alterdata.
import { normalizarTexto } from '../../formatos';
import type { LancamentoDoRazao } from './razao';

/** Um lançamento do extrato: data 'aaaa-mm-dd', valor em centavos (+ entrou, − saiu), o histórico e o banco (o nome e a marca). */
export interface LancamentoDoExtrato { data: string; valor: number; historico: string; banco: string; marca?: string }

export interface CaixaNoBanco {
  /** o lançamento do razão do caixa (o valor como o Alterdata: crédito positivo = saiu do caixa) */
  caixa: LancamentoDoRazao;
  /** saiu do caixa (um pagamento); senão, entrou (um recebimento) */
  saida: boolean;
  /** os lançamentos do banco do mesmo valor e sentido, do mais perto para o mais longe; dias = banco − caixa */
  noBanco: (LancamentoDoExtrato & { dias: number })[];
}

/** Até quantos dias de diferença entre o caixa e o banco. */
export const DIAS_DO_CAIXA_NO_BANCO = 5;

const dia = (d: string) => { const [a, m, x] = d.split('-').map(Number); return Date.UTC(a, m - 1, x) / 86400000; };

/** A contrapartida é uma conta de banco (a transferência entre o caixa e o banco, não o pagamento). */
const BANCO = /\b(banco|bco|sicoob|sicredi|bradesco|itau|santander|nubank|inter|c6|btg|cora|stone|pagbank|pagseguro|mercado pago|caixa economica|aplicacao|aplicacoes)\b/;

/**
 * Os pagamentos do caixa nos meses do período que também saíram do banco (até 3 por lançamento). Só o que saiu (Vitor,
 * 16/10/2026: "o que sai do banco e o que está saindo do caixa"); a transferência com o banco (a contrapartida é o banco)
 * fica de fora.
 */
export function caixaNoBanco(caixa: readonly LancamentoDoRazao[], extrato: readonly LancamentoDoExtrato[], meses: readonly string[], dias = DIAS_DO_CAIXA_NO_BANCO): CaixaNoBanco[] {
  return caixa
    .filter(l => meses.includes(l.data.slice(0, 7)) && Math.round(l.valor * 100) > 0 && !BANCO.test(normalizarTexto(l.nomeContrapartida)))
    .map(l => {
      const centavos = Math.round(Math.abs(l.valor) * 100);
      // no razão do Alterdata o crédito vem positivo: no caixa, é o que saiu
      const saida = l.valor > 0;
      const noBanco = extrato
        .filter(b => Math.abs(b.valor) === centavos && (saida ? b.valor < 0 : b.valor > 0))
        .map(b => ({ ...b, dias: dia(b.data) - dia(l.data) }))
        .filter(b => Math.abs(b.dias) <= dias)
        .sort((a, b) => Math.abs(a.dias) - Math.abs(b.dias) || a.dias - b.dias)
        .slice(0, 3);
      return { caixa: l, saida, noBanco };
    })
    .filter(x => x.noBanco.length > 0);
}
