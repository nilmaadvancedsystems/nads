import { describe, expect, it } from 'vitest';
import { cadastroDoDocumento, cadastroVazio, documentoDoCadastro } from './regras';
import {
  compararComReceita, falhaDaResposta, falhaQueVale, gravarDaReceita, linhasParaEscolher, retratoDaReceita, retratoDoEntregas,
  retratoQueVale, sociosDaReceita, type AntesDaReceita,
} from './situacaoNaReceita';
import type { DadosDaEmpresaNoEntregas } from './entregas';
import type { CadastroDaEmpresa, RetratoDaReceita } from './tipos';

// uma empresa inventada, no formato da BrasilAPI (a minhareceita.org responde igual)
const CNPJ = '11222333000181';
const AGORA = new Date('2026-11-17T12:00:00Z');
const RESPOSTA = {
  cnpj: CNPJ, razao_social: 'Empresa  Teste Ltda', nome_fantasia: 'Teste', descricao_situacao_cadastral: 'ATIVA',
  data_situacao_cadastral: '2005-11-03', descricao_motivo_situacao_cadastral: 'SEM MOTIVO',
  descricao_tipo_de_logradouro: 'RUA', logradouro: 'Dom Pedro II', numero: '120', complemento: 'Sala 2', bairro: 'Centro',
  municipio: 'MONTES CLAROS', uf: 'MG', cep: '39400001', codigo_municipio_ibge: 3143302,
  cnae_fiscal: 6920601, cnae_fiscal_descricao: 'Atividades de contabilidade',
  cnaes_secundarios: [{ codigo: 6911701, descricao: 'Serviços advocatícios' }, { codigo: 6911701, descricao: 'Serviços advocatícios' }],
  natureza_juridica: 'Sociedade Empresária Limitada', porte: 'MICRO EMPRESA', capital_social: 50000,
  data_inicio_atividade: '2005-11-03',
  qsa: [{ nome_socio: 'Fulana de Tal', qualificacao_socio: 'Sócio-Administrador', data_entrada_sociedade: '2005-11-03', cnpj_cpf_do_socio: '***123456**' }],
  opcao_pelo_simples: true, data_opcao_pelo_simples: '2007-07-01', data_exclusao_do_simples: null,
  opcao_pelo_mei: false, data_opcao_pelo_mei: null, data_exclusao_do_mei: null,
};
const retrato = (mudar: Record<string, unknown> = {}) => retratoDaReceita({ ...RESPOSTA, ...mudar }, CNPJ, AGORA)!;

const ENTREGAS: DadosDaEmpresaNoEntregas = {
  documento: CNPJ, nomeFantasia: 'TESTE', inscricaoEstadual: '', endereco: '', cidade: '',
  receita: {
    razaoSocial: 'EMPRESA TESTE LTDA', situacao: 'ATIVA', situacaoDesde: '2005-11-03', cnae: '6920601', cnaeDescricao: 'Atividades de contabilidade',
    naturezaJuridica: 'Sociedade Empresária Limitada', porte: 'MICRO EMPRESA', abertura: '2005-11-03',
    endereco: 'RUA DOM PEDRO II, 120, CENTRO, MONTES CLAROS/MG', socios: ['FULANA DE TAL'], conferidoEm: '2026-11-10T03:00:00Z',
  },
};
const cadastro = (c: Partial<CadastroDaEmpresa> = {}): CadastroDaEmpresa => ({ ...cadastroVazio('EMPRESA TESTE LTDA', 101), ...c });
const antesDe = (c: CadastroDaEmpresa, mudar: Partial<AntesDaReceita> = {}): AntesDaReceita =>
  ({ cadastro: c, nomeDaLista: 'EMPRESA TESTE LTDA', doEntregas: retratoDoEntregas(ENTREGAS, { enquadramento: 'Simples', receita: 'Simples' }), regimeQueVale: 'Simples', ...mudar });
const linha = (l: ReturnType<typeof compararComReceita>, campo: string) => l.find(x => x.campo === campo);

