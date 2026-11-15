// Os Insumos da Carteira (Vitor, 12/11/2026: "um menu de Insumos, onde a pessoa registra impressões, pastas, envelopes e
// caixas criadas"; 13/11/2026: "só vai ser, impressão, envelope, caixa, ele tem que selecionar um cliente registrado ou avulso,
// não há comissão descontada... é um só, simples, que aparece no financeiro"; 15/11/2026: "o preço do insumo é o financeiro que
// decide, e quais insumos são, o usuário só registra o tipo e quantidade").
//
// O Financeiro mantém a lista dos insumos (o nome e o preço de cada um; sem ela, valem Impressão, Envelope e Caixa, sem preço).
// Cada registro é de uma pessoa, de um dia e de um cliente (do Cadastro ou avulso) e guarda o nome e o preço do insumo do dia em
// que foi registrado: mudar o preço depois não mexe no que já foi registrado. Cada um vê os seus; o Diretor e o Financeiro veem
// os de todos, com os valores. Só a lógica (sem tela e sem banco).

/** o id do insumo na lista do Financeiro ('impressao', 'envelope', 'caixa' e os que o Financeiro criar; 'pasta' dos antigos) */
export type TipoDeInsumo = string;

/** Um insumo da lista do Financeiro: o nome e o preço de cada unidade. */
export interface TipoConfigurado { id: string; nome: string; preco: number }

/** A lista de quando o Financeiro ainda não montou a dele (os ids são os dos registros antigos). */
export const INSUMOS_PADRAO: readonly TipoConfigurado[] = [
  { id: 'impressao', nome: 'Impressão', preco: 0 },
  { id: 'envelope', nome: 'Envelope', preco: 0 },
  { id: 'caixa', nome: 'Caixa', preco: 0 },
];
/** os nomes dos ids de antes da lista (os registros antigos não têm o nome guardado) */
const NOMES_ANTIGOS: Record<string, string> = { impressao: 'Impressão', pasta: 'Pasta', envelope: 'Envelope', caixa: 'Caixa' };

/** O máximo de um registro (o mesmo da regra do banco). */
export const QUANTIDADE_MAXIMA = 100000;
/** O maior preço de uma unidade e o tamanho da lista (os mesmos da regra do banco). */
export const PRECO_MAXIMO = 100000;
export const MAIS_INSUMOS = 30;

export interface Insumo {
  id: string;
  /** de quem é (usuarios/{uid}) */
  uid: string;
  nome: string;
  /** AAAA-MM, tirado da data */
  competencia: string;
  /** AAAA-MM-DD */
  data: string;
  tipo: TipoDeInsumo;
  /** o nome do insumo no dia do registro ('' nos antigos: vale o nome do id) */
  nomeDoTipo: string;
  /** o preço de cada unidade no dia do registro (0 nos antigos e sem preço) */
  preco: number;
  quantidade: number;
  /** o cliente: o nome e o código do ERP (null no avulso) */
  cliente: string;
  codigo: number | null;
  criadoEm: string;
}

/** O que a pessoa escolhe: o tipo, a quantidade, o dia e o cliente. O nome e o preço vêm da lista do Financeiro. */
export interface InsumoParaSalvar { data: string; tipo: TipoDeInsumo; quantidade: number; cliente: string; codigo: number | null }
/** O que vai para o banco: o que a pessoa escolheu, com o nome e o preço do insumo de hoje. */
export interface InsumoComPreco extends InsumoParaSalvar { nomeDoTipo: string; preco: number }

export const ehTipoDeInsumo = (t: unknown): t is TipoDeInsumo => typeof t === 'string' && t.length > 0 && t.length <= 60;

/** O nome do insumo: o guardado no registro; sem ele, o da lista; sem a lista, o dos ids de antes. */
export function rotuloDoInsumo(x: Pick<Insumo, 'tipo' | 'nomeDoTipo'> | TipoDeInsumo, tipos: readonly TipoConfigurado[] = INSUMOS_PADRAO): string {
  const tipo = typeof x === 'string' ? x : x.tipo;
  const guardado = typeof x === 'string' ? '' : x.nomeDoTipo;
  return guardado || tipos.find(t => t.id === tipo)?.nome || NOMES_ANTIGOS[tipo] || tipo;
}

const centavos = (n: number) => Math.round(n * 100) / 100;

/** O valor do registro: a quantidade × o preço guardado. */
export const valorDoInsumo = (x: Pick<Insumo, 'quantidade' | 'preco'>) => centavos(x.quantidade * (x.preco || 0));

