// A saída do intermediário nads → SCI: a planilha que o gerador do SCI lê (docs/sci/02, item C). Aba "Importar" só com
// os lançamentos prontos (títulos na linha 1, total na última: o gerador usa linha inicial 2 e descarta 1 no fim) e
// aba "Conferir" com os que têm problema e o porquê, para a análise antes de importar.
import * as XLSX from 'xlsx';
import { cnpjValido, cpfValido } from '../../empresas/cadastro/receita';
import type { LancamentoSci, LinhaDoNads, OpcoesDoSci, ResumoDoSci } from '../tipos';
import { lerPlanilhaDoNads } from './leitura';

/** As 15 colunas da planilha do SCI, na ordem do gerador (A a K vão para o SCI; L a O são só para a análise). */
export const COLUNAS_DO_SCI = [
  'Data', 'Débito', 'Crédito', 'Valor', 'Histórico', 'Complemento', 'Documento', 'Lote', 'CNPJ empresa',
  'Participante D', 'Participante C', 'Nome da conta D', 'Nome da conta C', 'Origem', 'Situação no nads',
] as const;

/** O lote cabe em 10 letras no SCI. */
export const TAMANHO_DO_LOTE = 10;

const so = (s: string) => s.replace(/\D/g, '');

/** O CNPJ (ou CPF) com a máscara de sempre; como veio, se não tiver 14 nem 11 números. */
export function documentoComMascara(doc: string): string {
  const d = so(doc);
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return doc.trim();
}

/** O lote padrão do nads: NADS + AAMM do mês (NADS2611). */
export function loteDoMes(mes: string): string {
  const m = mes.match(/^(\d{4})-(\d{2})/);
  return m ? 'NADS' + m[1].slice(2) + m[2] : 'NADS';
}

/** O complemento numa linha só, sem espaço sobrando (o SCI aceita texto longo). */
export function limparComplemento(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** O mês que mais aparece nas linhas (aaaa-mm), para o lote e o nome do arquivo. '' sem linhas com data. */
export function mesPrincipal(linhas: readonly { data: string }[]): string {
  const conta = new Map<string, number>();
  for (const l of linhas) if (l.data) conta.set(l.data.slice(0, 7), (conta.get(l.data.slice(0, 7)) || 0) + 1);
  let melhor = '';
  for (const [m, n] of conta) if (!melhor || n > (conta.get(melhor) || 0) || (n === conta.get(melhor) && m < melhor)) melhor = m;
  return melhor;
}

/** Os lançamentos do SCI a partir das linhas do nads: troca as contas pelo de/para e aponta o que impede a importação. */
export function lancamentosParaOSci(linhas: readonly LinhaDoNads[], op: OpcoesDoSci): LancamentoSci[] {
  const cnpj = documentoComMascara(op.cnpjEmpresa);
  const cnpjOk = cnpjValido(op.cnpjEmpresa) || cpfValido(op.cnpjEmpresa);
  const lote = (op.lote?.trim() || loteDoMes(mesPrincipal(linhas))).slice(0, TAMANHO_DO_LOTE);
  const dePara = op.dePara && op.dePara.size ? op.dePara : null;
  const conta = (c: string) => {
    if (!dePara) return { codigo: c, nome: '', semPar: false };
    const p = dePara.get(c);
    return p ? { codigo: p.codigo, nome: p.nome, semPar: false } : { codigo: c, nome: '', semPar: true };
  };
  return linhas.map(l => {
    const d = conta(l.debito);
    const c = conta(l.credito);
    const historico = l.codHistorico || op.historicoPadrao?.trim() || '';
    const problemas: string[] = [];
    if (!l.data) problemas.push('sem data');
    if (!l.debito) problemas.push('sem conta de débito');
    if (!l.credito) problemas.push('sem conta de crédito');
    if (l.debito && d.semPar) problemas.push('a conta ' + l.debito + ' não tem par no SCI');
    if (l.credito && c.semPar) problemas.push('a conta ' + l.credito + ' não tem par no SCI');
    if (l.debito && l.credito && d.codigo === c.codigo) problemas.push('débito e crédito na mesma conta');
    if (!(l.valor > 0)) problemas.push('sem valor');
    if (!historico) problemas.push('sem histórico');
    if (!cnpjOk) problemas.push('CNPJ da empresa inválido');
    return {
      data: l.data, debito: d.codigo, credito: c.codigo, valor: isNaN(l.valor) ? 0 : l.valor, historico,
      complemento: limparComplemento(l.complemento), documento: l.documento, lote, cnpjEmpresa: cnpj,
      participanteD: '', participanteC: '', nomeD: d.nome, nomeC: c.nome, origem: l.origem, problemas,
    };
  });
}

export function resumoDoSci(lancamentos: readonly LancamentoSci[]): ResumoDoSci {
  const porOrigem = new Map<string, { linhas: number; comProblema: number }>();
  let prontos = 0;
  let valorPronto = 0;
  for (const l of lancamentos) {
    const o = porOrigem.get(l.origem) || { linhas: 0, comProblema: 0 };
    o.linhas++;
    if (l.problemas.length) o.comProblema++;
    else { prontos++; valorPronto += l.valor; }
    porOrigem.set(l.origem, o);
  }
  const meses = [...new Set(lancamentos.map(l => l.data.slice(0, 7)).filter(Boolean))].sort();
  return {
    total: lancamentos.length, prontos, comProblema: lancamentos.length - prontos, valorPronto, meses,
    porOrigem: [...porOrigem].map(([origem, v]) => ({ origem, ...v })),
  };
}

function serialExcel(iso: string): number | string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 + 25569 : iso;
}

