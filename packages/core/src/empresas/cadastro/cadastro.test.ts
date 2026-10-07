import { describe, expect, it } from 'vitest';
import {
  avisoDaConta, bancosDoCadastroNa, buscarNoPlano, cadastroDoDocumento, cadastroVazio, compararPlanos, confirmarPontoDePartida,
  comContasPadrao, criarRepoCadastro, criarRepoCadastroMemoria, definirCartao, definirContaPadrao, definirContato, definirNotaDeHonorario, definirPrestaServico, definirSocios, documentoDoCadastro, encerrarConta, excluirConta, lerPlanoDeContas,
  bancosDoEntregasDoDocumento, bancosDoEntregasPorCodigo, contasDoEntregas, juntarComEntregas, sugestoesDoEntregas,
  lerPlanilhaDoPlano, linhasDoTexto, registrarPlano, planoDoBalancete, planoDoDocumento, pontoDePartida, primeiroBancoDoCadastro, reabrirConta, salvarConta, textoDoArquivo,
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

describe('repositório sem acesso ao banco', () => {
  it('conta como carregado, vazio, indisponível e nunca grava', async () => {
    const gravados: string[] = [];
    const negado = (_id: string, _ok: unknown, falhou: (e: Error) => void) => { queueMicrotask(() => falhou(new Error('Missing or insufficient permissions.'))); return () => {}; };
    const avisos: string[] = [];
    const repo = criarRepoCadastro({ ouvirCadastro: negado, ouvirPlano: negado, ouvirTodos: (ok, falhou) => negado('', ok, falhou), gravar: async id => { gravados.push(id); } }, false);
    repo.definirAviso(m => avisos.push(m));
    repo.cadastro('FITO', 292);
    await Promise.resolve();
    expect(repo.carregada('FITO')).toBe(true);
    expect(repo.disponivel('FITO')).toBe(false);
    expect(repo.cadastro('FITO', 292).bancos).toBeNull();
    repo.salvar('FITO', confirmarPontoDePartida(repo.cadastro('FITO', 292), pontoDePartida(292), 'V', AGORA));
    expect(gravados).toEqual([]);
    expect(avisos).toHaveLength(1);
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
    repo.salvarPlano('FITO', PLANO, registrarPlano(repo.cadastro('FITO', 292), PLANO, 'V', AGORA));
    await Promise.resolve();
    expect(repo.plano('FITO')?.contas.length).toBe(3);
    repo.todos();
    await Promise.resolve();
    expect(repo.todos().carregada).toBe(true);
    expect(repo.todos().porId.get('fito')?.plano?.contas).toBe(3);
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

describe('bancos que o Entregas já sabe', () => {
  const doc = { codigoOrigem: '292', ativo: true, bancos: ['sicoob', 'bb', 'mercadopago'], contasBancarias: [{ banco: 'sicoob', agencia: '3144-5', conta: '12.345-6' }, { banco: 'bb', agencia: '', conta: '1' }] };

  it('traduz os ids do Entregas e junta por código do ERP', () => {
    const m = bancosDoEntregasPorCodigo([doc, { codigoOrigem: '5', ativo: false, bancos: ['itau'] }, { codigoOrigem: 'x', bancos: ['itau'] }]);
    expect([...m.keys()]).toEqual([292]);
    expect(m.get(292)).toEqual({ bancos: ['sicoob', 'banco-do-brasil', 'mercado-pago'], contas: [{ marca: 'sicoob', agencia: '3144-5', conta: '12.345-6' }] });
    expect(contasDoEntregas(m.get(292)).map(c => c.id)).toEqual(['sicoob-31445-123456', 'banco-do-brasil', 'mercado-pago']);
  });

  it('o ponto de partida ganha a agência e a conta do banco que já estava, e os bancos que faltam', () => {
    const e = bancosDoEntregasDoDocumento(doc);
    const p = juntarComEntregas(pontoDePartida(292), e);
    expect(p.map(b => [b.id, b.agencia || '', b.conta || ''])).toEqual([
      ['sicoob', '3144-5', '12.345-6'], ['banco-do-brasil', '', ''], ['mercado-pago', '', ''],
    ]);
  });

  it('com cadastro: sugere completar o banco sem número e incluir o que falta; o que já está não aparece', () => {
    const e = bancosDoEntregasDoDocumento(doc);
    const c = confirmarPontoDePartida(vazio(), pontoDePartida(292), 'V', AGORA); // só o Sicoob, sem número
    expect(sugestoesDoEntregas(c, e).map(s => [s.tipo, s.conta.id, s.id || ''])).toEqual([
      ['completar', 'sicoob-31445-123456', 'sicoob'], ['nova', 'banco-do-brasil', ''], ['nova', 'mercado-pago', ''],
    ]);
    const completo = salvarConta(c, 'sicoob', { marca: 'sicoob', agencia: '03144-5', conta: '0012345-6' }, [], 'V', AGORA).cadastro;
    expect(sugestoesDoEntregas(completo, e).map(s => s.conta.id)).toEqual(['banco-do-brasil', 'mercado-pago']);
    expect(sugestoesDoEntregas(completo, null)).toEqual([]);
  });
});

describe('presta serviços (a regra no Cadastro)', () => {
  it('sim, não e não informado; fica no histórico e vai para o documento', () => {
    const c0 = vazio();
    expect(c0.prestaServico).toBeUndefined();
    const sim = definirPrestaServico(c0, true, 'Vitor', AGORA);
    expect(sim.prestaServico).toBe(true);
    expect(sim.historico[0]).toMatchObject({ acao: 'Presta serviços', detalhe: 'Sim', por: 'Vitor' });
    expect(definirPrestaServico(sim, true, 'Vitor', AGORA)).toBe(sim);
    // os sócios (a etapa Bancos acha a transferência para o sócio pelo nome)
    const comSocio = definirSocios(c0, [{ nome: ' Marcos  Antonio ', cpf: '123.405.586-90' }, { nome: '', cpf: '' }], 'Vitor', AGORA);
    expect(comSocio.socios).toEqual([{ nome: 'Marcos Antonio', cpf: '12340558690' }]);
    expect(documentoDoCadastro(comSocio).socios).toEqual([{ nome: 'Marcos Antonio', cpf: '12340558690' }]);
    expect(definirSocios(comSocio, [{ nome: 'Marcos Antonio', cpf: '12340558690' }], 'Vitor', AGORA)).toBe(comSocio);
    const doc = documentoDoCadastro(sim);
    expect(doc.prestaServico).toBe(true);
    expect(cadastroDoDocumento('FITO', 292, doc).prestaServico).toBe(true);
    const nao = definirPrestaServico(sim, false, 'Vitor', AGORA);
    expect(cadastroDoDocumento('FITO', 292, documentoDoCadastro(nao)).prestaServico).toBe(false);
    const volta = definirPrestaServico(nao, null, 'Vitor', AGORA);
    expect('prestaServico' in documentoDoCadastro(volta)).toBe(false);
    expect(volta.historico[0].detalhe).toBe('Não informado');
  });
});

describe('os cartões da empresa (07/10/2026)', () => {
  it('cartão empresarial e vende no cartão: sim, não, não informado; vão e voltam do documento', () => {
    const c = definirCartao(definirCartao(vazio(), 'cartaoEmpresarial', true, 'Vitor', AGORA), 'vendeNoCartao', false, 'Vitor', AGORA);
    expect([c.cartaoEmpresarial, c.vendeNoCartao]).toEqual([true, false]);
    expect(c.historico[0]).toMatchObject({ acao: 'Vende no cartão', detalhe: 'Não' });
    const volta = cadastroDoDocumento('FITO', 292, documentoDoCadastro(c));
    expect([volta.cartaoEmpresarial, volta.vendeNoCartao]).toEqual([true, false]);
    expect('cartaoEmpresarial' in definirCartao(c, 'cartaoEmpresarial', null, 'Vitor', AGORA)).toBe(false);
  });
  it('a conta do cartão fica nas contas padrão, e o Creditor gravando as dele não a apaga', () => {
    const c = definirContaPadrao(vazio(), 'cartao', '21105', null, 'Vitor', AGORA);
    expect(c.contasPadrao?.contas.cartao).toBe('21105');
    const doCreditor = comContasPadrao(c, { contas: { banco: '10503' }, nomes: {} }, 'Creditor', AGORA);
    expect(doCreditor.contasPadrao?.contas).toEqual({ banco: '10503', cartao: '21105' });
  });
});

describe('a nota de honorário (07/10/2026)', () => {
  it('sim, não, não informado; vai e volta do documento, com o histórico', () => {
    const c = definirNotaDeHonorario(vazio(), false, 'Vitor', AGORA);
    expect(c.emiteNotaHonorario).toBe(false);
    expect(c.historico[0]).toMatchObject({ acao: 'Nota de honorário', detalhe: 'Não' });
    expect(cadastroDoDocumento('FITO', 292, documentoDoCadastro(c)).emiteNotaHonorario).toBe(false);
    expect(definirNotaDeHonorario(c, false, 'Vitor', AGORA)).toBe(c);
    const nada = definirNotaDeHonorario(c, null, 'Vitor', AGORA);
    expect('emiteNotaHonorario' in nada).toBe(false);
    expect('emiteNotaHonorario' in documentoDoCadastro(nada)).toBe(false);
  });
});

describe('o contato da empresa para o Mandei (07/10/2026)', () => {
  it('e-mail e WhatsApp (só os números); inválido não grava; vazio tira; vai e volta do documento', () => {
    let c = definirContato(vazio(), 'whatsapp', '(38) 99999-8888', 'Vitor', AGORA);
    c = definirContato(c, 'email', ' financeiro@fito.com.br ', 'Vitor', AGORA);
    expect(c.contato).toEqual({ whatsapp: '38999998888', email: 'financeiro@fito.com.br' });
    expect(c.historico[0]).toMatchObject({ acao: 'E-mail da empresa', detalhe: 'financeiro@fito.com.br' });
    expect(definirContato(c, 'email', 'sem-arroba', 'Vitor', AGORA)).toBe(c);
    expect(definirContato(c, 'whatsapp', '123', 'Vitor', AGORA)).toBe(c);
    expect(cadastroDoDocumento('FITO', 292, documentoDoCadastro(c)).contato).toEqual(c.contato);
    const sem = definirContato(definirContato(c, 'email', '', 'Vitor', AGORA), 'whatsapp', '', 'Vitor', AGORA);
    expect('contato' in sem).toBe(false);
    expect('contato' in documentoDoCadastro(sem)).toBe(false);
  });
});
