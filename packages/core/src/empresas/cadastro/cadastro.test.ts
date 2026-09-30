import { describe, expect, it } from 'vitest';
import {
  avisoDaConta, bancosDoCadastroNa, buscarNoPlano, cadastroDoDocumento, cadastroVazio, compararPlanos, confirmarPontoDePartida,
  criarRepoCadastroMemoria, definirContaPadrao, documentoDoCadastro, encerrarConta, excluirConta, lerPlanoDeContas,
  lerPlanilhaDoPlano, linhasDoTexto, planoDoBalancete, planoDoDocumento, pontoDePartida, primeiroBancoDoCadastro, reabrirConta, salvarConta, textoDoArquivo,
  type PlanoDeContas,
} from '.';

const AGORA = new Date('2026-09-30T12:00:00Z');
const vazio = () => cadastroVazio('FITO', 292);

describe('ponto de partida', () => {
  it('traz a lista provisória e os bancos adicionados no Extrator, sem a linha genérica', () => {
    const p = pontoDePartida(292, [{ id: 'itau-0412-9988', nome: 'Itaú', marca: 'itau', agencia: '0412', conta: '9988', desde: '2026-08' }]);
    expect(p.map(b => b.id)).toEqual(['sicoob', 'itau-0412-9988']);
    expect(p[1]).toMatchObject({ agencia: '0412', desde: '2026-08' });
    expect(pontoDePartida(null)).toEqual([]);
  });

  it('sem cadastro, o Extrator continua com a lista de antes', () => {
    expect(bancosDoCadastroNa(null, 292, '2026-08').map(b => b.id)).toEqual(['sicoob']);
    expect(bancosDoCadastroNa(vazio(), 292, '2026-08').map(b => b.id)).toEqual(['sicoob']);
    expect(primeiroBancoDoCadastro(null, 292)).toBe('sicoob');
  });
});

describe('contas bancárias', () => {
  const partida = pontoDePartida(292);

  it('inclui a conta começando pelo ponto de partida e registra no histórico', () => {
    const r = salvarConta(vazio(), null, { marca: 'itau', agencia: '0412', conta: '99887-7', contaContabil: '10504', desde: '2026-09' }, partida, 'Vitor', AGORA);
    expect(r.erro).toBeNull();
    expect(r.cadastro.bancos?.map(b => b.id)).toEqual(['sicoob', 'itau-0412-998877']);
    expect(r.cadastro.historico[0]).toMatchObject({ por: 'Vitor', acao: 'Incluiu conta' });
  });

  it('não aceita conta repetida nem sem agência', () => {
    const um = salvarConta(vazio(), null, { marca: 'itau', agencia: '0412', conta: '1' }, partida, 'V', AGORA).cadastro;
    expect(salvarConta(um, null, { marca: 'itau', agencia: '0412', conta: '1' }, partida, 'V', AGORA).erro).toMatch(/já está/);
    expect(salvarConta(um, null, { marca: 'itau', agencia: '', conta: '1' }, partida, 'V', AGORA).erro).toMatch(/agência/);
  });

  it('ao editar, o id não muda (os arquivos do Extrator continuam na conta)', () => {
    const r = salvarConta(vazio(), 'sicoob', { marca: 'sicoob', agencia: '3001', conta: '555' }, partida, 'V', AGORA);
    expect(r.erro).toBeNull();
    expect(r.cadastro.bancos?.[0]).toMatchObject({ id: 'sicoob', agencia: '3001', conta: '555' });
  });

  it('encerrada, some das competências seguintes; reaberta, volta', () => {
    const c = salvarConta(vazio(), null, { marca: 'itau', agencia: '1', conta: '2', desde: '2026-01' }, partida, 'V', AGORA).cadastro;
    const enc = encerrarConta(c, 'itau-1-2', '2026-06', partida, 'V', AGORA).cadastro;
    expect(bancosDoCadastroNa(enc, 292, '2026-06').map(b => b.id)).toContain('itau-1-2');
    expect(bancosDoCadastroNa(enc, 292, '2026-07').map(b => b.id)).not.toContain('itau-1-2');
    expect(bancosDoCadastroNa(enc, 292, '2025-12').map(b => b.id)).not.toContain('itau-1-2');
    expect(encerrarConta(c, 'itau-1-2', '2025-10', partida, 'V', AGORA).erro).toMatch(/começou depois/);
    const re = reabrirConta(enc, 'itau-1-2', partida, 'V', AGORA).cadastro;
    expect(bancosDoCadastroNa(re, 292, '2027-01').map(b => b.id)).toContain('itau-1-2');
  });

  it('cadastro sem conta nenhuma na competência = a linha genérica', () => {
    const c = excluirConta(confirmarPontoDePartida(vazio(), partida, 'V', AGORA), 'sicoob', partida, 'V', AGORA).cadastro;
    expect(c.bancos).toEqual([]);
    expect(bancosDoCadastroNa(c, 292, '2026-08').map(b => b.id)).toEqual(['banco']);
  });
});

