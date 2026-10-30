import { describe, expect, it } from 'vitest';
import {
  cifrar, decifrar, destrancar, destrancarComCodigo, metaDosSegredos, normalizarCodigo, novaChaveDoCofre, novoCodigoDeRecuperacao,
  cidadeDoIp, docComSegredosMudados, navegadorDoUserAgent, novoParDaPessoa, situacaoDoCertificado, trancarComCodigo, trancarPara, type SegredosDaEmpresa,
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

describe('o navegador de cada login (26/10/2026)', () => {
  it('o navegador e o sistema do userAgent', () => {
    expect(navegadorDoUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36')).toBe('Chrome no Windows');
    expect(navegadorDoUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0')).toBe('Edge no Windows');
    expect(navegadorDoUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe('Safari no iPhone');
    expect(navegadorDoUserAgent('Mozilla/5.0 (Linux; Android 14; SM-A145M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36')).toBe('Chrome no Android');
    expect(navegadorDoUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe('Firefox no Mac');
    expect(navegadorDoUserAgent('')).toBe('Navegador desconhecido');
  });
  it('a cidade do IP', () => {
    expect(cidadeDoIp({ cidade: 'Montes Claros', uf: 'MG', pais: 'BR' })).toBe('Montes Claros/MG');
    expect(cidadeDoIp({ cidade: 'Lisboa', uf: '11', pais: 'pt' })).toBe('Lisboa (PT)');
    expect(cidadeDoIp({ cidade: 'Taiobeiras' })).toBe('Taiobeiras');
    expect(cidadeDoIp({ cidade: '', uf: 'MG', pais: 'BR' })).toBe('');
  });
});

describe('mudar só a parte editada (30/10/2026)', () => {
  const quem = (n: number) => ({ empresa: 'FITO', codigo: 292, versao: 1, atualizadoEm: '2026-10-30T12:0' + n + ':00Z', atualizadoPor: 'V' });
  it('duas pessoas salvando partes diferentes a partir da mesma leitura: as duas ficam', async () => {
    const chave = await novaChaveDoCofre();
    const aberto = (await docComSegredosMudados(chave, null, () => SEGREDOS, quem(0))).doc;
    // a Ana troca a senha gov.br; a Bia, que abriu antes, troca o certificado: cada uma sobre o documento como está
    const daAna = (await docComSegredosMudados(chave, aberto, s => ({ ...s, gov: { login: '000.000.000-00', senha: 'nova-da-ana' } }), quem(1))).doc;
    const daBia = await docComSegredosMudados(chave, daAna, s => ({ ...s, certificado: { ...s.certificado!, senha: '9999' } }), quem(2));
    const final = await decifrar<SegredosDaEmpresa>(chave, daBia.doc);
    expect(final.gov?.senha).toBe('nova-da-ana');
    expect(final.certificado?.senha).toBe('9999');
    expect(daBia.segredos).toEqual(final);
    expect(daBia.doc).toMatchObject({ temGov: true, temCertificado: true, validade: '2027-01-31', atualizadoPor: 'V' });
  });
  it('o documento que a chave não abre não vira um documento vazio', async () => {
    const outra = await novaChaveDoCofre();
    const doc = (await docComSegredosMudados(await novaChaveDoCofre(), null, () => SEGREDOS, quem(0))).doc;
    await expect(docComSegredosMudados(outra, doc, s => ({ ...s, gov: undefined }), quem(1))).rejects.toBeTruthy();
  });
});
