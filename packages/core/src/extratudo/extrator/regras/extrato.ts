// Extrato em PDF: dos pedaços de texto de cada página (com a posição de cada um) aos lançamentos.
// Quem tira o texto do PDF é arquivos/pdf.ts; aqui só tem regra, para dar para testar sem PDF.
// Origem: protótipo do Extrator (leitura.js: montarLinhas, colunas, anoDoTexto, lerPaginasExtrato).
import { normalizarTexto } from '../../../formatos';
import type { Lado, Lancamento } from '../tipos';
import { centavos, lerData, temSinal } from './texto';

/** Um pedaço de texto da página: x/y do canto de baixo à esquerda (y cresce para cima), w = largura. */
export interface ItemDeTexto { texto: string; x: number; y: number; largura: number }

interface Token { s: string; x: number; x2: number }
interface Linha { y: number; tokens: Token[]; texto: string }
interface Colunas { deb?: number; cred?: number; saldo?: number; valor?: number }

const RE_DATA = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/;
/** a data com o mês em letras: "11 FEV", "11/fev", "08 FEV 2026" (o Nubank), "08FEV2026" (o OCR juntou) */
const RE_DATA_MES = /^(\d{1,2})[/.\s-]?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*(?:[/.\s-]?\d{4})?$/i;
/** o ano solto depois do dia e do mês ("11 | FEV | 2026", em pedaços separados) */
const RE_ANO = /^20\d{2}$/;

/**
 * O dia que o OCR leu com letra no lugar do número: o "O8FEV2026" do Nubank escaneado é "08FEV2026" (Vitor, 20/10/2026: o
 * Pix do dia 08 sumia do extrato). Só no começo da data, com o mês logo depois e ao menos um número de verdade.
 */
