import { afterEach, describe, expect, it } from 'vitest';
import { slug } from '../../formatos';
import { idDaExecucao } from '../../tarefas/repo';
import { buscarEmpresas, empresaPelaRota, rotaDaEmpresa } from '../busca';
import { nomeParaMostrar, usarRazoesSociais } from '../razaoSocial';
import {
  cadastroDoDocumento, cadastroVazio, confirmarPontoDePartida, criarRepoCadastro, definirContato, documentoDoCadastro, gravacaoDoCadastro,
  pontoDePartida, portaCadastroMemoria, razaoSocialDoCadastro, trocarRazaoSocial, type CadastroDaEmpresa, type PortaCadastro,
} from '.';

const AGORA = new Date('2026-11-13T12:00:00Z');
const DEPOIS = new Date('2026-11-14T09:00:00Z');
const NOME = 'FITO COMERCIO LTDA';
const LISTA = [
  { codigo: 292, nome: NOME, regime: 'Simples' },
  { codigo: 15, nome: 'CERAMICA FORTALEZA LTDA', regime: 'Simples' },
];

const trocar = (c: CadastroDaEmpresa, n: string, quando = AGORA) => {
  const r = trocarRazaoSocial(c, n, LISTA, 'Vitor', quando);
  if ('erro' in r) throw new Error(r.erro);
  return r;
};

afterEach(() => usarRazoesSociais(() => ''));

describe('trocar a razão social', () => {
  it('guarda a nova, a anterior, quem trocou e quando; o nome (a chave) não muda', () => {
    const c = trocar(cadastroVazio(NOME, 292), '  fito   distribuidora ltda ');
    expect(c.nome).toBe(NOME);
    expect(c.razaoSocial).toEqual({ atual: 'FITO DISTRIBUIDORA LTDA', em: AGORA.toISOString(), por: 'Vitor', anteriores: [{ nome: NOME, ate: AGORA.toISOString() }] });
    expect(c.historico[0]).toMatchObject({ por: 'Vitor', acao: 'Razão social', detalhe: NOME + ' → FITO DISTRIBUIDORA LTDA' });
    expect(razaoSocialDoCadastro(c)).toBe('FITO DISTRIBUIDORA LTDA');
    expect(razaoSocialDoCadastro(cadastroVazio(NOME, 292))).toBe(NOME);
  });

  it('a segunda troca guarda as duas anteriores, a mais nova primeiro', () => {
    const c = trocar(trocar(cadastroVazio(NOME, 292), 'FITO DISTRIBUIDORA LTDA'), 'FITO ATACADO LTDA', DEPOIS);
    expect(c.razaoSocial?.atual).toBe('FITO ATACADO LTDA');
    expect(c.razaoSocial?.anteriores.map(a => a.nome)).toEqual(['FITO DISTRIBUIDORA LTDA', NOME]);
    expect(c.historico.map(h => h.detalhe)).toEqual(['FITO DISTRIBUIDORA LTDA → FITO ATACADO LTDA', NOME + ' → FITO DISTRIBUIDORA LTDA']);
  });

  it('voltar ao nome de antes também fica registrado', () => {
    const c = trocar(trocar(cadastroVazio(NOME, 292), 'FITO DISTRIBUIDORA LTDA'), NOME, DEPOIS);
    expect(razaoSocialDoCadastro(c)).toBe(NOME);
    expect(c.razaoSocial?.anteriores.map(a => a.nome)).toEqual(['FITO DISTRIBUIDORA LTDA', NOME]);
  });

  it('sem mudança, devolve o mesmo cadastro (não grava à toa)', () => {
    const c = cadastroVazio(NOME, 292);
    expect(trocarRazaoSocial(c, 'fito comercio ltda', LISTA, 'Vitor', AGORA)).toBe(c);
  });

  it('recusa vazio, comprido demais e o nome de outra empresa', () => {
    const c = cadastroVazio(NOME, 292);
    expect(trocarRazaoSocial(c, '   ', LISTA, 'V', AGORA)).toEqual({ erro: 'Digite a razão social.' });
    expect(trocarRazaoSocial(c, 'X'.repeat(151), LISTA, 'V', AGORA)).toHaveProperty('erro');
    expect(trocarRazaoSocial(c, 'Cerâmica Fortaleza Ltda.', LISTA, 'V', AGORA)).toEqual({ erro: 'Já tem outra empresa com esse nome: 15 · CERAMICA FORTALEZA LTDA.' });
    const outras = [...LISTA, { codigo: 7, nome: 'OUTRA LTDA', razaoSocial: 'NOVA OUTRA LTDA' }];
    expect(trocarRazaoSocial(c, 'Nova Outra Ltda', outras, 'V', AGORA)).toHaveProperty('erro');
  });

  it('vai e volta do banco; o documento antigo (sem a razão) continua igual', () => {
    const c = trocar(cadastroVazio(NOME, 292), 'FITO DISTRIBUIDORA LTDA');
    expect(cadastroDoDocumento(NOME, 292, documentoDoCadastro(c)).razaoSocial).toEqual(c.razaoSocial);
    expect(cadastroDoDocumento(NOME, 292, { nome: NOME, historico: [], razaoSocial: { atual: '' } }).razaoSocial).toBeUndefined();
    expect('razaoSocial' in documentoDoCadastro(cadastroVazio(NOME, 292))).toBe(false);
    // grava só a razão social (e o histórico), nunca o nome novo no lugar da chave
    const g = gravacaoDoCadastro(cadastroVazio(NOME, 292), c);
    expect(g.campos.nome).toBe(NOME);
    expect(Object.keys(g.campos).sort()).toEqual(['atualizadoEm', 'codigo', 'historico', 'nome', 'razaoSocial']);
    expect(g.apagar).toEqual([]);
  });
});