const numeroOuTexto = (s: string): number | string => (/^\d{1,15}$/.test(s) ? Number(s) : s);

function linhaDaPlanilha(l: LancamentoSci): (string | number)[] {
  return [
    serialExcel(l.data), numeroOuTexto(l.debito), numeroOuTexto(l.credito), l.valor / 100, numeroOuTexto(l.historico),
    l.complemento, l.documento, l.lote, l.cnpjEmpresa, l.participanteD, l.participanteC, l.nomeD, l.nomeC, l.origem,
    l.problemas.length ? l.problemas.join('; ') : 'pronto',
  ];
}

function aba(aoa: (string | number)[][], linhasDeLancamento: number): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (let r = 1; r <= linhasDeLancamento; r++) {
    const d = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    if (d && typeof d.v === 'number') d.z = 'dd/mm/yyyy';
  }
  for (let r = 1; r < aoa.length; r++) {
    const v = ws[XLSX.utils.encode_cell({ r, c: 3 })];
    if (v && typeof v.v === 'number') v.z = '#,##0.00';
  }
  ws['!cols'] = [11, 12, 12, 13, 10, 50, 11, 10, 20, 20, 20, 30, 30, 26, 30].map(wch => ({ wch }));
  return ws;
}

/**
 * A planilha .xlsx para o SCI. Aba "Importar": títulos, os lançamentos prontos e a linha "Total" (o gerador lê da linha 2
 * e descarta 1 no fim). Aba "Conferir" (só se houver): os que têm problema, com o motivo na coluna Situação.
 */
export function planilhaDoSci(lancamentos: readonly LancamentoSci[]): Uint8Array {
  const prontos = lancamentos.filter(l => !l.problemas.length);
  const comProblema = lancamentos.filter(l => l.problemas.length);
  const total = prontos.reduce((s, l) => s + l.valor, 0);
  const importar: (string | number)[][] = [[...COLUNAS_DO_SCI], ...prontos.map(linhaDaPlanilha)];
  importar.push(['Total', '', '', total / 100, '', '', '', '', '', '', '', '', '', '', prontos.length + ' lançamentos']);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, aba(importar, prontos.length), 'Importar');
  if (comProblema.length) {
    XLSX.utils.book_append_sheet(wb, aba([[...COLUNAS_DO_SCI], ...comProblema.map(linhaDaPlanilha)], comProblema.length), 'Conferir');
  }
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}

export const TIPO_XLSX_SCI = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** sci_<CNPJ só números>_<aaaa-mm>[_<origem>].xlsx */
export function nomeDaPlanilhaSci(cnpjEmpresa: string, mes: string, origem = ''): string {
  const o = origem.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  return 'sci_' + (so(cnpjEmpresa) || 'empresa') + '_' + (mes || 'sem-mes') + (o ? '_' + o : '') + '.xlsx';
}

/**
 * O lote de cada tela (23/11/2026, o botão "Baixar para o SCI"): as 4 primeiras letras da origem + AAMM (CRED2611,
 * CART2611, HONO2611), para no SCI filtrar e excluir só o que veio daquela tela. Sem origem, NADS + AAMM.
 */
export function loteDaOrigem(origem: string, mes: string): string {
  const letras = origem.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  const base = loteDoMes(mes);
  return letras ? letras + base.slice(4) : base;
}

/** O que o botão das telas baixa: a planilha do SCI feita da planilha do Alterdata da tela, e o resumo para o aviso. */
export function planilhaDoSciDaTela(bytesDoAlterdata: Uint8Array, origem: string, op: Omit<OpcoesDoSci, 'lote'>): { bytes: Uint8Array; nome: string; resumo: ResumoDoSci } {
  const linhas = lerPlanilhaDoNads(bytesDoAlterdata, origem);
  const mes = mesPrincipal(linhas);
  const lancamentos = lancamentosParaOSci(linhas, { ...op, lote: loteDaOrigem(origem, mes) });
  return { bytes: planilhaDoSci(lancamentos), nome: nomeDaPlanilhaSci(op.cnpjEmpresa, mes, origem), resumo: resumoDoSci(lancamentos) };
}
