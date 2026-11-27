import { describe, expect, it } from 'vitest';
import {
  acessoDaArea, consultaDePublicados, criarAtendimentoDaArea, criarClienteSciReport, dataDoSci, empresaDoSciPeloDocumento, ErroDoSci,
  guiaDoSciReport, guiasDoSciReport, janelaDoSci, lerEmpresasDoSci, lerLoginDoSci, lerPaginaDePublicados, lerPublicacaoDoSci,
  sessaoDoSciVale, urlDoPdfDoSci, SCI_AUTH, SCI_RELATORIO, type BuscarNoSci, type PublicacaoDoSci,
} from './index';

const HOJE = new Date(2026, 10, 24, 10, 0); // 24/11/2026
const TOKEN = 'a'.repeat(40);
const CNPJ = '12345678000190';

/** uma linha de publicados.dados como a SCI manda (o exemplo do OpenAPI, com valores nossos) */
const linha = (x: Record<string, unknown> = {}) => ({
  publicadosId: 101, empresaId: 7, empresaNome: 'EMPRESA TESTE LTDA', mesRef: 10, anoRef: 2026, tipo: 'imposto', relatorioId: '0001',
  nomeRelatorio: 'DAS', descricao: '', dataVencimento: '2026-11-20', valor: 1534.27, individual: 0, visualizado: 1,
  dataHoraPrimeiraVisualizacao: '2026-11-10 09:12:00', loginPrimeiraVisualizacao: 'cliente@empresa', comprovantePagamento: '',
  dataPagamento: null, valorPagamento: null, ...x,
});
const pagina = (dados: unknown[], paginaAtual = 1, ultimaPagina = 1) => ({ mensagem: 'ok', publicados: { dados, paginaAtual, ultimaPagina, total: dados.length } });

describe('SCI Report: leitura das respostas', () => {
  it('converte as datas da SCI e recusa a inválida', () => {
    expect(dataDoSci('2026-11-20')).toBe('20/11/2026');
    expect(dataDoSci('2026-11-10 09:12:00')).toBe('10/11/2026');
    expect(dataDoSci('2026-02-30')).toBe('');
    expect(dataDoSci(null)).toBe('');
  });

  it('lê o login e diz quando renovar', () => {
    const s = lerLoginDoSci({ mensagem: 'Token gerado com sucesso.', token: 'jwt', validade: 3600 }, 0);
    expect(s).toEqual({ token: 'jwt', expiraEm: 3_600_000 });
    expect(sessaoDoSciVale(s, 3_600_000 - 6 * 60_000)).toBe(true);
    expect(sessaoDoSciVale(s, 3_600_000 - 4 * 60_000)).toBe(false);
    expect(lerLoginDoSci({ mensagem: 'Credenciais inválidas.', payload: {} }, 0)).toBeNull();
  });

  it('acha a empresa só pelo documento inteiro e igual', () => {
    const empresas = lerEmpresasDoSci({ empresas: [
      { empresaId: 7, nome: 'EMPRESA TESTE LTDA', numeroDocumento: '12.345.678/0001-90' },
      { empresaId: 8, nome: 'OUTRA', numeroDocumento: '12345678000271' },
      { empresaId: 'x', numeroDocumento: '1' },
    ] });
    expect(empresas.map(e => e.empresaId)).toEqual([7, 8]);
    expect(empresaDoSciPeloDocumento(empresas, '12.345.678/0001-90')).toBe(7);
    expect(empresaDoSciPeloDocumento(empresas, '12345678')).toBeNull();
    expect(empresaDoSciPeloDocumento([...empresas, { empresaId: 9, nome: 'DUPLICADA', cnpj: CNPJ }], CNPJ)).toBeNull();
  });

  it('lê a página de publicados e descarta a linha torta', () => {
    const p = lerPaginaDePublicados(pagina([linha(), linha({ publicadosId: null }), linha({ mesRef: 13, publicadosId: 102 })], 1, 3));
    expect(p.paginaAtual).toBe(1);
    expect(p.ultimaPagina).toBe(3);
    expect(p.itens.map(x => [x.publicadosId, x.competencia])).toEqual([[101, '2026-10'], [102, '2026-12']]);
    expect(lerPaginaDePublicados(null)).toEqual({ itens: [], paginaAtual: 1, ultimaPagina: 1 });
  });

  it('monta a consulta só dos impostos da empresa, sem os de funcionário', () => {
    const q = new URLSearchParams(consultaDePublicados({ empresaId: 7, de: '2026-09', ate: '2026-11', pagina: 2 }));
    expect(Object.fromEntries(q)).toEqual({
      tipoDocumento: 'imposto', status: 'todos', empresaId: '7', referenciaInicial: '09/2026', referenciaFinal: '11/2026',
      individual: 'false', page: '2', registrosPorPagina: '200',
    });
    expect(new URLSearchParams(consultaDePublicados({ empresaId: 7, de: '2026-09', ate: '2026-11', publicadosId: 101 })).get('publicadosId')).toBe('101');
  });

  it('a janela vai de dois meses atrás até o mês de hoje, virando o ano', () => {
    expect(janelaDoSci(HOJE)).toEqual({ de: '2026-09', ate: '2026-11' });
    expect(janelaDoSci(new Date(2027, 0, 5))).toEqual({ de: '2026-11', ate: '2027-01' });
  });

  it('só aceita a URL https do PDF', () => {
    expect(urlDoPdfDoSci({ urlPdf: 'https://s3.exemplo/a.pdf?assinatura=1' })).toBe('https://s3.exemplo/a.pdf?assinatura=1');
    expect(urlDoPdfDoSci({ urlPdf: 'http://s3.exemplo/a.pdf' })).toBe('');
    expect(urlDoPdfDoSci({})).toBe('');
  });
});

