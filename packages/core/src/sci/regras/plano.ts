// O plano de contas do SCI no ShadersCI (23/11/2026: "Esses são os dois planos de contas"): os planos padrão 90113 e 90011,
// exportados do SCI. O SCI lança pelo código reduzido (16 = Clientes nacionais no 90113, 159 no 90011); só a conta sem
// filhas (a analítica, quase sempre a de 5 níveis) recebe lançamento. As contas dos grupos de Clientes e de Fornecedores
// pedem o participante (o cadastro do cliente ou do fornecedor no SCI).
import { PLANO_90011 } from '../planos/plano90011';
import { PLANO_90113 } from '../planos/plano90113';

export type IdDoPlanoSci = '90113' | '90011';
export type TipoDeParticipante = 'cliente' | 'fornecedor';

export interface ContaDoPlanoSci {
  /** o código reduzido, o que vai no lançamento */
  codigo: string;
  /** 01.1.2.01.001 */
  classificacao: string;
  nome: string;
  apelido: string;
  nivel: number;
  /** sem contas filhas: recebe lançamento */
  analitica: boolean;
  /** a conta de Clientes ou de Fornecedores, que leva o participante (null = não leva) */
  participante: TipoDeParticipante | null;
}

export interface PlanoSci {
  id: IdDoPlanoSci;
  contas: readonly ContaDoPlanoSci[];
  porCodigo: ReadonlyMap<string, ContaDoPlanoSci>;
}

export const PLANOS_DO_SCI: readonly { id: IdDoPlanoSci; rotulo: string }[] = [
  { id: '90113', rotulo: 'Plano 90113' },
  { id: '90011', rotulo: 'Plano 90011' },
];

/** O texto sem acento e em minúsculas, para buscar. */
export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** O tipo de participante pelo grupo de cima: "CLIENTES ..." ou "FORNECEDORES" (o "Adiantamento a fornecedores" não leva). */
function participanteDoGrupo(classificacao: string, nomes: ReadonlyMap<string, string>): TipoDeParticipante | null {
  const partes = classificacao.split('.');
  for (let n = partes.length - 1; n >= 1; n--) {
    const nome = semAcento(nomes.get(partes.slice(0, n).join('.')) || '').trim();
    if (nome.startsWith('clientes')) return 'cliente';
    if (nome.startsWith('fornecedores')) return 'fornecedor';
  }
  return null;
}

/** O plano a partir das linhas exportadas do SCI (código, classificação, nome, apelido). */
export function montarPlano(id: IdDoPlanoSci, linhas: readonly (readonly [string, string, string, string])[]): PlanoSci {
  const nomes = new Map(linhas.map(l => [l[1], l[2]]));
  const comFilhas = new Set<string>();
  for (const [, classificacao] of linhas) {
    const i = classificacao.lastIndexOf('.');
    if (i > 0) comFilhas.add(classificacao.slice(0, i));
  }
  const contas = linhas.map(([codigo, classificacao, nome, apelido]) => ({
    codigo, classificacao, nome, apelido, nivel: classificacao.split('.').length,
    analitica: !comFilhas.has(classificacao),
    participante: participanteDoGrupo(classificacao, nomes),
  }));
  return { id, contas, porCodigo: new Map(contas.map(c => [c.codigo, c])) };
}

const cache = new Map<IdDoPlanoSci, PlanoSci>();
/** Um dos planos padrão (montado uma vez). */
export function planoDoSci(id: IdDoPlanoSci): PlanoSci {
  let p = cache.get(id);
  if (!p) { p = montarPlano(id, id === '90113' ? PLANO_90113 : PLANO_90011); cache.set(id, p); }
  return p;
}

/** A conta pelo que foi digitado: o código reduzido ou o apelido (CX, BB, FD...). */
export function contaDoPlano(plano: PlanoSci, texto: string): ContaDoPlanoSci | null {
  const t = texto.trim();
  if (!t) return null;
  const pelo = plano.porCodigo.get(t);
  if (pelo) return pelo;
  const a = semAcento(t);
  return plano.contas.find(c => c.apelido && semAcento(c.apelido) === a) || null;
}

/**
 * A busca no plano: número procura o código e a classificação pelo começo; texto procura o nome e o apelido. Só as analíticas
 * (as que recebem lançamento), as mais parecidas primeiro.
 */
export function buscarNoPlano(plano: PlanoSci, q: string, limite = 50): ContaDoPlanoSci[] {
  const t = semAcento(q.trim());
  const analiticas = plano.contas.filter(c => c.analitica);
  if (!t) return analiticas.slice(0, limite);
  const nota = (c: ContaDoPlanoSci): number => {
    if (c.codigo === t || semAcento(c.apelido) === t) return 0;
    if (c.codigo.startsWith(t) || c.classificacao.startsWith(t)) return 1;
    const nome = semAcento(c.nome);
    if (nome.startsWith(t)) return 2;
    if (nome.includes(t) || semAcento(c.apelido).includes(t)) return 3;
    return 9;
  };
  return analiticas.map(c => ({ c, n: nota(c) })).filter(x => x.n < 9).sort((a, b) => a.n - b.n || a.c.classificacao.localeCompare(b.c.classificacao)).slice(0, limite).map(x => x.c);
}
