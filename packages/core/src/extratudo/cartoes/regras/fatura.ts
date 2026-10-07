// A fatura do cartão de crédito empresarial (o PDF "Extrato de cartão de crédito" do Sicoob), lida pela posição de cada
// pedaço de texto: a data na coluna da esquerda, a descrição no meio, o valor na direita. Uma descrição longa quebra em
// duas linhas em volta da linha da data ("USINORTE EMBALAGENS 01/02 MONTES" / "23/01 … 1.960,00" / "CLAROS"): as duas
// soltas em volta viram a descrição. Os gastos vêm por portador ("GASTOS DE MARCOS ROCHA (4103)").
// Tudo no navegador; nada é guardado.

export interface PedacoDaFatura { texto: string; x: number; y: number }

export interface ItemDaFatura {
  /** 'aaaa-mm-dd' (o ano vem do vencimento: mês depois do vencimento é do ano anterior) */
  data: string;
  descricao: string;
  /** positivo = gasto; negativo = crédito/estorno/pagamento */
  valor: number;
  /** de quem é o gasto ("MARCOS ROCHA (4103)"); '' = os movimentos da conta (anuidade, pagamento…) */
  portador: string;
}

export interface FaturaDoCartao {
  /** "7563144207668" */
  contaCartao: string;
  cliente: string;
  /** 'aaaa-mm-dd' */
  vencimento: string;
  /** o "Total da Fatura" (null = o PDF não trouxe) */
  total: number | null;
  itens: ItemDaFatura[];
}

const RE_DATA = /^(\d{2})\/(\d{2})$/;
const RE_VALOR = /^-?\d{1,3}(?:\.\d{3})*,\d{2}$/;
/** as linhas que não são descrição de gasto (cabeçalhos das seções, limite, o número do cartão sozinho) */
const RE_CABECALHO = /^(TOTAL|GASTOS DE|LIMITE|MOVIMENTOS|DEMONSTRATIVO|RESUMO|PERFIL|ENCARGOS|\(\d+\)$)/i;
/** a coluna da data termina e a do valor começa aqui (pontos do PDF; o Sicoob põe a data em ~98 e o valor em ~450) */
const ATE_A_DATA = 120;
const DESDE_O_VALOR = 420;

const reais = (s: string) => Number(s.replace(/\./g, '').replace(',', '.'));
const iso = (d: string) => d.slice(6, 10) + '-' + d.slice(3, 5) + '-' + d.slice(0, 2);

interface Linha { pedacos: PedacoDaFatura[]; texto: string }

function linhasDe(pagina: readonly PedacoDaFatura[]): Linha[] {
  const porY = new Map<number, PedacoDaFatura[]>();
  for (const p of pagina) {
    if (!p.texto.trim()) continue;
    const y = Math.round(p.y);
    porY.set(y, [...(porY.get(y) || []), p]);
  }
  return [...porY.keys()].sort((a, b) => b - a).map(y => {
    const pedacos = porY.get(y)!.sort((a, b) => a.x - b.x);
    return { pedacos, texto: pedacos.map(p => p.texto.trim()).join(' ').replace(/\s+/g, ' ') };
  });
}

/** A linha de um gasto: a data à esquerda, o valor à direita e o que tem no meio. */
function partesDoGasto(l: Linha): { dia: string; valor: number; meio: string } | null {
  const primeiro = l.pedacos[0];
  const ultimo = l.pedacos[l.pedacos.length - 1];
  if (!primeiro || !ultimo || primeiro === ultimo) return null;
  const dia = primeiro.texto.trim();
  const valor = ultimo.texto.trim();
  if (primeiro.x >= ATE_A_DATA || !RE_DATA.test(dia) || ultimo.x < DESDE_O_VALOR || !RE_VALOR.test(valor)) return null;
  return { dia, valor: reais(valor), meio: l.pedacos.slice(1, -1).map(p => p.texto.trim()).filter(Boolean).join(' ') };
}

/** Uma linha "solta": só texto, sem data e sem valor, e que não é cabeçalho — pedaço de uma descrição quebrada. */
function solta(l: Linha | undefined): boolean {
  if (!l) return false;
  return !l.pedacos.some(p => RE_VALOR.test(p.texto.trim())) && !RE_DATA.test(l.pedacos[0].texto.trim()) && !RE_CABECALHO.test(l.texto);
}

