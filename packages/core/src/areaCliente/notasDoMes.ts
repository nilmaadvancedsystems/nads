// O painel do mês do Faturamento (12/11/2026: "quero algo mais bonito e completo, realmente um dashboard mensal"): o
// resumo das notas do mês pelo siegNotas/{código}_{AAAA-MM} (o "Baixar XMLs do SIEG": cada nota emitida com a data, o
// cliente, o CFOP e o valor). O robô (robo/area-cliente.js) monta este resumo e grava só ele no espelho: nunca a nota,
// a chave ou o documento (CPF/CNPJ) de quem comprou. A venda é a NF-e e a NFC-e emitidas, sem as canceladas e sem as
// notas de entrada; a NFS-e (o serviço) fica à parte.
import type { NotasSieg, NotaDoSieg } from '../tarefas/sieg';

export interface ClienteDoMes { nome: string; valor: number; notas: number }
export interface CfopDoMes { cfop: string; descricao: string; valor: number }

export interface NotasDoMes {
  /** o valor vendido em cada dia do mês (o índice 0 é o dia 1) */
  porDia: number[];
  /** os maiores clientes do mês (até 5), pelo valor */
  clientes: ClienteDoMes[];
  /** quantos clientes diferentes compraram (a venda sem identificação conta como um só, "Consumidor final") */
  totalClientes: number;
  /** o que sobra depois dos 5 maiores */
  outrosClientes?: { clientes: number; valor: number };
  /** as operações (CFOP) do mês, da maior para a menor (até 6) */
  cfops: CfopDoMes[];
  /** as notas de serviço (NFS-e) emitidas no mês */
  servicos?: { notas: number; valor: number };
  /** a maior nota do mês */
  maiorVenda?: { valor: number; dia: number; cliente: string };
  /** quando o SIEG foi lido */
  em: string;
}

export const MAIORES_CLIENTES = 5;
export const MAIORES_CFOPS = 6;
export const CONSUMIDOR_FINAL = 'Consumidor final';

const centavos = (n: number) => Math.round(n * 100) / 100;

/** O que cada CFOP de saída quer dizer, pelos três últimos números (o primeiro diz para onde: 5 no estado, 6 fora, 7 exterior). */
const OPERACOES: Record<string, string> = {
  '101': 'Venda de produção própria', '102': 'Venda de mercadoria', '103': 'Venda de produção própria', '104': 'Venda de mercadoria',
  '108': 'Venda a não contribuinte', '109': 'Venda à Zona Franca', '116': 'Venda de produção (entrega futura)', '117': 'Venda de mercadoria (entrega futura)',
  '118': 'Venda de produção (entrega a terceiro)', '119': 'Venda de mercadoria (entrega a terceiro)', '120': 'Venda de mercadoria (entrega a terceiro)',
  '122': 'Venda de produção (remessa para industrializar)', '124': 'Industrialização para terceiro', '125': 'Industrialização para terceiro',
  '151': 'Transferência de produção', '152': 'Transferência de mercadoria',
  '201': 'Devolução de compra', '202': 'Devolução de compra', '208': 'Devolução de compra', '209': 'Devolução de compra',
  '401': 'Venda com substituição tributária', '402': 'Venda com substituição tributária', '403': 'Venda com substituição tributária',
  '405': 'Venda com ICMS já retido (ST)', '409': 'Transferência com ST', '411': 'Devolução de compra com ST',
  '551': 'Venda de bem do ativo', '552': 'Transferência de bem do ativo', '556': 'Devolução de compra de material de uso',
  '656': 'Venda de combustível', '667': 'Venda de combustível a consumidor',
  '901': 'Remessa para industrialização', '902': 'Retorno de industrialização', '905': 'Remessa para depósito',
  '908': 'Remessa em comodato', '909': 'Retorno de comodato', '910': 'Bonificação, doação ou brinde', '911': 'Remessa de amostra grátis',
  '912': 'Remessa para demonstração', '913': 'Retorno de demonstração', '915': 'Remessa para conserto', '916': 'Retorno de conserto',
  '917': 'Remessa em consignação', '918': 'Devolução de consignação', '920': 'Remessa de vasilhame', '921': 'Devolução de vasilhame',
  '922': 'Venda para entrega futura (simples faturamento)', '923': 'Remessa por conta e ordem', '924': 'Remessa para industrialização por conta e ordem',
  '929': 'Venda já registrada em cupom fiscal', '933': 'Serviço tributado pelo ISS', '949': 'Outra saída',
};
const DESTINO: Record<string, string> = { '6': ' (outro estado)', '7': ' (exterior)' };