describe('a situação na Receita: a resposta lida por inteiro (17/11/2026)', () => {
  it('tira a situação, o endereço, as atividades, o capital, os sócios e o Simples', () => {
    const r = retrato();
    expect(r).toMatchObject({
      cnpj: CNPJ, situacao: 'ATIVA', situacaoDesde: '2005-11-03', motivoSituacao: '', razaoSocial: 'EMPRESA TESTE LTDA', fantasia: 'TESTE',
      endereco: 'RUA DOM PEDRO II, 120, CENTRO, MONTES CLAROS/MG', complemento: 'SALA 2', cep: '39400-001',
      cnae: { codigo: '6920-6/01', descricao: 'Atividades de contabilidade' }, naturezaJuridica: 'Sociedade Empresária Limitada', porte: 'MICRO EMPRESA',
      capitalSocial: 50000, abertura: '2005-11-03', simples: { optante: true, desde: '2007-07-01', exclusao: '' }, mei: { optante: false, desde: '', exclusao: '' },
      consultadoEm: AGORA.toISOString(),
    });
    // a secundária repetida entra uma vez; o CPF mascarado do sócio fica de fora
    expect(r.cnaesSecundarios).toEqual([{ codigo: '6911-7/01', descricao: 'Serviços advocatícios' }]);
    expect(r.socios).toEqual([{ nome: 'FULANA DE TAL', qualificacao: 'Sócio-Administrador', desde: '2005-11-03' }]);
  });
  it('a inapta com o motivo; sem secundária (a fonte manda o código 0) e sem a opção do Simples', () => {
    const r = retrato({ descricao_situacao_cadastral: 'INAPTA', data_situacao_cadastral: '2024-02-01', descricao_motivo_situacao_cadastral: 'Omissão de declarações',
      cnaes_secundarios: [{ codigo: 0, descricao: '' }], opcao_pelo_simples: null, capital_social: null });
    expect([r.situacao, r.motivoSituacao, r.cnaesSecundarios, r.simples.optante, r.capitalSocial]).toEqual(['INAPTA', 'OMISSÃO DE DECLARAÇÕES', [], null, null]);
  });
  it('não aceita a resposta de outra empresa, sem situação ou sem nome (a fonte às vezes responde 200 com erro)', () => {
    expect(retratoDaReceita({ ...RESPOSTA, cnpj: '11444777000161' }, CNPJ, AGORA)).toBeNull();
    expect(retratoDaReceita({ ...RESPOSTA, descricao_situacao_cadastral: '' }, CNPJ, AGORA)).toBeNull();
    expect(retratoDaReceita({ ...RESPOSTA, razao_social: null }, CNPJ, AGORA)).toBeNull();
    expect(retratoDaReceita({ message: 'erro' }, CNPJ, AGORA)).toBeNull();
    expect(retratoDaReceita(null, CNPJ, AGORA)).toBeNull();
  });
});

describe('as falhas da consulta', () => {
  it('pelo código da resposta', () => {
    expect([200, 400, 404, 429, 500, 503].map(falhaDaResposta)).toEqual([null, 'invalido', 'nao-encontrado', 'limite', 'fora-do-ar', 'fora-do-ar']);
  });
  it('de duas fontes, a que explica', () => {
    expect(falhaQueVale(['fora-do-ar', 'nao-encontrado'])).toBe('nao-encontrado');
    expect(falhaQueVale(['limite', 'fora-do-ar'])).toBe('limite');
    expect(falhaQueVale(['fora-do-ar'])).toBe('fora-do-ar');
    expect(falhaQueVale([])).toBe('fora-do-ar');
  });
});

