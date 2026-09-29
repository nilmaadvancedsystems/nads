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
const RE_DATA_MES = /^(\d{1,2})[/.\s-]?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*$/i;
const RE_VALOR = /^\(?-?(?:R\$)?-?\d{1,3}(?:\.\d{3})*,\d{2}\)?-?[CD]?$/i;
const RE_SINAL = /^(?:[CD]|\(\+\)|\(-\)|[+-]|\*)$/i;
/** linha de saldo, total ou resumo: não é lançamento */
const RE_SALDO = /\bs\s?a\s?l\s?d\s?o\b|saldo|total|resumo|limite|bloquead|dispon[ií]vel|a transportar|transporte/i;
const RE_SAIDA = /\b(pagto|pagamento|pag\b|tarifa|tar\b|saque|debito|deb\b|compra|enviad|envio|iof|juros|encargo|tributo|darf|gps|das\b|pago|aplicacao|cesta|mensalidade|cheque compensado|chq)/;
const RE_ENTRADA = /\b(recebid|receb\b|credito|cred\b|deposito|dep\b|resgate|estorno|rendimento|liquidacao cobranca|cobranca)/;

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
      } else junto.push({ ...t });
    }
    return { y: g.y, tokens: junto, texto: junto.map(t => t.s).join(' ') };
  });
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
export function lancamentosDoPdf(paginas: ItemDeTexto[][], lado: Lado, anoPadrao = new Date().getFullYear()): Lancamento[] {
  const todas = paginas.map(montarLinhas);
  const ano = anoDoTexto(todas.map(p => p.map(l => l.texto).join('\n')).join('\n'), anoPadrao);
  const saida: Lancamento[] = [];
  let col: Colunas | null = null;
  let dataAtual: string | null = null;

  for (const linhas of todas) {
    col = colunas(linhas) || col;
    let solta: string | null = null;
    let ultimo: Lancamento | null = null;
    let ultimaY: number | null = null;

    for (const l of linhas) {
      const t = l.tokens.slice();
      if (!t.length) continue;
      let data: string | null = null;
      if (RE_DATA.test(t[0].s)) { data = lerData(t[0].s, ano); if (data) t.shift(); }
      else if (t[1] && RE_DATA_MES.test(t[0].s + ' ' + t[1].s)) { data = lerData(t[0].s + ' ' + t[1].s, ano); if (data) t.splice(0, 2); }
      else if (RE_DATA_MES.test(t[0].s)) { data = lerData(t[0].s, ano); if (data) t.shift(); }
      if (data) dataAtual = data;

      const valores: Token[] = [];
      const resto: string[] = [];
      for (let i = 0; i < t.length; i++) {
        const s = t[i].s;
        if (RE_VALOR.test(s)) {
          const v = { ...t[i] };
          const prox = t[i + 1];
          if (prox && RE_SINAL.test(prox.s) && !RE_VALOR.test(prox.s)) {
            v.s += prox.s === '*' ? '' : ' ' + prox.s.replace(/[()]/g, '');
            v.x2 = prox.x2;
            i++;
          }
          valores.push(v);
        } else if (RE_DATA.test(s) && !resto.length && !valores.length) {
          // segunda data (data do balancete): ignora
        } else resto.push(s);
      }
      const hist = resto.join(' ').replace(/\s+/g, ' ').trim();

      if (!valores.length) {
        if (hist && !RE_SALDO.test(hist) && !/^(data|dt\.?)\b/i.test(hist) && hist.length <= 90) {
          if (data) solta = hist;
          else if (ultimo && ultimaY != null && Math.abs(ultimaY - l.y) < 16 && !solta) { ultimo.historico = (ultimo.historico + ' ' + hist).trim(); ultimaY = l.y; }
          else solta = (solta ? solta + ' ' : '') + hist;
        }
        continue;
      }
      if (RE_SALDO.test(hist) || (!hist && !solta && RE_SALDO.test(l.texto))) { solta = null; continue; }
      if (!dataAtual) continue;

      let candidatos = valores;
      if (col && col.saldo != null && valores.length > 1) {
        const saldo = col.saldo;
        candidatos = valores.filter(v => Math.abs(v.x2 - saldo) > 12);
        if (!candidatos.length) candidatos = [valores[0]];
      }
      const v = candidatos[0];
      let c = centavos(v.s);
      if (c == null || c === 0) continue;
      if (!temSinal(v.s)) {
        const base = normalizarTexto(hist || solta || '');
        if (col && col.deb != null && col.cred != null) {
          const ehDebito = Math.abs(v.x2 - col.deb) < Math.abs(v.x2 - col.cred);
          c = ehDebito !== (lado === 'sistema') ? -Math.abs(c) : Math.abs(c);
        } else if (RE_SAIDA.test(base) && !RE_ENTRADA.test(base)) c = -Math.abs(c);
      }

      let h = hist;
      if (!h && solta) { h = solta; solta = null; }
      else if (solta && ultimo) { ultimo.historico = (ultimo.historico + ' ' + solta).trim(); solta = null; }
      else solta = null;
      ultimo = { data: dataAtual, valor: c, historico: h || '(sem histórico)' };
      ultimaY = l.y;
      saida.push(ultimo);
    }
  }
  return saida;
}
