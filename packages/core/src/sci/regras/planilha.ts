// A saída do intermediário nads → SCI: a planilha que o gerador do SCI lê (docs/sci/02, item C). Aba "Importar" só com
// os lançamentos prontos (títulos na linha 1 e nada depois do último: o gerador usa linha inicial 2 e descarta 0 no fim) e
// aba "Conferir" com os que têm problema e o porquê, para a análise antes de importar.
//
// A regra (26/11/2026: "Leva como regra nesses arquivos exportados da sci, eu quero ele 100% pronto, não quero editar. Então
// remova: esse total e os dados da coluna lote, deixa vazia!"): sem a linha Total no fim e a coluna Lote só com o título.
import * as XLSX from 'xlsx';
import type { LancamentoSci, LinhaDoNads, OpcoesDoSci, ResumoDoSci } from '../tipos';
import { lerPlanilhaDoNads } from './leitura';
import { classificacaoNormal } from './dePara';
import { contaDoPlano, type ContaDoPlanoSci, type PlanoSci } from './plano';

/**
 * As 11 colunas da planilha do SCI, as do modelo "nads" do Gerador de integração de lançamentos contábeis por planilha, na
 * ordem e com os nomes dos campos dele (25/11/2026: "Eu quero exatamente no layout de exportacao do SCI! Tem colunas aqui sem
 * sentido"; "Nome da conta D? que isso nao ta no layout"). As colunas de análise (o nome das contas, a origem e o motivo) ficam
 * só na aba Conferir, que não vai para o SCI.
 */
/**
 * A coluna I (o CNPJ da filial) fica VAZIA, sem título e sem dado (27/11/2026, Vitor, depois de o SCI recusar a planilha com
 * "Arquivo não corresponde ao leiaute esperado": "Coluna CNPJ filial, a coluna I e vazia, nao eh pra ter nada! Nem cabecalho").
 * O '' aqui segura a posição; na planilha a célula nem existe.
 */
export const COLUNAS_DO_SCI = [
  'Data', 'Débito', 'Crédito', 'Valor principal', 'Histórico', 'Complemento', 'Documento', 'Lote', '',
  'Participante a débito', 'Participante a crédito',
] as const;
/** a coluna I (índice 8): sem nada */
const COLUNA_VAZIA = 8;
type Celula = string | number | null;
const titulos = (cs: readonly string[]): Celula[] => cs.map((c, i) => (i === COLUNA_VAZIA ? null : c));

/** A aba Conferir: as colunas do SCI e, depois, as da análise. */
export const COLUNAS_DA_CONFERENCIA = [...COLUNAS_DO_SCI, 'Nome da conta D', 'Nome da conta C', 'Origem', 'Motivo'] as const;

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

// o controle do lote: o que não confunde na tela nem no papel (sem 0/O, 1/I)
const LETRAS_DO_LOTE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function sortearLetras(n: number): string {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, x => LETRAS_DO_LOTE[x % LETRAS_DO_LOTE.length]).join('');
}

/** A base do lote do minimum tem 7 caracteres; os 3 do fim (001, 002…) são a chave de cada lançamento: 7 + 3 = os 10 do SCI. */
export const TAMANHO_DA_BASE_DO_LOTE = 7;
/** a chave de cada lançamento: 3 algarismos, então até 999 lançamentos por planilha */
export const MAX_LANCAMENTOS_POR_LOTE = 999;

/**
 * O lote do minimum (27/11/2026, Vitor: "ao exportar os arquivos, voce vai colocar na coluna lote, um codigo propio, feitos em
 * letras maiusculas, e numeros, que dentre desses numeros tenha o codigo da empresa"; "vai ser um lote por planilha"; depois:
 * cada linha leva [lote]001, [lote]002…, para excluir no SCI o lote todo ou um lançamento só; "a codificacao faz como quiser").
 * A base: M + o código da empresa (sem zeros na frente) + letras sorteadas até 7 (M583KQT). Na planilha, cada lançamento leva a
 * base + 001, 002… (M583KQT001). As letras separam a empresa da chave. Cada planilha, uma base nova. sortear: só o teste troca.
 */
export function loteDoMinimum(codigoDaEmpresa: number, sortear: (n: number) => string = sortearLetras): string {
  // o código da empresa no SCI tem até 5 algarismos; com 5, sobra 1 letra
  const empresa = String(Math.max(0, Math.trunc(codigoDaEmpresa) || 0)).slice(-5);
  const n = TAMANHO_DA_BASE_DO_LOTE - 1 - empresa.length;
  const letras = sortear(n).toUpperCase().replace(/[^A-Z]/g, '').padEnd(n, 'X').slice(0, n);
  return 'M' + empresa + letras;
}

