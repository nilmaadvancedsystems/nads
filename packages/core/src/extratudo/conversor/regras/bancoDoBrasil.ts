// Extrato de Conta Corrente do Banco do Brasil em PDF (o do site/app do BB): colunas Dia · Lote · Documento ·
// Histórico · Valor, e o sinal ao lado do valor, "(+)" ou "(-)". O histórico de muitos lançamentos vem em duas
// linhas, uma logo acima e outra logo abaixo da linha da data e do valor:
//
//     Pix - Enviado
//     02/09/2026  13105  90201                    2.000,00 (-)
//     02/09 08:34 RENALD DA CRUZ
//
// e no .xls do escritório vira "Pix - Enviado 02/09 08:34 RENALD DA CRUZ" (o de cima, o da linha e o de baixo).
// Saldo Anterior, Saldo do dia e S A L D O não são lançamento; as "Informações Adicionais" do fim também não.
import { normalizarTexto } from '../../../formatos';
import { montarLinhas, type ItemDeTexto } from '../../extrator/regras/extrato';
import { centavos } from '../../extrator/regras/texto';
import type { LinhaConvertida } from '../tipos';

type Linha = ReturnType<typeof montarLinhas>[number];

const RE_DATA = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const RE_VALOR = /^\d{1,3}(?:\.\d{3})*,\d{2}$/;
const RE_SINAL = /^\((\+|-)\)$/;
/**
 * a linha de texto pertence à linha da data mais perto, a até isso dela (o BB usa ~5 acima e ~6 abaixo; com o histórico
 * também na linha da data, ~11 e ~12); mais longe que isso, no pé ou no topo da página, é da página vizinha
 */
const PERTO = 14;

interface Cabecalho { xHistorico: number; xLote: number }

function cabecalho(l: Linha): Cabecalho | null {
  const n = l.tokens.map(t => normalizarTexto(t.s));
  const iDia = n.indexOf('dia'), iLote = n.indexOf('lote'), iHist = n.indexOf('historico'), iValor = n.indexOf('valor');
  if (iDia < 0 || iLote < 0 || iHist < 0 || iValor < 0) return null;
  return { xHistorico: l.tokens[iHist].x, xLote: l.tokens[iLote].x };
}

/** É o extrato do BB? (o cabeçalho "Dia Lote Documento Histórico Valor" e o sinal "(+)"/"(-)" nos valores) */
export function ehExtratoDoBancoDoBrasil(paginas: ItemDeTexto[][]): boolean {
  const linhas = paginas.flatMap(montarLinhas);
  return linhas.some(l => cabecalho(l)) && linhas.some(l => l.tokens.some(t => RE_SINAL.test(t.s)));
}

interface Lanc { y: number; data: string; valor: number; meio: string; acima: { y: number; s: string }[]; abaixo: { y: number; s: string }[] }

export function lancamentosDoBancoDoBrasil(paginas: ItemDeTexto[][]): LinhaConvertida[] {
  const saida: Lanc[] = [];
  let cab: Cabecalho | null = null;
  let fim = false;
  /** texto no pé da página, sem a linha da data: é o de cima do primeiro lançamento da página seguinte */
  let paraOProximo: { y: number; s: string }[] = [];

  for (const pagina of paginas) {
    if (fim) break;
    const linhas = montarLinhas(pagina);
    const vindo = paraOProximo;
    paraOProximo = [];
    const daPagina: Lanc[] = [];
    const textos: { y: number; s: string }[] = [];
    let dentro = false;
    for (const l of linhas) {
      const c = cabecalho(l);
      if (c) { cab = c; dentro = true; continue; }
      if (!dentro || !cab) continue;
      const norm = normalizarTexto(l.texto);
      if (/^informacoes adicionais\b/.test(norm)) { fim = true; break; }
      const t = l.tokens;
      const m = t[0] && t[0].x < cab.xLote - 2 ? t[0].s.match(RE_DATA) : null;
      if (!m) {
        // texto do histórico (as linhas de cima e de baixo)
        if (t.length && t[0].x >= cab.xHistorico - 4) textos.push({ y: l.y, s: l.texto });
        continue;
      }
      // a linha da data: o valor é o último número, com o sinal logo depois
      let iValor = -1;
      for (let i = t.length - 1; i > 0; i--) if (RE_VALOR.test(t[i].s)) { iValor = i; break; }
      if (iValor < 0) continue;
      const sinal = t[iValor + 1] && RE_SINAL.test(t[iValor + 1].s) ? t[iValor + 1].s : '(+)';
      const meio = t.slice(1, iValor).filter(x => x.x >= cab!.xHistorico - 4).map(x => x.s).join(' ');
      const nMeio = normalizarTexto(meio).replace(/\s+/g, '');
      if (/^saldo/.test(nMeio)) continue; // Saldo Anterior, Saldo do dia, S A L D O
      const v = centavos(t[iValor].s);
      if (v == null || v === 0) continue;
      daPagina.push({
        y: l.y, data: m[3] + '-' + m[2] + '-' + m[1], valor: sinal === '(-)' ? -v : v, meio,
        acima: [], abaixo: [],
      });
    }

    // cada texto vai para o lançamento mais perto (acima dele = começo do histórico; abaixo = o fim)
    for (const tx of textos) {
      let melhor: Lanc | null = null;
      for (const d of daPagina) if (!melhor || Math.abs(d.y - tx.y) < Math.abs(melhor.y - tx.y)) melhor = d;
      const longe = !melhor || Math.abs(melhor.y - tx.y) > PERTO;
      if (longe && (!daPagina.length || tx.y < Math.min(...daPagina.map(d => d.y)))) paraOProximo.push(tx); // no pé da página
      else if (longe && tx.y > Math.max(...daPagina.map(d => d.y)) && saida.length) saida[saida.length - 1].abaixo.push(tx); // no topo: o fim do último da página anterior
      else if (melhor) (tx.y > melhor.y ? melhor.acima : melhor.abaixo).push(tx);
    }
    if (daPagina.length && vindo.length) {
      // o texto que sobrou no pé da página anterior vem antes de tudo
      daPagina[0].acima = [...vindo.map((p, i) => ({ s: p.s, y: Number.MAX_SAFE_INTEGER - i })), ...daPagina[0].acima];
    } else if (vindo.length) paraOProximo = [...vindo, ...paraOProximo];
    saida.push(...daPagina);
  }

  return saida.map(d => {
    const acima = d.acima.slice().sort((a, b) => b.y - a.y).map(x => x.s);
    const abaixo = d.abaixo.slice().sort((a, b) => b.y - a.y).map(x => x.s);
    const historico = [...acima, d.meio, ...abaixo].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    return { data: d.data, valor: d.valor, historico };
  });
}
