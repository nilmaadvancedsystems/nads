// Relatório de movimentações da InfinitePay (CloudWalk) em PDF (Vitor, 09/10/2026): por dia, o cabeçalho Data · Hora · Tipo
// de transação · Nome · Detalhe · Valor (R$), os lançamentos e o "Saldo do dia". A data ("08 Set, 2026") só vem no
// primeiro lançamento do dia; o valor vem com o sinal grudado ("+345,20", "-126,36"); o nome comprido quebra numa linha
// acima e noutra abaixo da linha do valor (às vezes a data fica na linha de cima):
//
//                          Pix 360 IMPRIMIR COMPOSICAO DE PROJETOS GRAFICOS
//               15:12  Pix                                                Enviado           -126,36
//                          LTDA
//
// e no .xls vira "Pix 360 IMPRIMIR COMPOSICAO DE PROJETOS GRAFICOS LTDA Enviado" (o tipo, o nome e o detalhe; quando o nome
// já começa com o tipo, sem repetir). O resumo do topo e o "Saldo do dia" não entram.
import { normalizarTexto } from '../../../formatos';
import { montarLinhas, type ItemDeTexto } from '../../extrator/regras/extrato';
import { centavos } from '../../extrator/regras/texto';
import type { LinhaConvertida } from '../tipos';

const MESES: Record<string, string> = { jan: '01', fev: '02', mar: '03', abr: '04', mai: '05', jun: '06', jul: '07', ago: '08', set: '09', out: '10', nov: '11', dez: '12' };
const RE_VALOR = /^([+-])(\d{1,3}(?:\.\d{3})*,\d{2})$/;
/** o nome que quebrou de linha fica a até isso da linha do valor */
const PERTO = 9;

interface Colunas { hora: number; tipo: number; nome: number; detalhe: number; valor: number }

function colunas(l: ReturnType<typeof montarLinhas>[number]): Colunas | null {
  const n = l.tokens.map(t => normalizarTexto(t.s));
  const i = (s: string) => n.indexOf(s);
  if (i('data') < 0 || i('hora') < 0 || i('tipo') < 0 || i('nome') < 0 || i('detalhe') < 0 || i('valor') < 0) return null;
  const x = (s: string) => l.tokens[i(s)].x;
  return { hora: x('hora'), tipo: x('tipo'), nome: x('nome'), detalhe: x('detalhe'), valor: x('valor') };
}

/** É o relatório da InfinitePay? (o cabeçalho com Hora/Tipo de transação/Detalhe e a InfinitePay ou a CloudWalk no texto) */
export function ehExtratoDaInfinitePay(paginas: ItemDeTexto[][]): boolean {
  const linhas = paginas.flatMap(montarLinhas);
  return linhas.some(l => colunas(l)) && linhas.some(l => /\binfinitepay\b|\bcloudwalk\b/.test(normalizarTexto(l.texto)));
}

/** "08 Set, 2026" no começo da linha → '2026-09-08' (null se a linha não começa com a data). */
function dataDaLinha(l: ReturnType<typeof montarLinhas>[number], xHora: number): string | null {
  const t = l.tokens.filter(x => x.x < xHora - 5);
  if (t.length < 3) return null;
  const dia = t[0].s.match(/^(\d{1,2})$/);
  const mes = MESES[normalizarTexto(t[1].s).slice(0, 3)];
  const ano = t[2].s.match(/^(\d{4})$/);
  return dia && mes && ano ? ano[1] + '-' + mes + '-' + dia[1].padStart(2, '0') : null;
}

interface Lanc { y: number; data: string; valor: number; tipo: string; nome: string; detalhe: string; acima: { y: number; s: string }[]; abaixo: { y: number; s: string }[] }

export function lancamentosDaInfinitePay(paginas: ItemDeTexto[][]): LinhaConvertida[] {
  const saida: Lanc[] = [];
  let col: Colunas | null = null;
  let data = '';
  for (const pagina of paginas) {
    const daPagina: Lanc[] = [];
    const nomes: { y: number; s: string }[] = [];
    for (const l of montarLinhas(pagina)) {
      const c = colunas(l);
      if (c) { col = c; continue; }
      if (!col) continue;
      const k = col;
      const d = dataDaLinha(l, k.hora);
      if (d) data = d;
      if (/\bsaldo do dia\b/.test(normalizarTexto(l.texto))) continue;
      const entre = (a: number, b: number) => l.tokens.filter(t => t.x >= a - 4 && t.x < b - 4).map(t => t.s).join(' ');
      const v = l.tokens.find(t => t.x >= k.valor - 40 && RE_VALOR.test(t.s));
      if (!v) {
        // o pedaço do nome que quebrou de linha (às vezes junto com a data)
        const s = entre(k.nome, k.detalhe);
        if (s) nomes.push({ y: l.y, s });
        continue;
      }
      if (!data) continue;
      const m = v.s.match(RE_VALOR)!;
      const valor = centavos(m[2]);
      if (valor == null || valor === 0) continue;
      daPagina.push({
        y: l.y, data, valor: m[1] === '-' ? -valor : valor,
        tipo: entre(k.tipo, k.nome), nome: entre(k.nome, k.detalhe), detalhe: entre(k.detalhe, k.valor - 40),
        acima: [], abaixo: [],
      });
    }
    for (const n of nomes) {
      let melhor: Lanc | null = null;
      for (const x of daPagina) if (!melhor || Math.abs(x.y - n.y) < Math.abs(melhor.y - n.y)) melhor = x;
      if (melhor && Math.abs(melhor.y - n.y) <= PERTO) (n.y > melhor.y ? melhor.acima : melhor.abaixo).push(n);
    }
    saida.push(...daPagina);
  }
  return saida.map(x => {
    const ordem = (xs: { y: number; s: string }[]) => xs.slice().sort((a, b) => b.y - a.y).map(y => y.s);
    const nome = [...ordem(x.acima), x.nome, ...ordem(x.abaixo)].filter(Boolean).join(' ');
    // o nome que já começa com o tipo ("Pix" · "Pix LEONIDAS…"): sem repetir
    const partes = normalizarTexto(nome).startsWith(normalizarTexto(x.tipo) + ' ') ? [nome, x.detalhe] : [x.tipo, nome, x.detalhe];
    return { data: x.data, valor: x.valor, historico: partes.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim() };
  });
}
