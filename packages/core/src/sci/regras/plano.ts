// O plano de contas do SCI no ShadersCI (23/11/2026: "Esses são os dois planos de contas"): os planos padrão 90113 e 90011,
// exportados do SCI. O SCI lança pelo código reduzido (16 = Clientes nacionais no 90113, 159 no 90011); só a conta sem
// filhas (a analítica, quase sempre a de 5 níveis) recebe lançamento. As contas dos grupos de Clientes e de Fornecedores
// pedem o participante (o cadastro do cliente ou do fornecedor no SCI).
import * as XLSX from 'xlsx';
import { PLANO_90011 } from '../planos/plano90011';
import { PLANO_90113 } from '../planos/plano90113';

/** O número do plano padrão do SCI (90113, 90011...): os dois que vêm no nads e os que o escritório adiciona (26/11/2026). */
export type IdDoPlanoSci = string;
/** Uma conta como o SCI exporta: código reduzido, classificação, nome e apelido. */
export type LinhaDoPlanoSci = readonly [codigo: string, classificacao: string, nome: string, apelido: string];
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

/** Os planos que vêm no nads (exportados do SCI em 23/11/2026). */
export const PLANOS_DO_SCI: readonly { id: IdDoPlanoSci; rotulo: string }[] = [
  { id: '90113', rotulo: 'Plano 90113' },
  { id: '90011', rotulo: 'Plano 90011' },
];
const DO_NADS: Readonly<Record<string, readonly LinhaDoPlanoSci[]>> = { '90113': PLANO_90113, '90011': PLANO_90011 };

/**
 * Os planos gravados no banco (26/11/2026: "Coloca uma opcao de adicionar um plano de contas, ou atualizar o plano"): o
 * escritório manda a exportação do SCI em Cadastro › Integração SCI; o do banco vale no lugar do que vem no nads.
 */