describe('documento do banco', () => {
  it('ida e volta, e "nunca cadastrado" continua null', () => {
    expect(documentoDoCadastro(vazio())).not.toHaveProperty('bancos');
    const c = salvarConta(vazio(), null, { marca: 'itau', agencia: '1', conta: '2', tipo: 'aplicacao' }, [], 'V', AGORA).cadastro;
    const volta = cadastroDoDocumento('FITO', 292, documentoDoCadastro(c));
    expect(volta.bancos).toEqual(c.bancos);
    expect(cadastroDoDocumento('FITO', 292, { bancos: [{ id: '' }, { id: 'x', tipo: 'nada' }] }).bancos).toEqual([{ id: 'x', marca: 'x', nome: 'x' }]);
  });
});

const PLANO: PlanoDeContas = {
  origem: 'arquivo', importadoEm: '', contas: [
    { codigo: '1', nome: 'ATIVO', sintetica: true, ordem: 0 },
    { codigo: '10503', nome: 'SICOOB', ordem: 1 },
    { codigo: '97304', nome: 'JUROS RECEBIDOS', classificacao: '3.2.1.01.004', ordem: 2 },
  ],
};

describe('contas padrão', () => {
  it('guarda o código e o nome do plano; vazio volta ao padrão', () => {
    const c = definirContaPadrao(vazio(), 'juros', '97304', PLANO, 'V', AGORA);
    expect(c.contasPadrao).toEqual({ contas: { juros: '97304' }, nomes: { juros: 'JUROS RECEBIDOS' } });
    const d = definirContaPadrao(c, 'juros', '', PLANO, 'V', AGORA);
    expect(d.contasPadrao).toEqual({ contas: {}, nomes: {} });
    expect(definirContaPadrao(d, 'histJuros', '59648', PLANO, 'V', AGORA).contasPadrao?.contas.histJuros).toBe('59648');
  });

  it('avisa conta fora do plano, sintética ou com nome novo', () => {
    expect(avisoDaConta('999', PLANO)).toMatch(/não está/);
    expect(avisoDaConta('1', PLANO)).toMatch(/sintética/);
    expect(avisoDaConta('97304', PLANO, 'JUROS ATIVOS')).toMatch(/Mudou de nome/);
    expect(avisoDaConta('97304', PLANO, 'Juros recebidos')).toBeNull();
    expect(avisoDaConta('97304', null)).toBeNull();
  });
});