/** A chave do lançamento n (1, 2…) no lote: a base + 3 algarismos (M583KQT + 1 → M583KQT001). */
export function chaveDoLancamento(base: string, n: number): string {
  return base + String(n).padStart(3, '0');
}

/** Se o texto é a base de um lote do minimum (7: M + empresa + letras). */
const ehBaseDoMinimum = (lote: string) => lote.length === TAMANHO_DA_BASE_DO_LOTE && /^M\d{1,5}[A-Z]+$/.test(lote);

/**
 * O que um lote do minimum diz: a empresa, a base e, se tiver, o número do lançamento (M583KQT001 → 583, M583KQT, 1; M583KQT →
 * 583, M583KQT, null). null se não é um lote do minimum.
 */
export function lerLoteDoMinimum(lote: string): { empresa: number; base: string; lancamento: number | null } | null {
  const t = lote.trim().toUpperCase();
  const m = /^(M(\d{1,5})[A-Z]+)(\d{3})?$/.exec(t);
  if (!m || m[1].length !== TAMANHO_DA_BASE_DO_LOTE) return null;
  return { empresa: Number(m[2]), base: m[1], lancamento: m[3] ? Number(m[3]) : null };
}

/** A empresa de um lote do minimum (M583KQT001 ou M583KQT → 583), ou null se não é um lote do minimum. */
export function empresaDoLote(lote: string): number | null {
  return lerLoteDoMinimum(lote)?.empresa ?? null;
}

/**
 * A chave de cada lançamento na planilha (na ordem dos lançamentos): os prontos levam a base + 001, 002… na ordem em que vão para
 * o Importar; os com problema não vão para o SCI e ficam sem chave (''). Lote que não é do minimum: o mesmo em todos.
 */
