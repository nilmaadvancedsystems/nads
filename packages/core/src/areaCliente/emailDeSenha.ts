// O e-mail de criar ou trocar a senha da Área do Cliente sai pelo robô do escritório (19/11/2026; o dono: "Sim, pelo
// robô", depois de o Firebase avisar que "Email template updates are currently unavailable for this project"). O site
// deixa o pedido em areaClienteSenhas { token, email } (sem login: quem esqueceu a senha não está logado); o robô da nuvem
// confere que o e-mail tem acesso àquele link (as permissões do login), gera o código pelo Firebase e manda o e-mail da
// Nilma, em português, com o link para a página própria (/cliente/senha). E-mail sem acesso: nada sai (e o site diz a
// mesma frase: ninguém descobre quem tem acesso por aqui). Só a lógica.

const TOKEN = /^[0-9a-f]{40}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/;

/** O endereço da página própria de criar a senha. */
export const PAGINA_DE_SENHA = 'https://cliente.nilmacontabilidade.com/cliente/senha';

/** O pedido conferido (o e-mail minúsculo), ou null se o token ou o e-mail forem tortos. */
export function pedidoDeSenha(token: unknown, email: unknown): { token: string; email: string } | null {
  const t = typeof token === 'string' ? token : '';
  const e = typeof email === 'string' ? email.trim().toLowerCase() : '';
  return TOKEN.test(t) && EMAIL.test(e) ? { token: t, email: e } : null;
}

/** O link da página própria a partir do link que o Firebase gera (só o código vai junto); null sem o código. */
export function linkDaPaginaDeSenha(linkDoFirebase: string, pagina = PAGINA_DE_SENHA): string | null {
  let codigo = '';
  try { codigo = new URL(linkDoFirebase).searchParams.get('oobCode') ?? ''; } catch { return null; }
  return /^[A-Za-z0-9_-]{10,400}$/.test(codigo) ? pagina + '?mode=resetPassword&oobCode=' + codigo : null;
}

/** O e-mail em português (o texto puro: o robô manda sem HTML). */
export function emailDeSenha(empresa: string, link: string): { assunto: string; texto: string } {
  const nome = empresa.trim() || 'a sua empresa';
  return {
    assunto: 'Crie ou troque a sua senha da Área do Cliente',
    texto: [
      'Olá,',
      '',
      'Recebemos um pedido para criar ou trocar a sua senha da Área do Cliente da Nilma Contabilidade (' + nome + ').',
      '',
      'Para criar a senha, abra este link (ele vale por pouco tempo e só uma vez):',
      link,
      '',
      'Se não foi você que pediu, pode ignorar este e-mail: nada muda.',
      '',
      'Nilma Contabilidade',
    ].join('\n'),
  };
}