describe('antes × depois', () => {
  it('nada mudou em relação ao Entregas: igual; o que o nads não sabia (capital, secundárias), novo', () => {
    const l = compararComReceita(antesDe(cadastro({ socios: [{ nome: 'Fulana de Tal', cpf: '52998224725' }] })), retrato());
    expect(Object.fromEntries(l.map(x => [x.campo, x.estado]))).toEqual({
      situacao: 'igual', razaoSocial: 'igual', fantasia: 'igual', endereco: 'igual', cnae: 'igual', cnaesSecundarios: 'novo',
      naturezaJuridica: 'igual', porte: 'igual', capitalSocial: 'novo', abertura: 'igual', socios: 'igual', simples: 'igual',
    });
    expect(linhasParaEscolher(l).map(x => x.campo)).toEqual(['cnaesSecundarios', 'capitalSocial']);
    expect(l.some(x => x.grave)).toBe(false);
  });
  it('a empresa ficou inapta e saiu do Simples: mudou e pede atenção; o regime do nads não bate', () => {
    const l = compararComReceita(antesDe(cadastro()), retrato({ descricao_situacao_cadastral: 'INAPTA', data_situacao_cadastral: '2026-10-01',
      descricao_motivo_situacao_cadastral: 'Omissão de declarações', opcao_pelo_simples: false, data_exclusao_do_simples: '2026-10-31' }));
    expect(linha(l, 'situacao')).toMatchObject({ estado: 'mudou', grave: true, antes: 'ATIVA desde 03/11/2005', depois: 'INAPTA desde 01/10/2026 (omissão de declarações)' });
    expect(linha(l, 'simples')).toMatchObject({ estado: 'mudou', grave: true, antes: 'Simples', depois: 'Fora do Simples (excluída em 31/10/2026)' });
    // fora do Simples: Presumido ou Real é a pessoa quem diz
    expect(linha(l, 'regime')).toMatchObject({ estado: 'mudou', gravavel: false, antes: 'Simples', depois: 'Fora do Simples' });
  });
  it('virou MEI: o regime pode ser gravado; no Presumido, a Receita fora do Simples concorda', () => {
    const mei = compararComReceita(antesDe(cadastro()), retrato({ opcao_pelo_mei: true, data_opcao_pelo_mei: '2026-01-01' }));
    expect(linha(mei, 'regime')).toMatchObject({ gravavel: true, antes: 'Simples', depois: 'MEI' });
    const presumido = compararComReceita(antesDe(cadastro(), { regimeQueVale: 'Presumido', doEntregas: retratoDoEntregas(ENTREGAS) }), retrato({ opcao_pelo_simples: false }));
    expect(linha(presumido, 'regime')).toBeUndefined();
  });
  it('a razão social e os sócios comparam com o cadastro do nads (a lista e os sócios de lá)', () => {
    const c = cadastro({ socios: [{ nome: 'Beltrano', cpf: '11144477735' }] });
    const l = compararComReceita(antesDe(c), retrato());
    expect(linha(l, 'razaoSocial')).toMatchObject({ estado: 'igual', antes: 'EMPRESA TESTE LTDA' });
    expect(linha(l, 'socios')).toMatchObject({ estado: 'mudou', antes: 'BELTRANO', depois: 'FULANA DE TAL (Sócio-Administrador)' });
    expect(linha(l, 'socios')?.nota).toContain('Sai do cadastro: Beltrano');
    const outro = compararComReceita(antesDe(cadastro({ nome: 'EMP TESTE' }), { nomeDaLista: 'EMP TESTE' }), retrato());
    expect(linha(outro, 'razaoSocial')).toMatchObject({ estado: 'mudou', antes: 'EMP TESTE', depois: 'EMPRESA TESTE LTDA' });
  });
  it('o quadro vazio (MEI) não apaga os sócios do cadastro', () => {
    const l = compararComReceita(antesDe(cadastro({ socios: [{ nome: 'Fulana de Tal', cpf: '' }] })), retrato({ qsa: [] }));
    expect(linha(l, 'socios')).toMatchObject({ estado: 'vazio', gravavel: false });
  });
  it('o endereço novo; a pontuação e os acentos não contam como mudança', () => {
    const mudou = compararComReceita(antesDe(cadastro()), retrato({ logradouro: 'Rua Nova', numero: '5' }));
    expect(linha(mudou, 'endereco')).toMatchObject({ estado: 'mudou', antes: 'RUA DOM PEDRO II, 120, CENTRO, MONTES CLAROS/MG' });
    expect(linha(mudou, 'endereco')?.depois).toBe('RUA NOVA, 5, CENTRO, MONTES CLAROS/MG · SALA 2 · CEP 39400-001');
    const igual = compararComReceita(antesDe(cadastro()), retrato({ natureza_juridica: 'Sociedade Empresaria Limitada.' }));
    expect(linha(igual, 'naturezaJuridica')?.estado).toBe('igual');
  });
  it('sem nada do Entregas: tudo novo', () => {
    const l = compararComReceita(antesDe(cadastro(), { doEntregas: {}, regimeQueVale: '' }), retrato());
    expect(l.filter(x => x.campo !== 'razaoSocial').every(x => x.estado === 'novo')).toBe(true);
    expect(linha(l, 'regime')).toMatchObject({ estado: 'novo', gravavel: true, depois: 'Simples' });
  });
});