describe('SCI Report: o que o cliente vê', () => {
  const pub = (x: Record<string, unknown> = {}) => lerPublicacaoDoSci(linha(x)) as PublicacaoDoSci;

  it('a guia em aberto tem a situação pela data, e só os campos da lista branca', () => {
    expect(guiaDoSciReport(pub(), HOJE)).toEqual({ id: '101', nome: 'DAS', competencia: '2026-10', vencimento: '20/11/2026', valor: 1534.27, situacao: 'vencida' });
    expect(guiaDoSciReport(pub({ dataVencimento: '2026-11-24' }), HOJE)?.situacao).toBe('vence hoje');
    expect(guiaDoSciReport(pub({ dataVencimento: '2026-12-20' }), HOJE)?.situacao).toBe('a vencer');
  });

  it('com o pagamento informado no SCI Report, mostra a data e o valor pago', () => {
    expect(guiaDoSciReport(pub({ dataPagamento: '2026-11-19', valorPagamento: 1534.27 }), HOJE)).toMatchObject({ situacao: 'pagamento informado', pagamentoEm: '19/11/2026', valorPago: 1534.27 });
  });

  it('a de funcionário e a sem vencimento não são guias da empresa', () => {
    expect(guiaDoSciReport(pub({ individual: 1 }), HOJE)).toBeNull();
    expect(guiaDoSciReport(pub({ dataVencimento: '' }), HOJE)).toBeNull();
  });

  it('ordena: em aberto primeiro, pelo vencimento; sem repetir', () => {
    const lista = guiasDoSciReport([
      pub({ publicadosId: 1, dataVencimento: '2026-12-20', nomeRelatorio: 'DARF' }),
      pub({ publicadosId: 2, dataPagamento: '2026-11-10' }),
      pub({ publicadosId: 3, dataVencimento: '2026-11-20' }),
      pub({ publicadosId: 3, dataVencimento: '2026-11-20' }),
    ], HOJE);
    expect(lista.map(g => g.id)).toEqual(['3', '1', '2']);
  });
});

describe('SCI Report: quem pode ver', () => {
  it('confere o link e, com "Exigir senha", o login do cliente com este link', () => {
    expect(acessoDaArea('curto', { existe: true }, null)).toBe('link invalido');
    expect(acessoDaArea(TOKEN, null, null)).toBe('link invalido');
    expect(acessoDaArea(TOKEN, { existe: true }, null)).toBe('liberado');
    expect(acessoDaArea(TOKEN, { existe: true, exigeSenha: true }, null)).toBe('precisa entrar');
    expect(acessoDaArea(TOKEN, { existe: true, exigeSenha: true }, { cliente: true, a: ['b'.repeat(40)] })).toBe('precisa entrar');
    expect(acessoDaArea(TOKEN, { existe: true, exigeSenha: true }, { cliente: true, a: [TOKEN] })).toBe('liberado');
  });
});

/** a SCI de mentira: responde pelo caminho e anota cada chamada */
function sciFalsa(rotas: (url: URL, metodo: string, auth: string) => { status: number; corpo?: unknown }) {
  const chamadas: { metodo: string; url: string; auth: string }[] = [];
  const buscar: BuscarNoSci = async (url, init) => {
    const auth = init.headers.Authorization ?? '';
    chamadas.push({ metodo: init.method, url, auth });
    const r = rotas(new URL(url), init.method, auth);
    return { status: r.status, json: async () => r.corpo };
  };
  return { buscar, chamadas };
}

