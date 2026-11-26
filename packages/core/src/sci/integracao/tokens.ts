// Os tokens de cliente da SCI cadastrados pela tela (26/11/2026; o dono: "vai ter uma maneira mais simples de cadastrar token
// de api de clientes?"). A tela de Configurações › Integração SCI embaralha o token com a CHAVE PÚBLICA abaixo (RSA-OAEP) e
// grava só o embaralhado em config/sciTokens; quem desembaralha é o robô da nuvem, o único com a chave privada (no metadado
// segredo-sci-chave da máquina). Assim o token não fica legível nem no banco nem no repositório, e a regra do config que já
// existe (lê quem é membro, grava o admin) basta. O robô testa cada token novo e grava o resultado em config/sciTokensTeste.

/** A chave pública (SPKI, base64) que embaralha os tokens. Pública de propósito: com ela só se embaralha. */
export const CHAVE_PUBLICA_DOS_TOKENS = 'MIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAuJ+obs/U1uUpDTAINpgC53pdVDpgLocCt6Wz/Mso1v5fql4AJOXxrs87kKRgEw9Z3WbDmZuBXdZ1EujIrPFdtWyXGR7v9daLz71713XkQ6W+O2JBDA43+F1vPvdbWBBFtRvP3lhc8OFPcOJh61fbqTY7rXwnbCivgh+fXC15S6W4rNWBEqINlQGFyOuopH3devy1uteIEWK3r1X8p9r66IxtukeUkmTJfWiRiZKrFQRB9Mwvilngv7P3xGoPvc57E6wgCAFYdRXEObZNYElusDjHmNm+obnXahPbAW4uTG9FrnITH4AUfH/Lp78eucY6FPw9gG/nPyZCJQF+d2bCd3vZQ1j2wIjShbE6t1PVjReMpqOpdvHnRg9maRtG2ajI7KmdgoMFsFLgvsLy3NgwvZLGnlPDH27xTL0Frzp/XlBMQuP5PglQ6LI3tbhr9AGfOlsWz26H8rIjS4GOyf5GFlpVqiSBLw60sCu6zZ8OW2sYnxtJ6r96bjDwMXfFVS6pAgMBAAE=';

const ALGORITMO = { name: 'RSA-OAEP', hash: 'SHA-256' } as const;
const sutil = (s?: SubtleCrypto) => s ?? globalThis.crypto.subtle;
const deBase64 = (b: string) => Uint8Array.from(atob(b), c => c.charCodeAt(0));
const paraBase64 = (b: ArrayBuffer) => { let s = ''; for (const x of new Uint8Array(b)) s += String.fromCharCode(x); return btoa(s); };

/** O que está errado no token colado ('' = pode gravar). */
export function erroDoToken(token: string): string {
  const t = String(token ?? '').trim();
  if (!t) return 'Cole o token.';
  if (/\s/.test(t)) return 'O token não tem espaços: confira se colou só ele.';
  if (t.length < 20) return 'Token curto demais: confira se colou ele inteiro.';
  if (t.length > 180) return 'Token comprido demais: confira se colou só ele.';
  return '';
}

/** Embaralha o token (na tela). */
export async function cifrarToken(token: string, chavePublica = CHAVE_PUBLICA_DOS_TOKENS, subtle?: SubtleCrypto): Promise<string> {
  const erro = erroDoToken(token);
  if (erro) throw new Error(erro);
  const chave = await sutil(subtle).importKey('spki', deBase64(chavePublica), ALGORITMO, false, ['encrypt']);
  return paraBase64(await sutil(subtle).encrypt(ALGORITMO, chave, new TextEncoder().encode(token.trim())));
}

/** Desembaralha (no robô, com a chave privada PKCS#8 em base64). */
export async function decifrarToken(cifrado: string, chavePrivada: string, subtle?: SubtleCrypto): Promise<string> {
  const chave = await sutil(subtle).importKey('pkcs8', deBase64(chavePrivada.replace(/\s/g, '')), ALGORITMO, false, ['decrypt']);
  return new TextDecoder().decode(await sutil(subtle).decrypt(ALGORITMO, chave, deBase64(cifrado)));
}

/** Um token guardado: o embaralhado, quando e por quem. */
export interface TokenGuardado { cifrado: string; em: string; por: string }
/** O teste que o robô fez de um token: se funcionou, o que disse e de qual gravação era (o em do token). */
export interface TesteDoToken { ok: boolean; texto: string; em: string; doToken: string }

const objeto = (x: unknown): Record<string, unknown> | null => (x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : null);
const codigoValido = (k: string) => /^\d{1,6}$/.test(k);

/** Os tokens de config/sciTokens, por código da empresa (o que vier torto fica de fora). */
export function tokensDoDocumento(x: unknown): Record<string, TokenGuardado> {
  const saida: Record<string, TokenGuardado> = {};
  for (const [k, v] of Object.entries(objeto(objeto(x)?.empresas) ?? {})) {
    const o = objeto(v);
    if (!codigoValido(k) || !o || typeof o.cifrado !== 'string' || !o.cifrado) continue;
    saida[k] = { cifrado: o.cifrado, em: String(o.em ?? ''), por: String(o.por ?? '') };
  }
  return saida;
}

/** O documento novo com o token de uma empresa trocado (cifrado) ou tirado (null). */
export function documentoDosTokens(atuais: Record<string, TokenGuardado>, codigo: number, cifrado: string | null, por: string, agora: Date): { empresas: Record<string, TokenGuardado>; atualizadoEm: string } {
  const empresas = { ...atuais };
  if (cifrado) empresas[String(codigo)] = { cifrado, em: agora.toISOString(), por };
  else delete empresas[String(codigo)];
  return { empresas, atualizadoEm: agora.toISOString() };
}

/** Os testes de config/sciTokensTeste, por código da empresa. */
export function testesDoDocumento(x: unknown): Record<string, TesteDoToken> {
  const saida: Record<string, TesteDoToken> = {};
  for (const [k, v] of Object.entries(objeto(objeto(x)?.empresas) ?? {})) {
    const o = objeto(v);
    if (!codigoValido(k) || !o) continue;
    saida[k] = { ok: o.ok === true, texto: String(o.texto ?? ''), em: String(o.em ?? ''), doToken: String(o.doToken ?? '') };
  }
  return saida;
}

/** Os tokens que o robô ainda não testou (gravados depois do último teste de cada um). */
export function tokensParaTestar(tokens: Record<string, TokenGuardado>, testes: Record<string, TesteDoToken>): string[] {
  return Object.keys(tokens).filter(k => testes[k]?.doToken !== tokens[k].em);
}

/** A situação do token de uma empresa, para a tela. */
export function situacaoDoToken(token: TokenGuardado | undefined, teste: TesteDoToken | undefined): { texto: string; tom: '' | 'ok' | 'warn' | 'bad' } {
  if (!token) return { texto: 'Sem token cadastrado aqui', tom: '' };
  const quando = (iso: string) => { const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }); };
  if (!teste || teste.doToken !== token.em) return { texto: 'Token gravado em ' + quando(token.em) + '. O robô testa em até 1 minuto…', tom: 'warn' };
  return teste.ok ? { texto: 'Funcionando (testado em ' + quando(teste.em) + ')' + (teste.texto ? ': ' + teste.texto : ''), tom: 'ok' }
    : { texto: 'Não funcionou: ' + (teste.texto || 'erro sem explicação') + '. Gere outro token no SCI WEB e cole aqui.', tom: 'bad' };
}
