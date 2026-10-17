import { describe, expect, it } from 'vitest';
import { dadosDaDanfse, URL_CONSULTA_NFSE } from './danfse';
import { XML_DA_NOTA_AUTORIZADA } from './danfse.fixture';

describe('os dados da DANFSe (15/10/2026: "faz o danf poder ser baixado")', () => {
  const d = dadosDaDanfse(XML_DA_NOTA_AUTORIZADA);

  it('lê o cabeçalho: chave, número, datas, DPS e município', () => {
    expect(d.chave).toBe('31680021227872981000113260000000409926100002961714');
    expect(d.urlDeConsulta).toBe(URL_CONSULTA_NFSE + d.chave);
    expect(d.municipio).toBe('Taiobeiras - MG');
    expect(d.numeroNfse).toBe('2600000004099');
    expect(d.competencia).toBe('14/10/2026');
    expect(d.emitidaEm).toBe('14/10/2026 17:32:45');
    expect(d.numeroDps).toBe('260000000000002');
    expect(d.serieDps).toBe('70000');
    expect(d.dpsEmitidaEm).toBe('14/10/2026 17:32:45');
    expect([d.emitente, d.situacao, d.finalidade, d.ambienteGerador, d.tipoAmbiente]).toEqual(['Prestador', 'NFS-e Gerada', '-', '1', '1']);
  });

  it('lê o prestador com o regime do Simples por extenso', () => {
    expect(d.prestador).toEqual({
      documento: '27.872.981/0001-13', inscricaoMunicipal: '250517/6308', nome: 'NILMA CONTABILIDADE LTDA', fone: '-',
      municipio: 'Taiobeiras / MG', ibgeCep: '3168002 / 39550-000', endereco: 'Travessa MARTINHO REGO, 000030, SALA 101/105, CENTRO', email: '-',
      simples: 'Optante - ME/EPP', regimeApuracao: 'Regime de apuração dos tributos federais e municipal pelo SN',
    });
  });

  it('lê o tomador; sem o nome do município no XML, mostra o código (ou o nome, se o app souber)', () => {
    expect(d.tomador).toMatchObject({ documento: '529.982.247-25', nome: 'CLIENTE EXEMPLO DA SILVA', fone: '(34) 9999-0000', municipio: '3130655 / MG', ibgeCep: '3130655 / 39536-000', endereco: 'FAZENDA EXEMPLO, 0, ZONA RURAL', email: 'cliente@exemplo.com.br' });
    expect(dadosDaDanfse(XML_DA_NOTA_AUTORIZADA, { '3130655': 'Indaiabira' }).tomador.municipio).toBe('Indaiabira / MG');
  });

  it('lê o serviço e a tributação municipal', () => {
    expect(d.servico).toEqual({ codigoTributacao: '17.19.01 / -', descricaoDoCodigo: 'Contabilidade, inclusive serviços técnicos e auxiliares.', descricao: 'Serviços Contábeis Ref. 09/2026', nbs: '113022100', local: 'Taiobeiras / MG / BR' });
    expect(d.municipal).toMatchObject({ tributacao: 'Operação tributável', incidencia: 'Taiobeiras / MG / BR', regimeEspecial: 'Nenhum', suspensao: 'Não', baseDeCalculo: 'R$ 950,00', aliquota: '3,74%', retencao: 'Não Retido', issqn: 'R$ 35,53', calculoBm: 'R$ 0,00' });
  });

  it('lê os totais e as informações complementares', () => {
    expect(d.totais).toMatchObject({ valorServico: 'R$ 950,00', liquido: 'R$ 950,00', ibsCbs: 'R$ 0,00', liquidoComIbsCbs: 'R$ 950,00' });
    expect(d.informacoes).toBe('Inf. Cont.: Percentual aproximado de tributos: 16,42% Fonte: IBPT | Totais Aproximados dos Tributos cfe. Lei nº 12.741/2012: Federais: -; Estaduais: -; Municipais: -;');
  });

  it('o indicador de operação traz os quatro campos do modelo da NT 008 (sem IBS/CBS na nota, todos "-")', () => {
    expect(d.ibsCbs.operacao).toBe('- / - / - / -');
  });

  it('recusa o que não é uma NFS-e autorizada', () => {
    expect(() => dadosDaDanfse('<html></html>')).toThrow(/infNFSe/);
  });
});