function diaDoOcr(s: string): string {
  const m = s.match(/^([\dOoIl]{1,2})(?=[/.\s-]?(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez))/i);
  return m && /\d/.test(m[1]) ? m[1].replace(/[Oo]/g, '0').replace(/[Il]/g, '1') + s.slice(m[1].length) : s;
}
const RE_VALOR = /^\(?-?(?:R\$)?-?\d{1,3}(?:\.\d{3})*,\d{2}\)?-?[CD]?$/i;
const RE_SINAL = /^(?:[CD]|\(\+\)|\(-\)|[+-]|\*)$/i;
/** o valor do depósito bloqueado, com o * colado ("2.300,00*"): ainda não é saldo */
const RE_BLOQUEADO = /^\(?-?(?:R\$)?\d{1,3}(?:\.\d{3})*,\d{2}\*$/;
/**
 * Linha de saldo, total ou resumo: não é lançamento. A palavra tem de abrir a linha ("SALDO ANTERIOR", "Total de
 * créditos", "Limite disponível"…), ou ser um saldo explícito no meio dela ("… SALDO DO DIA"). Solta no histórico, não
 * vale (Vitor, 09/10/2026: o "IOF S/ UTILIZACAO LIMITE" da 380 sumia, como "… TRANSPORTES LTDA" ou "TOTAL ATACADO"). O
 * "S A L D O" espaçado vale também no meio (o "0000 00000 999 S A L D O" do fim do extrato do BB "Consultas").
 */
const RE_SALDO = /^[\s(+\-*]*(?:s\s?a\s?l\s?d\s?o|sdo\b|total|resumo|limite|bloquead|dispon[ií]vel|a transportar|transporte\b)|\bsaldo (?:anterior|inicial|final|atual|do dia|em\b|disponivel|disponível|bloqueado)|\bs a l d o\b/i;
const RE_SAIDA = /\b(pagto|pagamento|pag\b|tarifa|tar\b|saque|debito|deb\b|compra|enviad|envio|iof|juros|encargo|tributo|darf|gps|das\b|pago|aplicacao|cesta|mensalidade|cheque compensado|chq)/;
const RE_ENTRADA = /\b(recebid|receb\b|credito|cred\b|deposito|dep\b|resgate|estorno|rendimento|liquidacao cobranca|cobranca)/;

/**
 * O saldo antes do primeiro lançamento, como o extrato traz: a primeira linha "SALDO ANTERIOR" (ou "saldo inicial")
 * com valor; o valor é o da direita (a coluna Saldo), com o sinal dele (−, D/C, parênteses). Sem a linha, null.
 */
export function saldoAnteriorDoPdf(paginas: ItemDeTexto[][]): number | null {
  for (const linhas of paginas.map(p => juntarPedacosSoltos(montarLinhas(p)))) {
    for (const l of linhas) {
      if (!/saldo\s*(anterior|inicial)/i.test(normalizarTexto(l.texto))) continue;
      const t = l.tokens;
      for (let i = t.length - 1; i >= 0; i--) {
        if (RE_SINAL.test(t[i].s) && i > 0 && RE_VALOR.test(t[i - 1].s)) return centavos(t[i - 1].s + ' ' + t[i].s.replace(/[()]/g, ''));
        if (RE_VALOR.test(t[i].s)) return centavos(t[i].s);
      }
    }
  }
  return null;
}

/** Junta os pedaços da mesma altura numa linha, da esquerda para a direita, e separa as palavras. */
export function montarLinhas(itens: ItemDeTexto[]): Linha[] {
  const ord = itens.filter(i => i.texto && i.texto.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
  const grupos: { y: number; itens: ItemDeTexto[] }[] = [];
  for (const i of ord) {
    const g = grupos[grupos.length - 1];
    if (!g || Math.abs(g.y - i.y) > 2.5) grupos.push({ y: i.y, itens: [i] });
    else g.itens.push(i);
  }
  return grupos.map(g => {
    g.itens.sort((a, b) => a.x - b.x);
    const toks: Token[] = [];
    for (const i of g.itens) {
      const total = i.texto.length || 1;
      let pos = 0;
      for (const p of i.texto.split(/(\s+)/)) {
        if (p.trim()) toks.push({ s: p, x: i.x + i.largura * (pos / total), x2: i.x + i.largura * ((pos + p.length) / total) });
        pos += p.length;
      }
    }
    // "R$" ou "-" soltos antes do número fazem parte dele
    const junto: Token[] = [];
    for (const t of toks) {
      const ant = junto[junto.length - 1];
      if (ant && /^(R\$|-|\()$/.test(ant.s) && /^\(?\d/.test(t.s) && t.x - ant.x2 < 14) {
        ant.s = (ant.s === 'R$' ? '' : ant.s) + t.s;
        ant.x2 = t.x2;
        // o "-" antes do "R$" ("- R$ 95.000,00", o Stone): o sinal é do número (Vitor, 26/10/2026: na 183 as saídas do
        // Stone entravam como entrada)
        const menos = junto[junto.length - 2];
        if (menos && menos.s === '-' && ant.x - menos.x2 < 14 && /^\d/.test(ant.s)) { menos.s = '-' + ant.s; menos.x2 = ant.x2; junto.pop(); }
      } else junto.push({ ...t });
    }
    return { y: g.y, tokens: junto, texto: junto.map(t => t.s).join(' ') };
  });
}

/** os pedaços soltos de um lançamento: só o valor, ou só a letra C/D do sinal */
const SO_VALOR = /^\(?-?\d{1,3}(?:\.\d{3})*,\d{2}\)?$/;
const SO_SINAL = /^[CD]$/;
/** até onde fica o pedaço solto da linha dele (o Sicoob do SISBR: o valor 5 pontos acima; a letra 5 abaixo, ou 11 quando o
 *  valor está na linha da data), e a letra logo à direita do valor */
const PERTO_DO_PEDACO = 7;
const PERTO_DO_SINAL = 12;
const LADO_DO_VALOR = 15;

/**
 * O Sicoob do SISBR ("EXTRATO CONTA CORRENTE", a data sem o ano) imprime o valor das saídas, do saldo anterior e do saldo
 * do dia 5 pontos acima da linha da data e a letra C/D 5 pontos abaixo (Vitor, 26/10/2026: na 183, junho/2026 entrava com
 * o saldo de cada dia como lançamento e as saídas com o valor do saldo). Junta os dois na linha da data, que não tem
 * valor: o valor que está sozinho logo acima, e a letra sozinha logo abaixo de quem tem o valor.
 */
export function juntarPedacosSoltos(linhas: Linha[]): Linha[] {
  const saida: Linha[] = [];
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    const prox = linhas[i + 1];
    const temValor = (x: Linha) => x.tokens.some(t => RE_VALOR.test(t.s));
    // o valor sozinho logo acima da linha da data sem valor
    if (prox && l.tokens.length === 1 && SO_VALOR.test(l.tokens[0].s) && l.y - prox.y <= PERTO_DO_PEDACO
      && RE_DATA.test(prox.tokens[0]?.s || '') && !temValor(prox)) {
      const tokens = [...prox.tokens, ...l.tokens].sort((a, b) => a.x - b.x);
      saida.push({ y: prox.y, tokens, texto: tokens.map(t => t.s).join(' ') });
      i++;
      continue;
    }
    // a letra sozinha logo abaixo da linha que termina no valor
    const ant = saida[saida.length - 1];
    const valorDeCima = ant?.tokens[ant.tokens.length - 1];
    if (ant && valorDeCima && l.tokens.length === 1 && SO_SINAL.test(l.tokens[0].s) && ant.y - l.y <= PERTO_DO_SINAL
      && RE_VALOR.test(valorDeCima.s) && !RE_SINAL.test(valorDeCima.s.slice(-1)) && Math.abs(l.tokens[0].x - valorDeCima.x2) <= LADO_DO_VALOR) {
      ant.tokens = [...ant.tokens, l.tokens[0]];
      ant.texto = ant.tokens.map(t => t.s).join(' ');
      continue;
    }
    saida.push(l);
  }
  return saida;
}

/** Cabeçalho da tabela: onde ficam as colunas Débito / Crédito / Saldo / Valor (pela borda direita). */
function colunas(linhas: Linha[]): Colunas | null {
  for (const l of linhas) {
    const c: Colunas = {};
    for (const t of l.tokens) {
      const n = normalizarTexto(t.s);
      if (/^(debito|debitos|saida|saidas)$/.test(n)) c.deb = t.x2;
      else if (/^(credito|creditos|entrada|entradas)$/.test(n)) c.cred = t.x2;
      else if (n === 'saldo') c.saldo = t.x2;
      else if (n === 'valor' && c.valor == null) c.valor = t.x2;
    }
    if ((c.deb != null && c.cred != null) || (c.saldo != null && (c.valor != null || c.deb != null || c.cred != null))) return c;
  }
  return null;
}

/** O ano que mais aparece no texto (para datas "05/09" sem ano). */
export function anoDoTexto(texto: string, padrao: number): number {
  const conta: Record<string, number> = {};
  for (const m of texto.matchAll(/\b\d{1,2}[/.-]\d{1,2}[/.-](20\d{2})\b/g)) conta[m[1]] = (conta[m[1]] || 0) + 1;
  for (const m of normalizarTexto(texto).matchAll(/\b(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]* (?:de )?(20\d{2})\b/g)) conta[m[1]] = (conta[m[1]] || 0) + 1;
  let melhor: string | null = null;
  for (const a of Object.keys(conta)) if (!melhor || conta[a] > conta[melhor]) melhor = a;
  return melhor ? +melhor : padrao;
}

/**
 * Páginas do PDF → lançamentos. Regras:
 * - a data abre o lançamento e vale para as linhas seguintes sem data (extratos que só põem a data
 *   no primeiro lançamento do dia);
 * - o valor é o primeiro número "1.234,56" da linha; o da coluna Saldo é ignorado;
 * - o sinal vem do próprio valor (−, D/C, parênteses); senão da coluna (Débito/Crédito); senão do
 *   histórico (pagamento, tarifa… = saída);
 * - linhas de saldo, total e resumo não são lançamento;
 * - texto solto sem valor vira o histórico do lançamento seguinte (quando ele não tem) ou
 *   complementa o anterior.
 * No sistema (razão em PDF), débito é entrada no banco: o sinal pela coluna se inverte.
 */
/**
 * O extrato sem movimento (Vitor, 13/10/2026: o BNB "Nenhuma movimentação encontrada"): os meses do período que ele
 * mostra ("Período: 01/01/2026 até 31/01/2026", "de 01/01/2026 a 31/01/2026"); sem a frase, null. Sem o período, o mês
 * do "Período do extrato" ou das datas que aparecem; nada disso, [] (quem importa decide o mês).
 */
/** os meses como o normalizarTexto deixa (sem acento, minúsculas) */
const MESES_POR_EXTENSO = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function mesesSemMovimento(texto: string): string[] | null {
  const t = normalizarTexto(texto);
  if (!/nenhuma movimentacao|nenhum lancamento|sem movimentacao|sem movimento|nao (?:ha|houve|existem?|possui) (?:movimentacao|movimentacoes|lancamentos?)/.test(t)) return null;
  const p = texto.match(/(\d{2})\/(\d{2})\/(\d{4})\s*(?:at[eé]|a)\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  if (p) {
    const meses: string[] = [];
    let a = Number(p[3]), m = Number(p[2]);
    const fimA = Number(p[6]), fimM = Number(p[5]);
    while ((a < fimA || (a === fimA && m <= fimM)) && meses.length < 24) { meses.push(a + '-' + String(m).padStart(2, '0')); m++; if (m > 12) { m = 1; a++; } }
    return meses;
  }
  // o período por extenso, como o do Nubank: "01 DE ABRIL DE 2026 a 30 DE ABRIL DE 2026" (Vitor, 19/10/2026: o mês não
  // era achado e o sem movimento pedia para marcar na mão)
  const e = normalizarTexto(texto).match(new RegExp('\\b\\d{1,2} de (' + MESES_POR_EXTENSO.join('|') + ') de (\\d{4}) (?:a|ate) \\d{1,2} de (' + MESES_POR_EXTENSO.join('|') + ') de (\\d{4})\\b'));
  if (e) {
    const meses: string[] = [];
    let a = Number(e[2]), m = MESES_POR_EXTENSO.indexOf(e[1]) + 1;
    const fimA = Number(e[4]), fimM = MESES_POR_EXTENSO.indexOf(e[3]) + 1;
    while ((a < fimA || (a === fimA && m <= fimM)) && meses.length < 24) { meses.push(a + '-' + String(m).padStart(2, '0')); m++; if (m > 12) { m = 1; a++; } }
    return meses;
  }
  const um = periodoDoExtrato(texto);
  return um ? [um] : [];
}

/** O mês do extrato quando ele diz ("Período do extrato 02 / 2026", o do BB "Consultas"): 'aaaa-mm', ou null. */
export function periodoDoExtrato(texto: string): string | null {
  // (o normalizarTexto tira a barra: "02 / 2026" vira "02 2026")
  const m = normalizarTexto(texto).match(/periodo do (?:extrato )?(\d{1,2}) (\d{4})\b/);
  return m && Number(m[1]) >= 1 && Number(m[1]) <= 12 ? m[2] + '-' + m[1].padStart(2, '0') : null;
}

/**
 * O extrato do BB "Consultas - Extrato de conta corrente" (o do BB Empresa), com as colunas Dt. balancete e Dt. movimento:
 * nele, a data certa do lançamento é a Dt. movimento (Vitor, 09/10/2026).
 */
export function ehConsultasDoBB(texto: string): boolean {
  const t = normalizarTexto(texto);
  return /consultas extrato de conta corrente/.test(t) && /\bbalancete\b/.test(t) && /\bmovimento\b/.test(t);
}

export function lancamentosDoPdf(paginas: ItemDeTexto[][], lado: Lado, anoPadrao = new Date().getFullYear()): Lancamento[] {
  return lancamentosComPagina(paginas, lado, anoPadrao).lancamentos;
}

/**
 * O saldo que o extrato imprime no fim de cada dia (a coluna Saldo da última linha do dia, ou a linha "SALDO DO DIA"):
 * no Cheque especial, os dias negativos são os do banco, não os recalculados (Vitor, 13/10/2026: "se o razão passou na
 * primeira etapa, se guie pelo extrato bancário" — no BB "Consultas", pela Dt. movimento, o saldo recalculado ficava
 * negativo em dias que o banco fechou positivo). Sem a coluna Saldo, vazio.
 */
export function saldosDoDiaDoPdf(paginas: ItemDeTexto[][], anoPadrao = new Date().getFullYear()): { data: string; saldo: number }[] {
  return extratoDoPdf(paginas, 'banco', anoPadrao).saldosDoDia;
}

/** Os lançamentos e o saldo do dia numa leitura só (a importação lê o PDF uma vez; Vitor, 13/10/2026: ficou lento). */
export function extratoDoPdf(paginas: ItemDeTexto[][], lado: Lado, anoPadrao = new Date().getFullYear()): { lancamentos: Lancamento[]; saldosDoDia: { data: string; saldo: number }[]; saldoAnteriorPelaLinha: number | null } {
  const r = lancamentosComPagina(paginas, lado, anoPadrao);
  const s = r.saldosDoDia;
  return { saldoAnteriorPelaLinha: r.saldoAnteriorPelaLinha ?? null, lancamentos: r.lancamentos, saldosDoDia: s ? [...s].map(([data, saldo]) => ({ data, saldo })).sort((a, b) => a.data.localeCompare(b.data)) : [] };
}

/**
 * As páginas de cada mês (Vitor, 09/10/2026: o PDF de vários meses vai para o Drive quebrado, um por mês): a página entra
 * no mês de cada lançamento dela (a que vira o mês entra nos dois); página sem lançamento (o resumo do fim) fica com a de
 * antes. Os índices começam em 0, em ordem.
 */
export function paginasPorMes(paginas: ItemDeTexto[][], anoPadrao = new Date().getFullYear()): Record<string, number[]> {
  const { lancamentos, pagina } = lancamentosComPagina(paginas, 'banco', anoPadrao);
  const porPagina: Set<string>[] = paginas.map(() => new Set());
  lancamentos.forEach((l, i) => porPagina[pagina[i]].add(l.data.slice(0, 7)));
  const out: Record<string, number[]> = {};
  let antes: Set<string> = new Set();
  porPagina.forEach((meses, i) => {
    const deste = meses.size ? meses : antes;
    for (const m of deste) (out[m] = out[m] || []).push(i);
    if (meses.size) antes = new Set([[...meses].sort().pop() as string]);
  });
  return out;
}

/**
 * O extrato da Caixa (internet banking, "Data/Hora  Nr. Doc.  Descrição/Detalhamento  Valor (R$)  Saldo(R$)"): cada
 * lançamento é um bloco de 3 a 5 linhas — o texto pode vir acima da linha do valor, a hora e o detalhe embaixo — e cada dia
 * fecha com "SALDO DIA" (o valor só na coluna Saldo). Vitor, 13/10/2026: o leitor genérico contava o saldo do dia como
 * lançamento e punha o texto de um no anterior.
 */
export function ehExtratoDaCaixa(texto: string): boolean {
  const t = normalizarTexto(texto);
  return /data hora nr doc descricao detalhamento valor r saldo r/.test(t);
}

function lancamentosDaCaixa(todas: Linha[][], ano: number): { lancamentos: Lancamento[]; pagina: number[] } {
  const lancamentos: Lancamento[] = [];
  const pagina: number[] = [];
  let xValor: number | null = null, xSaldo: number | null = null;
  for (const [nPagina, linhas] of todas.entries()) {
    // as colunas pelo cabeçalho da tabela (a borda esquerda de "Valor" e de "Saldo")
    for (const l of linhas) {
      const v = l.tokens.find(t => /^valor$/i.test(t.s)), s = l.tokens.find(t => /^saldo\(r\$\)$/i.test(t.s) || /^saldo$/i.test(t.s));
      if (v && s && /descri/i.test(l.texto)) { xValor = v.x; xSaldo = s.x; }
    }
    if (xValor == null || xSaldo == null) continue;
    const meio = (xValor + xSaldo) / 2 + 20;
    // a linha do valor: um valor (com C/D) antes do meio entre Valor e Saldo
    const blocos: { y: number; linha: Linha; valor: Token; sinal: string }[] = [];
    const soltas: Linha[] = [];
    for (const l of linhas) {
      if (/^(data hora|movimentacoes desde|saldo anterior a|extrato|cliente|conta|data \d)/.test(normalizarTexto(l.texto))) continue;
      if (/^\d{1,2} de [a-z]+ de \d{4}/.test(normalizarTexto(l.texto))) continue;
      // o fecho do dia: "SALDO DIA" e a linha só com o saldo ("0  136,20 C") não são de lançamento nenhum
      if (/^saldo dia\b/.test(normalizarTexto(l.texto))) continue;
      if (l.tokens.every(t => t.s === '0' || /^[CD]$/i.test(t.s) || (RE_VALOR.test(t.s) && t.x >= meio))) continue;
      const i = l.tokens.findIndex(t => RE_VALOR.test(t.s) && t.x < meio);
      if (i >= 0) {
        const prox = l.tokens[i + 1];
        blocos.push({ y: l.y, linha: l, valor: l.tokens[i], sinal: prox && /^[CD]$/i.test(prox.s) ? prox.s.toUpperCase() : '' });
      } else soltas.push(l);
    }
    // cada linha solta vai para o bloco de valor mais perto (o "SALDO DIA" e a linha só com o saldo não têm valor: ficam de fora)
    const doBloco = new Map<number, Linha[]>(blocos.map((_, i) => [i, []]));
    for (const l of soltas) {
      if (!blocos.length) break;
      let melhor = 0;
      for (let i = 1; i < blocos.length; i++) if (Math.abs(blocos[i].y - l.y) < Math.abs(blocos[melhor].y - l.y)) melhor = i;
      if (Math.abs(blocos[melhor].y - l.y) <= 24) doBloco.get(melhor)!.push(l);
    }
    blocos.forEach((b, i) => {
      const todasDoBloco = [b.linha, ...doBloco.get(i)!].sort((a, c) => c.y - a.y);
      let data: string | null = null;
      const partes: string[] = [];
      for (const l of todasDoBloco) {
        for (const t of l.tokens) {
          if (t === b.valor || (t.x > b.valor.x && (RE_VALOR.test(t.s) || /^[CD]$/i.test(t.s)))) continue;
          if (RE_DATA.test(t.s) && /\d{4}$/.test(t.s) && t.x < 60) { data = data || lerData(t.s, ano); continue; }
          if (/^\d{2}:\d{2}:\d{2}$/.test(t.s)) continue;
          partes.push(t.s);
        }
      }
      const c = centavos(b.valor.s);
      if (!data || c == null || c === 0) return;
      // o número de documento "0" (o da Caixa nas tarifas e no IOF) não diz nada
      const historico = partes.filter(p => p !== '0').join(' ').replace(/\s+/g, ' ').trim();
      lancamentos.push({ data, valor: b.sinal === 'D' ? -Math.abs(c) : Math.abs(c), historico: historico || '(sem histórico)' });
      pagina.push(nPagina);
    });
  }
  // o bloco que começa numa página e termina na outra fica na ordem das datas
  return { lancamentos, pagina };
}

function lancamentosComPagina(paginas: ItemDeTexto[][], lado: Lado, anoPadrao: number): { lancamentos: Lancamento[]; pagina: number[]; saldosDoDia?: Map<string, number>; saldoAnteriorPelaLinha?: number | null } {
  const saldosDoDia = new Map<string, number>();
  let ultimaDataDeValor: string | null = null;
  const todas = paginas.map(p => juntarPedacosSoltos(montarLinhas(p)));
  if (lado === 'banco') {
    const texto = todas.map(p => p.map(l => l.texto).join('\n')).join('\n');
    if (ehExtratoDaCaixa(texto)) return lancamentosDaCaixa(todas, anoDoTexto(texto, anoPadrao));
  }
  const paginaDe: number[] = [];
  const ano = anoDoTexto(todas.map(p => p.map(l => l.texto).join('\n')).join('\n'), anoPadrao);
  // a ordem das datas que abrem as linhas: o extrato do mais novo para o mais velho (o Stone) tem mais descidas que subidas
  let sobe = 0, desce = 0, antes: string | null = null;
  for (const l of todas.flat()) {
    const d = l.tokens[0] && RE_DATA.test(l.tokens[0].s) ? lerData(l.tokens[0].s, ano) : null;
    if (!d) continue;
    if (antes && d > antes) sobe++;
    else if (antes && d < antes) desce++;
    antes = d;
  }
  const decrescente = desce > sobe;
  const saida: Lancamento[] = [];
  /** o saldo da coluna Saldo na linha de cada lançamento (null = a linha não tem) */
  const saldoDeCada: (number | null)[] = [];
  let col: Colunas | null = null;
  let dataAtual: string | null = null;
  // o quadro RESUMO do fim (Sicoob: "Cheque especial contratado: 10.000,00C", juros e tarifas provisionados…): não é
  // lançamento; vale até a próxima linha com data na coluna (Vitor, 13/10/2026: a 380 tinha 10 mil "entrando no banco")
  let noResumo = false;
  // os "Últimos Lançamentos" do Bradesco (o Extrato Consolidado / Por Período): depois do Total do período, o banco
  // imprime o movimento dos dias em que o PDF foi tirado, de outro mês. Dali para baixo, nada é do extrato (Vitor,
  // 19/10/2026: na 450 o extrato e o razão batiam, mas o março vinha em dobro, com os do PDF de janeiro e de fevereiro)
  let noFim = false;
  // o saldo corrido (a coluna Saldo, o último valor da linha que tem dois; ou o saldo anterior / do dia): o sinal do
  // lançamento vem da diferença dos saldos quando ela bate com o valor (Vitor, 14/10/2026: o OCR leu o "-" do "- 632,50"
  // do BNB como "7" e o débito virou crédito)
  let saldoCorrido: number | null = null;
  // a coluna da data: onde ficam as datas com ano que abrem a linha. Data curta ("21/03") longe dela é o fim de um
  // histórico quebrado ("REM: FULANO" / "21/03"), não um dia novo (Vitor, 09/10/2026: a 380 jogava o 23/03 no 21/03)
  const xDasDatas = todas.flat().map(l => l.tokens[0]).filter(t => t && RE_DATA.test(t.s) && /\d{4}$/.test(t.s)).map(t => t.x);
  const naColunaDaData = (x: number) => !xDasDatas.length || xDasDatas.some(d => Math.abs(d - x) <= 20);
  const textoTodo = todas.map(p => p.map(l => l.texto).join('\n')).join('\n');
  const periodo = periodoDoExtrato(textoTodo);
  const pelaDtMovimento = ehConsultasDoBB(textoTodo);

  for (const [nPagina, linhas] of todas.entries()) {
    col = colunas(linhas) || col;
    let solta: string | null = null;
    /** a altura da última linha do texto solto: ele fica com o lançamento mais perto */
    let soltaY: number | null = null;
    let ultimo: Lancamento | null = null;
    let ultimaY: number | null = null;
    let pulandoBloqueado = false;
    // as linhas de texto sem valor logo depois de um lançamento: cada uma vai para o lançamento mais perto, o de cima ou o
    // de baixo (Vitor, 14/10/2026: o BNB põe "PGTO TITULO INTERNET BANK" acima do valor e o fornecedor embaixo; o
    // Bradesco também) — decidido quando chega a próxima linha com valor
    let perto: { texto: string; y: number }[] = [];
    const juntarPerto = () => { if (ultimo) for (const p of perto) ultimo.historico = (ultimo.historico + ' ' + p.texto).trim(); perto = []; };

    for (const l of linhas) {
      const t = l.tokens.slice();
      if (!t.length || noFim) continue;
      if (/^ultimos lancamentos\b/.test(normalizarTexto(l.texto))) { juntarPerto(); noFim = true; continue; }
      // o depósito bloqueado (Sicoob: "DEP.CHEQUE BLOQ.1D 2.300,00*"): o valor com * ainda não entrou no saldo; a linha e o
      // texto embaixo dela ("ENVELOPE: …") ficam de fora, sem data nem histórico para os outros — o lançamento é a
      // "LIBERAÇÃO DE DEPÓSITO BLOQUEADO" (Vitor, 13/10/2026: a 58 juntava o texto e a data dele no lançamento de cima)
      if (t.some(x => RE_BLOQUEADO.test(x.s))) { pulandoBloqueado = true; continue; }
      if (pulandoBloqueado) {
        if (!t.some(x => RE_VALOR.test(x.s)) && !RE_DATA.test(t[0].s)) continue;
        pulandoBloqueado = false;
      }
      let data: string | null = null;
      let segunda: string | null = null;
      if (!naColunaDaData(t[0].x)) { /* texto no meio da linha: não abre dia */ }
      else if (RE_DATA.test(t[0].s)) { data = lerData(t[0].s, ano); if (data) t.shift(); }
      else if (t[1] && RE_DATA_MES.test(diaDoOcr(t[0].s) + ' ' + t[1].s)) {
        // o ano no pedaço seguinte ("11 | FEV | 2026") é da data: senão o "2026 Total de saídas" virava lançamento (Vitor,
        // 20/10/2026: o Nubank tinha o total do dia como uma saída a mais)
        const comAno = t[2] && RE_ANO.test(t[2].s);
        data = lerData(diaDoOcr(t[0].s) + ' ' + t[1].s + (comAno ? ' ' + t[2].s : ''), ano);
        if (data) t.splice(0, comAno ? 3 : 2);
      }
      else if (RE_DATA_MES.test(diaDoOcr(t[0].s))) { data = lerData(diaDoOcr(t[0].s), ano); if (data) t.shift(); }
      if (data) { dataAtual = data; noResumo = false; }
      // (e o "Detalhamento do Saldo" do BNB: saldo disponível, limite, Investimentos "BNB AUTOMATICO FIF"; Vitor, 14/10/2026; e o
      // quadro do limite do BB depois do 999 S A L D O: Limite Ouro Empresarial, Custo Efetivo Total, Valor total devido,
      // Valor liberado, IOF, Tarifa — a simulação do cheque especial, que entrava como lançamento do último dia; Vitor, 26/10/2026)
      if (!data && /^(resumo|encargos vencidos|detalhamento do s|limite ouro|custo efetivo total|valor total devido|informacoes complementares)/.test(normalizarTexto(l.texto))) { juntarPerto(); noResumo = true; continue; }
      if (noResumo) continue;

      const valores: Token[] = [];
      const bloqueados = new Set<Token>();
      const resto: string[] = [];
      for (let i = 0; i < t.length; i++) {
        const s = t[i].s;
        if (RE_VALOR.test(s)) {
          const v = { ...t[i] };
          const prox = t[i + 1];
          if (prox && RE_SINAL.test(prox.s) && !RE_VALOR.test(prox.s)) {
            if (prox.s === '*') bloqueados.add(v);
            v.s += prox.s === '*' ? '' : ' ' + prox.s.replace(/[()]/g, '');
            v.x2 = prox.x2;
            i++;
          }
          valores.push(v);
        } else if (RE_DATA.test(s) && !resto.length && !valores.length) {
          // segunda data (no BB "Consultas": Dt. balancete e Dt. movimento): guarda, para o período do extrato
          segunda = lerData(s, ano);
        } else resto.push(s);
      }
      const hist = resto.join(' ').replace(/\s+/g, ' ').trim();

      if (!valores.length) {
        if (hist && !RE_SALDO.test(hist) && !/^(data|dt\.?)\b/i.test(hist) && hist.length <= 90) {
          const acima = perto.length ? perto[perto.length - 1].y : ultimaY;
          if (data) { juntarPerto(); solta = hist; soltaY = l.y; }
          else if (ultimo && acima != null && Math.abs(acima - l.y) < 16 && !solta) perto.push({ texto: hist, y: l.y });
          else { juntarPerto(); solta = (solta ? solta + ' ' : '') + hist; soltaY = l.y; }
        }
        continue;
      }
      if (RE_SALDO.test(hist) || (!hist && !solta && RE_SALDO.test(l.texto))) {
        // a linha "SALDO DO DIA": o saldo que o banco imprime no fim do dia; o "999 S A L D O" do fim do BB: o do último dia
        const n = normalizarTexto(hist || l.texto);
        if (/saldo (?:anterior|inicial)|saldo (?:do )?dia|\bs a l d o\b/.test(n) && valores.length) saldoCorrido = centavos(valores[valores.length - 1].s);
        const diaDoSaldo = /\bs a l d o\b/.test(n) ? ultimaDataDeValor : /\bsaldo (?:do )?dia\b/.test(n) ? dataAtual : null;
        const sv = diaDoSaldo ? centavos(valores[valores.length - 1].s) : null;
        if (sv != null && diaDoSaldo) saldosDoDia.set(diaDoSaldo, sv);
        juntarPerto();
        // o texto entre o último lançamento do dia e o saldo é dele (o Sicoob do SISBR: "Pagto de Simples Nacional" embaixo
        // do DB.CONV.TR FD-RFB; Vitor, 26/10/2026)
        if (solta && ultimo) ultimo.historico = (ultimo.historico + ' ' + solta).trim();
        solta = null; continue;
      }
      if (!dataAtual) continue;
      ultimaDataDeValor = dataAtual;
      // o valor na coluna Saldo (no BB "Consultas", na última linha do dia, pela Dt. balancete): o saldo do dia no banco
      if (col && col.saldo != null && valores.length > 1) {
        const doSaldo = valores.filter(x => Math.abs(x.x2 - (col as Colunas).saldo!) <= 12);
        const sv = doSaldo.length ? centavos(doSaldo[doSaldo.length - 1].s) : null;
        if (sv != null) saldosDoDia.set(dataAtual, sv);
      }

      let candidatos = valores;
      if (col && col.saldo != null && valores.length > 1) {
        const saldo = col.saldo;
        candidatos = valores.filter(v => Math.abs(v.x2 - saldo) > 12);
        if (!candidatos.length) candidatos = [valores[0]];
      }
      const v = candidatos[0];
      // o valor com * é bloqueado ("911 Depósito bloquead.1d útil 4.837,00 *"): não mexe no saldo, não é lançamento (Vitor,
      // 09/10/2026: a 380 não fechava maio com junho, no BB "Consultas"; 26/10/2026: o mesmo no extrato do BB da 237)
      if (bloqueados.has(v)) { solta = null; continue; }
      let c = centavos(v.s);
      if (c == null || c === 0) continue;
      const saldoDaLinha = lado === 'banco' && valores.length > 1 && valores[valores.length - 1] !== v ? centavos(valores[valores.length - 1].s) : null;
      const saldoAntes = saldoCorrido;
      if (saldoDaLinha != null) saldoCorrido = saldoDaLinha;
      // do mais novo para o mais velho (o Stone), a diferença dos saldos é a do lançamento de cima, não a deste: não vale. A
      // folga de 1 centavo (o arredondamento) só em valor de 1 real para cima: no Stone, o rendimento de R$ 0,01 virava
      // saída pela diferença de R$ 0,02 do lançamento vizinho (Vitor, 26/10/2026)
      const diferenca = !decrescente && saldoAntes != null && saldoDaLinha != null ? saldoDaLinha - saldoAntes : null;
      const folga = Math.abs(c) >= 100 ? 1 : 0;
      if (diferenca != null && diferenca !== 0 && Math.abs(Math.abs(diferenca) - Math.abs(c)) <= folga) c = Math.sign(diferenca) * Math.abs(c);
      else if (!temSinal(v.s)) {
        const base = normalizarTexto(hist || solta || '');
        if (col && col.deb != null && col.cred != null) {
          const ehDebito = Math.abs(v.x2 - col.deb) < Math.abs(v.x2 - col.cred);
          c = ehDebito !== (lado === 'sistema') ? -Math.abs(c) : Math.abs(c);
        } else if (RE_SAIDA.test(base) && !RE_ENTRADA.test(base)) c = -Math.abs(c);
      }

      // o texto entre o lançamento de cima e este: o que está mais perto de cima fica lá; o resto abre este
      let antes = '';
      for (const p of perto) {
        if (!antes && ultimo && ultimaY != null && Math.abs(ultimaY - p.y) <= Math.abs(p.y - l.y)) { ultimo.historico = (ultimo.historico + ' ' + p.texto).trim(); ultimaY = p.y; }
        else antes = (antes ? antes + ' ' : '') + p.texto;
      }
      perto = [];
      let h = antes ? (antes + ' ' + hist).trim() : hist;
      // o texto solto colado nesta linha (menos de 9 pontos acima; no Sicoob do SISBR o texto de baixo fica a 12 da próxima
      // linha e é do lançamento de cima) e mais perto dela que do lançamento de cima abre este: o Stone
      // põe o nome do Pix 6 pontos acima do valor e o tipo ("Entrada") na linha dele (Vitor, 26/10/2026: o nome ia para a
      // tarifa de cima, e o mesmo lançamento saía com histórico diferente em cada PDF)
      const desteLado = solta != null && soltaY != null && Math.abs(soltaY - l.y) < 9
        && (!ultimo || ultimaY == null || Math.abs(soltaY - l.y) < Math.abs(ultimaY - soltaY));
      if (!h && solta) { h = solta; solta = null; }
      else if (solta && desteLado) { h = (solta + ' ' + h).trim(); solta = null; }
      else if (solta && ultimo) { ultimo.historico = (ultimo.historico + ' ' + solta).trim(); solta = null; }
      else solta = null;
      soltaY = null;
      // o BB "Consultas": vale a Dt. movimento (a 2ª data), quando a linha tem (Vitor, 09/10/2026: "nesse layout, siga a
      // Dt. movimento"); nos outros, o extrato de um mês só ("Período do extrato 02 / 2026"): a linha com a 1ª data fora do
      // mês e a 2ª dentro é do mês do extrato
      const dataDoLanc = segunda && pelaDtMovimento ? segunda
        : periodo && segunda && !dataAtual.startsWith(periodo) && segunda.startsWith(periodo) ? segunda : dataAtual;
      ultimo = { data: dataDoLanc, valor: c, historico: h || '(sem histórico)' };
      ultimaY = l.y;
      // a Dt. movimento no mês seguinte: o lançamento vem no extrato do outro mês (senão entraria duas vezes; o saldo
      // anterior do extrato seguinte já é o de antes dele)
      if (pelaDtMovimento && periodo && !dataDoLanc.startsWith(periodo)) continue;
      saida.push(ultimo);
      saldoDeCada.push(saldoDaLinha);
      paginaDe.push(nPagina);
    }
    juntarPerto();
  }
  // o saldo antes do primeiro lançamento pela coluna Saldo, quando o extrato não imprime a linha do saldo anterior (o Stone;
  // Vitor, 26/10/2026): o saldo da linha do lançamento mais antigo menos o valor dele
  let saldoAnteriorPelaLinha: number | null = null;
  if (col && (col as Colunas).saldo != null && saida.length) {
    let i0 = -1;
    saida.forEach((l, i) => { if (i0 < 0 || l.data < saida[i0].data || (decrescente && l.data === saida[i0].data)) i0 = i; });
    const s0 = saldoDeCada[i0];
    if (s0 != null) saldoAnteriorPelaLinha = s0 - saida[i0].valor;
  }
  return { lancamentos: saida, pagina: paginaDe, saldosDoDia, saldoAnteriorPelaLinha };
}
