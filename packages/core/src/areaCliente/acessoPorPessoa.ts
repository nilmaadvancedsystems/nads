// A Área do Cliente com senha, uma por pessoa (18/11/2026; frases do dono: "a area de cliente vai ter senha de acesso",
// "Uma por pessoa"; desenho em docs/acessorias/desenho-senha-por-pessoa.md). Primeira etapa: cada pessoa cadastrada pela
// equipe entra com e-mail e senha e vê as empresas (os links) que a equipe deu a ela, inteiras, como o link de hoje; a
// divisão por setor fica para a segunda etapa. O link continua valendo sem senha até a equipe ligar "Exigir senha" nele.
//
// Como funciona: a equipe grava areaClientePessoas/{id} { nome, email, tokens, ativo }; o robô da nuvem
// (robo/acesso-cliente.js) cria o login no Firebase (sem senha: a pessoa cria a dela pelo "Criar ou trocar a senha", o
// e-mail do próprio Firebase) e põe no login as permissões { cliente: true, a: [tokens] }, que a regra do banco confere.
// Nunca põe permissão de cliente numa conta da equipe. Só a lógica.

/** O que a equipe grava (areaClientePessoas/{id}). */
export interface PessoaDaArea {
  id: string;
  nome: string;
  /** o login: minúsculo, sem espaço */
  email: string;
  /** os links (areasCliente/{token}) que a pessoa abre */
  tokens: string[];
  /** false = tirou o acesso (o robô derruba as sessões) */
  ativo: boolean;
}

/** As permissões que vão no login (custom claims): o Firebase aceita até 1000 bytes; cerca de 20 links de 40 letras. */
export interface PermissoesDoCliente { cliente: true; a: string[] }

export const MAIOR_NUMERO_DE_LINKS_POR_PESSOA = 20;
const TOKEN = /^[0-9a-f]{40}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/;

export const normalizarEmail = (e: string) => String(e || '').trim().toLowerCase();

/** O erro do que a equipe digitou, ou '' se está certo. */
export function erroDaPessoa(p: { nome: string; email: string }): string {
  const nome = String(p.nome || '').trim();
  if (nome.length < 2 || nome.length > 80) return 'O nome da pessoa (de 2 a 80 letras).';
  if (!EMAIL.test(normalizarEmail(p.email))) return 'O e-mail da pessoa não parece certo.';
  return '';
}

/**
 * As permissões de cada e-mail, juntando todas as fichas ativas dele (a mesma pessoa pode estar em várias empresas,
 * cada uma com a sua ficha). Os links tortos ficam de fora; acima de 20, os primeiros 20 (em ordem, para não mudar à toa).
 */
export function permissoesPorEmail(pessoas: readonly Pick<PessoaDaArea, 'email' | 'tokens' | 'ativo'>[]): Map<string, PermissoesDoCliente> {
  const porEmail = new Map<string, Set<string>>();
  for (const p of pessoas) {
    const email = normalizarEmail(p.email);
    if (!EMAIL.test(email)) continue;
    const set = porEmail.get(email) ?? new Set<string>();
    if (p.ativo) for (const t of p.tokens) if (TOKEN.test(t)) set.add(t);
    porEmail.set(email, set);
  }
  // quem só tem fichas desligadas fica com a lista vazia: o robô tira as permissões e derruba as sessões
  return new Map([...porEmail].map(([email, set]) => [email, { cliente: true as const, a: [...set].sort().slice(0, MAIOR_NUMERO_DE_LINKS_POR_PESSOA) }]));
}

/** As permissões que estão no login são as mesmas que deviam estar? (o robô só grava quando mudou) */
export function mesmasPermissoes(atual: unknown, nova: PermissoesDoCliente): boolean {
  const a = atual && typeof atual === 'object' ? (atual as { cliente?: unknown; a?: unknown }) : null;
  return !!a && a.cliente === true && Array.isArray(a.a) && a.a.length === nova.a.length && a.a.every((t, i) => t === nova.a[i]);
}

/** O cliente logado abre este link? (a mesma conta da regra do banco, para a tela não prometer o que o banco nega) */
export function clienteAbreOLink(permissoes: unknown, token: string): boolean {
  const p = permissoes && typeof permissoes === 'object' ? (permissoes as { cliente?: unknown; a?: unknown }) : null;
  return !!p && p.cliente === true && Array.isArray(p.a) && p.a.includes(token);
}