describe('gravar só o que foi escolhido', () => {
  const opcoes = { por: 'Fulano', agora: AGORA, outras: [] };
  it('grava o escolhido e os iguais; o mudou não escolhido fica como estava', () => {
    const c = cadastro({ socios: [{ nome: 'Fulana de Tal', cpf: '52998224725' }] });
    const depois = retrato({ porte: 'DEMAIS', capital_social: 80000 });
    const l = compararComReceita(antesDe(c), depois);
    expect(linha(l, 'porte')?.estado).toBe('mudou');
    const { cadastro: novo, erros } = gravarDaReceita(c, depois, l, ['capitalSocial'], opcoes);
    expect(erros).toEqual([]);
    expect(novo.receita).toMatchObject({ conferidoEm: AGORA.toISOString(), por: 'Fulano', capitalSocial: 80000, situacao: 'ATIVA', cnpj: CNPJ });
    // o porte mudou e não foi escolhido: não entra (vale o do Entregas); as secundárias (novo, não escolhidas) também não
    expect(novo.receita?.porte).toBeUndefined();
    expect(novo.receita?.cnaesSecundarios).toBeUndefined();
    expect(novo.historico[0]).toMatchObject({ acao: 'Receita', detalhe: 'Gravado da consulta: Capital social', por: 'Fulano' });
    expect(retratoQueVale(novo.receita, retratoDoEntregas(ENTREGAS)).porte).toBe('MICRO EMPRESA');
    // o documento do banco leva e traz o retrato
    expect(cadastroDoDocumento(c.nome, c.codigo, documentoDoCadastro(novo)).receita).toEqual(novo.receita);
  });
  it('a razão social pela troca (a anterior fica guardada); os sócios mantêm o CPF; o regime vai para o cadastro', () => {
    const c = cadastro({ nome: 'EMP TESTE', socios: [{ nome: 'fulana de tal', cpf: '52998224725' }, { nome: 'Beltrano', cpf: '11144477735' }] });
    const depois = retrato({ opcao_pelo_mei: true });
    const l = compararComReceita(antesDe(c, { nomeDaLista: 'EMP TESTE' }), depois);
    const { cadastro: novo } = gravarDaReceita(c, depois, l, ['razaoSocial', 'socios', 'regime'], opcoes);
    expect(novo.razaoSocial).toMatchObject({ atual: 'EMPRESA TESTE LTDA', anteriores: [{ nome: 'EMP TESTE' }] });
    expect(novo.socios).toEqual([{ nome: 'FULANA DE TAL', cpf: '52998224725' }]);
    expect(novo.regime).toBe('MEI');
    expect(novo.historico.map(h => h.acao)).toEqual(['Receita', 'Regime', 'Sócios', 'Razão social']);
  });
  it('a razão social de outra empresa não troca: volta o erro e o resto grava', () => {
    const c = cadastro({ nome: 'EMP TESTE' });
    const depois = retrato();
    const l = compararComReceita(antesDe(c, { nomeDaLista: 'EMP TESTE' }), depois);
    const { cadastro: novo, erros } = gravarDaReceita(c, depois, l, ['razaoSocial', 'capitalSocial'], { ...opcoes, outras: [{ codigo: 7, nome: 'EMPRESA TESTE LTDA' }] });
    expect(erros[0]).toContain('Já tem outra empresa');
    expect(novo.razaoSocial).toBeUndefined();
    expect(novo.receita?.razaoSocial).toBeUndefined();
    expect(novo.receita?.capitalSocial).toBe(50000);
  });
  it('nada escolhido: só conferido (os iguais entram)', () => {
    const c = cadastro();
    const depois = retrato();
    const { cadastro: novo } = gravarDaReceita(c, depois, compararComReceita(antesDe(c), depois), [], opcoes);
    expect(novo.receita).toMatchObject({ situacao: 'ATIVA', cnae: { codigo: '6920-6/01' } });
    expect(novo.historico[0].detalhe).toBe('Conferido na Receita: nada gravado');
  });
  it('os sócios da Receita com o CPF de quem continua', () => {
    expect(sociosDaReceita([{ nome: 'Fulána de  Tal', cpf: '1' }], [{ nome: 'FULANA DE TAL', qualificacao: '', desde: '' }, { nome: 'NOVO', qualificacao: '', desde: '' }]))
      .toEqual([{ nome: 'FULANA DE TAL', cpf: '1' }, { nome: 'NOVO', cpf: '' }]);
  });
});

describe('o retrato que vale para mostrar', () => {
  it('campo a campo: o gravado no nads; sem ele, o do Entregas', () => {
    const doEntregas = retratoDoEntregas(ENTREGAS, { enquadramento: '', receita: 'MEI' });
    expect(doEntregas.mei?.optante).toBe(true);
    const r: Partial<RetratoDaReceita> = retratoQueVale({ conferidoEm: 'x', por: 'y', porte: 'DEMAIS' }, doEntregas);
    expect([r.porte, r.situacao]).toEqual(['DEMAIS', 'ATIVA']);
    expect(retratoDoEntregas({ ...ENTREGAS, receita: null, endereco: 'Rua A, 1', cidade: 'Montes Claros' }).endereco).toBe('RUA A, 1, MONTES CLAROS');
  });
});
