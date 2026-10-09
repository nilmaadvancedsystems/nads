// Extrato da Unicred em PDF, o do internet banking (Vitor, 09/10/2026): colunas Data · Lançamentos · Valor (R$) · Saldo (R$).
// Como no BB, o histórico vem numa linha logo acima e noutra logo abaixo da linha da data e do valor; a saída tem o "-"
// solto antes do valor:
//
//     TRANSFERENCIA TEF PIX ( Doc.: 1139525 / AYRTON
//     02/09/2026                                  - 4.618,00    13.348,24
//     OLIVEIRA COUTINHO )
//
// e no .xls vira "TRANSFERENCIA TEF PIX (Doc.: 1139525 / AYRTON OLIVEIRA COUTINHO)". Alguns lançamentos vêm numa linha só
// (a "Aplicação CDI Unicred" com o histórico na linha da data). O resumo do topo, o "Saldo no final do período" e os
// "Lançamentos futuros" do fim não entram.
import { normalizarTexto } from '../../../formatos';
import { montarLinhas, type ItemDeTexto } from '../../extrator/regras/extrato';
import { centavos } from '../../extrator/regras/texto';
import type { LinhaConvertida } from '../tipos';

const RE_DATA = /^(\d{2})\/(\d{2})\/(\d{4})$/;
/** o valor; o "-" da saída vem solto antes dele ou, conforme o espaçamento do PDF, grudado */
const RE_VALOR = /^-?\d{1,3}(?:\.\d{3})*,\d{2}$/;
/** a linha de texto pertence à linha da data mais perto, a até isso dela (a Unicred usa ~4 acima e ~7 abaixo) */
const PERTO = 11;

interface Cabecalho { xLancamentos: number; xValor: number; xSaldo: number }

function cabecalho(l: ReturnType<typeof montarLinhas>[number]): Cabecalho | null {
  const n = l.tokens.map(t => normalizarTexto(t.s));
  const iData = n.indexOf('data'), iLanc = n.indexOf('lancamentos'), iValor = n.indexOf('valor'), iSaldo = n.indexOf('saldo');
  if (iData < 0 || iLanc < 0 || iValor < 0 || iSaldo < 0) return null;
  return { xLancamentos: l.tokens[iLanc].x, xValor: l.tokens[iValor].x, xSaldo: l.tokens[iSaldo].x };
}

/** É o extrato da Unicred? (o cabeçalho "Data Lançamentos Valor (R$) Saldo (R$)" e a Unicred no texto) */
export function ehExtratoDaUnicred(paginas: ItemDeTexto[][]): boolean {
  const linhas = paginas.flatMap(montarLinhas);
  return linhas.some(l => cabecalho(l)) && linhas.some(l => /\bunicred\b|\bcoop\b.*\bag\b/.test(normalizarTexto(l.texto)));
}

interface Lanc { y: number; data: string; valor: number; meio: string; acima: { y: number; s: string }[]; abaixo: { y: number; s: string }[] }

const limpar = (s: string) => s.replace(/\(\s+/g, '(').replace(/\s+\)/g, ')').replace(/\s+/g, ' ').trim();

export function lancamentosDaUnicred(paginas: ItemDeTexto[][]): LinhaConvertida[] {
  const saida: Lanc[] = [];
  let cab: Cabecalho | null = null;
  let fim = false;
  for (const pagina of paginas) {
    if (fim) break;
    const daPagina: Lanc[] = [];
    const textos: { y: number; s: string }[] = [];
    let dentro = false;
    for (const l of montarLinhas(pagina)) {
      const c = cabecalho(l);
      if (c) { cab = c; dentro = true; continue; }
      if (!dentro || !cab) continue;
      const norm = normalizarTexto(l.texto);
      if (/^saldo no final do periodo\b|^lancamentos futuros\b/.test(norm)) { fim = true; break; }
      const t = l.tokens;
      const m = t[0] && t[0].x < cab.xLancamentos - 10 ? t[0].s.match(RE_DATA) : null;
      if (!m) {
        // o histórico de cima e o de baixo (na coluna Lançamentos)
        if (t.length && t[0].x >= cab.xLancamentos - 4 && t[0].x < cab.xValor - 20) textos.push({ y: l.y, s: l.texto });
        continue;
      }
      // a linha da data: o valor (antes da coluna Saldo) e o "-" solto antes dele
      const valores = t.map((x, i) => ({ x, i })).filter(({ x }) => RE_VALOR.test(x.s));
      // a coluna Valor: antes do meio do caminho até a coluna Saldo (os números das duas ficam perto)
      const meioDoCaminho = (cab.xValor + cab.xSaldo) / 2;
      const doValor = valores.filter(({ x }) => x.x < meioDoCaminho);
      if (!doValor.length) continue;
      const { x: vx, i: vi } = doValor[doValor.length - 1];
      const negativo = vi > 0 && t[vi - 1].s === '-';
      const v = centavos(vx.s);
      if (v == null || v === 0) continue;
      const meio = t.slice(1, negativo ? vi - 1 : vi).filter(x => x.x >= cab!.xLancamentos - 4).map(x => x.s).join(' ');
      daPagina.push({ y: l.y, data: m[3] + '-' + m[2] + '-' + m[1], valor: negativo ? -v : v, meio, acima: [], abaixo: [] });
    }
    // cada texto vai para o lançamento mais perto: acima dele, o começo do histórico; abaixo, o fim
    for (const tx of textos) {
      let melhor: Lanc | null = null;
      for (const d of daPagina) if (!melhor || Math.abs(d.y - tx.y) < Math.abs(melhor.y - tx.y)) melhor = d;
      if (melhor && Math.abs(melhor.y - tx.y) <= PERTO) (tx.y > melhor.y ? melhor.acima : melhor.abaixo).push(tx);
    }
    saida.push(...daPagina);
  }
  return saida.map(d => {
    const ordem = (xs: { y: number; s: string }[]) => xs.slice().sort((a, b) => b.y - a.y).map(x => x.s);
    return { data: d.data, valor: d.valor, historico: limpar([...ordem(d.acima), d.meio, ...ordem(d.abaixo)].filter(Boolean).join(' ')) };
  });
}
