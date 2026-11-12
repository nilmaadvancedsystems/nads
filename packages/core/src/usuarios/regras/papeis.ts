// Papéis: o que o Entregas confere para liberar cada tela (temPapel). O departamento e o nível da
// pessoa GERAM os papéis dela; os que não vêm do cargo (Office boy, Equipe geral, ou um Admin dado à
// mão) continuam como estão. Assim, gravar departamento/nível já deixa todos os sistemas do Entregas
// funcionando, sem mudar nenhum deles.
// Origem do que já existia: entregas.html CARGOS (~L1232), papeisDoDoc_ (~L11720), cargosLabel_,
// e o rótulo 'dp' da tarefas.html (~L2289).
import type { Departamento, DocUsuario, Nivel, Papel, Usuario } from '../tipos';

export const DEPARTAMENTOS: readonly { id: Departamento; rotulo: string }[] = [
  { id: 'fiscal', rotulo: 'Fiscal' },
  { id: 'dp', rotulo: 'Departamento Pessoal' },
  { id: 'contabil', rotulo: 'Contábil' },
];

/** Do mais alto ao mais baixo. */
export const NIVEIS: readonly { id: Nivel; rotulo: string }[] = [
  // o Dono (Vitor, 12/11/2026: "o master do master, tem acesso a tudo"): tudo o que o Diretor pode; só o modo desenvolvedor não
  { id: 'dono', rotulo: 'Dono' },
  { id: 'diretor', rotulo: 'Diretor' },
  { id: 'senior', rotulo: 'Sênior' },
  { id: 'pleno', rotulo: 'Pleno' },
  { id: 'junior', rotulo: 'Júnior' },
];

/**
 * Os níveis que dá para escolher no app (Cadastro › Usuários, Novo usuário, convite): todos menos o Dono. O Dono é um só e
 * quem põe é o desenvolvedor, direto no banco; pelo app ele só deixa de ser (Vitor, 12/11/2026).
 */
export const NIVEIS_ESCOLHIVEIS: readonly { id: Nivel; rotulo: string }[] = NIVEIS.filter(n => n.id !== 'dono');

/** Rótulos dos papéis, na ordem da ficha do Entregas ('staff' é o piso e aparece como "Equipe"). */
export const PAPEIS: readonly { id: Papel; rotulo: string }[] = [
  { id: 'admin', rotulo: 'Admin' },
  { id: 'office_boy', rotulo: 'Office boy' },
  { id: 'contabil', rotulo: 'Contábil' },
  { id: 'fiscal', rotulo: 'Fiscal' },
  { id: 'dp', rotulo: 'Departamento pessoal' },
  { id: 'equipe_geral', rotulo: 'Equipe geral' },
  // o modo desenvolvedor só para quem tem este papel, dado à mão no Cadastro › Usuários (Vitor, 06/11/2026)
  { id: 'desenvolvedor', rotulo: 'Desenvolvedor' },
  // quem vê o Financeiro do nads sem ser Diretor: só o Diretor autoriza, na ficha da pessoa (Vitor, 09/11/2026)
  { id: 'financeiro', rotulo: 'Financeiro' },
];

/** O papel que cada departamento dá. */
const PAPEL_DO_DEPARTAMENTO: Record<Departamento, Papel> = { fiscal: 'fiscal', dp: 'dp', contabil: 'contabil' };

/** Dono e Diretor administram (é o Admin do Entregas: equipe, clientes, ajustes). */
const NIVEIS_ADMIN: readonly Nivel[] = ['dono', 'diretor'];

/** O nível que abre o que é do Diretor: o Diretor e o Dono, que tem tudo o que o Diretor tem (12/11/2026). */
export const nivelDeDiretor = (nivel: string | null | undefined): boolean => nivel === 'dono' || nivel === 'diretor';

export function ehDepartamento(v: unknown): v is Departamento {
  return DEPARTAMENTOS.some(d => d.id === v);
}

export function ehNivel(v: unknown): v is Nivel {
  return NIVEIS.some(n => n.id === v);
}

/** Os papéis que o departamento e o nível dão (sem o 'staff'). */
export function papeisDoCargo(departamento: Departamento | null, nivel: Nivel | null): Papel[] {
  const r: Papel[] = [];
  if (nivel && NIVEIS_ADMIN.includes(nivel)) r.push('admin');
  if (departamento) r.push(PAPEL_DO_DEPARTAMENTO[departamento]);
  return r;
}

/** Papéis do documento, como o Entregas lê: `roles`; senão o `role` antigo; senão só 'staff'. */
export function papeisDoDoc(doc: DocUsuario): string[] {
  if (Array.isArray(doc.roles) && doc.roles.length) return doc.roles;
  if (doc.role) return [doc.role];
  return ['staff'];
}

