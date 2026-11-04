// O Diário do Alterdata (PDF, todas as contas do período num arquivo só; Vitor, 2026-11): a leitura do texto já extraído
// (cada item com o texto e a posição x/y) → os lançamentos de cada conta, e daí o razão no mesmo formato do XLS
// (RazaoDaConta), para as etapas que usam o razão. Aqui só a regra; o pdf.js fica na tela (apps/web).
// Colunas (no PDF, x em pontos): a conta antes de x=150; o histórico de 150 a 376; o documento de 376 a 470; o valor
// com x>=470: Débito antes de x=530, Crédito depois. O valor vai para a linha dele ou a de baixo; a data ("DD de <mês> de
// AAAA") vale para os lançamentos abaixo dela até a próxima. Quebra de página: a linha sem valor vai para o último
// lançamento; a linha do topo sem a própria conta é do lançamento de cima (fica sem código: vira "sem conta").
import { normalizarTexto } from '../../formatos';
import type { RazaoDaConta, LancamentoDoRazao } from './razao';

/** Um texto da página com a posição (o y cresce para cima, como no PDF). */
export interface TextoDoPdf { s: string; x: number; y: number }
/** Uma página: o número e os textos dela. */
export interface PaginaDoPdf { p: number; items: TextoDoPdf[] }

/** Um lançamento do diário, por conta. valor sempre positivo; o lado diz se é débito ou crédito na conta. */
export interface LancamentoDoDiario {
  /** AAAA-MM-DD, ou '' se a página não trouxe data antes dele */
  data: string;
  lado: 'D' | 'C';
  valor: number;
  /** o código da conta ('' = linha sem código: quebra de página, para conferir) */
  conta: string;
  nomeConta: string;
  historico: string;
  documento: string;
  /** a outra conta do mesmo lançamento (pela data, documento e valor; '' se não achou o par) */
  contrapartida: string;
  nomeContrapartida: string;
  pagina: number;
}

export interface DiarioLido {
  lancamentos: LancamentoDoDiario[];
  totais: { debito: number; credito: number };
  /** débito − crédito: 0 quando o diário fecha */
  diferenca: number;
  /** lançamentos sem código de conta (para conferir) */
  semConta: number;
  periodo: { inicio: string; fim: string } | null;
  paginas: number;
}

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, 'março': 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};
const AMT = /^\d{1,3}(\.\d{3})*,\d{2}$/;
const DATA_LINHA = /^\d{2} de \S+ de \d{4}$/;
const TOL = 3;
const centavos = (n: number) => Math.round(n * 100) / 100;
const numeroBR = (s: string) => parseFloat(s.replace(/\./g, '').replace(',', '.'));

/** "05 de janeiro de 2026" → "2026-01-05"; o que não for data, ''. */
export function dataDoDiario(texto: string): string {
  const m = texto.trim().match(/^(\d{2}) de (\S+) de (\d{4})$/);
  if (!m) return '';
  const mes = MESES[normalizarTexto(m[2])] ?? MESES[m[2].toLowerCase()];
  return mes ? `${m[3]}-${String(mes).padStart(2, '0')}-${m[1]}` : '';
}

interface Lanc {
  y: number; pagina: number; valor: number; lado: 'D' | 'C'; data: string;
  acc: TextoDoPdf[]; his: TextoDoPdf[]; doc: TextoDoPdf[];
  accC: TextoDoPdf[]; hisC: TextoDoPdf[]; docC: TextoDoPdf[];
}

/** Os textos de uma página, sem o que é cabeçalho, rodapé ou linha de asteriscos. */
function itensDaPagina(pg: PaginaDoPdf): { corpo: TextoDoPdf[] } {
  const todos = pg.items.filter(i => i.s.trim() !== '');
  const tot = todos.find(i => /TOTAL GERAL/.test(i.s));
  const cutY = tot ? tot.y + 3 : -1;
  return { corpo: todos.filter(i => i.y < 760 && i.y > cutY && !/\*\*\*\*/.test(i.s)) };
}

