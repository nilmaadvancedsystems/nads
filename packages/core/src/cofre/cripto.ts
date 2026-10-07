// A criptografia do cofre (WebCrypto, o mesmo no navegador e no Node): a chave do cofre (AES-GCM 256), o par de chaves
// de cada pessoa (RSA-OAEP 2048, SHA-256; a privada não sai do navegador), trancar e destrancar a chave do cofre para uma
// pessoa, embaralhar e desembaralhar os segredos, e o código de recuperação (PBKDF2 com 310 mil voltas + AES-GCM).
import type { Cifrado, Recuperacao } from './tipos';

const sutil = () => globalThis.crypto.subtle;
const ALG_PESSOA = { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' } as const;
const VOLTAS = 310_000;

export function paraBase64(b: ArrayBuffer | Uint8Array): string {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

export function deBase64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

const aleatorio = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** A chave do cofre: AES-GCM 256 (exportável só para ser trancada para cada pessoa). */
export function novaChaveDoCofre(): Promise<CryptoKey> {
  return sutil().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']) as Promise<CryptoKey>;
}

/** O par de chaves de uma pessoa (um navegador): a pública vai para o banco; a privada não pode ser exportada. */
export async function novoParDaPessoa(): Promise<{ publica: JsonWebKey; privada: CryptoKey }> {
  const par = await sutil().generateKey(ALG_PESSOA, false, ['wrapKey', 'unwrapKey']) as CryptoKeyPair;
  return { publica: await sutil().exportKey('jwk', par.publicKey), privada: par.privateKey };
}

/** Tranca a chave do cofre para uma pessoa (com a pública dela). */
export async function trancarPara(chave: CryptoKey, publica: JsonWebKey): Promise<string> {
  const pub = await sutil().importKey('jwk', publica, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['wrapKey']);
  return paraBase64(await sutil().wrapKey('raw', chave, pub, { name: 'RSA-OAEP' }));
}

/** Destranca a cópia da pessoa (com a privada dela) e devolve a chave do cofre. */
export function destrancar(trancada: string, privada: CryptoKey): Promise<CryptoKey> {
  return sutil().unwrapKey('raw', deBase64(trancada), privada, { name: 'RSA-OAEP' }, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

/** Embaralha um objeto com a chave do cofre. */
export async function cifrar(chave: CryptoKey, obj: unknown): Promise<Cifrado> {
  const iv = aleatorio(12);
  const dados = await sutil().encrypt({ name: 'AES-GCM', iv }, chave, new TextEncoder().encode(JSON.stringify(obj)));
  return { iv: paraBase64(iv), dados: paraBase64(dados) };
}

/** Desembaralha (erra com chave errada ou dado mexido: o AES-GCM confere). */
export async function decifrar<T>(chave: CryptoKey, c: Cifrado): Promise<T> {
  const bytes = await sutil().decrypt({ name: 'AES-GCM', iv: deBase64(c.iv) }, chave, deBase64(c.dados));
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** O código de recuperação: 32 letras e números (sem os parecidos), em grupos de 4. */
export function novoCodigoDeRecuperacao(): string {
  const b = aleatorio(32);
  let s = '';
  for (let i = 0; i < 32; i++) s += ALFABETO[b[i] % ALFABETO.length];
  return s.match(/.{4}/g)!.join('-');
}

/** O código como foi digitado: só letras e números, em maiúsculas. */
export const normalizarCodigo = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '');

async function chaveDoCodigo(codigo: string, sal: Uint8Array<ArrayBuffer>, usos: KeyUsage[]): Promise<CryptoKey> {
  const base = await sutil().importKey('raw', new TextEncoder().encode(normalizarCodigo(codigo)), 'PBKDF2', false, ['deriveKey']);
  return sutil().deriveKey({ name: 'PBKDF2', salt: sal, iterations: VOLTAS, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, usos);
}

/** Tranca a chave do cofre com o código de recuperação. */
export async function trancarComCodigo(chave: CryptoKey, codigo: string): Promise<Recuperacao> {
  const sal = aleatorio(16);
  const iv = aleatorio(12);
  const k = await chaveDoCodigo(codigo, sal, ['wrapKey']);
  const dados = await sutil().wrapKey('raw', chave, k, { name: 'AES-GCM', iv });
  return { sal: paraBase64(sal), iv: paraBase64(iv), dados: paraBase64(dados) };
}

/** Destranca a chave do cofre com o código de recuperação (erra com código errado). */
export async function destrancarComCodigo(r: Recuperacao, codigo: string): Promise<CryptoKey> {
  const k = await chaveDoCodigo(codigo, deBase64(r.sal), ['unwrapKey']);
  return sutil().unwrapKey('raw', deBase64(r.dados), k, { name: 'AES-GCM', iv: deBase64(r.iv) }, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
