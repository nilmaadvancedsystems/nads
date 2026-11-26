import { describe, expect, it } from 'vitest';
import type { BuscarNoSci } from '../../areaCliente';
import {
  admissaoDoRhNet, clienteIdDoJwt, configDoSci, corpoDaAdmissao, corpoDaLiberacao, corpoDaLiberacaoDaPlanilha, corpoDosLancamentos, criarClienteRhNet,
  empresaIdDoJwt, erroDaAdmissao, erroDoLancamento, itensDoCadastro, lerCadastrosDoRhNet, lerPaginaDoRhNet, mensagemDoRhNet, resumoDosCadastros, RH_NET,
} from './index';

/** um JWT de mentira com estas informações dentro (a assinatura não importa aqui) */
const jwt = (info: Record<string, unknown>) => 'cab.' + btoa(JSON.stringify(info)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_') + '.ass';
const ADMISSAO = { nome: 'Maria da Silva', cpf: '529.982.247-25', admissao: '2026-12-01' };

describe('RH NET: a regra', () => {
  it('a chave do RH NET na configuração começa desligada', () => {
    expect(configDoSci(null).rhNet).toBe(false);
    expect(configDoSci({ rhNet: true }).rhNet).toBe(true);
  });

  it('lê a página e a mensagem de erro (com os erros de validação)', () => {
    const p = lerPaginaDoRhNet({ sucesso: true, retorno: [{ a: 1 }, 'x'], paginacao: { pagina_atual: 2, ultima_pagina: 3, total: 201 } });
    expect(p).toEqual({ itens: [{ a: 1 }], paginaAtual: 2, ultimaPagina: 3, total: 201 });
    expect(lerPaginaDoRhNet({ retorno: { funcionario_contribuinte_id: 9 } }).itens).toHaveLength(1);
    expect(mensagemDoRhNet({ mensagem: 'Erro de validação', erros: { cpf: ['O CPF já existe.'] } }, 400)).toBe('Erro de validação (cpf: O CPF já existe.)');
    expect(mensagemDoRhNet(null, 500)).toBe('o RH NET respondeu 500');
  });

  it('os cadastros: id, nome e código, sem repetir e em ordem', () => {
    const itens = itensDoCadastro('departamentos', [
      { departamento_id: 2, departamento: 'Vendas', cod_departamento: '02' }, { departamento_id: 1, departamento: 'Administração' },
      { departamento_id: 2, departamento: 'Vendas' }, { departamento: 'sem id' },
    ]);
    expect(itens).toEqual([{ id: 1, nome: 'Administração' }, { id: 2, nome: 'Vendas' }]);
    const c = { departamentos: itens, funcoes: itensDoCadastro('funcoes', [{ v_funcao_id: 5, funcao: 'Vendedor', cbo: '521110' }]), centrosCusto: [], quadrosHorario: [], sindicatos: [] };
    expect(c.funcoes).toEqual([{ id: 5, nome: 'Vendedor', codigo: '521110' }]);
    expect(resumoDosCadastros(c)).toBe('Departamentos 2 · Funções 1 · Centros de custo 0 · Quadros de horário 0 · Sindicatos 0');
    expect(lerCadastrosDoRhNet(JSON.parse(JSON.stringify(c)))).toEqual(c);
  });

  it('acha a empresa e a contabilidade dentro do JWT', () => {
    expect(empresaIdDoJwt(jwt({ empresa_id: 900001, cliente: '1234' }))).toBe(900001);
    expect(clienteIdDoJwt(jwt({ empresa_id: 900001, cliente: '1234' }))).toBe(1234);
    expect(empresaIdDoJwt('lixo')).toBe(0);
    // como a SCI manda de verdade (o primeiro login, 25/11/2026): dentro de usuario.dados
    const real = jwt({ sub: 1, parceiroId: 802, usuario: { tipo: 2, usuarioId: 1, dados: { clienteId: 17157, empresasVinculadas: [566483], acessos: {} } } });
    expect(empresaIdDoJwt(real)).toBe(566483);
    expect(clienteIdDoJwt(real)).toBe(17157);
    // usuário com mais de uma empresa: fica a dúvida (o escritório informa)
    expect(empresaIdDoJwt(jwt({ usuario: { dados: { empresasVinculadas: [1, 2] } } }))).toBe(0);
  });

  it('a admissão: confere o mínimo e monta o corpo como a SCI pede', () => {
    expect(erroDaAdmissao(ADMISSAO)).toBe('');
    expect(erroDaAdmissao({ ...ADMISSAO, cpf: '111.111.111-11' })).toBe('o CPF não é válido');
    expect(erroDaAdmissao({ ...ADMISSAO, admissao: '01/12/2026' })).toBe('falta a data de admissão');
    expect(erroDaAdmissao({ ...ADMISSAO, salario: 0 })).toMatch('salário');
    const corpo = corpoDaAdmissao(900001, { ...ADMISSAO, celular: '(38) 99876-5432', salario: 1800, funcaoId: 5 });
    expect(corpo).toMatchObject({
      empresa_id: 900001, tipo_colaborador: 'funcionario', nome: 'MARIA DA SILVA', cpf: '529.982.247-25', admissao_data: '2026-12-01',
      ddd_celular: '38', celular: '998765432', salario_base: 1800, v_funcao_id: 5, departamento_id: null, habilita_acesso_modulo_colaborador: false,
    });
    // (26/11/2026) os obrigatórios da pré-admissão do SCI vão com o padrão: assalariado, admissão, CLT geral, mensalista, prazo indeterminado
    expect(corpo).toMatchObject({ classe_id: 0, admissao_tipo_id: 1, categoria_esocial_id: 101, funcionario_tipo_id: 0, contrato_tipo_id: 1, prazo_experiencia: 0, prazo_experiencia_fim: null });
    expect(corpo).not.toHaveProperty('prazo_experiencia_prorrogacao');
    // a experiência de 45 + 45 a partir de 01/12: o 1º prazo termina em 14/01 e a prorrogação em 28/02
    expect(corpoDaAdmissao(900001, { ...ADMISSAO, experienciaDias: 45, prorrogacaoDias: 45, remuneracao: 2 })).toMatchObject({
      prazo_experiencia: 45, prazo_experiencia_fim: '2027-01-14', prazo_experiencia_prorrogacao: 45, prazo_experiencia_prorrogacao_fim: '2027-02-28', funcionario_tipo_id: 2,
    });
    // o estágio: classe 2, categoria 901 e o tipo de contrato em branco para o escritório escolher
    expect(corpoDaAdmissao(900001, { ...ADMISSAO, classe: 2, categoriaEsocial: 901, contratoTipo: null })).toMatchObject({ classe_id: 2, categoria_esocial_id: 901, contrato_tipo_id: null });
    expect(admissaoDoRhNet({ funcionario_contribuinte_id: 15, situacao: 'nao_liberado', nome: 'MARIA DA SILVA', cpf: '529', admissao_data: '2026-12-01' }))
      .toEqual({ id: 15, situacao: 'nao_liberado', primeiroNome: 'MARIA', admissao: '2026-12-01' });
    expect(corpoDaLiberacao(900001, [15, 15, 0], 'liberado')).toEqual({ empresa_id: 900001, situacao: 'liberado', funcionario_contribuinte_id: [15] });
  });

  it('os lançamentos: valor ou referência, competência no dia 1', () => {
    const l = { funcionarioId: 15, verbaId: 7, competencia: '2026-11', valor: 150 };
    expect(erroDoLancamento(l)).toBe('');
    expect(erroDoLancamento({ ...l, valor: undefined })).toBe('falta o valor ou a referência');
    expect(erroDoLancamento(l, 'centros-custos')).toBe('falta o centro de custo');
    expect(corpoDosLancamentos(900001, [l])).toEqual({ dados: [{ empresa_id: 900001, funcionario_contribuinte_id: 15, v_verba_id: 7, competencia: '2026-11-01', valor: 150, referencia: null }] });
    expect(corpoDaLiberacaoDaPlanilha(1234, 900001, '2026-11', 'liberado')).toEqual({ cliente_id: 1234, empresa_id: 900001, competencia: '2026-11-01', situacao: 'liberado' });
  });
});

/** a SCI de mentira para o RH NET */
function rhFalso(rotas: (url: URL, metodo: string, body: unknown) => { status: number; corpo?: unknown }) {
  const chamadas: { url: string; metodo: string; auth: string; body: unknown }[] = [];
  const buscar: BuscarNoSci = async (url, init) => {
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
    chamadas.push({ url, metodo: init.method, auth: init.headers.Authorization ?? '', body });
    const r = rotas(new URL(url), init.method, body);
    return { status: r.status, json: async () => r.corpo };
  };
  return { buscar, chamadas };
}
const TOKEN_DO_LOGIN = jwt({ empresa_id: 900001, cliente: 1234 });
const login = (url: URL) => (url.pathname.endsWith('/credencial/login') ? { status: 201, corpo: { token: TOKEN_DO_LOGIN, validade: 3600 } } : null);

describe('RH NET: o cliente da API', () => {
  it('entra com o token da EMPRESA, acha a empresa no JWT e pagina os cadastros', async () => {
    const { buscar, chamadas } = rhFalso(url => login(url) ?? (url.pathname === '/api/v1/departamentos'
      ? { status: 200, corpo: { retorno: [{ departamento_id: Number(url.searchParams.get('page')), departamento: 'D' + url.searchParams.get('page') }], paginacao: { pagina_atual: Number(url.searchParams.get('page')), ultima_pagina: 2 } } }
      : { status: 200, corpo: { retorno: [], paginacao: { pagina_atual: 1, ultima_pagina: 1 } } }));
    const rh = criarClienteRhNet({ buscar, tokens: () => ({ parceiro: 'p', empresa: 'e' }), agora: () => 0 });
    const c = await rh.cadastros();
    expect(c.departamentos.map(d => d.nome)).toEqual(['D1', 'D2']);
    expect(chamadas[0]).toMatchObject({ metodo: 'POST', auth: 'Basic ' + btoa('p:e') });
    const deps = chamadas.filter(x => x.url.startsWith(RH_NET + '/api/v1/departamentos'));
    expect(deps).toHaveLength(2);
    expect(new URL(deps[0].url).searchParams.get('empresa_id')).toBe('900001');
    expect(deps.every(x => x.auth === 'Bearer ' + TOKEN_DO_LOGIN)).toBe(true);
    expect(await rh.identificacao()).toEqual({ empresaId: 900001, clienteId: 1234 });
  });

  it('cria a admissão (fica não liberada) e libera só quando pedem', async () => {
    const { buscar, chamadas } = rhFalso((url, metodo) => login(url) ?? (metodo === 'POST' && url.pathname === '/api/v1/admissoes'
      ? { status: 201, corpo: { sucesso: true, retorno: { funcionario_contribuinte_id: 15, situacao: 'nao_liberado', nome: 'MARIA DA SILVA', admissao_data: '2026-12-01' } } }
      : { status: 200, corpo: { sucesso: true } }));
    const rh = criarClienteRhNet({ buscar, tokens: () => ({ parceiro: 'p', empresa: 'e' }), agora: () => 0 });
    expect(await rh.criarAdmissao(ADMISSAO)).toEqual({ id: 15, situacao: 'nao_liberado', primeiroNome: 'MARIA', admissao: '2026-12-01' });
    expect(chamadas.some(c => c.url.includes('/liberacoes/'))).toBe(false);
    await rh.liberarAdmissoes([15], 'liberado');
    expect(chamadas.at(-1)).toMatchObject({ url: RH_NET + '/api/v1/liberacoes/admissoes', body: { empresa_id: 900001, situacao: 'liberado', funcionario_contribuinte_id: [15] } });
  });

  it('não manda a admissão errada; o 403 vira a frase de que o RH NET não está liberado', async () => {
    const { buscar, chamadas } = rhFalso(url => login(url) ?? { status: 403, corpo: { mensagem: 'Forbidden' } });
    const rh = criarClienteRhNet({ buscar, tokens: () => ({ parceiro: 'p', empresa: 'e' }), agora: () => 0 });
    await expect(rh.criarAdmissao({ ...ADMISSAO, cpf: '1' })).rejects.toThrow('o CPF não é válido');
    expect(chamadas).toHaveLength(0);
    await expect(rh.admissoes()).rejects.toThrow('não está liberado para esta empresa');
  });

  it('sem o número da empresa no JWT, pede para informar; com ele informado, segue', async () => {
    const semEmpresa = jwt({ sub: 'x' });
    const { buscar } = rhFalso(url => (url.pathname.endsWith('/credencial/login') ? { status: 201, corpo: { token: semEmpresa, validade: 3600 } } : { status: 200, corpo: { retorno: [] } }));
    await expect(criarClienteRhNet({ buscar, tokens: () => ({ parceiro: 'p', empresa: 'e' }), agora: () => 0 }).admissoes()).rejects.toThrow('informe-o na configuração');
    expect(await criarClienteRhNet({ buscar, tokens: () => ({ parceiro: 'p', empresa: 'e', empresaId: 77 }), agora: () => 0 }).identificacao()).toEqual({ empresaId: 77, clienteId: 0 });
  });
});
