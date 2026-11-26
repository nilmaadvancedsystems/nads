import { describe, expect, it } from 'vitest';
import { criarClienteSciReport, lerPublicacaoDoSci, type BuscarNoSci, type PublicacaoDoSci } from '../../areaCliente';
import {
  camposDaPublicacao, chaveDaGuiaNoSci, chaveDoXml, chavesDasUrls, codigoDoRelatorio, configDoSci, conferirComOSci, criarClienteIntegraNet,
  dataParaOSci, documentoDaConfigDoSci, empresaNoSci, empresasDoTexto, erroDaGuiaParaPublicar, fraseDaPublicacao, fraseDoIntegra, idDaPublicacao,
  jaPublicada, lerResumoDoIntegra, nomeNoIntegra, periodoNoIntegra, publicadasDoRegistro, relatorioDaGuia, resumoDoIntegra, situacaoDeVolta, tipoNoIntegra, xmlsParaEnviar,
  CONFIG_DO_SCI_DESLIGADA, INTEGRA_NET, INTEGRA_POR_LOTE,
} from './index';

const CNPJ = '12345678000190';
/** uma chave de 44 dígitos com o modelo nas posições 21-22 */
const chave = (modelo: string, n: number) => ('3526' + '11' + CNPJ + modelo + '001' + String(n).padStart(9, '0') + '1' + '12345678').slice(0, 44).padEnd(44, '0');
const nfe = (n: number) => '<nfeProc><NFe><infNFe Id="NFe' + chave('55', n) + '"></infNFe></NFe></nfeProc>';
const evento = (n: number) => '<procEventoNFe><evento><infEvento><tpEvento>110111</tpEvento><chNFe>' + chave('55', n) + '</chNFe></infEvento></evento></procEventoNFe>';

describe('SCI: a configuração (config/sci)', () => {
  it('sem documento ou torta: tudo desligado', () => {
    expect(configDoSci(null)).toEqual(CONFIG_DO_SCI_DESLIGADA);
    expect(configDoSci({ areaCliente: 'sim', empresas: 'x', relatorios: [1] })).toEqual(CONFIG_DO_SCI_DESLIGADA);
  });

  it('lê as chaves, as empresas e os códigos dos relatórios (normalizados como a SCI)', () => {
    const c = configDoSci({ areaCliente: true, publicarGuias: true, lerDeVolta: true, enviarXmls: true, empresas: [602, '583', 0, -1, 602], relatorios: { DAS: '1', 'DAE-ICMS': 'a2', XYZ: '9', DAM: '12345' } });
    expect(c).toMatchObject({ areaCliente: true, publicarGuias: true, lerDeVolta: true, enviarXmls: true, conferirXmls: false, empresas: [583, 602], relatorios: { DAS: '0001', 'DAE-ICMS': '00A2' } });
    // ler de volta sem publicar não faz sentido: fica desligado
    expect(configDoSci({ lerDeVolta: true }).lerDeVolta).toBe(false);
    expect(empresaNoSci(c, '583')).toBe(true);
    expect(empresaNoSci(c, 1)).toBe(false);
  });

  it('o documento que a tela grava leva quem e quando', () => {
    const d = documentoDaConfigDoSci({ ...CONFIG_DO_SCI_DESLIGADA, empresas: [583], relatorios: { DAS: '0001' } }, 'Ana', new Date('2026-11-24T20:00:00Z'));
    expect(d).toMatchObject({ empresas: [583], relatorios: { DAS: '0001' }, atualizadoEm: '2026-11-24T20:00:00.000Z', atualizadoPor: 'Ana' });
    expect(empresasDoTexto('583, 602 607;602')).toEqual([583, 602, 607]);
    expect(codigoDoRelatorio('12345')).toBe('');
  });

  it('a guia vai para o relatório pela chave, senão o DARF geral, senão o de outras', () => {
    const c = configDoSci({ relatorios: { DAS: '0001', DARF: '0002', OUTRA: '0009' } });
    expect(chaveDaGuiaNoSci('DARF', 'cofins')).toBe('DARF-COFINS');
    expect(chaveDaGuiaNoSci('DAE', 'ICMS')).toBe('DAE-ICMS');
    expect(chaveDaGuiaNoSci('GPS', '')).toBe('OUTRA');
    // (26/11/2026) o DAE pela coluna do Relatório: cada tipo com o modelo dele no SCI Report
    expect(chaveDaGuiaNoSci('DAE', 'ICMS', 'icms-dif-ativo')).toBe('DAE-DIFAL');
    expect(chaveDaGuiaNoSci('DAE', 'ICMS', 'icms-dif')).toBe('DAE-DIFAL');
    expect(chaveDaGuiaNoSci('DAE', '', 'icms-arroz')).toBe('DAE-ANTECIPACAO');
    expect(chaveDaGuiaNoSci('DAE', 'ICMS', 'st-ent')).toBe('DAE-ST-ENTRADA');
    expect(chaveDaGuiaNoSci('DAE', 'ICMS', 'st-sai')).toBe('DAE-ST-SAIDA');
    expect(chaveDaGuiaNoSci('DAE', 'ICMS', 'icms')).toBe('DAE-ICMS');
    expect(chaveDaGuiaNoSci('DAE', 'ICMS', '')).toBe('DAE-ICMS');
    expect(relatorioDaGuia(configDoSci({ relatorios: { 'DAE-ICMS': 'DAEN', 'DAE-DIFAL': 'DAEA' } }), 'DAE', 'ICMS', 'icms-dif-ativo')).toBe('DAEA');
    // sem o código do diferencial, não cai no do ICMS normal
    expect(relatorioDaGuia(configDoSci({ relatorios: { 'DAE-ICMS': 'DAEN' } }), 'DAE', 'ICMS', 'st-ent')).toBe('');
    expect(relatorioDaGuia(c, 'DAS', '')).toBe('0001');
    expect(relatorioDaGuia(c, 'DARF', 'PIS')).toBe('0002');
    expect(relatorioDaGuia(c, 'DAM', 'ISS')).toBe('0009');
    expect(relatorioDaGuia(configDoSci({}), 'DAS', '')).toBe('');
  });
});

