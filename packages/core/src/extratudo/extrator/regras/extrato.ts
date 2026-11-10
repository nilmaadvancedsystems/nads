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
const RE_VALOR = /^\(?[-+]?(?:R\$)?-?\d{1,3}(?:\.\d{3})*,\d{2}\)?-?[CD]?$/i;
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
      // o "Saldo inicial: X  Saldo final: Y" na mesma linha (o Mercado Pago; Vitor, 10/11/2026): o valor é o do inicial
      const k = t.findIndex(x => /^(anterior|inicial)/.test(normalizarTexto(x.s)));
      const fim = t.findIndex((x, i) => i > k && /^final/.test(normalizarTexto(x.s)));
      for (let i = (k >= 0 && fim > k ? fim : t.length) - 1; i >= 0; i--) {
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
  // o Extrato Consolidado do BNB (Vitor, 09/11/2026: "só tem aplicação"): várias contas e fundos num PDF, cada conta com a sua
  // frase; só é sem movimento se TODA conta corrente disser que não houve. O mês vem em "Mês: Outubro/2026"
  if (/extrato consolidado/.test(t) && /> ?conta corrente/i.test(texto)) {
    const contas = texto.split(/>\s*CONTA CORRENTE/i).slice(1).map(c => normalizarTexto(c.split('>')[0]));
    if (!contas.every(c => /nao houve movimentacao/.test(c))) return null;
    const ref = t.match(new RegExp('\\bmes (' + MESES_POR_EXTENSO.join('|') + ') (\\d{4})\\b'));
    return ref ? [ref[2] + '-' + String(MESES_POR_EXTENSO.indexOf(ref[1]) + 1).padStart(2, '0')] : [];
  }
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
 * O período que o Bradesco imprime no cabeçalho ("Extrato de: Ag: 2557 | CC: 0008939-7 | Entre 01/01/2026 e 31/01/2026"):
 * o primeiro e o último dia, 'aaaa-mm-dd'; sem a frase (ou com ela embaralhada pelo OCR), null.
 */
export function periodoEntreDatas(texto: string): { inicio: string; fim: string } | null {
  const m = texto.match(/\bentre\s+(\d{2})\/(\d{2})\/(\d{4})\s+e\s+(\d{2})\/(\d{2})\/(\d{4})\b/i);
  if (!m) return null;
  const inicio = m[3] + '-' + m[2] + '-' + m[1], fim = m[6] + '-' + m[5] + '-' + m[4];
  return inicio <= fim ? { inicio, fim } : null;
}

/**
 * A data lida pelo OCR, posta dentro do período que o extrato diz (Vitor, 06/11/2026, na 571: o Bradesco "Microsoft Print
 * to PDF" vinha com o "2026" lido "2028" e "2086", e o janeiro ficava com 30 dos 111 lançamentos): fora do período, mas
 * com o dia e o mês dentro dele num dos anos do período, fica nesse ano; senão, como veio.
 */
export function dataNoPeriodo(data: string, p: { inicio: string; fim: string }): string {
  if (data >= p.inicio && data <= p.fim) return data;
  for (const a of new Set([p.inicio.slice(0, 4), p.fim.slice(0, 4)])) {
    const d = a + data.slice(4);
    if (d >= p.inicio && d <= p.fim) return d;
  }
  return data;
}

/**
 * A data que o OCR embaralhou na coluna da data, quando o extrato diz o período (Vitor, 06/11/2026, na 571: "Qual o
 * sentido? Onde tem lançamento no dia 01/01?"): as letras que parecem número viram número ("c2r01r2026" = 02/01/2026,
 * "c2102/20268" = 02/02/2026, com a barra lida como "1"); o dia são os 2 primeiros dígitos, e o mês, os 2 seguintes ou os
 * 2 depois de um a mais (a barra lida como número). Vale só o que cai dentro do período; senão, null.
 */
export function dataEmbaralhada(token: string, p: { inicio: string; fim: string }): string | null {
  const d = token.replace(/[oOcCQD]/g, '0').replace(/[lIi|!]/g, '1').replace(/\D/g, '');
  if (d.length < 6) return null;
  const dia = d.slice(0, 2);
  for (const mes of [d.slice(2, 4), d.slice(3, 5)]) {
    for (const a of new Set([p.inicio.slice(0, 4), p.fim.slice(0, 4)])) {
      const data = a + '-' + mes + '-' + dia;
      if (+mes >= 1 && +mes <= 12 && +dia >= 1 && +dia <= 31 && data >= p.inicio && data <= p.fim) return data;
    }
  }
  return null;
}

/**
 * Os números das colunas de valor que o OCR estragou (Vitor, 06/11/2026, na 571: "onde tem 179 no dia 06 aqui?"), no
 * extrato que diz o período (o Bradesco): o número partido em dois ("2.345" "67" = 2.345,67) e o número sem a vírgula
 * ("18766" = 187,66; "123456" = 1.234,56), quando a borda direita fica numa coluna de valor. A coluna é o fim da palavra
 * do título ("Crédito"), e o "(R$)" vem depois: no OCR os números terminam uns 20 pontos à direita dela, e o Dcto, uns 65
 * à esquerda da de Crédito.
 */
function consertarValoresDoOcr(t: Token[], col: Colunas): void {
  const xs = [col.cred, col.deb, col.saldo, col.valor].filter((x): x is number => x != null);
  const naColuna = (k: Token) => xs.some(x => Math.abs(k.x2 - x) <= 30);
  for (let i = 0; i < t.length; i++) {
    // a aspa que o OCR põe na frente do número ("“123,45")
    if (/^["“”'‘’[]+-?\d/.test(t[i].s) && naColuna(t[i])) t[i] = { ...t[i], s: t[i].s.replace(/^["“”'‘’[]+/, '') };
    // o ponto do milhar lido como vírgula ("712,345,67")
    if (/^-?\d{1,3}(?:,\d{3})+,\d{2}$/.test(t[i].s) && naColuna(t[i])) t[i] = { ...t[i], s: t[i].s.replace(/,(?=\d{3}[,.])/g, '.') };
    const a = t[i], b = t[i + 1];
    if (b && /^-?\d{1,3}(?:\.\d{3})*$/.test(a.s) && /^\d{2}$/.test(b.s) && naColuna(b) && b.x - a.x2 <= 8) {
      t.splice(i, 2, { s: a.s + ',' + b.s, x: a.x, x2: b.x2 });
      continue;
    }
    if (/^-?\d{3,9}$/.test(a.s) && naColuna(a)) {
      const neg = a.s.startsWith('-'), d = a.s.replace('-', '');
      t[i] = { ...a, s: (neg ? '-' : '') + d.slice(0, -2).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d.slice(-2) };
    }
  }
}

/** O número sem o 1º dígito (o "−" que o OCR leu como número: "712.345,67" era "−12.345,67"), em centavos. */
const semOPrimeiroDigito = (n: number): number | null => { const s = String(Math.abs(n)).slice(1); return s ? Number(s) : null; };

/**
 * O número lido e o que ele pode ter sido, na ordem: o lido, com o sinal trocado (o "−" perdido), sem o 1º dígito (o "−"
 * lido como número: "712.345,67"), e com o 1º dígito trocado por 1 (o "−1" lido como um número só: "71.234,56" era
 * −11.234,56) — os dois últimos com os dois sinais.
 */
function numerosQueOOcrEstraga(n: number): number[] {
  const d = String(Math.abs(n));
  const sem = semOPrimeiroDigito(n);
  const comUm = d.length > 1 && d[0] !== '1' ? Number('1' + d.slice(1)) : null;
  return [...new Set([n, -n, ...(sem != null ? [sem, -sem] : []), ...(comUm != null ? [comUm, -comUm] : [])])];
}

/**
 * O valor e o saldo da linha que fecham com o saldo de antes, no Bradesco escaneado (Vitor, 06/11/2026, na 571): o OCR
 * perde o "−" do saldo negativo ("−12.345,67" lido "12.345,67"), ou lê o "−" como um número na frente do saldo
 * ("712.345,67") ou do valor ("71.000,00"). Vale a 1ª combinação em que o saldo menos o de antes é o valor; nenhuma, null.
 */
function acertoPeloSaldo(valor: number, saldo: number, antes: number): { valor: number; saldo: number; duvida?: boolean } | null {
  const saldos = numerosQueOOcrEstraga(saldo);
  const v1 = semOPrimeiroDigito(valor);
  const valores = [Math.abs(valor), ...(v1 != null ? [v1] : [])];
  for (const s of saldos) for (const v of valores) {
    const dif = s - antes;
    if (dif !== 0 && Math.abs(dif) === v) return { valor: dif, saldo: s };
  }
  // um dígito diferente entre o valor e a diferença dos saldos: nestes extratos, quem tem o dígito trocado é o saldo (o
  // "123,45" certo com o saldo "1.234,58", que era −1.234,56). Fica o
  // valor lido, com o sinal da diferença, e o saldo refeito a partir dele; e a dúvida, para a linha de baixo decidir
  const lido = String(Math.abs(valor));
  for (const s of [saldo, -saldo]) {
    const dif = s - antes, d = String(Math.abs(dif));
    if (dif !== 0 && d.length === lido.length && [...d].filter((x, i) => x !== lido[i]).length === 1) {
      const v = Math.sign(dif) * Math.abs(valor);
      return { valor: v, saldo: antes + v, duvida: true };
    }
  }
  return null;
}

/** O valor certo parecido com o que o OCR leu: um dígito trocado, ou um a mais na frente (o "−" lido como número). */
function valorParecido(certo: number, lido: number): boolean {
  const a = String(Math.abs(certo)), b = String(Math.abs(lido));
  return (a.length === b.length && [...a].filter((x, i) => x !== b[i]).length === 1) || b.slice(1) === a;
}

/** O valor fecha com o saldo de antes por alguma leitura do saldo da linha, igual ou com um dígito diferente. */
function fechaQuase(valor: number, saldo: number, antes: number): boolean {
  const lido = String(Math.abs(valor));
  return numerosQueOOcrEstraga(saldo).some(s => {
    const d = String(Math.abs(s - antes));
    return s !== antes && d.length === lido.length && [...d].filter((x, i) => x !== lido[i]).length <= 1;
  });
}

/** A coluna mais perto da borda direita do número. */
function colunaDoNumero(x2: number, col: Colunas): keyof Colunas | null {
  let melhor: keyof Colunas | null = null;
  for (const k of ['cred', 'deb', 'valor', 'saldo'] as const) {
    const x = col[k];
    if (x != null && (melhor == null || Math.abs(x2 - x) < Math.abs(x2 - (col[melhor] as number)))) melhor = k;
  }
  return melhor;
}

/**
 * O extrato do BB com as colunas Dt. balancete e Dt. movimento: o "Consultas - Extrato de conta corrente" (o do BB
 * Empresa) e o "Cliente - Conta atual" (o mesmo cabeçalho de colunas). Nele, a data certa do lançamento é a Dt. movimento
 * (Vitor, 09/10/2026; 04/11/2026, na 10: o "Movimento do Dia" de balancete 07/07 e movimento 08/07 saía como data errada).
 */
export function ehConsultasDoBB(texto: string): boolean {
  const t = normalizarTexto(texto);
  if (/\bdt balancete dt movimento\b/.test(t)) return true;
  return /consultas extrato de conta corrente/.test(t) && /\bbalancete\b/.test(t) && /\bmovimento\b/.test(t);
}

/**
 * O extrato do PagBank (no cabeçalho, "290 - PagSeguro Internet"; outros bancos citam o PagSeguro nos Pix): as saídas vêm
 * com o sinal escrito; o valor sem sinal é entrada.
 */
export function ehPagBank(texto: string): boolean {
  return /\b290 pagseguro internet\b/.test(normalizarTexto(texto));
}

/** O extrato do Inter: cada dia abre com "2 de Março de 2026  Saldo do dia: 15.093,56" e as saídas vêm com o "-R$" escrito. */
export function ehInter(texto: string): boolean {
  return /\binstituicao banco inter\b/.test(normalizarTexto(texto));
}

/**
 * O extrato "Lançamentos do período" do Itaú (o título da tabela: Data, Lançamentos, Razão Social, CNPJ/CPF, Valor, Saldo): as
 * saídas vêm com o sinal escrito; o valor sem sinal é entrada.
 */
export function ehItauPorPeriodo(texto: string): boolean {
  return /\bdata lancamentos razao social cnpj cpf valor r\b/.test(normalizarTexto(texto));
}

/**
 * O "extrato mensal" do Itaú (no topo, "extrato mensal  ag 1234 cc 56789-0 fev 2026"; a tabela: entradas R$, saídas R$, saldo
 * R$): as saídas vêm com o "-" escrito depois do número, o valor sem sinal é entrada. À esquerda da data, na 1ª página, fica
 * a legenda das siglas; depois do "Saldo final", os quadros das aplicações, dos débitos automáticos e do cheque especial.
 */
export function ehItauMensal(texto: string): boolean {
  const t = normalizarTexto(texto);
  return /\bextrato mensal\b/.test(t) && /\bag \d+ cc \d+/.test(t) && /\bentradas r\b/.test(t) && /\bsaidas r\b/.test(t) && /\bsaldo r\b/.test(t);
}

/** Tira o que está à esquerda da coluna da data (a legenda): ela caía na linha dos lançamentos e escondia a data deles. */
function semALegendaDoItau(pagina: ItemDeTexto[]): ItemDeTexto[] {
  const data = pagina.find(i => /^data$/i.test(i.texto.trim()));
  return data ? pagina.filter(i => i.x >= data.x - 5) : pagina;
}

/**
 * A fatura do cartão na pasta do extrato (Vitor, 09/11/2026, na 474: o "02-2026.pdf" do Itaú era a fatura e o extrato, o
 * "02-2026 (1).pdf"; a fatura entrava como extrato, com as compras nas datas delas). O "Pagamento de fatura" do extrato não
 * conta: a fatura traz o quadro dela e o vencimento, e nunca o saldo anterior ou inicial da conta.
 */
export function ehFaturaDeCartao(texto: string): boolean {
  const t = normalizarTexto(texto);
  return /resumo da fatura|total d(?:a|esta) fatura|sua fatura de|fatura no valor de/.test(t) && /\bvencimento\b/.test(t) && !/saldo (?:anterior|inicial)/.test(t);
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
export function extratoDoPdf(paginas: ItemDeTexto[][], lado: Lado, anoPadrao = new Date().getFullYear()): { lancamentos: Lancamento[]; saldosDoDia: { data: string; saldo: number }[]; saldoAnteriorPelaLinha: number | null; saldoAnteriorConferido: number | null } {
  const r = lancamentosComPagina(paginas, lado, anoPadrao);
  const s = r.saldosDoDia;
  return { saldoAnteriorPelaLinha: r.saldoAnteriorPelaLinha ?? null, saldoAnteriorConferido: r.saldoAnteriorConferido ?? null, lancamentos: r.lancamentos, saldosDoDia: s ? [...s].map(([data, saldo]) => ({ data, saldo })).sort((a, b) => a.data.localeCompare(b.data)) : [] };
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

/**
 * O "Extrato por período" da Caixa escaneado ("Lançamentos  Nr. Doc  Histórico/Complemento  Favorecido  CPF/CNPJ  Valor
 * Saldo"), com as colunas alinhadas à esquerda. Chamado 03CP5C (09/11/2026, na 474): o OCR leu o "5.377,47 D" como
 * "5.377,A7D" e o único número da linha virou o saldo devedor, "5.372,57 D": o lançamento entrava com o valor do saldo e o
 * erro de 4,90 ia para todos os dias negativos seguintes do cheque especial.
 */
export function ehCaixaPorPeriodo(texto: string): boolean {
  const t = normalizarTexto(texto);
  return /\bextrato por periodo\b/.test(t) && /\bcaixa\b/.test(t);
}

/** a borda esquerda da coluna Valor, pelo cabeçalho que tem Favorecido, Valor e Saldo na mesma linha */
function xDaColunaValorDaCaixa(linhas: Linha[]): number | null {
  for (const l of linhas) {
    const achar = (nome: string) => l.tokens.find(t => normalizarTexto(t.s) === nome);
    const valor = achar('valor');
    if (valor && achar('favorecido') && achar('saldo')) return valor.x;
  }
  return null;
}

/** até onde o número da coluna Valor pode começar longe do título dela (a coluna é alinhada à esquerda) */
const FOLGA_DA_COLUNA_VALOR = 8;
const NUMERO_DA_LETRA: Record<string, string> = { A: '4', O: '0', o: '0', I: '1', l: '1', S: '5', B: '8' };

/** o valor com letra no lugar de número ("5.377,A7D" → "5.377,47D"); o que não vira um valor fica como está */
function valorSemLetraDoOcr(s: string): string {
  const m = s.match(/^([\dAOoIlSB.,]+?)([CD]?)$/);
  if (!m || !/\d/.test(m[1])) return s;
  const certo = m[1].replace(/[AOoIlSB]/g, x => NUMERO_DA_LETRA[x]) + m[2];
  return RE_VALOR.test(certo) ? certo : s;
}

function lancamentosComPagina(paginas: ItemDeTexto[][], lado: Lado, anoPadrao: number): { lancamentos: Lancamento[]; pagina: number[]; saldosDoDia?: Map<string, number>; saldoAnteriorPelaLinha?: number | null; saldoAnteriorConferido?: number | null } {
  const saldosDoDia = new Map<string, number>();
  let ultimaDataDeValor: string | null = null;
  const itauMensal = lado === 'banco' && ehItauMensal(paginas.map(p => p.map(i => i.texto).join(' ')).join('\n'));
  const todas = (itauMensal ? paginas.map(semALegendaDoItau) : paginas).map(p => juntarPedacosSoltos(montarLinhas(p)));
  if (lado === 'banco') {
    const texto = todas.map(p => p.map(l => l.texto).join('\n')).join('\n');
    if (ehExtratoDaCaixa(texto)) return lancamentosDaCaixa(todas, anoDoTexto(texto, anoPadrao));
  }
  const paginaDe: number[] = [];
  // o período que o extrato diz (o Bradesco: "Entre 01/01/2026 e 31/01/2026"): o ano dele vale, e não o que mais aparece
  // (na 571 o OCR leu mais "2028" que "2026")
  const entre = periodoEntreDatas(todas.map(p => p.map(l => l.texto).join('\n')).join('\n'));
  const ano = entre ? +entre.inicio.slice(0, 4) : anoDoTexto(todas.map(p => p.map(l => l.texto).join('\n')).join('\n'), anoPadrao);
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
  // o lançamento de cima ficou sem o saldo na linha dele (o OCR o pôs na linha de baixo)
  let ultimoSemSaldo = false;
  // o lançamento de cima que não fechou com o saldo (o Bradesco escaneado): a linha de baixo confere
  let inseguro: { l: Lancamento; antes: number } | null = null;
  // o SALDO ANTERIOR lido ainda não conferido com a 1ª linha com saldo, e o que a conferência achou (o OCR leu o "−11.234,56"
  // como "71.234,56"; Vitor, 06/11/2026, na 571)
  let aberturaSemConferir = false;
  let saldoAnteriorConferido: number | null = null;
  // a coluna da data: onde ficam as datas com ano que abrem a linha. Data curta ("21/03") longe dela é o fim de um
  // histórico quebrado ("REM: FULANO" / "21/03"), não um dia novo (Vitor, 09/10/2026: a 380 jogava o 23/03 no 21/03)
  const xDasDatas = todas.flat().map(l => l.tokens[0]).filter(t => t && RE_DATA.test(t.s) && /\d{4}$/.test(t.s)).map(t => t.x);
  const naColunaDaData = (x: number) => !xDasDatas.length || xDasDatas.some(d => Math.abs(d - x) <= 20);
  const textoTodo = todas.map(p => p.map(l => l.texto).join('\n')).join('\n');
  const periodo = periodoDoExtrato(textoTodo);
  const pelaDtMovimento = ehConsultasDoBB(textoTodo);
  // o PagBank escreve o sinal das saídas ("-2,27", "-R$ 30.000,00"): o valor sem sinal é entrada, e o histórico não decide
  // (Vitor, 04/11/2026, na 10: "Vendas - Disponivel DEBITO VISA" e "Pagamento de PIX" recebidos viravam saída). Só nele:
  // em outros bancos (Nubank, Inter, Stone…) o "-" aparece em totais e saldos e as saídas vêm sem sinal. O Itaú "Lançamentos
  // do período" também escreve (report PGL7X5, 09/11/2026, na 581: o "REND PAGO" e o Pix da "… PAGAMENTO S.A." viravam saída)
  // e o "extrato mensal" dele (Vitor, 09/11/2026, na 474: o "PIX TRANSF" recebido virava saída)
  const inter = ehInter(textoTodo);
  const sinalEscrito = ehPagBank(textoTodo) || ehItauPorPeriodo(textoTodo) || itauMensal || inter;
  const caixaPorPeriodo = lado === 'banco' && ehCaixaPorPeriodo(textoTodo);
  let xValorDaCaixa: number | null = null;

  for (const [nPagina, linhas] of todas.entries()) {
    col = colunas(linhas) || col;
    if (caixaPorPeriodo) xValorDaCaixa = xDaColunaValorDaCaixa(linhas) ?? xValorDaCaixa;
    const xValor = xValorDaCaixa;
    const naColunaValor = (k: Token) => xValor != null && Math.abs(k.x - xValor) <= FOLGA_DA_COLUNA_VALOR;
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
      if (entre && col) consertarValoresDoOcr(t, col);
      for (let i = 0; i < t.length; i++) if (naColunaValor(t[i])) t[i] = { ...t[i], s: valorSemLetraDoOcr(t[i].s) };
      if (/^ultimos lancamentos\b/.test(normalizarTexto(l.texto))) { juntarPerto(); noFim = true; continue; }
      if (itauMensal && /^(saldo final|totalizador de aplicacoes)\b/.test(normalizarTexto(l.texto))) { juntarPerto(); noFim = true; continue; }
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
      // "2 de Março de 2026" (o Inter) e "01 Mar, 2026" (o InfinitePay; Vitor, 10/11/2026: nenhum dos dois era lido)
      else if (inter && t[4] && /^\d{1,2}$/.test(t[0].s) && /^de$/i.test(t[1].s) && /^de$/i.test(t[3].s) && RE_ANO.test(t[4].s)) { data = lerData(t[0].s + ' ' + t[2].s + ' ' + t[4].s, ano); if (data) t.splice(0, 5); }
      else if (t[2] && /^\d{1,2}$/.test(t[0].s) && /^[a-zç]{3},$/i.test(t[1].s) && RE_ANO.test(t[2].s)) { data = lerData(t[0].s + ' ' + t[1].s.slice(0, 3) + ' ' + t[2].s, ano); if (data) t.splice(0, 3); }
      else if (t[1] && RE_DATA_MES.test(diaDoOcr(t[0].s) + ' ' + t[1].s)) {
        // o ano no pedaço seguinte ("11 | FEV | 2026") é da data: senão o "2026 Total de saídas" virava lançamento (Vitor,
        // 20/10/2026: o Nubank tinha o total do dia como uma saída a mais)
        const comAno = t[2] && RE_ANO.test(t[2].s);
        data = lerData(diaDoOcr(t[0].s) + ' ' + t[1].s + (comAno ? ' ' + t[2].s : ''), ano);
        if (data) t.splice(0, comAno ? 3 : 2);
      }
      else if (RE_DATA_MES.test(diaDoOcr(t[0].s))) { data = lerData(diaDoOcr(t[0].s), ano); if (data) t.shift(); }
      else if (entre) { data = dataEmbaralhada(t[0].s, entre); if (data) t.shift(); }
      if (data && entre) data = dataNoPeriodo(data, entre);
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
        // o "R$" / "-R$" solto antes do número (o PagBank "Extrato da conta"): vai com o valor, e o "-" é o sinal
        if (sinalEscrito && /^-?R\$$/i.test(s) && t[i + 1] && RE_VALOR.test(t[i + 1].s)) {
          valores.push({ ...t[i + 1], s: (s.startsWith('-') && !t[i + 1].s.startsWith('-') ? '-' : '') + t[i + 1].s });
          i++;
          continue;
        }
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
        // (no Inter, o saldo do dia vem antes dos lançamentos dele: não é o saldo de antes do primeiro)
        if (!inter && /saldo (?:anterior|inicial)|saldo (?:do )?dia|\bs a l d o\b/.test(n) && valores.length) saldoCorrido = centavos(valores[valores.length - 1].s);
        if (entre && /saldo (?:anterior|inicial)/.test(n) && saldoCorrido != null) { aberturaSemConferir = true; saldoAnteriorConferido = saldoCorrido; }
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
      // na Caixa por período, o número fora da coluna Valor é o saldo: sem valor legível, o lançamento não entra (e aparece
      // como pendência na conferência), em vez de entrar com o saldo no lugar do valor
      if (xValor != null && data && !valores.some(naColunaValor)) { solta = null; continue; }
      // antes do período só fica a data do SALDO ANTERIOR: o lançamento sem data depois dele (o OCR embaralhou a do 1º dia,
      // "c2102/20268") é do período, e entra no 1º dia dele (Vitor, 06/11/2026, na 571: o fevereiro tinha 15 lançamentos em
      // 30/01, a data do saldo anterior, e o arquivo de fevereiro aparecia no janeiro)
      if (entre && dataAtual < entre.inicio) dataAtual = entre.inicio;
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
      const lidoC = centavos(v.s);
      if (lidoC == null || lidoC === 0) continue;
      let c: number = lidoC;
      let saldoDaLinha: number | null = lado === 'banco' && valores.length > 1 && valores[valores.length - 1] !== v ? centavos(valores[valores.length - 1].s) : null;
      let saldoAntes: number | null = saldoCorrido;
      // a linha de cima não fechou (o OCR estragou o valor e o saldo dela: "800,00" e "1.234,06" eram 600,00 e 1.234,56): o
      // saldo desta, menos o de antes da de cima e menos este valor, é o valor da de cima, se for parecido com o lido (um
      // dígito trocado, ou um a mais na frente) — Vitor, 06/11/2026, na 571
      if (entre && inseguro && ultimo === inseguro.l && saldoDaLinha != null && saldoAntes === inseguro.antes + inseguro.l.valor
        && fechaQuase(c, saldoDaLinha, saldoAntes)) {
        // a de cima ficou com o valor lido e o saldo refeito, e esta fecha com ele (com um dígito trocado no saldo desta,
        // como o "712.345,68" embaixo do "123,45"): a de cima fica como está
      } else if (entre && inseguro && ultimo === inseguro.l && saldoDaLinha != null) {
        const cima: { l: Lancamento; antes: number } = inseguro;
        const contas: number[] = [];
        // (o valor desta também pode ter o "−" lido como número: o "71.234,56" do tributo embaixo do PIX de 600,00 lido 800,00)
        const c1 = semOPrimeiroDigito(c);
        for (const s of numerosQueOOcrEstraga(saldoDaLinha)) for (const cc of [c, -c, ...(c1 ? [c1, -c1] : [])]) contas.push(s - cima.antes - cc);
        // o valor lido confirmado (só o saldo da de cima estava errado: "712.345,68" era −12.345,63) vale mais que um parecido
        const achou = contas.find(vi => vi === cima.l.valor) ?? contas.find(vi => vi !== 0 && valorParecido(vi, cima.l.valor));
        if (achou != null) { cima.l.valor = achou; saldoAntes = cima.antes + achou; }
      }
      inseguro = null;
      // no Bradesco escaneado, a linha só com o número da coluna Saldo (Vitor, 06/11/2026, na 571): o OCR pôs o saldo do
      // lançamento de cima numa linha à parte (o saldo do PAGTO na linha de baixo), e aí é dele; ou o valor ficou ilegível
      // ("7x 34"), e aí o valor é a diferença dos saldos
      if (entre && col && lado === 'banco' && saldoAntes != null && valores.every(x => colunaDoNumero(x.x2, col as Colunas) === 'saldo')) {
        const s = c;
        // (o saldo corrido já andou com o valor da de cima)
        const doDeCima = ultimo && ultimoSemSaldo ? [s, -s].find(x => x === saldoAntes) : undefined;
        if (doDeCima != null && ultimo) {
          saldoCorrido = doDeCima; ultimoSemSaldo = false;
          if (hist) ultimo.historico = (ultimo.historico + ' ' + hist).trim();
          continue;
        }
        if (s === saldoAntes) continue;
        // o OCR perde o "−" do saldo negativo: vale o sinal que dá a menor diferença ("7x 34" com o saldo "1.234,56", que era negativo)
        const sCerto: number = Math.abs(s - saldoAntes) <= Math.abs(-s - saldoAntes) ? s : -s;
        c = sCerto - saldoAntes;
        saldoDaLinha = sCerto;
      }
      // o extrato que diz o período (o Bradesco escaneado): o valor e o saldo que o OCR estragou ficam os que fecham com o
      // saldo de antes (Vitor, 06/11/2026, na 571)
      let duvida = false;
      if (entre && !decrescente && saldoDaLinha != null && saldoAntes != null) {
        let a = acertoPeloSaldo(c, saldoDaLinha, saldoAntes);
        if (!a && aberturaSemConferir) {
          // o saldo anterior que fecha com esta linha; dos que fecham, o que usa o saldo desta como foi lido (só o sinal
          // pode mudar) vale mais (o "71.234,56" fechava como 1.234,56 com o saldo "11.734,56" lido 1.734,56; era −11.234,56)
          // e, com o saldo todo sem o "−", o sinal do valor pela coluna (Débito = saída) decide entre o positivo e o negativo
          const lidaQue = (n: number) => Math.abs(n) === Math.abs(saldoDaLinha as number);
          const sinal = col && col.deb != null && col.cred != null ? (Math.abs(v.x2 - col.deb) < Math.abs(v.x2 - col.cred) ? -1 : 1) : 0;
          const nota = (b: { valor: number; saldo: number }) => (lidaQue(b.saldo) ? 2 : 0) + (sinal && Math.sign(b.valor) === sinal ? 1 : 0);
          let melhor: { alt: number; b: { valor: number; saldo: number } } | null = null;
          for (const alt of numerosQueOOcrEstraga(saldoAntes as number).slice(1) as number[]) {
            const b = acertoPeloSaldo(c, saldoDaLinha, alt);
            if (!b || b.duvida) continue;
            if (!melhor || nota(b) > nota(melhor.b)) melhor = { alt, b };
          }
          if (melhor) { a = melhor.b; saldoAntes = melhor.alt; saldoAnteriorConferido = melhor.alt; }
        }
        if (a) { c = a.valor; saldoDaLinha = a.saldo; if (a.duvida) duvida = true; }
      }
      // não fechou (ou fechou trocando um dígito): a linha de baixo confere
      const ficouInseguro: number | null = entre && saldoDaLinha != null && saldoAntes != null && (duvida || saldoDaLinha - saldoAntes !== c) ? saldoAntes : null;
      if (saldoDaLinha != null) { saldoCorrido = saldoDaLinha; aberturaSemConferir = false; }
      ultimoSemSaldo = saldoDaLinha == null;
      // do mais novo para o mais velho (o Stone), a diferença dos saldos é a do lançamento de cima, não a deste: não vale. A
      // folga de 1 centavo (o arredondamento) só em valor de 1 real para cima: no Stone, o rendimento de R$ 0,01 virava
      // saída pela diferença de R$ 0,02 do lançamento vizinho (Vitor, 26/10/2026)
      const diferenca: number | null = !decrescente && saldoAntes != null && saldoDaLinha != null ? saldoDaLinha - saldoAntes : null;
      const folga = Math.abs(c) >= 100 ? 1 : 0;
      // o "−" que o OCR leu como um número na frente ("−12,34" virou "112,34", "−12.345,67" virou "712.345,67"; Vitor,
      // 06/11/2026, na 571): sem o 1º dígito, o valor é a diferença dos saldos
      const semOPrimeiro = String(Math.abs(c)).slice(1);
      if (diferenca != null && diferenca !== 0 && Math.abs(Math.abs(diferenca) - Math.abs(c)) > folga && semOPrimeiro && Number(semOPrimeiro) === Math.abs(diferenca)) c = diferenca;
      else if (diferenca != null && diferenca !== 0 && Math.abs(Math.abs(diferenca) - Math.abs(c)) <= folga) c = Math.sign(diferenca) * Math.abs(c);
      else if (!temSinal(v.s)) {
        const base = normalizarTexto(hist || solta || '');
        // (no Itaú mensal, a 1ª página tem o quadro "entradas (créditos) / saídas (débitos)" do resumo, fora das colunas da tabela)
        if (!itauMensal && col && col.deb != null && col.cred != null) {
          const ehDebito = Math.abs(v.x2 - col.deb) < Math.abs(v.x2 - col.cred);
          c = ehDebito !== (lado === 'sistema') ? -Math.abs(c) : Math.abs(c);
        } else if (!sinalEscrito && RE_SAIDA.test(base) && !RE_ENTRADA.test(base)) c = -Math.abs(c);
      }
      // no Bradesco escaneado, a corrente dos saldos não para (Vitor, 06/11/2026, na 571): a linha sem saldo legível ("x34,56")
      // anda com o valor dela; a que não fechou fica com a leitura do saldo mais perto do esperado (o saldo negativo lido sem o "−")
      if (entre && saldoAntes != null) {
        const esperado = saldoAntes + c;
        if (saldoDaLinha == null) saldoCorrido = esperado;
        else if (ficouInseguro != null && !duvida) saldoCorrido = numerosQueOOcrEstraga(saldoDaLinha).reduce((m, x) => (Math.abs(x - esperado) < Math.abs(m - esperado) ? x : m));
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
      const novo: Lancamento = { data: dataDoLanc, valor: c, historico: h || '(sem histórico)', ...(dataDoLanc !== dataAtual ? { balancete: dataAtual } : {}) };
      ultimo = novo;
      if (ficouInseguro != null) inseguro = { l: novo, antes: ficouInseguro };
      ultimaY = l.y;
      // a Dt. movimento no mês seguinte: o lançamento vem no extrato do outro mês (senão entraria duas vezes; o saldo
      // anterior do extrato seguinte já é o de antes dele)
      if (pelaDtMovimento && periodo && !dataDoLanc.startsWith(periodo)) continue;
      saida.push(novo);
      saldoDeCada.push(saldoDaLinha);
      paginaDe.push(nPagina);
    }
    juntarPerto();
  }
  // o saldo antes do primeiro lançamento pela coluna Saldo, quando o extrato não imprime a linha do saldo anterior (o Stone;
  // Vitor, 26/10/2026): o saldo da linha do lançamento mais antigo menos o valor dele
  let saldoAnteriorPelaLinha: number | null = null;
  if (((col && (col as Colunas).saldo != null) || inter) && saida.length) {
    let i0 = -1;
    saida.forEach((l, i) => { if (i0 < 0 || l.data < saida[i0].data || (decrescente && l.data === saida[i0].data)) i0 = i; });
    const s0 = saldoDeCada[i0];
    if (s0 != null) saldoAnteriorPelaLinha = s0 - saida[i0].valor;
  }
  return { lancamentos: saida, pagina: paginaDe, saldosDoDia, saldoAnteriorPelaLinha, saldoAnteriorConferido };
}
