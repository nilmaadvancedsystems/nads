// "O que corrigir no razão" (Vitor, 01/10/2026): as pendências da conferência extrato × razão de um banco no período,
// já ditas do jeito que o contador corrige no sistema contábil. Um item por problema:
//   data   — o lançamento está no razão em outro dia (mudar a data);
//   sinal  — no banco é entrada e no razão está como saída (ou o contrário);
//   valor  — o mesmo lançamento com valor diferente;
//   lote   — no mesmo dia, o que entrou no banco e o que o razão lançou não somam igual (a diferença do dia);
//   falta  — entrou/saiu do banco e não está no razão;
//   sobra  — está no razão e não no banco;
//   duplicado — lançado duas vezes no razão (ou repetido no extrato).
// Quando a diferença de um dia é o contrário da de outro (130,96 a mais em 06/03 e a menos em 18/05), a dica liga os dois.
import type { EmpresaExtrator, LancamentoDoArquivo, LinhaConferencia } from '../tipos';
import { conferenciaDoBanco } from './situacaoDoBanco';
import { dataBR, valorBR } from './texto';

export type TipoCorrecao = 'data' | 'sinal' | 'valor' | 'lote' | 'falta' | 'sobra' | 'duplicado';

export interface CorrecaoDoRazao {
  mes: string;
  /** 'aaaa-mm-dd': o dia do banco */
  data: string;
  tipo: TipoCorrecao;
  /** a frase inteira (para copiar ou ler) */
  texto: string;
  /**
   * A coluna Situação: o problema descrito (Vitor, 02/10/2026: "deixe a descrição do problema, não só Lote não soma").
   * Ex.: "Razão: 17/04 · Correto: 16/04" (o certo é sempre o do banco), "Os 130,96 que faltam parecem estar lançados em 06/03/2026".
   */
  situacao: string;
  /** para a tabela: o lançamento (o histórico do banco, ou do razão quando só ele tem) e o detalhe embaixo */
  lancamento: string;
  detalhe?: string;
  /** o valor no banco e no razão (null = não tem daquele lado) */
  noBanco: number | null;
  noRazao: number | null;
  /** lote: cada lançamento daquele dia, de cada lado (a planilha mostra um por linha, embaixo do lote) */
  partes?: { lado: 'banco' | 'razao'; historico: string; valor: number }[];
  /** razão − banco, em centavos (lote, falta, sobra, valor) */
  diferenca?: number;
  /** a ligação com outro dia (a mesma diferença ao contrário) */
  dica?: string;
}

/** O nome curto de cada tipo (a etiqueta da tabela). */
export const ROTULO_CORRECAO: Record<TipoCorrecao, string> = {
  data: 'Data trocada', sinal: 'Sinal trocado', valor: 'Valor diferente', lote: 'Lote não soma',
  falta: 'Falta no razão', sobra: 'Sobra no razão', duplicado: 'Duplicado',
};

const dia = (d: string) => dataBR(d).slice(0, 5);
const v = (n: number) => valorBR(Math.abs(n));
const soNomes = (l: LancamentoDoArquivo[]) => {
  const ate = l.slice(0, 4).map(x => x.historico + ' ' + v(x.valor)).join(' · ');
  return l.length > 4 ? ate + ' e mais ' + (l.length - 4) : ate;
};
const nomes = (l: LancamentoDoArquivo[]) => {
  const ate = l.slice(0, 4).map(x => x.historico + ' ' + v(x.valor)).join(', ');
  return l.length > 4 ? ate + ' e mais ' + (l.length - 4) : ate;
};