/** "Venda de mercadoria", "Venda de mercadoria (outro estado)"; o CFOP sem nome fica como "Operação 5xxx". */
export function descricaoDoCfop(cfop: string): string {
  const c = String(cfop || '').replace(/\D/g, '');
  if (c.length !== 4) return 'Operação sem CFOP';
  const nome = OPERACOES[c.slice(1)];
  return nome ? nome + (DESTINO[c[0]] ?? '') : 'Operação ' + c;
}

/** O dia da nota (1 a 31) quando é do mês da competência; senão null. */
function diaDaNota(n: NotaDoSieg, competencia: string): number | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(String(n.data || ''));
  if (!m || m[3] + '-' + m[2] !== competencia) return null;
  return Number(m[1]);
}

const diasDoMes = (competencia: string) => new Date(Number(competencia.slice(0, 4)), Number(competencia.slice(5, 7)), 0).getDate();

/** O resumo das notas do mês para o painel; null se o mês não tem nenhuma venda nem serviço. */
export function notasDoMes(n: NotasSieg | null | undefined): NotasDoMes | null {
  if (!n || !/^\d{4}-\d{2}$/.test(n.competencia)) return null;
  const emitidas = Array.isArray(n.emitidas) ? n.emitidas : [];
  const vendas = emitidas.filter(x => (x.tipo === 'NF-e' || x.tipo === 'NFC-e') && !x.cancelada && !x.entrada);
  const servicos = emitidas.filter(x => x.tipo === 'NFS-e' && !x.cancelada);
  if (!vendas.length && !servicos.length) return null;

  const porDia = Array.from({ length: diasDoMes(n.competencia) }, () => 0);
  const clientes = new Map<string, ClienteDoMes>();
  const cfops = new Map<string, number>();
  let maior: NotasDoMes['maiorVenda'];
  for (const x of vendas) {
    const valor = Number(x.valor) || 0;
    const dia = diaDaNota(x, n.competencia);
    if (dia) porDia[dia - 1] += valor;
    const doc = String(x.destinatario?.doc || '').replace(/\D/g, '');
    const nome = String(x.destinatario?.nome || '').trim();
    // o cliente é o documento (ou o nome, sem documento); a venda sem nome nem CNPJ (a NFC-e do balcão, o CPF na nota)
    // vira "Consumidor final", uma linha só
    const chave = doc && (nome || doc.length === 14) ? doc : nome ? 'nome:' + nome.toUpperCase() : CONSUMIDOR_FINAL;
    const rotulo = chave === CONSUMIDOR_FINAL ? CONSUMIDOR_FINAL : nome || 'Cliente sem nome';
    const c = clientes.get(chave) ?? { nome: rotulo, valor: 0, notas: 0 };
    c.valor += valor; c.notas++;
    clientes.set(chave, c);
    if (x.itens?.length) for (const i of x.itens) cfops.set(i.cfop || '', (cfops.get(i.cfop || '') ?? 0) + (Number(i.valor) || 0));
    else cfops.set(x.cfop || '', (cfops.get(x.cfop || '') ?? 0) + valor);
    if (dia && (!maior || valor > maior.valor)) maior = { valor: centavos(valor), dia, cliente: rotulo };
  }

  const ordem = [...clientes.values()].map(c => ({ ...c, valor: centavos(c.valor) })).sort((a, b) => b.valor - a.valor || a.nome.localeCompare(b.nome));
  const resto = ordem.slice(MAIORES_CLIENTES);
  const listaDeCfops = [...cfops.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const juntarCfops = listaDeCfops.length > MAIORES_CFOPS;
  const cfopsDoMes: CfopDoMes[] = (juntarCfops ? listaDeCfops.slice(0, MAIORES_CFOPS - 1) : listaDeCfops)
    .map(([cfop, valor]) => ({ cfop, descricao: descricaoDoCfop(cfop), valor: centavos(valor) }));
  if (juntarCfops) cfopsDoMes.push({ cfop: '', descricao: 'Outras operações', valor: centavos(listaDeCfops.slice(MAIORES_CFOPS - 1).reduce((t, [, v]) => t + v, 0)) });

  return {
    porDia: porDia.map(centavos),
    clientes: ordem.slice(0, MAIORES_CLIENTES),
    totalClientes: ordem.length,
    ...(resto.length ? { outrosClientes: { clientes: resto.length, valor: centavos(resto.reduce((t, c) => t + c.valor, 0)) } } : {}),
    cfops: cfopsDoMes,
    ...(servicos.length ? { servicos: { notas: servicos.length, valor: centavos(servicos.reduce((t, x) => t + (Number(x.valor) || 0), 0)) } } : {}),
    ...(maior ? { maiorVenda: maior } : {}),
    em: String(n.em || ''),
  };
}

// ---------- o relatório do dia (12/11/2026: "quando eu clico no dia, um relatório do dia com as notas no estilo do SIEG") ----------

/** Uma nota no relatório do dia: o que a lista do portal do SIEG mostra, sem o documento de quem comprou. */
export interface NotaDoRelatorio {
  dia: number;
  tipo: 'NF-e' | 'NFC-e' | 'NFS-e';
  numero: string;
  serie: string;
  /** o nome de quem comprou ("Consumidor final" sem nome) */
  cliente: string;
  cfop: string;
  valor: number;
  cancelada?: boolean;
  /** a chave de acesso (44 números; a NFS-e pode não ter) */
  chave: string;
}

/** o máximo de notas de um mês no espelho (resumo/notas-{código}-{mês} cabe folgado num documento) */
export const MAIOR_LISTA_DE_NOTAS = 4000;

/** As notas emitidas do mês (venda e serviço, com as canceladas marcadas; sem as de entrada), por dia e número. */
export function listaDeNotasDoMes(n: NotasSieg | null | undefined): { notas: NotaDoRelatorio[]; cortadas: number } | null {
  if (!n || !/^\d{4}-\d{2}$/.test(n.competencia)) return null;
  const lista: NotaDoRelatorio[] = [];
  for (const x of Array.isArray(n.emitidas) ? n.emitidas : []) {
    if (x.entrada || !(x.tipo === 'NF-e' || x.tipo === 'NFC-e' || x.tipo === 'NFS-e')) continue;
    const dia = diaDaNota(x, n.competencia);
    if (!dia) continue;
    const doc = String(x.destinatario?.doc || '').replace(/\D/g, '');
    const nome = String(x.destinatario?.nome || '').trim();
    lista.push({
      dia, tipo: x.tipo, numero: String(x.numero || ''), serie: String(x.serie || ''),
      cliente: nome || (doc.length === 14 ? 'Cliente sem nome' : CONSUMIDOR_FINAL),
      cfop: String(x.cfop || x.itens?.[0]?.cfop || ''), valor: centavos(Number(x.valor) || 0),
      ...(x.cancelada ? { cancelada: true } : {}), chave: String(x.chave || '').replace(/\D/g, ''),
    });
  }
  if (!lista.length) return null;
  lista.sort((a, b) => a.dia - b.dia || a.tipo.localeCompare(b.tipo) || Number(a.numero) - Number(b.numero));
  return { notas: lista.slice(0, MAIOR_LISTA_DE_NOTAS), cortadas: Math.max(0, lista.length - MAIOR_LISTA_DE_NOTAS) };
}

export interface RelatorioDoDia {
  dia: number;
  notas: NotaDoRelatorio[];
  /** a venda do dia (NF-e e NFC-e, sem as canceladas) */
  vendas: number;
  servicos: number;
  quantidade: number;
  canceladas: number;
  porTipo: { tipo: NotaDoRelatorio['tipo']; notas: number; valor: number }[];
}

/** O relatório de um dia: as notas dele, na ordem do número, com os totais (as canceladas não somam). */
export function relatorioDoDia(notas: readonly NotaDoRelatorio[], dia: number): RelatorioDoDia {
  const doDia = notas.filter(x => x.dia === dia).sort((a, b) => a.tipo.localeCompare(b.tipo) || Number(a.numero) - Number(b.numero));
  const validas = doDia.filter(x => !x.cancelada);
  const soma = (xs: readonly NotaDoRelatorio[]) => centavos(xs.reduce((t, x) => t + x.valor, 0));
  const tipos = (['NF-e', 'NFC-e', 'NFS-e'] as const).map(tipo => ({ tipo, notas: validas.filter(x => x.tipo === tipo).length, valor: soma(validas.filter(x => x.tipo === tipo)) })).filter(t => t.notas);
  return {
    dia, notas: doDia,
    vendas: soma(validas.filter(x => x.tipo !== 'NFS-e')), servicos: soma(validas.filter(x => x.tipo === 'NFS-e')),
    quantidade: validas.length, canceladas: doDia.length - validas.length, porTipo: tipos,
  };
}
