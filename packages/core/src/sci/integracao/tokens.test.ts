import { describe, expect, it } from 'vitest';
import { cifrarToken, decifrarToken, documentoDosTokens, erroDoToken, situacaoDoToken, testesDoDocumento, tokensDoDocumento, tokensParaTestar } from './index';

const ALG = { name: 'RSA-OAEP', hash: 'SHA-256' } as const;
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
/** um par de chaves de teste (o de verdade: a pública no código, a privada só no robô) */
async function par() {
  const p = await crypto.subtle.generateKey({ ...ALG, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, true, ['encrypt', 'decrypt']);
  return { publica: b64(await crypto.subtle.exportKey('spki', p.publicKey)), privada: b64(await crypto.subtle.exportKey('pkcs8', p.privateKey)) };
}
const TOKEN = 'tokenDeMentira0123456789abcdefghijklmnopqrstu';

describe('os tokens de cliente da SCI pela tela (26/11/2026)', () => {
  it('confere o token colado', () => {
    expect(erroDoToken('')).toBe('Cole o token.');
    expect(erroDoToken('abc')).toMatch(/curto/);
    expect(erroDoToken('abc def ghi jkl mno pqr stu')).toMatch(/espaços/);
    expect(erroDoToken('  ' + TOKEN + '\n')).toBe('');
  });

  it('embaralha com a pública e só a privada desembaralha', async () => {
    const { publica, privada } = await par();
    const cifrado = await cifrarToken(' ' + TOKEN + ' ', publica);
    expect(cifrado).not.toContain(TOKEN);
    expect(await decifrarToken(cifrado, privada)).toBe(TOKEN);
    const outra = await par();
    await expect(decifrarToken(cifrado, outra.privada)).rejects.toThrow();
  });

  it('a chave pública do código embaralha', async () => {
    expect((await cifrarToken(TOKEN)).length).toBeGreaterThan(100);
    await expect(cifrarToken('')).rejects.toThrow('Cole o token.');
  });

  it('o documento: trocar, tirar e ler (o torto fica de fora)', () => {
    const agora = new Date('2026-11-26T15:00:00Z');
    const d = documentoDosTokens({}, 590, 'XYZ', 'Gustavo', agora);
    expect(d.empresas['590']).toEqual({ cifrado: 'XYZ', em: '2026-11-26T15:00:00.000Z', por: 'Gustavo' });
    expect(documentoDosTokens(d.empresas, 590, null, 'Gustavo', agora).empresas).toEqual({});
    expect(tokensDoDocumento({ empresas: { ...d.empresas, abc: { cifrado: 'x' }, 12: { cifrado: '' }, 13: 'x' } })).toEqual(d.empresas);
    expect(tokensDoDocumento(null)).toEqual({});
  });

  it('o robô testa só o que mudou desde o último teste; a tela diz a situação', () => {
    const tokens = { 590: { cifrado: 'X', em: '2026-11-26T15:00:00.000Z', por: 'G' }, 591: { cifrado: 'Y', em: '2026-11-26T16:00:00.000Z', por: 'G' } };
    const testes = testesDoDocumento({ empresas: { 590: { ok: true, texto: 'empresa 590', em: '2026-11-26T15:01:00.000Z', doToken: '2026-11-26T15:00:00.000Z' }, 591: { ok: false, doToken: 'antigo' } } });
    expect(tokensParaTestar(tokens, testes)).toEqual(['591']);
    expect(situacaoDoToken(undefined, undefined).tom).toBe('');
    expect(situacaoDoToken(tokens[590], testes['590'])).toEqual({ texto: 'Funcionando (testado em 26/11/2026, 12:01): empresa 590', tom: 'ok' });
    expect(situacaoDoToken(tokens[591], testes['591']).tom).toBe('warn');
    expect(situacaoDoToken(tokens[591], { ok: false, texto: 'Token de cliente inválido', em: '', doToken: tokens[591].em }).texto).toMatch(/^Não funcionou: Token de cliente inválido/);
  });
});