/** As correções de um mês (a conferência do banco naquele mês). */
function correcoesDoMes(mes: string, linhas: LinhaConferencia[]): CorrecaoDoRazao[] {
  const r: CorrecaoDoRazao[] = [];
  const faltando = new Map<string, LancamentoDoArquivo[]>(), amais = new Map<string, LancamentoDoArquivo[]>();
  for (const l of linhas) {
    if (l.situacao === 'ok') continue;
    const e = l.extrato, s = l.sistema;
    if (l.situacao === 'diferente' && e && s) {
      if (l.tipoDiferenca === 'data') r.push({ mes, data: e.data, tipo: 'data', lancamento: s.historico, situacao: 'Razão: ' + dia(s.data) + ' · Correto: ' + dia(e.data), noBanco: e.valor, noRazao: s.valor, texto: s.historico + ' (' + v(s.valor) + ') está no razão em ' + dia(s.data) + '; no banco foi em ' + dia(e.data) + '. Mudar a data.' });
      else if (l.tipoDiferenca === 'sinal') r.push({ mes, data: e.data, tipo: 'sinal', lancamento: s.historico, situacao: e.valor > 0 ? 'No razão como saída · Correto: entrada' : 'No razão como entrada · Correto: saída', noBanco: e.valor, noRazao: s.valor, texto: s.historico + ' (' + v(s.valor) + '): ' + (e.valor > 0 ? 'no banco é entrada e no razão está como saída.' : 'no banco é saída e no razão está como entrada.') });
      else r.push({ mes, data: e.data, tipo: 'valor', diferenca: s.valor - e.valor, lancamento: e.historico, detalhe: 'No razão: ' + s.historico, situacao: 'Razão: ' + v(s.valor) + ' · Correto: ' + v(e.valor), noBanco: e.valor, noRazao: s.valor, texto: e.historico + ': no banco ' + v(e.valor) + ', no razão ' + v(s.valor) + ' (' + s.historico + '). Diferença de ' + v(s.valor - e.valor) + '.' });
    } else if (l.situacao === 'duplicado') {
      const x = (e || s)!;
      r.push({ mes, data: x.data, tipo: 'duplicado', lancamento: x.historico, situacao: l.ladoDuplicado === 'sistema' ? 'Lançado duas vezes no razão' : 'Repetido no extrato; uma vez só no razão', noBanco: e ? e.valor : null, noRazao: s ? s.valor : null, texto: x.historico + ' (' + v(x.valor) + ') ' + (l.ladoDuplicado === 'sistema' ? 'foi lançado duas vezes no razão.' : 'aparece repetido no extrato e uma vez só no razão.') });
    } else if (l.situacao === 'faltando' && e) (faltando.get(e.data) || faltando.set(e.data, []).get(e.data)!).push(e);
    else if (l.situacao === 'amais' && s) (amais.get(s.data) || amais.set(s.data, []).get(s.data)!).push(s);
  }
  const soma = (l: LancamentoDoArquivo[]) => l.reduce((t, x) => t + x.valor, 0);
  for (const d of [...new Set([...faltando.keys(), ...amais.keys()])]) {
    const bs = faltando.get(d) || [], cs = amais.get(d) || [];
    if (bs.length && cs.length) {
      const dif = soma(cs) - soma(bs);
      r.push({
        mes, data: d, tipo: 'lote', diferenca: dif,
        situacao: dif === 0 ? 'Mesmo total, lançamentos diferentes' : 'No dia, ' + v(dif) + (dif > 0 ? ' a mais' : ' a menos') + ' no razão',
        lancamento: bs.length === 1 ? bs[0].historico : bs.length + ' lançamentos no banco', detalhe: 'No razão: ' + soNomes(cs), noBanco: soma(bs), noRazao: soma(cs),
        partes: [
          ...(bs.length > 1 ? bs.map(b => ({ lado: 'banco' as const, historico: b.historico, valor: b.valor })) : []),
          ...cs.map(c => ({ lado: 'razao' as const, historico: c.historico, valor: c.valor })),
        ],
        texto: bs.map(b => b.historico).join(' + ') + ' foi ' + v(soma(bs)) + ' no banco; no razão, ' + (cs.length === 1 ? cs[0].historico + ' está com ' + v(cs[0].valor) : nomes(cs) + ' somam ' + v(soma(cs))) + '. ' +
          (dif === 0 ? 'Mesmo total, lançamentos diferentes.' : v(dif) + (dif > 0 ? ' a mais' : ' a menos') + ' no razão.'),
      });
    } else {
      for (const b of bs) r.push({ mes, data: d, tipo: 'falta', diferenca: -b.valor, lancamento: b.historico, situacao: (b.valor > 0 ? 'Entrou' : 'Saiu') + ' no banco e não está no razão', noBanco: b.valor, noRazao: null, texto: b.historico + ' (' + v(b.valor) + ') ' + (b.valor > 0 ? 'entrou' : 'saiu') + ' no banco e não está no razão.' });
      for (const c of cs) r.push({ mes, data: d, tipo: 'sobra', diferenca: c.valor, lancamento: c.historico, situacao: 'Está no razão e não no banco', noBanco: null, noRazao: c.valor, texto: c.historico + ' (' + v(c.valor) + ') está no razão e não no banco.' });
    }
  }
  return r;
}

/**
 * O que corrigir no razão de um banco no período: os meses com extrato e razão importados (os sem movimento ficam
 * de fora), na ordem das datas. Vazio = nada a corrigir (ou ainda falta importar).
 */
export function correcoesDoRazao(e: EmpresaExtrator, banco: string, primeiro: string, meses: readonly string[], semMovimento: readonly string[] = []): CorrecaoDoRazao[] {
  // a conferência do banco (mês a mês, já sem os lançamentos do cheque especial)
  const c = conferenciaDoBanco(e, banco, primeiro, meses, semMovimento);
  const todas: CorrecaoDoRazao[] = c.pendencias.flatMap(p => correcoesDoMes(p.mes, p.linhas));
  todas.sort((a, b) => a.data.localeCompare(b.data));
  // num dia que fecha negativo, o que sobra no razão pode ser o cheque especial com o valor errado
  const negativo = new Map(c.negativos.map(n => [n.data, n.saldo]));
  for (const x of todas) {
    const s = negativo.get(x.data);
    if (s == null || x.dica || !(x.tipo === 'sobra' || x.tipo === 'lote' || x.tipo === 'valor')) continue;
    x.dica = 'O banco fecha negativo neste dia (' + valorBR(s) + '): se for o cheque especial, o ajuste é de ' + valorBR(Math.abs(s)) + ' e o estorno, no dia seguinte.';
  }
  // a mesma diferença ao contrário em outro dia: provavelmente o mesmo lançamento no dia errado
  for (const c of todas) {
    if (!c.diferenca) continue;
    const par = todas.find(o => o !== c && o.diferenca === -c.diferenca! && o.data !== c.data);
    // a ligação com o outro dia é a própria pendência: vai para a Situação
    if (par) c.situacao = c.diferenca > 0
      ? 'Os ' + v(c.diferenca) + ' a mais parecem ser de ' + dataBR(par.data)
      : 'Os ' + v(c.diferenca) + ' que faltam parecem estar lançados em ' + dataBR(par.data);
  }
  return todas;
}
