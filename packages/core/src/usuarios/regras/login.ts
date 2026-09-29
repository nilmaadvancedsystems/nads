// Login pelo nome: "José da Silva" entra como jose.da.silva@nilma.local.
// Cópia fiel do Entregas (entregas.html emailFromNome/resolveLoginEmail ~L1398-1409), para a mesma
// pessoa entrar com o mesmo nome e a mesma senha nos dois sistemas.

export const DOMINIO_LOGIN = '@nilma.local';
export const SENHA_MINIMA = 6;

/** Nome → e-mail de login: sem acento, minúsculo, tudo que não é letra/número vira um ponto. */
export function emailDoNome(nome: string): string {
  const slug = nome.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return slug + DOMINIO_LOGIN;
}

/** O que foi digitado no campo Nome: com "@" é um e-mail (contas antigas); senão, vira o e-mail do nome. */
export function emailDoLogin(digitado: string): string {
  const t = digitado.trim();
  return t.indexOf('@') !== -1 ? t : emailDoNome(t);
}

/** Iniciais para a foto padrão: primeira letra do primeiro e do último nome ("Gustavo Santos" → "GS"). */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const a = partes[0][0];
  const b = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (a + b).toUpperCase();
}

/** Mensagem do erro de login, igual à do Entregas (entregas.html ~L12776-12804). */
export function mensagemDeErroDeLogin(codigo: string): string {
  if (codigo === 'auth/too-many-requests') return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';
  if (codigo === 'auth/network-request-failed') return 'A conexão caiu no meio da entrada. Tente de novo.';
  return 'Nome ou senha inválidos.';
}
