// A planilha do resultado do Verificar por conta (Vitor, 22/10/2026: "deixe a exportação disso mais completa, mostrando na
// planilha tudo certinho, o que tá faltando e o que está duplicado"): no lugar do CSV de uma tabela só, um .xlsx com uma aba
// por assunto — o Resumo (a conta, o CFOP, o período, os totais e o que explica a diferença), Faltando (a nota inteira),
// Duplicadas (cada nota com o valor dela, quanto foi lançado e cada lançamento a mais, com o histórico), A mais, Operação
// incorreta, ICMS, Não vão para o Contábil e as Conferidas pelo valor. Os valores vão como número (somam no Excel).
import * as XLSX from 'xlsx';
import { semPendencias, linhaDaTabela, linhasFaltando, linhasForaDoContabil, operacaoIncorretaDe, partesDoHistorico, totaisVerificacao, type LinhaRazao, type LinhaTabela, type ResultadoVerificacao } from './verificarConta';
import { slugArquivoLegado } from './consultaCsv';

type Celula = string | number;
const MOEDA = '#,##0.00';
const centavos = (v: number) => Math.round(v * 100) / 100;

/** Uma aba: o cabeçalho, as linhas, as colunas de valor (formato de moeda) e a largura de cada coluna. */
function aba(cab: string[], linhas: Celula[][], larguras: number[], total?: { rotulo: string; coluna: number }): XLSX.WorkSheet {
  const corpo: Celula[][] = [cab, ...linhas];
  if (total && linhas.length) {
    const t: Celula[] = cab.map(() => '');
    t[0] = total.rotulo;
    t[total.coluna] = centavos(linhas.reduce((s, l) => s + (typeof l[total.coluna] === 'number' ? (l[total.coluna] as number) : 0), 0));
    corpo.push([], t);
  }
  const ws = XLSX.utils.aoa_to_sheet(corpo);
  ws['!cols'] = larguras.map(wch => ({ wch }));
  // as colunas de valor com o formato de moeda
  for (const ref of Object.keys(ws)) {
    if (ref.startsWith('!')) continue;
    const c = ws[ref] as XLSX.CellObject;
    if (c.t === 'n') c.z = MOEDA;
  }
  return ws;
}

export interface InfoDaPlanilha {
  empresa: string;
  /** '01/01/2026 a 31/08/2026' (vazio = todas as notas) */
  periodo: string;
}