describe('trocar a razão social não tira nenhum dado da empresa', () => {
  it('o cadastro continua no mesmo documento, com os bancos, o contato e o histórico; as chaves dos outros dados não mudam', async () => {
    const gravados: string[] = [];
    const memoria = portaCadastroMemoria({ cadastros: {}, planos: {} });
    const porta: PortaCadastro = { ...memoria, gravarCampos: (id, ...resto) => { gravados.push(id); return memoria.gravarCampos(id, ...resto); } };
    const repo = criarRepoCadastro(porta, true);

    // a empresa com os dados de antes
    repo.cadastro(NOME, 292);
    await Promise.resolve();
    const comBancos = confirmarPontoDePartida(repo.cadastro(NOME, 292), pontoDePartida(292), 'Clara', AGORA);
    const comContato = definirContato(comBancos, 'email', 'fito@exemplo.com', 'Clara', AGORA);
    repo.salvar(NOME, comContato);
    await Promise.resolve();
    const antes = repo.cadastro(NOME, 292);
    const chavesAntes = { cadastro: slug(NOME), rotina: idDaExecucao(NOME, '2026-10', 'contabil'), rota: rotaDaEmpresa(LISTA[0]) };

    // a troca
    repo.salvar(NOME, trocar(antes, 'FITO DISTRIBUIDORA LTDA', DEPOIS));
    await Promise.resolve();

    // gravou no mesmo documento (cadastro/fito-comercio-ltda), sem criar outro
    expect(new Set(gravados)).toEqual(new Set([slug(NOME)]));
    const depois = repo.cadastro(NOME, 292);
    expect(depois.nome).toBe(NOME);
    expect(depois.bancos).toEqual(antes.bancos);
    expect(depois.contato).toEqual(antes.contato);
    expect(depois.historico.slice(1)).toEqual(antes.historico);
    expect(razaoSocialDoCadastro(depois)).toBe('FITO DISTRIBUIDORA LTDA');
    repo.todos();
    await Promise.resolve();
    expect([...repo.todos().porId.keys()]).toEqual([slug(NOME)]);
    expect(repo.todos().porId.get(slug(NOME))?.bancos).toEqual(antes.bancos);

    // extratos, Conferência, cofre e "onde parou" (slug do nome), rotinas e a URL da empresa: as mesmas chaves
    expect({ cadastro: slug(depois.nome), rotina: idDaExecucao(depois.nome, '2026-10', 'contabil'), rota: rotaDaEmpresa(LISTA[0]) }).toEqual(chavesAntes);
    expect(empresaPelaRota(LISTA, '292')).toBe(LISTA[0]);
  });

  it('a busca acha pelo nome novo e pelo antigo, e devolve a mesma empresa da lista (com a chave de sempre)', () => {
    usarRazoesSociais(n => (n === NOME ? 'FITO DISTRIBUIDORA LTDA' : ''));
    expect(nomeParaMostrar(LISTA[0])).toBe('FITO DISTRIBUIDORA LTDA');
    expect(nomeParaMostrar(LISTA[1])).toBe('CERAMICA FORTALEZA LTDA');
    expect(buscarEmpresas(LISTA, 'distribuidora')).toEqual([LISTA[0]]);
    expect(buscarEmpresas(LISTA, 'fito comercio')).toEqual([LISTA[0]]);
    expect(buscarEmpresas(LISTA, 'distribuidora')[0].nome).toBe(NOME);
  });
});
