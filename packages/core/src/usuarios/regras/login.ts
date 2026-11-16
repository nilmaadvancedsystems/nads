// Login pelo nome: "José da Silva" entra como jose.da.silva@nilma.local.
// Cópia fiel do Entregas (entregas.html emailFromNome/resolveLoginEmail ~L1398-1409), para a mesma
// pessoa entrar com o mesmo nome e a mesma senha nos dois sistemas.

export const DOMINIO_LOGIN = '@nilma.local';
export const SENHA_MINIMA = 6;

/** Nome → e-mail de login: a chave do nome com o domínio. */
export function emailDoNome(nome: string): string {
  return chaveDoNome(nome) + DOMINIO_LOGIN;
}

/** Dois nomes iguais para o login (Vitor, 12/11/2026: "não deixa criar dois usuários com o mesmo nome"): sem diferenciar maiúscula, acento nem pontuação. */
export function mesmoNome(a: string, b: string): boolean {
  const ca = chaveDoNome(a);
  return !!ca && ca === chaveDoNome(b);
}

/** A chave do nome: sem acento, minúsculo, tudo que não é letra/número vira um ponto ("José da Silva" → "jose.da.silva"). */
export function chaveDoNome(nome: string): string {
  return nome.trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

/** O que foi digitado no campo Nome: com "@" é um e-mail (contas antigas); senão, vira o e-mail do nome. */
export function emailDoLogin(digitado: string): string {
  const t = digitado.trim();
  return t.indexOf('@') !== -1 ? t : emailDoNome(t);
}

/** O nome com o sobrenome, para as telas ("Maria" + "Souza" → "Maria Souza"); sem sobrenome, só o nome. */
export function nomeCompleto(u: { nome: string; sobrenome?: string }): string {
  return [u.nome.trim(), (u.sobrenome || '').trim()].filter(Boolean).join(' ');
}

/** Iniciais para a foto padrão: primeira letra do primeiro e do último nome ("Gustavo Santos" → "GS"). */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const a = partes[0][0];
  const b = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (a + b).toUpperCase();
}

/** Mensagem do erro de login, igual à do Entregas (entregas.html ~L12776-12804). Entrou pelo nome e não deu: a conta
 *  pode ter o e-mail trocado (12/11/2026), e aí o nome não leva mais a ela; a mensagem diz para digitar o e-mail. */
export function mensagemDeErroDeLogin(codigo: string, digitado = ''): string {
  if (codigo === 'auth/too-many-requests') return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';
  if (codigo === 'auth/network-request-failed') return 'A conexão caiu no meio da entrada. Tente de novo.';
  if (digitado.trim() && digitado.indexOf('@') === -1) return 'Nome ou senha inválidos. Se o seu e-mail de entrada foi trocado, digite o e-mail no lugar do nome.';
  return 'Nome ou senha inválidos.';
}

/** O e-mail de entrada que dá para pôr numa conta (a troca do e-mail, 12/11/2026): algo@algo.algo, sem espaço. */
export function ehEmailDeLogin(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
}

/** O login feito do nome (nome@nilma.local): não é um e-mail de verdade, ninguém recebe nada nele. */
export function ehEmailDoNome(email: string): boolean {
  return email.trim().toLowerCase().endsWith(DOMINIO_LOGIN);
}

/**
 * Falta o e-mail principal? (Vitor, 16/11/2026: "para concluir seu cadastro do NADS precisamos do seu e-mail principal"; "você
 * atrela o login ao email, não ao usuario"). O e-mail principal É o e-mail de entrada (o do Firebase Auth): falta quando a
 * conta ainda entra pelo nome@nilma.local, ou quando tem um e-mail que a pessoa nunca confirmou (o Diretor pode ter posto).
 */
export function precisaDoEmailPrincipal(u: { email: string; emailPrincipalEm?: string | null }): boolean {
  return !u.email.trim() || ehEmailDoNome(u.email) || !u.emailPrincipalEm;
}

/** O que está errado no e-mail principal digitado na janela ('' = pode enviar); duas vezes, para não errar o login. */
export function problemaDoEmailPrincipal(email: string, confirmacao: string): string {
  const e = email.trim().toLowerCase();
  if (!e) return 'Escreva o seu e-mail pessoal.';
  if (!ehEmailDeLogin(e)) return 'Escreva um e-mail válido (por exemplo, nome@gmail.com).';
  if (ehEmailDoNome(e)) return 'Esse é o login feito do nome, não um e-mail. Escreva o e-mail que você usa.';
  if (e !== confirmacao.trim().toLowerCase()) return 'Os dois e-mails não são iguais. Confira e digite de novo.';
  return '';
}