/** Os pedaços de texto de cada página do PDF → a fatura. Lança Error com a mensagem para a tela. */
export function lerFatura(paginas: readonly (readonly PedacoDaFatura[])[]): FaturaDoCartao {
  const linhas = paginas.flatMap(p => linhasDe(p));
  const todo = linhas.map(l => l.texto).join('\n');
  const venc = todo.match(/Vencimento:\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (!/CART[ÃA]O DE CR[ÉE]DITO/i.test(todo) || !venc) throw new Error('Não é uma fatura de cartão de crédito (não achei o vencimento). Mande o PDF do extrato do cartão.');
  const vencimento = iso(venc[1]);
  const [anoV, mesV, diaV] = [Number(vencimento.slice(0, 4)), Number(vencimento.slice(5, 7)), Number(vencimento.slice(8, 10))];
  const total = todo.match(/Total da Fatura\s+(-?[\d.]+,\d{2})/i);
  const contaCartao = todo.match(/Conta Cart[ãa]o:\s*(\d+)/i)?.[1] || '';
  const cliente = todo.match(/Cliente:\s*(.+)/i)?.[1].trim() || '';

  const itens: ItemDaFatura[] = [];
  const usadas = new Set<number>();
  let portador = '';
  let fim = false;
  linhas.forEach((l, i) => {
    if (fim) return;
    if (/^DEMONSTRATIVO/i.test(l.texto)) { fim = true; return; }
    const gastos = l.texto.match(/^GASTOS DE\s+(.+?)(?:\s+LIMITE.*)?$/i);
    if (gastos) {
      // o número do cartão pode vir na linha de baixo ("(5647)")
      const numero = /^\(\d+\)$/.test(linhas[i + 1]?.texto || '') ? ' ' + linhas[i + 1].texto : '';
      portador = (gastos[1] + numero).trim();
      return;
    }
    const g = partesDoGasto(l);
    if (!g) return;
    let descricao = g.meio;
    if (!descricao) {
      // quebrada em volta: a de cima e a de baixo (as soltas que ainda não foram de ninguém)
      const partes: string[] = [];
      if (solta(linhas[i - 1]) && !usadas.has(i - 1)) { partes.push(linhas[i - 1].texto); usadas.add(i - 1); }
      if (solta(linhas[i + 1]) && !usadas.has(i + 1)) { partes.push(linhas[i + 1].texto); usadas.add(i + 1); }
      descricao = partes.join(' ');
    }
    const [dia, mes] = g.dia.split('/').map(Number);
    const ano = mes > mesV || (mes === mesV && dia > diaV) ? anoV - 1 : anoV;
    itens.push({ data: ano + '-' + String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0'), descricao, valor: g.valor, portador });
  });
  if (!itens.length) throw new Error('A fatura não tem nenhum lançamento.');
  return { contaCartao, cliente, vencimento, total: total ? reais(total[1]) : null, itens };
}

const centavos = (n: number) => Math.round(n * 100);

/** O que vira lançamento e o que fica de fora (e por quê). */
export interface ComprasDaFatura {
  compras: ItemDaFatura[];
  /** os que se anulam (tarifa × crédito da mesma tarifa) e o pagamento da fatura anterior */
  deFora: { item: ItemDaFatura; motivo: string }[];
  /** a soma das compras (os créditos sem par entram subtraindo) */
  soma: number;
  /** soma − total da fatura (0 = bate; null = sem total no PDF) */
  diferenca: number | null;
}

/**
 * As compras da fatura (Vitor, 07/10/2026: "você meio que quebra os lançamentos do banco"): sai o pagamento da fatura
 * anterior ("PAGAMENTO DEBITO EM CONTA"); um crédito anula um gasto do mesmo valor (proteção × crédito promoção,
 * anuidade × desconto da anuidade); o resto vira lançamento.
 */
export function comprasDaFatura(f: FaturaDoCartao): ComprasDaFatura {
  const deFora: ComprasDaFatura['deFora'] = [];
  const restam: ItemDaFatura[] = [];
  for (const it of f.itens) {
    if (it.valor < 0 && /PAGAMENTO/i.test(it.descricao)) deFora.push({ item: it, motivo: 'Pagamento da fatura anterior' });
    else restam.push(it);
  }
  const creditos = restam.filter(it => it.valor < 0);
  const anulados = new Set<ItemDaFatura>();
  for (const c of creditos) {
    // o gasto do mesmo valor, de preferência da mesma seção e o mais perto na lista
    const par = restam
      .filter(g => g.valor > 0 && !anulados.has(g) && centavos(g.valor) === -centavos(c.valor))
      .sort((a, b) => Number(b.portador === c.portador) - Number(a.portador === c.portador) || Math.abs(restam.indexOf(a) - restam.indexOf(c)) - Math.abs(restam.indexOf(b) - restam.indexOf(c)))[0];
    if (!par) continue;
    anulados.add(par).add(c);
    deFora.push({ item: par, motivo: 'Anulado por "' + c.descricao + '"' }, { item: c, motivo: 'Anula "' + par.descricao + '"' });
  }
  const compras = restam.filter(it => !anulados.has(it));
  const soma = Math.round(compras.reduce((s, it) => s + centavos(it.valor), 0)) / 100;
  return { compras, deFora, soma, diferenca: f.total == null ? null : Math.round((soma - f.total) * 100) / 100 };
}