describe('SCI: o Integra NET (regra)', () => {
  it('reconhece o tipo e a chave do XML', () => {
    expect(chaveDoXml(nfe(1))).toBe(chave('55', 1));
    expect(tipoNoIntegra(nfe(1))).toBe('nfe');
    expect(tipoNoIntegra('<CTe><infCte Id="CTe' + chave('57', 2) + '"/></CTe>')).toBe('cte');
    expect(tipoNoIntegra('<NFe><infNFe Id="NFe' + chave('65', 3) + '"/></NFe>')).toBe('nfce');
    expect(tipoNoIntegra('<CompNfse><Nfse></Nfse></CompNfse>')).toBe('nfse');
    expect(tipoNoIntegra('<outra/>')).toBeNull();
    expect(nomeNoIntegra('Nota Fiscal ção.xml', nfe(1))).toBe('Nota_Fiscal_cao.xml');
  });

  it('monta os lotes: sem repetir, sem os que já foram, notas antes dos eventos', () => {
    const arquivos = [{ nome: 'ev.xml', xml: evento(1) }, { nome: 'a.xml', xml: nfe(1) }, { nome: 'a.xml', xml: nfe(1) }, { nome: 'b.xml', xml: nfe(2) }, { nome: 'x.txt', xml: '<x/>' }];
    const { lotes, ignorados } = xmlsParaEnviar(arquivos, [chave('55', 2)]);
    expect(ignorados).toBe(2);
    expect(lotes.map(l => [l.tipo, l.itens.map(i => i.nome)])).toEqual([['nfe', ['a.xml']], ['nfe', ['ev.xml']]]);
    const muitos = Array.from({ length: INTEGRA_POR_LOTE + 1 }, (_, i) => ({ nome: 'n' + i + '.xml', xml: nfe(100 + i) }));
    expect(xmlsParaEnviar(muitos).lotes.map(l => l.itens.length)).toEqual([INTEGRA_POR_LOTE, 1]);
  });

  it('o período e as chaves da consulta', () => {
    expect(periodoNoIntegra('2026-02')).toEqual({ dataIni: '01-02-2026', dataFim: '28-02-2026' });
    expect(chavesDasUrls(['https://integranetsci.s3.amazonaws.com/0890/9001/NFE/E/2016/03/02/' + chave('55', 7) + '.xml?X-Amz=1', 'lixo'])).toEqual([chave('55', 7)]);
  });

  it('confere o mês: o que falta no SCI e o que só o SCI tem (sem as canceladas)', () => {
    const c = conferirComOSci([chave('55', 1), chave('55', 2), chave('55', 3)], [chave('55', 1), chave('55', 9)], [chave('55', 3)]);
    expect(c).toEqual({ noSieg: 2, noSci: 2, faltamNoSci: [chave('55', 2)], soNoSci: [chave('55', 9)] });
    const r = resumoDoIntegra({ agora: new Date('2026-11-24T00:00:00Z'), enviadas: 2, falhas: 0, conferencia: c });
    expect(fraseDoIntegra(r)).toBe('SCI: 2 enviadas · faltam 1 no SCI · 1 só no SCI');
    expect(fraseDoIntegra(resumoDoIntegra({ agora: new Date(), enviadas: 1, falhas: 1, erro: 'x' }))).toBe('SCI: 1 enviada · 1 falhou');
    // o que a tela lê do banco: o mesmo resumo; torto, nada
    expect(lerResumoDoIntegra(JSON.parse(JSON.stringify(r)))).toEqual(r);
    expect(lerResumoDoIntegra({ enviadas: 3 })).toBeNull();
    expect(lerResumoDoIntegra({ em: 'x', enviadas: -2, chavesFaltam: ['1', chave('55', 1)] })).toMatchObject({ enviadas: 0, chavesFaltam: [chave('55', 1)] });
  });
});