describe('SCI Report: o cliente da API', () => {
  const SEGREDOS = { parceiro: 'parceiro', cliente: 'cliente' };

  it('entra com Basic (parceiro:cliente), guarda o JWT e pagina as publicações', async () => {
    const { buscar, chamadas } = sciFalsa(url => {
      if (url.pathname.endsWith('/credencial/login')) return { status: 201, corpo: { token: 'jwt1', validade: 3600 } };
      const p = Number(url.searchParams.get('page'));
      return { status: 200, corpo: pagina([linha({ publicadosId: p, empresaId: p === 2 ? 99 : 7 })], p, 2) };
    });
    const sci = criarClienteSciReport({ buscar, segredos: () => SEGREDOS, agora: () => 0 });
    const lista = await sci.publicacoes(7, '2026-09', '2026-11');
    expect(lista.map(p => p.publicadosId)).toEqual([1]); // a da página 2 é de outra empresa: fica de fora
    expect(chamadas[0]).toEqual({ metodo: 'POST', url: SCI_AUTH + '/api/v1/auth/credencial/login', auth: 'Basic ' + btoa('parceiro:cliente') });
    expect(chamadas.slice(1).every(c => c.url.startsWith(SCI_RELATORIO + '/api/v1/publicados/busca?') && c.auth === 'Bearer jwt1')).toBe(true);
    expect(chamadas.filter(c => c.url.includes('/login'))).toHaveLength(1);
  });

  it('perto de vencer, renova pelo refresh; com 401, entra de novo uma vez', async () => {
    let t = 0;
    let recusar = false;
    const { buscar, chamadas } = sciFalsa((url, _m, auth) => {
      if (url.pathname.endsWith('/credencial/login')) return { status: 201, corpo: { token: 'jwt-login', validade: 3600 } };
      if (url.pathname.endsWith('/refresh')) return { status: 201, corpo: { token: 'jwt-refresh', validade: 3600 } };
      if (recusar && auth === 'Bearer jwt-refresh') return { status: 401, corpo: { mensagem: 'Token expirado' } };
      return { status: 204 };
    });
    const sci = criarClienteSciReport({ buscar, segredos: () => SEGREDOS, agora: () => t });
    await sci.publicacoes(7, '2026-09', '2026-11');
    t = 3_600_000 - 60_000; // falta 1 minuto
    await sci.publicacoes(7, '2026-09', '2026-11');
    expect(chamadas.map(c => new URL(c.url).pathname.split('/').pop())).toEqual(['login', 'busca', 'refresh', 'busca']);
    recusar = true;
    await sci.publicacoes(7, '2026-09', '2026-11');
    // o 401 derruba a sessão: entra de novo com os tokens (o refresh não serve para um JWT recusado)
    expect(chamadas.slice(4).map(c => new URL(c.url).pathname.split('/').pop())).toEqual(['busca', 'login', 'busca']);
  });

  it('tokens recusados viram erro sem mostrar os tokens', async () => {
    const { buscar } = sciFalsa(() => ({ status: 401, corpo: { mensagem: 'Credenciais inválidas.' } }));
    const sci = criarClienteSciReport({ buscar, segredos: () => SEGREDOS });
    const erro = await sci.publicacoes(7, '2026-09', '2026-11').catch(e => e);
    expect(erro).toBeInstanceOf(ErroDoSci);
    expect(erro.status).toBe(401);
    expect(String(erro.message)).not.toMatch(/parceiro|cliente:/);
    await expect(criarClienteSciReport({ buscar, segredos: () => ({ parceiro: '', cliente: '' }) }).publicacoes(7, '2026-09', '2026-11')).rejects.toThrow('faltam os tokens');
  });

  it('acha a empresa pelo CNPJ uma vez só (guarda na memória)', async () => {
    const { buscar, chamadas } = sciFalsa(url => url.pathname.endsWith('/credencial/login')
      ? { status: 201, corpo: { token: 'jwt', validade: 3600 } }
      : { status: 200, corpo: { empresas: [{ empresaId: 7, nome: 'EMPRESA TESTE LTDA', numeroDocumento: CNPJ }] } });
    const sci = criarClienteSciReport({ buscar, segredos: () => SEGREDOS, agora: () => 0 });
    expect(await sci.empresaPeloDocumento('12.345.678/0001-90')).toBe(7);
    expect(await sci.empresaPeloDocumento(CNPJ)).toBe(7);
    expect(chamadas.filter(c => c.url.includes('/empresa/busca/'))).toHaveLength(1);
    // a SCI só acha o CNPJ formatado (26/11/2026)
    expect(new URL(chamadas.find(c => c.url.includes('/empresa/busca/'))!.url).searchParams.get('numeroDocumento')).toBe('12.345.678/0001-90');
  });
});

