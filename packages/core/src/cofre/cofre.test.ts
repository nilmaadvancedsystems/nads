import { describe, expect, it } from 'vitest';
import {
  cifrar, decifrar, destrancar, destrancarComCodigo, metaDosSegredos, normalizarCodigo, novaChaveDoCofre, novoCodigoDeRecuperacao,
  novoParDaPessoa, situacaoDoCertificado, trancarComCodigo, trancarPara, type SegredosDaEmpresa,
} from './index';

const SEGREDOS: SegredosDaEmpresa = {
  gov: { login: '000.000.000-00', senha: 'senha-de-teste' },
  certificado: { nomeArquivo: 'empresa.pfx', arquivo: 'AAEC', senha: '1234', validade: '2027-01-31' },
};

describe('o cofre (chave por pessoa, como o WhatsApp)', () => {
  it('a pessoa liberada destranca a chave do cofre e lê; outra pessoa não', async () => {
    const chave = await novaChaveDoCofre();
    const ana = await novoParDaPessoa();
    const bia = await novoParDaPessoa();
    const cifrado = await cifrar(chave, SEGREDOS);
    expect(cifrado.dados).not.toContain('senha-de-teste');
    // a cópia da Ana, trancada com a pública dela
    const daAna = await trancarPara(chave, ana.publica);
    const chaveDaAna = await destrancar(daAna, ana.privada);
    expect(await decifrar(chaveDaAna, cifrado)).toEqual(SEGREDOS);
    // a Bia, sem cópia própria, não destranca a da Ana
    await expect(destrancar(daAna, bia.privada)).rejects.toBeTruthy();
    // liberar a Bia: a Ana tranca para a pública dela
    const daBia = await trancarPara(chaveDaAna, bia.publica);
    expect(await decifrar(await destrancar(daBia, bia.privada), cifrado)).toEqual(SEGREDOS);
  });
  it('o código de recuperação devolve a chave; código errado não', async () => {
    const chave = await novaChaveDoCofre();
    const codigo = novoCodigoDeRecuperacao();
    expect(codigo).toMatch(/^([A-Z2-9]{4}-){7}[A-Z2-9]{4}$/);
    const rec = await trancarComCodigo(chave, codigo);
    const cifrado = await cifrar(chave, SEGREDOS);
    // digitado em minúsculas e sem os tracinhos também vale
    const volta = await destrancarComCodigo(rec, codigo.toLowerCase().replace(/-/g, ' '));
    expect(await decifrar(volta, cifrado)).toEqual(SEGREDOS);
    await expect(destrancarComCodigo(rec, 'AAAA-BBBB')).rejects.toBeTruthy();
    expect(normalizarCodigo('ab-cd 12')).toBe('ABCD12');
  });
  it('dado mexido não abre (o AES-GCM confere)', async () => {
    const chave = await novaChaveDoCofre();
    const c = await cifrar(chave, SEGREDOS);
    const mexido = { ...c, dados: c.dados.slice(0, -4) + (c.dados.endsWith('AAAA') ? 'BBBB' : 'AAAA') };
    await expect(decifrar(chave, mexido)).rejects.toBeTruthy();
  });
});

describe('as regras do cofre', () => {
  const hoje = new Date(2026, 9, 7);
  it('a situação do certificado pela validade', () => {
    expect(situacaoDoCertificado(undefined, hoje).situacao).toBe('sem');
    expect(situacaoDoCertificado('2026-10-06', hoje)).toEqual({ situacao: 'vencido', dias: -1 });
    expect(situacaoDoCertificado('2026-11-06', hoje)).toEqual({ situacao: 'vence', dias: 30 });
    expect(situacaoDoCertificado('2027-01-31', hoje).situacao).toBe('ok');
  });
  it('às claras só o que não é segredo', () => {
    expect(metaDosSegredos(SEGREDOS)).toEqual({ temGov: true, temCertificado: true, validade: '2027-01-31' });
    expect(metaDosSegredos({})).toEqual({ temGov: false, temCertificado: false });
  });
});