export function chavesDaPlanilha(lancamentos: readonly LancamentoSci[], lote: string): string[] {
  if (!ehBaseDoMinimum(lote)) return lancamentos.map(() => lote);
  let n = 0;
  return lancamentos.map(l => (l.problemas.length ? '' : chaveDoLancamento(lote, ++n)));
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

/** A conta do SCI pelo que vai na planilha: o código reduzido, o apelido ou a classificação (o SCI aceita os três). */
export function contaNoPlanoSci(plano: PlanoSci, texto: string): ContaDoPlanoSci | null {
  const pelo = contaDoPlano(plano, texto);
  if (pelo || !texto.includes('.')) return pelo;
  const c = classificacaoNormal(texto);
  return plano.contas.find(x => classificacaoNormal(x.classificacao) === c) || null;
}

function problemasNoPlano(plano: PlanoSci, lado: 'débito' | 'crédito', codigo: string, participante: string): string[] {
  if (!codigo) return [];
  const c = contaNoPlanoSci(plano, codigo);
  if (!c) return ['a conta ' + codigo + ' não existe no plano ' + plano.id + ' do SCI'];
  if (!c.analitica) return ['a conta ' + codigo + ' (' + c.nome + ') não recebe lançamento no SCI'];
  if (c.participante && !participante.trim()) return ['a conta de ' + lado + ' ' + codigo + ' pede o ' + c.participante + ' (participante)'];
  return [];
}

/** Os lançamentos do SCI a partir das linhas do nads: troca as contas pelo de/para e aponta o que impede a importação. */
export function lancamentosParaOSci(linhas: readonly LinhaDoNads[], op: OpcoesDoSci): LancamentoSci[] {
  const cnpj = documentoComMascara(op.cnpjEmpresa);
  const lote = (op.lote?.trim() || loteDoMes(mesPrincipal(linhas))).slice(0, TAMANHO_DO_LOTE);
  const dePara = op.dePara && op.dePara.size ? op.dePara : null;
  const conta = (c: string) => {
    if (!dePara) return { codigo: c, nome: '', semPar: false };
    const p = dePara.get(c);
    return p ? { codigo: p.codigo, nome: p.nome, semPar: false } : { codigo: c, nome: '', semPar: true };
  };
  const nomeNoPlano = (codigo: string) => (op.planoSci && codigo ? contaNoPlanoSci(op.planoSci, codigo)?.nome || '' : '');
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
    // o CNPJ não vai mais na planilha (a coluna I vazia) e não impede mais (27/11/2026: "Sim, tira")
    if (op.planoSci) {
      if (!d.semPar) problemas.push(...problemasNoPlano(op.planoSci, 'débito', d.codigo, ''));
      if (!c.semPar) problemas.push(...problemasNoPlano(op.planoSci, 'crédito', c.codigo, ''));
    }
    return {
      data: l.data, debito: d.codigo, credito: c.codigo, valor: isNaN(l.valor) ? 0 : l.valor, historico,
      complemento: limparComplemento(l.complemento), documento: l.documento, lote, cnpjEmpresa: cnpj,
      participanteD: '', participanteC: '', nomeD: d.nome || nomeNoPlano(d.codigo), nomeC: c.nome || nomeNoPlano(c.codigo), origem: l.origem, problemas,
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

/**
 * lote: o da planilha toda (o do minimum, um por planilha; 27/11/2026: "ao exportar os arquivos, voce vai colocar na coluna lote, um
 * codigo propio"). Sem ele, a coluna Lote vai vazia, como antes (26/11/2026: "os dados da coluna lote, deixa vazia!").
 */
function linhaDaPlanilha(l: LancamentoSci, lote = ''): Celula[] {
  return [
    serialExcel(l.data), numeroOuTexto(l.debito), numeroOuTexto(l.credito), l.valor / 100, numeroOuTexto(l.historico),
    // a coluna I vazia: nada, nem o CNPJ (27/11/2026)
    l.complemento, l.documento, lote, null, l.participanteD, l.participanteC,
  ];
}

/** A linha da aba Conferir: a do SCI, o nome das contas, a origem e o motivo de não estar pronto. */
const linhaDaConferencia = (l: LancamentoSci, lote = ''): Celula[] => [...linhaDaPlanilha(l, lote), l.nomeD, l.nomeC, l.origem, l.problemas.join('; ')];

function aba(aoa: Celula[][], linhasDeLancamento: number): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (let r = 1; r <= linhasDeLancamento; r++) {
    const d = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    if (d && typeof d.v === 'number') d.z = 'dd/mm/yyyy';
  }
  for (let r = 1; r < aoa.length; r++) {
    const v = ws[XLSX.utils.encode_cell({ r, c: 3 })];
    if (v && typeof v.v === 'number') v.z = '#,##0.00';
  }
  ws['!cols'] = [11, 12, 12, 13, 10, 50, 11, 10, 20, 20, 20, 30, 30, 26, 30].slice(0, aoa[0]?.length ?? 15).map(wch => ({ wch }));
  return ws;
}

/**
 * A planilha .xlsx para o SCI, pronta para importar sem editar nada. Aba "Importar": as 11 colunas do gerador, com os títulos
 * e os lançamentos prontos, sem a linha Total (o gerador lê da linha 2 e descarta 0 no fim). Aba "Conferir" (só se houver): os
 * que têm problema, com o nome das contas, a origem e o motivo depois das colunas do SCI.
 */
export function planilhaDoSci(lancamentos: readonly LancamentoSci[], lote = ''): Uint8Array {
  const prontos = lancamentos.filter(l => !l.problemas.length);
  const comProblema = lancamentos.filter(l => l.problemas.length);
  if (ehBaseDoMinimum(lote) && prontos.length > MAX_LANCAMENTOS_POR_LOTE) {
    throw new Error('A planilha tem ' + prontos.length + ' lançamentos prontos: o lote vai até ' + MAX_LANCAMENTOS_POR_LOTE + ' (a chave de cada um tem 3 algarismos). Divida em mais de uma planilha.');
  }
  const chaves = chavesDaPlanilha(lancamentos, lote);
  const chaveDe = new Map(lancamentos.map((l, i) => [l, chaves[i]]));
  // o lote do minimum: cada lançamento com a sua chave (a base + 001, 002…); os da aba Conferir, só a base (não vão para o SCI)
  const importar: Celula[][] = [titulos(COLUNAS_DO_SCI), ...prontos.map(l => linhaDaPlanilha(l, chaveDe.get(l) ?? lote))];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, aba(importar, prontos.length), 'Importar');
  if (comProblema.length) {
    XLSX.utils.book_append_sheet(wb, aba([titulos(COLUNAS_DA_CONFERENCIA), ...comProblema.map(l => linhaDaConferencia(l, lote))], comProblema.length), 'Conferir');
  }
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}

export const TIPO_XLSX_SCI = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** sci_<CNPJ só números>_<aaaa-mm>[_<origem>][_<lote>].xlsx (o lote do minimum no nome: o arquivo e o lote no SCI se acham) */
export function nomeDaPlanilhaSci(cnpjEmpresa: string, mes: string, origem = '', lote = ''): string {
  const o = origem.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  const l = lote.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return 'sci_' + (so(cnpjEmpresa) || 'empresa') + '_' + (mes || 'sem-mes') + (o ? '_' + o : '') + (l ? '_' + l : '') + '.xlsx';
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