/** O diário (os itens de cada página, na ordem) → os lançamentos, os totais e o que não fecha. Sem pdf.js: quem chama extrai. */
export function lerDiario(paginas: readonly PaginaDoPdf[]): DiarioLido {
  const lancs: Lanc[] = [];
  let dataAtual = '';
  let ultimo: Lanc | null = null;

  for (const pg of paginas) {
    const { corpo } = itensDaPagina(pg);
    // as datas da página (linha "DD de <mês> de AAAA" na coluna da conta)
    const datas = corpo.filter(i => i.x < 150 && DATA_LINHA.test(i.s.trim()))
      .map(i => ({ y: i.y, data: dataDoDiario(i.s.trim()) })).filter(d => d.data);
    // os valores da página, do topo para baixo
    const valores = corpo.filter(i => i.x >= 470 && AMT.test(i.s.trim()))
      .map(i => ({ y: i.y, valor: numeroBR(i.s.trim()), lado: (i.x < 530 ? 'D' : 'C') as 'D' | 'C' }))
      .sort((a, b) => b.y - a.y);
    const pagina: Lanc[] = valores.map(v => ({ ...v, pagina: pg.p, data: '', acc: [], his: [], doc: [], accC: [], hisC: [], docC: [] }));

    // cada lançamento: a data da última linha de data acima dele (ou a que veio da página de antes)
    for (const l of pagina) {
      const ds = datas.filter(d => d.y >= l.y - TOL);
      if (ds.length) dataAtual = ds.reduce((a, b) => (b.y < a.y ? b : a)).data;
      l.data = dataAtual;
    }

    // a quebra de página: se o topo não tem linha de conta/histórico, as linhas soltas do fim da página de antes são dele
    if (ultimo && pagina.length) {
      const topo = pagina[0];
      const temLinha = corpo.some(i => i.x < 470 && i.x >= 37 && Math.abs(i.y - topo.y) <= TOL && !(i.x < 150 && DATA_LINHA.test(i.s.trim())));
      if (!temLinha) {
        const sobra: { col: 'acc' | 'his' | 'doc'; t: TextoDoPdf }[] = [];
        for (const col of ['acc', 'his', 'doc'] as const) for (const t of ultimo[col]) if (t.y < ultimo.y - TOL) sobra.push({ col, t });
        if (sobra.length) {
          const menorY = Math.min(...sobra.map(s => s.t.y));
          for (const m of sobra.filter(s => s.t.y <= menorY + TOL)) {
            ultimo[m.col] = ultimo[m.col].filter(t => t !== m.t);
            topo[m.col].push(m.t);
          }
        }
      }
    }

    // cada texto vai para o lançamento logo abaixo dele (ou o da página de antes, se não há nenhum)
    const dono = (y: number) => {
      let melhor: Lanc | null = null;
      for (const l of pagina) if (l.y >= y - TOL && (melhor === null || l.y < melhor.y)) melhor = l;
      return melhor;
    };
    for (const i of corpo) {
      if (i.x >= 470) continue;
      if (i.x < 150 && DATA_LINHA.test(i.s.trim())) continue;
      if (/^Conta$|^Hist.rico$|^Documento$|^D.bito$|^Cr.dito$/.test(i.s.trim()) && i.y > 755) continue;
      const col = i.x < 150 ? 'acc' : i.x < 376 ? 'his' : 'doc';
      let o = dono(i.y);
      let c: 'acc' | 'his' | 'doc' | 'accC' | 'hisC' | 'docC' = col;
      if (!o) { if (!ultimo) continue; o = ultimo; c = (col + 'C') as typeof c; }
      o[c].push({ y: i.y, x: i.x, s: i.s.trim() });
    }
    for (const l of pagina) { lancs.push(l); ultimo = l; }
  }

  // o texto de cada lançamento: as linhas de cima para baixo, da esquerda para a direita (com a sobra da quebra)
  const texto = (own: TextoDoPdf[], cont: TextoDoPdf[]) => {
    const ordenado = [...own].sort((a, b) => (b.y - a.y) || (a.x - b.x)).map(t => t.s);
    return [...ordenado, ...cont.map(t => t.s)].join(' ').replace(/\s+/g, ' ').trim();
  };
  const finais = lancs.map(l => {
    const acc = texto(l.acc, l.accC);
    const codigos = [...acc.matchAll(/\((\d{4,6})\)/g)];
    const ultimoCod = codigos.length ? codigos[codigos.length - 1] : null;
    return {
      data: l.data, lado: l.lado, valor: centavos(l.valor),
      conta: ultimoCod ? ultimoCod[1] : '',
      nomeConta: ultimoCod ? acc.slice(0, ultimoCod.index).trim() : acc,
      historico: texto(l.his, l.hisC), documento: texto(l.doc, l.docC), pagina: l.pagina,
    };
  });

  // a contrapartida: o outro lado do mesmo lançamento (mesma data, documento e valor; um para um)
  const chave = (l: { data: string; documento: string; valor: number }) => l.data + '|' + l.documento + '|' + Math.round(l.valor * 100);
  const creditos = new Map<string, number[]>();
  finais.forEach((l, i) => { if (l.lado === 'C') creditos.set(chave(l), [...(creditos.get(chave(l)) || []), i]); });
  // o par de cada lançamento (nos dois sentidos), para não parear duas vezes
  const par = new Map<number, number>();
  finais.forEach((l, i) => {
    if (l.lado !== 'D') return;
    const fila = creditos.get(chave(l));
    const j = fila?.shift();
    if (j !== undefined) { par.set(i, j); par.set(j, i); }
  });
  const lancamentos: LancamentoDoDiario[] = finais.map((l, i) => {
    const j = par.get(i);
    const outro = j !== undefined ? finais[j] : null;
    return { ...l, contrapartida: outro?.conta ?? '', nomeContrapartida: outro?.nomeConta ?? '' };
  });

  const debito = centavos(lancamentos.filter(l => l.lado === 'D').reduce((s, l) => s + l.valor, 0));
  const credito = centavos(lancamentos.filter(l => l.lado === 'C').reduce((s, l) => s + l.valor, 0));
  const datas = lancamentos.map(l => l.data).filter(Boolean).sort();
  return {
    lancamentos,
    totais: { debito, credito },
    diferenca: centavos(debito - credito),
    semConta: lancamentos.filter(l => !l.conta).length,
    periodo: datas.length ? { inicio: datas[0], fim: datas[datas.length - 1] } : null,
    paginas: paginas.length,
  };
}

