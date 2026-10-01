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
import type { ArquivoImportado, EmpresaExtrator, LancamentoDoArquivo, LinhaConferencia } from '../tipos';
import { arquivosDoBanco } from './bancos';
import { conferir } from './conferencia';
import { dataBR, valorBR } from './texto';

export type TipoCorrecao = 'data' | 'sinal' | 'valor' | 'lote' | 'falta' | 'sobra' | 'duplicado';

export interface CorrecaoDoRazao {
  mes: string;
  /** 'aaaa-mm-dd': o dia do banco */
  data: string;
  tipo: TipoCorrecao;
  texto: string;
  /** razão − banco, em centavos (lote, falta, sobra, valor) */
  diferenca?: number;
  /** a ligação com outro dia (a mesma diferença ao contrário) */
  dica?: string;
}

const dia = (d: string) => dataBR(d).slice(0, 5);
const v = (n: number) => valorBR(Math.abs(n));
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
      if (l.tipoDiferenca === 'data') r.push({ mes, data: e.data, tipo: 'data', texto: s.historico + ' (' + v(s.valor) + ') está no razão em ' + dia(s.data) + '; no banco foi em ' + dia(e.data) + '. Mudar a data.' });
      else if (l.tipoDiferenca === 'sinal') r.push({ mes, data: e.data, tipo: 'sinal', texto: s.historico + ' (' + v(s.valor) + '): ' + (e.valor > 0 ? 'no banco é entrada e no razão está como saída.' : 'no banco é saída e no razão está como entrada.') });
      else r.push({ mes, data: e.data, tipo: 'valor', diferenca: s.valor - e.valor, texto: e.historico + ': no banco ' + v(e.valor) + ', no razão ' + v(s.valor) + ' (' + s.historico + '). Diferença de ' + v(s.valor - e.valor) + '.' });
    } else if (l.situacao === 'duplicado') {
      const x = (e || s)!;
      r.push({ mes, data: x.data, tipo: 'duplicado', texto: x.historico + ' (' + v(x.valor) + ') ' + (l.ladoDuplicado === 'sistema' ? 'foi lançado duas vezes no razão.' : 'aparece repetido no extrato e uma vez só no razão.') });
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
        texto: bs.map(b => b.historico).join(' + ') + ' foi ' + v(soma(bs)) + ' no banco; no razão, ' + (cs.length === 1 ? cs[0].historico + ' está com ' + v(cs[0].valor) : nomes(cs) + ' somam ' + v(soma(cs))) + '. ' +
          (dif === 0 ? 'Mesmo total, lançamentos diferentes.' : v(dif) + (dif > 0 ? ' a mais' : ' a menos') + ' no razão.'),
      });
    } else {
      for (const b of bs) r.push({ mes, data: d, tipo: 'falta', diferenca: -b.valor, texto: b.historico + ' (' + v(b.valor) + ') ' + (b.valor > 0 ? 'entrou' : 'saiu') + ' no banco e não está no razão.' });
      for (const c of cs) r.push({ mes, data: d, tipo: 'sobra', diferenca: c.valor, texto: c.historico + ' (' + v(c.valor) + ') está no razão e não no banco.' });
    }
  }
  return r;
}

/**
 * O que corrigir no razão de um banco no período: os meses com extrato e razão importados (os sem movimento ficam
 * de fora), na ordem das datas. Vazio = nada a corrigir (ou ainda falta importar).
 */
export function correcoesDoRazao(e: EmpresaExtrator, banco: string, primeiro: string, meses: readonly string[], semMovimento: readonly string[] = []): CorrecaoDoRazao[] {
  const doMes = (lado: ArquivoImportado['lado'], mes: string): LancamentoDoArquivo[] =>
    arquivosDoBanco(e, banco, primeiro, lado, mes).flatMap(a =>
      a.lancamentos.flatMap((l, i) => (l.data.startsWith(mes) ? [{ ...l, id: a.id + ':' + i, idArquivo: a.id, lado }] : [])));
  const todas: CorrecaoDoRazao[] = [];
  for (const mes of meses) {
    if (semMovimento.includes(mes)) continue;
    const extrato = doMes('banco', mes), razao = doMes('sistema', mes);
    if (!extrato.length || !razao.length) continue;
    todas.push(...correcoesDoMes(mes, conferir(extrato, razao).linhas));
  }
  todas.sort((a, b) => a.data.localeCompare(b.data));
  // a mesma diferença ao contrário em outro dia: provavelmente o mesmo lançamento no dia errado
  for (const c of todas) {
    if (!c.diferenca) continue;
    const par = todas.find(o => o !== c && o.diferenca === -c.diferenca! && o.data !== c.data);
    if (par) c.dica = c.diferenca > 0
      ? 'Os ' + v(c.diferenca) + ' a mais parecem ser de ' + dataBR(par.data) + ' (lá faltam ' + v(c.diferenca) + ' no razão).'
      : 'Os ' + v(c.diferenca) + ' que faltam parecem estar lançados em ' + dataBR(par.data) + ' (lá sobram ' + v(c.diferenca) + ' no razão).';
  }
  return todas;
}