/** Lista sem repetição, com 'staff' sempre, na ordem de PAPEIS (a mesma da ficha). */
function arrumar(papeis: Iterable<string>): Papel[] {
  const set = new Set<string>(papeis);
  set.add('staff');
  const conhecidos = ['staff', ...PAPEIS.map(p => p.id)];
  const ordenados = conhecidos.filter(p => set.has(p)) as Papel[];
  const outros = [...set].filter(p => !conhecidos.includes(p)).sort() as Papel[];
  return [...ordenados, ...outros];
}

/**
 * Os `roles` para gravar quando o cargo muda: tira os que vinham do cargo antigo, põe os do novo e
 * mantém os que foram dados à mão (Office boy, Equipe geral, um Admin sem ser diretor…).
 */
export function papeisAoMudarCargo(
  atuais: string[],
  antes: { departamento: Departamento | null; nivel: Nivel | null },
  depois: { departamento: Departamento | null; nivel: Nivel | null },
): Papel[] {
  const doAntigo = new Set<string>(papeisDoCargo(antes.departamento, antes.nivel));
  const mantidos = atuais.filter(p => !doAntigo.has(p));
  return arrumar([...mantidos, ...papeisDoCargo(depois.departamento, depois.nivel)]);
}

/** Os `roles` de uma conta nova: os do cargo + os marcados à mão. */
export function papeisDaContaNova(departamento: Departamento | null, nivel: Nivel | null, extras: Papel[] = []): Papel[] {
  return arrumar([...papeisDoCargo(departamento, nivel), ...extras]);
}

/** O documento lido vira Usuario. Os papéis são os GRAVADOS (os mesmos que o Entregas vê). */
export function lerUsuario(uid: string, doc: DocUsuario): Usuario {
  return {
    uid,
    nome: (doc.nome || doc.email || '').trim(),
    sobrenome: (doc.sobrenome || '').trim(),
    email: doc.email || '',
    departamento: ehDepartamento(doc.departamento) ? doc.departamento : null,
    nivel: ehNivel(doc.nivel) ? doc.nivel : null,
    papeis: arrumar(papeisDoDoc(doc)),
    ativo: doc.ativo !== false,
    fotoPerfil: doc.fotoPerfil || null,
    vistoNoNads: doc.nadsVistoEm || null,
    ondeNoNads: doc.nadsOnde?.empresa && doc.nadsOnde.etapa && doc.nadsOnde.em
      ? { codigo: doc.nadsOnde.codigo ?? null, empresa: doc.nadsOnde.empresa, etapa: doc.nadsOnde.etapa, competencia: doc.nadsOnde.competencia || '', em: doc.nadsOnde.em }
      : null,
  };
}

export function temPapel(u: Pick<Usuario, 'papeis'>, p: Papel): boolean {
  return u.papeis.includes(p);
}

/** "Contábil · Sênior", ou os papéis como o Entregas mostra quando ainda não tem cargo. */
export function rotuloDoCargo(u: Pick<Usuario, 'departamento' | 'nivel' | 'papeis'>): string {
  const partes = [
    u.departamento ? DEPARTAMENTOS.find(d => d.id === u.departamento)!.rotulo : '',
    u.nivel ? NIVEIS.find(n => n.id === u.nivel)!.rotulo : '',
  ].filter(Boolean);
  if (partes.length) return partes.join(' · ');
  const nomes = PAPEIS.filter(p => u.papeis.includes(p.id)).map(p => p.rotulo);
  return nomes.length ? nomes.join(' · ') : 'Equipe';
}

/**
 * O departamento em que a pessoa trabalha: o do cargo; na conta antiga, sem cargo gravado, o que os
 * papéis dizem (contábil, depois fiscal, depois DP). null = a conta não diz (a Tarefas pede para o
 * admin completar o cargo).
 */
export function departamentoDaConta(u: Pick<Usuario, 'departamento' | 'papeis'>): Departamento | null {
  if (u.departamento) return u.departamento;
  for (const d of ['contabil', 'fiscal', 'dp'] as const) if (u.papeis.includes(d)) return d;
  return null;
}

/** O nível da pessoa é pelo menos `minimo`? (Diretor > Sênior > Pleno > Júnior; sem nível = não.) */
export function nivelPeloMenos(u: Pick<Usuario, 'nivel'>, minimo: Nivel): boolean {
  if (!u.nivel) return false;
  const ordem = NIVEIS.map(n => n.id);
  return ordem.indexOf(u.nivel) <= ordem.indexOf(minimo);
}

/**
 * O que não bate entre o cargo e os papéis gravados (ex.: editado direto no Entregas). O painel
 * da equipe mostra, para o admin acertar com um clique.
 */
export function papeisFaltando(u: Pick<Usuario, 'departamento' | 'nivel' | 'papeis'>): Papel[] {
  return papeisDoCargo(u.departamento, u.nivel).filter(p => !u.papeis.includes(p));
}
