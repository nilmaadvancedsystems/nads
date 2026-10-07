import forge from 'node-forge';
import { describe, expect, it } from 'vitest';
import { cnpjDoNomeDoArquivo, lerCertificado } from './certificado';

/** Um .pfx sintético (chave pequena, só para o teste), com o CN no formato do e-CNPJ. */
function pfxDeTeste(senha: string, fim: Date): string {
  const chaves = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = chaves.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(2025, 0, 1);
  cert.validity.notAfter = fim;
  const sujeito = [{ name: 'commonName', value: 'EMPRESA TESTE LTDA:12345678000190' }];
  cert.setSubject(sujeito);
  cert.setIssuer(sujeito);
  cert.sign(chaves.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(chaves.privateKey, [cert], senha, { algorithm: '3des' });
  return forge.util.encode64(forge.asn1.toDer(p12).getBytes());
}

describe('o CNPJ no nome do arquivo', () => {
  it('só os dígitos, com ou sem pontuação', () => {
    expect(cnpjDoNomeDoArquivo('EMPRESA LTDA_27872981000113.pfx')).toBe('27872981000113');
    expect(cnpjDoNomeDoArquivo('cert 27.872.981/0001-13.p12')).toBe('27872981000113');
    expect(cnpjDoNomeDoArquivo('certificado.pfx')).toBe('');
  });
});

describe('ler o certificado A1', () => {
  const arquivo = pfxDeTeste('1234', new Date(2027, 2, 15, 12));
  it('com a senha certa: a validade e o titular', async () => {
    expect(await lerCertificado(arquivo, '1234')).toEqual({ ok: true, validade: '2027-03-15', titular: 'EMPRESA TESTE LTDA', documento: '12345678000190' });
  });
  it('com a senha errada: avisa', async () => {
    const r = await lerCertificado(arquivo, 'errada');
    expect(r.ok).toBe(false);
  });
  it('um arquivo que não é certificado: avisa', async () => {
    expect((await lerCertificado(btoa('não é pfx'), '1234')).ok).toBe(false);
  });
}, 30000);