let doBanco = new Map<IdDoPlanoSci, readonly LinhaDoPlanoSci[]>();
/** Usa os planos do banco (a tela chama quando eles chegam ou mudam). */
export function usarPlanosDoBanco(planos: readonly { id: IdDoPlanoSci; linhas: readonly LinhaDoPlanoSci[] }[]): void {
  doBanco = new Map(planos.filter(p => p.linhas.length).map(p => [p.id, p.linhas]));
  cache.clear();
}
/** Todos os planos (os do nads e os adicionados), em ordem de número. */
export function planosDoSci(): { id: IdDoPlanoSci; rotulo: string; doBanco: boolean }[] {
  const ids = [...new Set([...PLANOS_DO_SCI.map(p => p.id), ...doBanco.keys()])].sort((a, b) => Number(b) - Number(a));
  return ids.map(id => ({ id, rotulo: 'Plano ' + id, doBanco: doBanco.has(id) }));
}
/** O número do plano tem o jeito de um plano do SCI (só dígitos, de 3 a 8). */
export const idDePlanoValido = (id: unknown): id is IdDoPlanoSci => typeof id === 'string' && /^\d{3,8}$/.test(id);

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
export function montarPlano(id: IdDoPlanoSci, linhas: readonly LinhaDoPlanoSci[]): PlanoSci {
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
/** Um dos planos (montado uma vez): o do banco, se o escritório mandou; senão, o que vem no nads; sem nenhum, vazio. */
export function planoDoSci(id: IdDoPlanoSci): PlanoSci {
  let p = cache.get(id);
  if (!p) { p = montarPlano(id, doBanco.get(id) || DO_NADS[id] || []); cache.set(id, p); }
  return p;
}

/**
 * O plano da exportação do SCI (a "Impressão de campos da consulta" do plano de contas, .xls): as colunas achadas pelo título
 * (Código, Classificação, Nome, Apelido, Plano padrão), o nome sem os espaços do recuo. O número do plano vem da coluna
 * Plano padrão; o arquivo com mais de um plano, ou sem as colunas, volta com o erro.
 */
export function planoDaExportacaoDoSci(bytes: Uint8Array): { id: IdDoPlanoSci; linhas: LinhaDoPlanoSci[]; erro: string } {
  const vazio = (erro: string) => ({ id: '', linhas: [], erro });
  let ws: XLSX.WorkSheet | undefined;
  try { const wb = XLSX.read(bytes, { type: 'array' }); ws = wb.Sheets[wb.SheetNames[0]]; } catch { return vazio('Não deu para ler o arquivo: mande o .xls exportado do SCI.'); }
  if (!ws) return vazio('O arquivo está vazio.');
  const a = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' });
  const iCab = a.findIndex(r => r.some(v => semAcento(String(v)).trim() === 'classificacao'));
  if (iCab < 0) return vazio('Não achei as colunas do plano (Código, Classificação, Nome): exporte o plano de contas pela consulta do SCI.');
  const cab = a[iCab].map(v => semAcento(String(v)).trim());
  const col = (t: string) => cab.indexOf(t);
  const [cC, cK, cN, cA, cP] = [col('codigo'), col('classificacao'), col('nome'), col('apelido'), col('plano padrao')];
  if (cC < 0 || cK < 0 || cN < 0) return vazio('Faltam as colunas Código, Classificação ou Nome na exportação.');
  const txt = (r: unknown[], i: number) => (i < 0 ? '' : String(r[i] ?? '').trim());
  const linhas: LinhaDoPlanoSci[] = [];
  const planos = new Set<string>();
  for (const r of a.slice(iCab + 1)) {
    const codigo = txt(r, cC), classificacao = txt(r, cK);
    if (!/^\d+$/.test(codigo) || !/^\d{2}(\.\d+)*$/.test(classificacao)) continue;
    linhas.push([codigo, classificacao, txt(r, cN), txt(r, cA)]);
    if (txt(r, cP)) planos.add(txt(r, cP));
  }
  if (!linhas.length) return vazio('Não achei nenhuma conta no arquivo.');
  if (planos.size > 1) return vazio('O arquivo tem mais de um plano (' + [...planos].join(', ') + '): exporte um de cada vez.');
  const id = [...planos][0] || '';
  if (!idDePlanoValido(id)) return vazio('Não achei o número do plano (a coluna Plano padrão).');
  return { id, linhas, erro: '' };
}

/** O que muda de um plano para outro, pelo código reduzido: as contas novas, as que mudaram e as que saíram. */
export function diferencasDoPlanoSci(antes: readonly LinhaDoPlanoSci[], depois: readonly LinhaDoPlanoSci[]): { novas: LinhaDoPlanoSci[]; mudaram: LinhaDoPlanoSci[]; sairam: LinhaDoPlanoSci[] } {
  const a = new Map(antes.map(l => [l[0], l])), d = new Map(depois.map(l => [l[0], l]));
  return {
    novas: depois.filter(l => !a.has(l[0])),
    mudaram: depois.filter(l => a.has(l[0]) && a.get(l[0])!.join('\t') !== l.join('\t')),
    sairam: antes.filter(l => !d.has(l[0])),
  };
}

/** As linhas do plano como o banco guarda (uma conta por linha, os campos separados por tabulação) e de volta. */
export const textoDoPlanoSci = (linhas: readonly LinhaDoPlanoSci[]) => linhas.map(l => l.map(v => v.replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
export function linhasDoTextoDoPlanoSci(texto: unknown): LinhaDoPlanoSci[] {
  if (typeof texto !== 'string') return [];
  return texto.split('\n').map(l => l.split('\t')).filter(c => c.length >= 3 && /^\d+$/.test(c[0])).map(c => [c[0], c[1], c[2], c[3] || ''] as const);
}

/** As linhas que o nads usa hoje para o plano (as do banco ou as que vêm no nads), para comparar com a exportação nova. */
export const linhasDoPlanoSci = (id: IdDoPlanoSci): readonly LinhaDoPlanoSci[] => doBanco.get(id) || DO_NADS[id] || [];

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