/** O .xlsx do resultado (as abas sem nada ficam de fora; o Resumo vai sempre). */
export function planilhaVerificacao(r: ResultadoVerificacao, info: InfoDaPlanilha): Uint8Array {
  const t = totaisVerificacao(r);
  const multi = !!(r.contas && r.contas.length > 1);
  const comConta = (l: { conta?: string }, resto: Celula[]): Celula[] => (multi ? [l.conta || '', ...resto] : resto);
  const cabConta = (cab: string[]) => (multi ? ['Conta', ...cab] : cab);
  const larg = (ls: number[]) => (multi ? [10, ...ls] : ls);
  const wb = XLSX.utils.book_new();

  // ── Resumo ──
  const resumo: Celula[][] = [
    ['Verificar por conta'],
    [],
    ['Empresa', info.empresa],
    ['Conta contábil', r.conta.codigo + ' — ' + r.conta.nome],
    ['Notas conferidas', r.fonte],
    ['Período', info.periodo || 'Todas as notas importadas'],
    ['Situação', semPendencias(r) ? 'Sem pendências' : 'Com pendências'],
    [],
    ['Relatório da conta', centavos(r.somaRazao)],
    ['Notas fiscais', centavos(r.somaFiscal)],
    ['Diferença', centavos(t.diferenca)],
    [],
    ['O que explica a diferença', 'Valor', 'Quantidade'],
    ['Faltando na conta', centavos(t.faltando), r.faltando.length],
    ['Duplicadas na conta', centavos(t.duplicadas), r.duplicada.length],
    ['Operação incorreta', centavos(t.operacaoIncorreta), operacaoIncorretaDe(r).length],
    ['A mais na conta', centavos(t.aMais), r.aMais.length],
    ['ICMS', centavos(t.icms), r.icms.length],
    ...(Math.abs(t.semExplicacao) >= 0.005 ? [['Sem explicação', centavos(t.semExplicacao), ''] as Celula[]] : []),
    ...((r.foraDoContabil || []).length ? [[], ['Não vão para o Contábil (fora da soma das notas)', centavos((r.foraDoContabil || []).reduce((s, n) => s + n.valor, 0)), (r.foraDoContabil || []).length] as Celula[]] : []),
  ];
  XLSX.utils.book_append_sheet(wb, aba(resumo[0].map(String), resumo.slice(1), [44, 60, 12]), 'Resumo');

  // ── Faltando na conta: a nota inteira ──
  const notas = (ls: LinhaTabela[]) => ls.map(l => [l.data, l.nota || '', l.part || '', l.operacao || '', l.cfop || '', l.exportado || '', centavos(l.valor)] as Celula[]);
  const CAB_NOTA = ['Data', 'Nota', 'Participante', 'Operação', 'CFOP', 'Exportado', 'Valor'];
  const LARG_NOTA = [12, 12, 46, 11, 8, 10, 14];
  const faltando = linhasFaltando(r);
  if (faltando.length) XLSX.utils.book_append_sheet(wb, aba(CAB_NOTA, notas(faltando), LARG_NOTA, { rotulo: 'Total', coluna: 6 }), 'Faltando');

  // ── Duplicadas: a nota, quantas vezes está no relatório, o valor dela e cada lançamento a mais ──
  if (r.duplicada.length) {
    const linhas: Celula[][] = [];
    for (const d of r.duplicada) {
      for (const l of d.linhas) {
        const p = partesDoHistorico(l.txt);
        linhas.push(comConta(l, [d.numero, d.vezes, l.data, p.nome || '', l.contra || p.lanc || '', l.operacao || '', l.txt, centavos(l.valor)]));
      }
    }
    const cab = cabConta(['Nota', 'Vezes no relatório', 'Data', 'Participante', 'Contrapartida', 'Operação', 'Histórico', 'Lançado a mais']);
    XLSX.utils.book_append_sheet(wb, aba(cab, linhas, larg([12, 10, 12, 40, 14, 11, 70, 14]), { rotulo: 'Total a mais', coluna: cab.length - 1 }), 'Duplicadas');
  }

  // ── as linhas do relatório: A mais, Operação incorreta e ICMS (com o histórico inteiro) ──
  const doRelatorio = (ls: LinhaRazao[]) => ls.map(l => { const x = linhaDaTabela(l); return comConta(l, [x.data, x.nota || '', x.part || '', x.contra || '', x.operacao || '', l.txt, centavos(x.valor)]); });
  const CAB_REL = cabConta(['Data', 'Nota', 'Participante', 'Contrapartida', 'Operação', 'Histórico', 'Valor']);
  const LARG_REL = larg([12, 12, 40, 14, 11, 70, 14]);
  const totalRel = { rotulo: 'Total', coluna: CAB_REL.length - 1 };
  if (r.aMais.length) XLSX.utils.book_append_sheet(wb, aba(CAB_REL, doRelatorio(r.aMais), LARG_REL, totalRel), 'A mais');
  if (operacaoIncorretaDe(r).length) XLSX.utils.book_append_sheet(wb, aba(CAB_REL, doRelatorio(operacaoIncorretaDe(r)), LARG_REL, totalRel), 'Operação incorreta');
  if (r.icms.length) XLSX.utils.book_append_sheet(wb, aba(CAB_REL, doRelatorio(r.icms), LARG_REL, totalRel), 'ICMS');

  // ── as notas fora (não vão para o Contábil) e as conferidas pelo valor (a nota sem o número no histórico) ──
  const fora = linhasForaDoContabil(r);
  if (fora.length) XLSX.utils.book_append_sheet(wb, aba(CAB_NOTA, notas(fora), LARG_NOTA, { rotulo: 'Total', coluna: 6 }), 'Não vão para o Contábil');
  if (r.peloValor.length) {
    const ls = r.peloValor.map(({ nota, linha }) => [nota.data, nota.numero, nota.nome, centavos(nota.valor), linha.data, linha.txt] as Celula[]);
    XLSX.utils.book_append_sheet(wb, aba(['Data da nota', 'Nota', 'Participante', 'Valor', 'Data no relatório', 'Histórico no relatório'], ls, [12, 12, 40, 14, 14, 70]), 'Conferidas pelo valor');
  }
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}

/** "verificar-conta-nome-da-empresa-98005.xlsx" */
export function nomePlanilhaVerificacao(empresa: string, conta: string): string {
  return 'verificar-conta-' + slugArquivoLegado(empresa) + (conta ? '-' + conta.replace(/[^0-9a-z]+/gi, '-') : '') + '.xlsx';
}
