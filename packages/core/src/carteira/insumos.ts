// Os Insumos da Carteira (Vitor, 12/11/2026: "um menu de Insumos, onde a pessoa registra impressões, pastas, envelopes e
// caixas criadas"): cada registro é de uma pessoa, de um dia e de um cliente (obrigatório). Cada um vê os seus; o Diretor e
// quem tem o Financeiro veem os de todos, somados por pessoa e por cliente. Só a lógica (sem tela e sem banco).

export type TipoDeInsumo = 'impressao' | 'pasta' | 'envelope' | 'caixa';

export const TIPOS_DE_INSUMO: readonly { valor: TipoDeInsumo; rotulo: string; plural: string }[] = [
  { valor: 'impressao', rotulo: 'Impressão', plural: 'Impressões' },
  { valor: 'pasta', rotulo: 'Pasta', plural: 'Pastas' },
  { valor: 'envelope', rotulo: 'Envelope', plural: 'Envelopes' },
  { valor: 'caixa', rotulo: 'Caixa', plural: 'Caixas' },
];

export const rotuloDoInsumo = (t: TipoDeInsumo) => TIPOS_DE_INSUMO.find(x => x.valor === t)?.rotulo ?? t;
export const ehTipoDeInsumo = (t: unknown): t is TipoDeInsumo => TIPOS_DE_INSUMO.some(x => x.valor === t);

/** O máximo de um registro (o mesmo da regra do banco). */
export const QUANTIDADE_MAXIMA = 100000;

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
  quantidade: number;
  /** o cliente: o nome e o código do ERP (null quando a empresa não tem) */
  cliente: string;
  codigo: number | null;
  criadoEm: string;
}

export interface InsumoParaSalvar { data: string; tipo: TipoDeInsumo; quantidade: number; cliente: string; codigo: number | null }

export function conferirInsumo(x: InsumoParaSalvar): string[] {
  const erros: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x.data)) erros.push('Escolha a data.');
  if (!ehTipoDeInsumo(x.tipo)) erros.push('Escolha o tipo.');
  if (!x.cliente.trim()) erros.push('Escolha o cliente.');
  if (!Number.isInteger(x.quantidade) || x.quantidade <= 0) erros.push('A quantidade é um número inteiro maior que zero.');
  else if (x.quantidade > QUANTIDADE_MAXIMA) erros.push('A quantidade passa de ' + QUANTIDADE_MAXIMA.toLocaleString('pt-BR') + '.');
  return erros;
}

/** A quantidade digitada ("1.200", "15") como número inteiro; NaN quando não é. */
export function quantidadeDigitada(s: string): number {
  const t = s.replace(/\./g, '').trim();
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

export type TotaisDosInsumos = Record<TipoDeInsumo, number>;

const zerados = (): TotaisDosInsumos => ({ impressao: 0, pasta: 0, envelope: 0, caixa: 0 });

export function totaisDosInsumos(lista: readonly Insumo[]): TotaisDosInsumos {
  const t = zerados();
  for (const x of lista) t[x.tipo] += x.quantidade;
  return t;
}

export interface LinhaDoResumo { chave: string; nome: string; codigo: number | null; totais: TotaisDosInsumos; quantos: number }

function agrupar(lista: readonly Insumo[], chave: (x: Insumo) => string, nome: (x: Insumo) => string, codigo: (x: Insumo) => number | null): LinhaDoResumo[] {
  const por = new Map<string, LinhaDoResumo>();
  for (const x of lista) {
    const k = chave(x);
    const l = por.get(k) ?? { chave: k, nome: nome(x), codigo: codigo(x), totais: zerados(), quantos: 0 };
    l.totais[x.tipo] += x.quantidade;
    l.quantos++;
    por.set(k, l);
  }
  return [...por.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Os do mês somados por pessoa (para o Diretor e o Financeiro). */
export const porPessoa = (lista: readonly Insumo[]) => agrupar(lista, x => x.uid, x => x.nome || '—', () => null);

/** Os do mês somados por cliente (pelo código; sem código, pelo nome). */
export const porCliente = (lista: readonly Insumo[]) =>
  agrupar(lista, x => (x.codigo != null ? 'c' + x.codigo : 'n' + x.cliente.trim().toUpperCase()), x => x.cliente, x => x.codigo);

export const porDataDoInsumo = (a: Insumo, b: Insumo) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm);