/** O id de um insumo novo, tirado do nome ("Pasta de couro" → "pasta-de-couro"); repetido ganha um número. */
export function idDoInsumo(nome: string, usados: readonly string[] = []): string {
  const base = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'insumo';
  let id = base;
  for (let n = 2; usados.includes(id); n++) id = base + '-' + n;
  return id;
}

/** Os problemas da lista do Financeiro (vazia = pode gravar). */
export function conferirTipos(lista: readonly TipoConfigurado[]): string[] {
  const erros: string[] = [];
  if (!lista.length) erros.push('Deixe pelo menos um insumo.');
  if (lista.length > MAIS_INSUMOS) erros.push('São no máximo ' + MAIS_INSUMOS + ' insumos.');
  const nomes = lista.map(t => t.nome.trim().toLowerCase());
  if (nomes.some(n => !n)) erros.push('Dê um nome a cada insumo.');
  if (nomes.some(n => n.length > 80)) erros.push('O nome do insumo vai até 80 letras.');
  if (new Set(nomes.filter(Boolean)).size !== nomes.filter(Boolean).length) erros.push('Há dois insumos com o mesmo nome.');
  if (lista.some(t => !Number.isFinite(t.preco) || t.preco < 0 || t.preco > PRECO_MAXIMO)) erros.push('O preço vai de R$ 0,00 a R$ ' + PRECO_MAXIMO.toLocaleString('pt-BR') + ',00.');
  if (new Set(lista.map(t => t.id)).size !== lista.length || lista.some(t => !ehTipoDeInsumo(t.id))) erros.push('A lista tem um insumo repetido.');
  return erros;
}

/** Os problemas do registro (vazia = pode gravar); o tipo tem de estar na lista do Financeiro. */
export function conferirInsumo(x: InsumoParaSalvar, tipos: readonly TipoConfigurado[] = INSUMOS_PADRAO): string[] {
  const erros: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x.data)) erros.push('Escolha a data.');
  if (!tipos.some(t => t.id === x.tipo)) erros.push('Escolha o insumo.');
  if (!x.cliente.trim()) erros.push('Escolha o cliente.');
  if (!Number.isInteger(x.quantidade) || x.quantidade <= 0) erros.push('A quantidade é um número inteiro maior que zero.');
  else if (x.quantidade > QUANTIDADE_MAXIMA) erros.push('A quantidade passa de ' + QUANTIDADE_MAXIMA.toLocaleString('pt-BR') + '.');
  return erros;
}

/** O registro com o nome e o preço do insumo de hoje (o que vai para o banco). */
export function comPreco(x: InsumoParaSalvar, tipos: readonly TipoConfigurado[] = INSUMOS_PADRAO): InsumoComPreco {
  const t = tipos.find(y => y.id === x.tipo);
  return { ...x, nomeDoTipo: t?.nome ?? rotuloDoInsumo(x.tipo, tipos), preco: t ? centavos(t.preco) : 0 };
}

/** A quantidade digitada ("1.200", "15") como número inteiro; NaN quando não é. */
export function quantidadeDigitada(s: string): number {
  const t = s.replace(/\./g, '').trim();
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

/** O total de um insumo no mês: as unidades e o valor. */
export interface TotalDoInsumo { id: TipoDeInsumo; nome: string; quantidade: number; valor: number }

/**
 * Os totais do mês por insumo, na ordem da lista do Financeiro (os que estão na lista aparecem mesmo zerados; os de fora dela,
 * como as pastas antigas, entram no fim só quando têm registro), e o valor de tudo.
 */
export function totaisDosInsumos(lista: readonly Insumo[], tipos: readonly TipoConfigurado[] = INSUMOS_PADRAO): { porInsumo: TotalDoInsumo[]; valor: number } {
  const por = new Map<string, TotalDoInsumo>(tipos.map(t => [t.id, { id: t.id, nome: t.nome, quantidade: 0, valor: 0 }]));
  for (const x of lista) {
    const t = por.get(x.tipo) ?? { id: x.tipo, nome: rotuloDoInsumo(x, tipos), quantidade: 0, valor: 0 };
    t.quantidade += x.quantidade;
    t.valor = centavos(t.valor + valorDoInsumo(x));
    por.set(x.tipo, t);
  }
  const porInsumo = [...por.values()];
  return { porInsumo, valor: centavos(porInsumo.reduce((s, t) => s + t.valor, 0)) };
}

export const porDataDoInsumo = (a: Insumo, b: Insumo) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm);
