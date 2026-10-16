// O caixa × os bancos (Vitor, 16/10/2026: "upar o razão do caixa e procurar nos bancos valores e datas semelhantes, que às
// vezes pagou com caixa, mas tinha no banco"). Cada lançamento do caixa no período procura, nos extratos importados, o
// lançamento do mesmo valor no mesmo sentido (o pagamento pelo caixa que saiu do banco; o recebimento no caixa que entrou
// no banco), até alguns dias de diferença. A transferência entre o caixa e o banco (o saque, o depósito) fica de fora
// sozinha: ela vai no sentido contrário. Só sugere: a pessoa confere e corrige no Alterdata.
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

/** Os lançamentos do caixa nos meses do período que aparecem no banco (até 3 por lançamento). */
export function caixaNoBanco(caixa: readonly LancamentoDoRazao[], extrato: readonly LancamentoDoExtrato[], meses: readonly string[], dias = DIAS_DO_CAIXA_NO_BANCO): CaixaNoBanco[] {
  return caixa
    .filter(l => meses.includes(l.data.slice(0, 7)) && Math.round(l.valor * 100) !== 0)
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