describe('SCI Report: o atendimento da Área do Cliente', () => {
  const sci = (pdfs: string[] = []) => ({
    empresaPeloDocumento: async (d: string) => (d === CNPJ ? 7 : null),
    publicacoes: async (empresaId: number, _de: string, _ate: string, publicadosId?: number) => [
      lerPublicacaoDoSci(linha({ publicadosId: 101, empresaId })) as PublicacaoDoSci,
      lerPublicacaoDoSci(linha({ publicadosId: 102, empresaId, dataPagamento: '2026-11-19' })) as PublicacaoDoSci,
    ].filter(p => !publicadosId || p.publicadosId === publicadosId),
    urlDoPdf: async (id: number) => { pdfs.push(String(id)); return 'https://s3.exemplo/' + id + '.pdf'; },
    publicar: async () => 1,
  });
  const deps = (link: { existe: boolean; exigeSenha?: boolean } | null, pdfs?: string[], config?: { ligado: boolean; empresas: number[] }) => ({
    sci: sci(pdfs),
    lerLink: async () => link,
    lerEmpresas: async () => [{ codigo: 583, cnpj: CNPJ }, { codigo: 602, cnpj: '98765432000110' }],
    lerLogin: async (id: string) => (id === 'login-bom' ? { cliente: true, a: [TOKEN] } : null),
    ...(config ? { config: async () => config } : {}),
  });

  it('com o SCI desligado na configuração, não pergunta nada à SCI; só as empresas ligadas vão', async () => {
    expect(await criarAtendimentoDaArea(deps({ existe: true }, [], { ligado: false, empresas: [583] })).guias(TOKEN, '', HOJE))
      .toEqual({ acesso: 'liberado', guias: [], semEmpresaNoSci: 0, desligado: true });
    // só a 602 ligada: o CNPJ dela não está no SCI (o falso só conhece o da 583)
    expect(await criarAtendimentoDaArea(deps({ existe: true }, [], { ligado: true, empresas: [602] })).guias(TOKEN, '', HOJE))
      .toEqual({ acesso: 'liberado', guias: [], semEmpresaNoSci: 1 });
    expect(await criarAtendimentoDaArea(deps({ existe: true }, [], { ligado: true, empresas: [602] })).pdf(TOKEN, '', '101', HOJE)).toEqual({ acesso: 'guia de outra empresa' });
  });

  it('devolve as guias das empresas do link e conta as que não estão no SCI', async () => {
    const r = await criarAtendimentoDaArea(deps({ existe: true })).guias(TOKEN, '', HOJE);
    expect(r).toMatchObject({ acesso: 'liberado', semEmpresaNoSci: 1 });
    expect(r.acesso === 'liberado' && r.guias.map(g => [g.id, g.situacao])).toEqual([['101', 'vencida'], ['102', 'pagamento informado']]);
  });

  it('não pergunta à SCI sem o link ou sem a senha', async () => {
    expect(await criarAtendimentoDaArea(deps(null)).guias(TOKEN, '', HOJE)).toEqual({ acesso: 'link invalido' });
    expect(await criarAtendimentoDaArea(deps({ existe: true, exigeSenha: true })).guias(TOKEN, '', HOJE)).toEqual({ acesso: 'precisa entrar' });
    expect((await criarAtendimentoDaArea(deps({ existe: true, exigeSenha: true })).guias(TOKEN, 'login-bom', HOJE)).acesso).toBe('liberado');
  });

  it('o PDF só sai para a guia de uma empresa do link', async () => {
    const pdfs: string[] = [];
    const a = criarAtendimentoDaArea(deps({ existe: true }, pdfs));
    expect(await a.pdf(TOKEN, '', '101', HOJE)).toEqual({ acesso: 'liberado', url: 'https://s3.exemplo/101.pdf' });
    expect(await a.pdf(TOKEN, '', '555', HOJE)).toEqual({ acesso: 'guia de outra empresa' });
    expect(await a.pdf(TOKEN, '', 'abc', HOJE)).toEqual({ acesso: 'guia de outra empresa' });
    expect(pdfs).toEqual(['101']);
  });
});

describe('SCI Report: o número da publicação manual (26/11/2026)', () => {
  it('acha o publicadosId em qualquer nível da resposta', async () => {
    const { publicadosIdDaResposta } = await import('./sciReportCliente');
    expect(publicadosIdDaResposta({ publicados: [{ publicadosId: 7 }] })).toBe(7);
    expect(publicadosIdDaResposta({ dados: { publicados: [{ publicadosId: '51643495' }] } })).toBe(51643495);
    expect(publicadosIdDaResposta({ retorno: { publicadosId: 9 } })).toBe(9);
    expect(publicadosIdDaResposta({ mensagem: 'ok' })).toBe(0);
  });
});