/** a SCI de mentira: responde pelo método e pelo endereço, e anota cada chamada */
function sciFalsa(rotas: (url: string, metodo: string, init: { headers: Record<string, string>; body?: unknown }) => { status: number; corpo?: unknown }) {
  const chamadas: { url: string; metodo: string; headers: Record<string, string>; body?: unknown }[] = [];
  const buscar: BuscarNoSci = async (url, init) => {
    chamadas.push({ url, metodo: init.method, headers: init.headers, body: init.body });
    const r = rotas(url, init.method, init);
    return { status: r.status, json: async () => r.corpo };
  };
  return { buscar, chamadas };
}
const SEGREDOS = { parceiro: 'tok-parceiro', cliente: 'tok-cliente' };

describe('SCI: o Integra NET (cliente da API)', () => {
  it('pede as URLs com os dois tokens e manda cada arquivo SEM os tokens', async () => {
    const { buscar, chamadas } = sciFalsa((url, metodo) => metodo === 'POST'
      ? { status: 200, corpo: { 'a.xml': 'https://s3.exemplo/a.xml?sig=1', 'b.xml': 'https://s3.exemplo/b.xml?sig=2' } }
      : { status: url.includes('b.xml') ? 500 : 200 });
    const { lotes } = xmlsParaEnviar([{ nome: 'a.xml', xml: nfe(1) }, { nome: 'b.xml', xml: nfe(2) }]);
    const r = await criarClienteIntegraNet({ buscar, segredos: () => SEGREDOS }).enviar('12.345.678/0001-90', lotes);
    expect(r).toMatchObject({ enviadas: [chave('55', 1)], falhas: 1, semLicenca: false });
    expect(chamadas[0]).toMatchObject({ url: INTEGRA_NET + '/nfe', metodo: 'POST', headers: { 'Service-Token': 'tok-parceiro', Authorization: 'Bearer tok-cliente' } });
    expect(JSON.parse(String(chamadas[0].body))).toEqual({ cnpj: CNPJ, nomeArquivo: ['a.xml', 'b.xml'] });
    const puts = chamadas.filter(c => c.metodo === 'PUT');
    expect(puts).toHaveLength(2);
    expect(puts.every(c => !('Authorization' in c.headers) && !('Service-Token' in c.headers))).toBe(true);
  });

  it('sem licença (403): para tudo e conta as que não foram', async () => {
    const { buscar, chamadas } = sciFalsa(() => ({ status: 403, corpo: { error: 'A empresa informada não possui licença do Integra NET vinculada.' } }));
    const { lotes } = xmlsParaEnviar([{ nome: 'a.xml', xml: nfe(1) }, { nome: 'e.xml', xml: evento(1) }]);
    const r = await criarClienteIntegraNet({ buscar, segredos: () => SEGREDOS }).enviar(CNPJ, lotes);
    expect(r).toMatchObject({ enviadas: [], falhas: 2, semLicenca: true, erro: 'A empresa informada não possui licença do Integra NET vinculada.' });
    expect(chamadas).toHaveLength(1);
  });

  it('a consulta pagina até a página vazia (ou o 404) e junta as chaves', async () => {
    const { buscar, chamadas } = sciFalsa(url => {
      const page = Number(new URL(url).searchParams.get('page'));
      return page <= 2 ? { status: 200, corpo: ['https://s3/x/' + chave('55', page) + '.xml?a'] } : { status: 404 };
    });
    const chaves = await criarClienteIntegraNet({ buscar, segredos: () => SEGREDOS }).chavesDoMes(7, 'nfe', 'saida', '2026-10');
    expect(chaves).toEqual([chave('55', 1), chave('55', 2)]);
    expect(chamadas[0].url).toBe(INTEGRA_NET + '/nfe/saida?empresaId=7&dataIni=01-10-2026&dataFim=31-10-2026&page=1');
  });

  it('sem os tokens não chama nada', async () => {
    const { buscar, chamadas } = sciFalsa(() => ({ status: 200 }));
    await expect(criarClienteIntegraNet({ buscar, segredos: () => ({ parceiro: '', cliente: '' }) }).chavesDoMes(7, 'nfe', 'saida', '2026-10')).rejects.toThrow('faltam os tokens');
    expect(chamadas).toHaveLength(0);
  });
});