describe('plano de contas', () => {
  it('lê o layout do Alterdata ("NOME [código]", recuo = nível)', () => {
    const rows = [
      ['', '', 'Balancete', ''],
      ['', '', 'ATIVO [1]', ''],
      ['', '', '      CIRCULANTE [100]', ''],
      ['', '', '            SICOOB [10503]', ''],
      ['', '', 'RECEITAS [3]', ''],
      ['', '', '      JUROS RECEBIDOS [97304]', ''],
    ];
    const r = lerPlanoDeContas(rows);
    expect(r.formato).toBe('alterdata');
    expect(r.contas.map(c => [c.codigo, c.grupo, !!c.sintetica])).toEqual([
      ['1', 'Ativo', true], ['100', 'Ativo', true], ['10503', 'Ativo', false], ['3', 'Receita', true], ['97304', 'Receita', false],
    ]);
  });

  it('lê uma tabela com cabeçalho (classificação diz quem é sintética)', () => {
    const rows = [
      ['Plano de contas'],
      ['Classificação', 'Reduzido', 'Descrição'],
      ['1', '1', 'ATIVO'],
      ['1.1', '100', 'CIRCULANTE'],
      ['1.1.01', '10503', 'SICOOB'],
      ['3', '3', 'RECEITAS'],
      ['3.1', '97304', 'JUROS RECEBIDOS'],
    ];
    const r = lerPlanoDeContas(rows);
    expect(r.formato).toBe('tabela');
    expect(r.contas.find(c => c.codigo === '10503')).toMatchObject({ classificacao: '1.1.01', grupo: 'Ativo' });
    expect(r.contas.filter(c => c.sintetica).map(c => c.codigo)).toEqual(['1', '100', '3']);
  });

  it('planilha sem contas dá erro', () => {
    expect(lerPlanoDeContas([['nada'], ['aqui']]).erro).toMatch(/Não achei/);
  });

  it('monta do balancete da Conferência (ou da impressão digital dele)', () => {
    expect(planoDoBalancete({ contas: [{ codigo: '2', nome: 'B', grupo: 'Outros', ordem: 1 }, { codigo: '1', nome: 'A', grupo: 'Ativo', ordem: 0 }] }))
      .toEqual([{ codigo: '1', nome: 'A', grupo: 'Ativo', ordem: 0 }, { codigo: '2', nome: 'B', ordem: 1 }]);
    expect(planoDoBalancete({ contas: [], balanceteAssinatura: { '10503': 'Sicoob' } })).toEqual([{ codigo: '10503', nome: 'SICOOB', ordem: 0 }]);
    expect(planoDoBalancete(null)).toEqual([]);
  });

  it('busca por código, classificação e nome', () => {
    expect(buscarNoPlano(PLANO.contas, '105').map(c => c.codigo)).toEqual(['10503']);
    expect(buscarNoPlano(PLANO.contas, '3.2').map(c => c.codigo)).toEqual(['97304']);
    expect(buscarNoPlano(PLANO.contas, 'juros').map(c => c.codigo)).toEqual(['97304']);
    expect(buscarNoPlano(PLANO.contas, '', true).map(c => c.codigo)).toEqual(['10503', '97304']);
    expect(planoDoDocumento({ contas: PLANO.contas, origem: 'arquivo' })?.contas.length).toBe(3);
    expect(planoDoDocumento({ contas: [] })).toBeNull();
  });

  it('comparar planos avisa as contas usadas no cadastro que saem', () => {
    const c = definirContaPadrao(vazio(), 'juros', '97304', PLANO, 'V', AGORA);
    const m = compararPlanos(PLANO, [{ codigo: '10503', nome: 'SICOOB S/A', ordem: 0 }, { codigo: '5', nome: 'NOVA', ordem: 1 }], c);
    expect(m).toEqual({ novas: 1, saem: 2, renomeadas: 1, usadasQueSaem: ['97304 (Juros recebidos)'] });
  });
});

describe('repositório (memória)', () => {
  it('não grava antes de chegar; depois grava e avisa', async () => {
    const repo = criarRepoCadastroMemoria({ cadastros: {}, planos: {} });
    let avisos = 0;
    repo.assinar(() => { avisos++; });
    const antes = repo.cadastro('FITO', 292);
    expect(repo.carregada('FITO')).toBe(false);
    repo.salvar('FITO', confirmarPontoDePartida(antes, pontoDePartida(292), 'V', AGORA)); // ignorado: ainda não chegou
    await Promise.resolve();
    expect(repo.carregada('FITO')).toBe(true);
    expect(repo.cadastro('FITO', 292).bancos).toBeNull();
    repo.salvar('FITO', confirmarPontoDePartida(repo.cadastro('FITO', 292), pontoDePartida(292), 'V', AGORA));
    await Promise.resolve();
    expect(repo.cadastro('FITO', 292).bancos?.map(b => b.id)).toEqual(['sicoob']);
    repo.salvarPlano('FITO', PLANO, repo.cadastro('FITO', 292));
    await Promise.resolve();
    expect(repo.plano('FITO')?.contas.length).toBe(3);
    expect(avisos).toBeGreaterThan(2);
  });
});

describe('planilha do plano em CSV', () => {
  const enc = (s: string) => new TextEncoder().encode(s).buffer as ArrayBuffer;
  it('lê CSV com ";" em UTF-8 e em Windows-1252 (o do Excel brasileiro)', () => {
    const csv = 'Classificação;Reduzido;Descrição;Tipo\n1;1;ATIVO;S\n1.1;10503;"BANCO SICOOB; C/ MOVIMENTO";A\n';
    const r = lerPlanoDeContas(lerPlanilhaDoPlano(enc(csv), 'plano.csv'));
    expect(r.contas.map(c => [c.codigo, c.nome, !!c.sintetica])).toEqual([['1', 'ATIVO', true], ['10503', 'BANCO SICOOB; C/ MOVIMENTO', false]]);
    const latin1 = new Uint8Array([...'Descri'].map(c => c.charCodeAt(0)).concat([0xe7, 0xe3], [...'o;C'].map(c => c.charCodeAt(0)), [0xf3], [...'digo\nSICOOB;10503\n'].map(c => c.charCodeAt(0))));
    expect(linhasDoTexto(textoDoArquivo(latin1.buffer))[0]).toEqual(['Descrição', 'Código']);
  });
});