/**
 * O razão de uma conta a partir do diário (o mesmo formato do XLS: valor negativo = débito na conta; saldo negativo =
 * devedor). O diário não traz o saldo anterior: quem chama passa o saldo da conta no início (o dinâmico); sem ele, 0.
 * null = a conta não tem lançamento no diário.
 */
export function razaoDoDiario(lancamentos: readonly LancamentoDoDiario[], codigo: string, saldoInicial = 0): RazaoDaConta | null {
  const meus = lancamentos.filter(l => l.conta === codigo && l.data);
  if (!meus.length) return null;
  // o diário sai em ordem de página; o razão é por data (estável: a ordem do diário dentro do dia)
  const ordenados = [...meus].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  let saldo = centavos(saldoInicial);
  const out: LancamentoDoRazao[] = ordenados.map(l => {
    const valor = centavos(l.lado === 'D' ? -l.valor : l.valor);
    saldo = centavos(saldo + valor);
    return {
      data: l.data, contrapartida: l.contrapartida, nomeContrapartida: l.nomeContrapartida,
      valor, codigoHistorico: '', historico: l.historico, saldo,
    };
  });
  return {
    lancamentos: out, saldoInicial: centavos(saldoInicial), saldoFinal: saldo,
    inicio: out[0].data, fim: out[out.length - 1].data, conta: codigo,
  };
}

/** As contas que têm lançamento no diário (código → quantidade), para pedir o razão de cada uma. */
export function contasDoDiario(lancamentos: readonly LancamentoDoDiario[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of lancamentos) if (l.conta) out[l.conta] = (out[l.conta] || 0) + 1;
  return out;
}