describe('SCI: publicar no SCI Report', () => {
  const GUIA = { competencia: '2026-10', vencimento: '20/11/2026', valor: 1534.271, descricao: 'DAS' };

  it('monta os campos do multipart como a SCI pede', () => {
    expect(dataParaOSci('20/11/2026')).toBe('2026-11-20');
    expect(dataParaOSci('31/02/2026')).toBe('');
    expect(idDaPublicacao('2026-10', 'DARF PIS')).toBe('2610DARFPI');
    expect(camposDaPublicacao(GUIA, '0001', 7)).toEqual({
      relatorioId: '0001', mesRef: '10', anoRef: '2026', todaEmpresa: 'false', empresaId: '7', dataVencimento: '2026-11-20', valor: '1534.27', id: '2610DAS', descricao: 'DAS',
    });
  });

  it('diz o que falta antes de publicar', () => {
    expect(erroDaGuiaParaPublicar(GUIA, '', 7, 10)).toMatch('código do relatório');
    expect(erroDaGuiaParaPublicar(GUIA, '0001', null, 10)).toMatch('não foi achada');
    expect(erroDaGuiaParaPublicar({ ...GUIA, valor: 0 }, '0001', 7, 10)).toMatch('sem o valor');
    expect(erroDaGuiaParaPublicar(GUIA, '0001', 7, 21 * 1024 * 1024)).toMatch('20 MB');
    expect(erroDaGuiaParaPublicar(GUIA, '0001', 7, 10)).toBe('');
  });

  it('reconhece a guia já publicada e lê de volta o visto e o pagamento', () => {
    const p = (x: Record<string, unknown>) => lerPublicacaoDoSci({ publicadosId: 11, empresaId: 7, mesRef: 10, anoRef: 2026, dataVencimento: '2026-11-20', valor: 1534.27, relatorioId: '0001', ...x }) as PublicacaoDoSci;
    expect(jaPublicada([p({})], GUIA, '0001')?.publicadosId).toBe(11);
    expect(jaPublicada([p({ valor: 10 })], GUIA, '0001')).toBeNull();
    const guardadas = publicadasDoRegistro([{ publicadosId: 11, nome: 'DAS' }, { publicadosId: 'x' }]);
    expect(guardadas).toEqual([{ publicadosId: 11, nome: 'DAS', vistoEm: '', pagamentoEm: '' }]);
    const r1 = situacaoDeVolta(guardadas, [p({ visualizado: 1, dataHoraPrimeiraVisualizacao: '2026-11-12 09:00:00' })]);
    expect(r1).toMatchObject({ mudou: true, terminou: false, publicadas: [{ vistoEm: '12/11/2026' }] });
    expect(fraseDaPublicacao(r1.publicadas[0])).toBe('vista 12/11');
    const r2 = situacaoDeVolta(r1.publicadas, [p({ visualizado: 1, dataPagamento: '2026-11-19' })]);
    expect(r2).toMatchObject({ mudou: true, terminou: true });
    expect(fraseDaPublicacao(r2.publicadas[0])).toBe('pagamento informado 19/11');
    expect(situacaoDeVolta(r2.publicadas, [p({ dataPagamento: '2026-11-19' })]).mudou).toBe(false);
  });

  it('o cliente do SCI Report publica com o JWT e um multipart com o PDF', async () => {
    const { buscar, chamadas } = sciFalsa(url => url.endsWith('/credencial/login')
      ? { status: 201, corpo: { token: 'jwt', validade: 3600 } }
      : { status: 201, corpo: { mensagem: 'Publicação realizada com sucesso!', publicados: [{ publicadosId: 555 }] } });
    const sci = criarClienteSciReport({ buscar, segredos: () => SEGREDOS, agora: () => 0 });
    const id = await sci.publicar(camposDaPublicacao(GUIA, '0001', 7), new Uint8Array([37, 80, 68, 70]), 'DAS out.pdf');
    expect(id).toBe(555);
    const pub = chamadas.find(c => c.url.endsWith('/api/v1/publicacao-manual'))!;
    expect(pub.headers.Authorization).toBe('Bearer jwt');
    const f = pub.body as FormData;
    expect(f.get('relatorioId')).toBe('0001');
    expect((f.get('arquivo') as File).name).toBe('DAS_out.pdf');
  });
});
