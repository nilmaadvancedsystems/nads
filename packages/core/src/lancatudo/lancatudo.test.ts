// O Lançatudo: o motor de regras, a conta aprendida, a montagem do Registro e a exportação para o Alterdata.
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import type { ContaDoPlano } from '../empresas/cadastro/tipos';
import type { EmpresaExtrator, Lancamento } from '../extratudo/extrator/tipos';
import {
  chaveDoFavorecido, chavesDasLinhas, mesesComExtrato, configDoDocumento, configVazia, criarRegra, dadosDoBanco, documentoDaConfig, documentoDoMes, editarHistorico, editarRegra,
  contaDoBancoNaConfig, definirContaDoBanco, escolherConta, excluirRegras, gravarLinha, expressaoCasa, ignorarLinha, lancamentosParaImportar, mesDoDocumento, mesVazio, montarRegistro, percentualConciliado,
  planilhaDaConferencia, problemaDaRegra, regraDaLinha, regraSugerida, registrarExportacao, removerConta, totaisDoRegistro, voltarAoAutomatico,
  type DadosDaRegra, type DadosDoBanco, type RegraDoLancatudo,
} from './index';

const AGORA = new Date('2026-11-17T12:00:00Z');
const regra = (r: Partial<RegraDoLancatudo> & Pick<RegraDoLancatudo, 'expressao' | 'conta'>): RegraDoLancatudo => ({
  id: r.id || 'r' + r.expressao, tipo: 'historico', sentido: 'ambos', comHistoricoDoExtrato: false, criadaEm: '2026-11-01T00:00:00Z', por: 'Teste', ...r,
});
const dados = (extrato: Lancamento[], extra: Partial<DadosDoBanco> = {}): DadosDoBanco => ({ extrato, razaoDoMes: [], modelos: [], razaoInvertido: false, ...extra });

const PLANO: ContaDoPlano[] = [
  { codigo: '10503', nome: 'Banco Sicoob', classificacao: '1.1.1.02.003', ordem: 1 },
  { codigo: '10101', nome: 'Caixa Geral', classificacao: '1.1.1.01.001', ordem: 2 },
  { codigo: '81012', nome: 'Tarifas bancárias', classificacao: '4.1.2.01.012', ordem: 3 },
  { codigo: '32016', nome: 'Fornecedor Beta', classificacao: '2.1.1.01.016', ordem: 4 },
  { codigo: '30000', nome: 'FORNECEDORES', classificacao: '2.1.1.01', sintetica: true, ordem: 5 },
];

const EXTRATO: Lancamento[] = [
  { data: '2026-09-02', valor: 1250000, historico: 'PIX RECEBIDO CLIENTE ALFA LTDA' },
  { data: '2026-09-03', valor: -345090, historico: 'PAGTO BOLETO FORNECEDOR BETA 0 123456' },
  { data: '2026-09-05', valor: -8990, historico: 'TARIFA COBRANCA' },
  { data: '2026-09-05', valor: -8990, historico: 'TARIFA COBRANCA' },
  { data: '2026-09-09', valor: -50000, historico: 'PIX EMIT 12.345.678/0001-90 ACME SA' },
];

describe('a expressão da regra', () => {
  it('acha o texto no histórico sem acento e sem caixa, com * no meio', () => {
    expect(expressaoCasa({ tipo: 'historico', expressao: 'tarifa cobrança' }, 'TARIFA COBRANCA 09/2026')).toBe(true);
    expect(expressaoCasa({ tipo: 'historico', expressao: 'PIX*RECEB' }, 'PIX - RECEBIDO JOAO')).toBe(true);
    expect(expressaoCasa({ tipo: 'historico', expressao: 'RECEB*PIX' }, 'PIX RECEBIDO JOAO')).toBe(false);
    expect(expressaoCasa({ tipo: 'historico', expressao: '*' }, 'QUALQUER')).toBe(false);
  });
  it('o favorecido pelo nome (todas as palavras, qualquer ordem) ou pelo CPF/CNPJ com ou sem pontuação', () => {
    expect(expressaoCasa({ tipo: 'favorecido', expressao: 'Silva João' }, 'PIX EMIT JOAO DA SILVA')).toBe(true);
    expect(expressaoCasa({ tipo: 'favorecido', expressao: 'João Souza' }, 'PIX EMIT JOAO DA SILVA')).toBe(false);
    expect(expressaoCasa({ tipo: 'favorecido', expressao: '12345678000190' }, 'PIX EMIT 12.345.678/0001-90 ACME')).toBe(true);
    expect(expressaoCasa({ tipo: 'favorecido', expressao: '12.345.678/0001-90' }, 'TED 12345678000190')).toBe(true);
    expect(expressaoCasa({ tipo: 'favorecido', expressao: '12345678000190' }, 'TED 123456780001901')).toBe(false);
  });
  it('vale a da conta bancária antes da de todas, depois a mais longa; o sentido conta', () => {
    const regras = [
      regra({ id: 'a', expressao: 'TARIFA', conta: '81000' }),
      regra({ id: 'b', expressao: 'TARIFA COBRANCA', conta: '81012', sentido: 'saida' }),
      regra({ id: 'c', expressao: 'TARIFA', conta: '81099', banco: 'sicoob' }),
      regra({ id: 'd', expressao: 'TARIFA COBRANCA', conta: '70000', sentido: 'entrada' }),
    ];
    const l = { historico: 'TARIFA COBRANCA', valor: -100 };
    expect(regraDaLinha(regras, l, 'sicoob')?.id).toBe('c');
    expect(regraDaLinha(regras, l, 'itau')?.id).toBe('b');
    expect(regraDaLinha(regras, { ...l, valor: 100 }, 'itau')?.id).toBe('d');
  });
  it('a regra sugerida pela linha: o CNPJ quando tem; senão o histórico sem números', () => {
    expect(regraSugerida({ historico: 'PIX EMIT 12.345.678/0001-90 ACME', valor: -1 })).toEqual({ tipo: 'favorecido', expressao: '12345678000190', sentido: 'saida' });
    expect(regraSugerida({ historico: 'Tarifa cobrança 09/2026 0', valor: -1 })).toEqual({ tipo: 'historico', expressao: 'TARIFA COBRANÇA', sentido: 'saida' });
  });
});

describe('a chave do favorecido (o que o nads aprende)', () => {
  it('o documento quando tem; senão o nome sem as palavras da transação', () => {
    expect(chaveDoFavorecido('PIX EMIT 123.456.789-09 MARIA')).toBe('doc:12345678909');
    expect(chaveDoFavorecido('PIX EMIT JOAO DA SILVA 0001')).toBe('nome:joao silva');
    expect(chaveDoFavorecido('TED JOAO SILVA')).toBe('nome:joao silva');
    expect(chaveDoFavorecido('PIX RECEBIDO')).toBe('nome:pix recebido');
    expect(chaveDoFavorecido('123 456')).toBeNull();
  });
});

describe('o Registro do mês', () => {
  const base = { banco: 'sicoob', contaDoBanco: '10503', plano: PLANO };

  it('a chave da linha separa as repetidas do mesmo dia e não muda com outra leitura', () => {
    const k = chavesDasLinhas(EXTRATO);
    expect(new Set(k).size).toBe(EXTRATO.length);
    expect(chavesDasLinhas(EXTRATO.map(l => ({ ...l })))).toEqual(k);
    expect(k[3].endsWith('-2')).toBe(true);
  });

  it('sem regra nem razão, tudo pendente; a regra concilia e põe o histórico', () => {
    const vazio = montarRegistro({ ...base, dados: dados(EXTRATO), config: configVazia(), decisoes: {} });
    expect(vazio.every(l => l.situacao === 'pendente' && l.conta === null)).toBe(true);
    const config = { ...configVazia(), regras: [regra({ expressao: 'TARIFA COBRANCA', conta: '81012', historico: 'Tarifa de cobrança', comHistoricoDoExtrato: false, codHistorico: '92060' })] };
    const linhas = montarRegistro({ ...base, dados: dados(EXTRATO), config, decisoes: {} });
    expect(linhas[2]).toMatchObject({ conta: '81012', nomeDaConta: 'Tarifas bancárias', origem: 'regra', situacao: 'conciliada', historico: 'Tarifa de cobrança', codHistorico: '92060' });
    expect(linhas[1].historico).toBe('PAGTO BOLETO FORNECEDOR BETA 123456');
  });

  it('a pessoa vale mais que a regra; tirar a conta deixa sem conta mesmo com regra; o automático volta', () => {
    const config = { ...configVazia(), regras: [regra({ expressao: 'TARIFA', conta: '81012' })] };
    const linhas0 = montarRegistro({ ...base, dados: dados(EXTRATO), config, decisoes: {} });
    let { mes } = escolherConta(mesVazio('2026-09'), config, 'sicoob', [linhas0[2]], '10101', AGORA, 'Ana');
    let linhas = montarRegistro({ ...base, dados: dados(EXTRATO), config, decisoes: mes.decisoes.sicoob });
    expect(linhas[2]).toMatchObject({ conta: '10101', origem: 'pessoa', situacao: 'conciliada', contaEscolhida: true });
    expect(linhas[1].contaEscolhida).toBeUndefined();
    mes = removerConta(mes, 'sicoob', linhas[2].chave, AGORA, 'Ana');
    linhas = montarRegistro({ ...base, dados: dados(EXTRATO), config, decisoes: mes.decisoes.sicoob });
    expect(linhas[2]).toMatchObject({ conta: null, situacao: 'pendente', contaEscolhida: true });
    mes = voltarAoAutomatico(mes, 'sicoob', linhas[2].chave);
    linhas = montarRegistro({ ...base, dados: dados(EXTRATO), config, decisoes: mes.decisoes.sicoob || {} });
    expect(linhas[2]).toMatchObject({ conta: '81012', origem: 'regra' });
  });

  it('o nads aprende o favorecido e usa no mês seguinte (no mesmo sentido)', () => {
    const linhas0 = montarRegistro({ ...base, dados: dados(EXTRATO), config: configVazia(), decisoes: {} });
    const { config } = escolherConta(mesVazio('2026-09'), configVazia(), 'sicoob', [linhas0[4]], '32016', AGORA, 'Ana');
    const outubro: Lancamento[] = [
      { data: '2026-10-09', valor: -70000, historico: 'TED 12345678000190 ACME S/A' },
      { data: '2026-10-10', valor: 70000, historico: 'TED 12345678000190 ACME S/A' },
    ];
    const linhas = montarRegistro({ ...base, dados: dados(outubro), config, decisoes: {} });
    expect(linhas[0]).toMatchObject({ conta: '32016', origem: 'lembrada', situacao: 'conciliada' });
    expect(linhas[1].conta).toBeNull();
  });

  it('a conta fora do plano ou sintética deixa a linha pendente, com o motivo', () => {
    const config = { ...configVazia(), regras: [regra({ expressao: 'TARIFA', conta: '99999' }), regra({ expressao: 'PAGTO BOLETO', conta: '30000' })] };
    const linhas = montarRegistro({ ...base, dados: dados(EXTRATO), config, decisoes: {} });
    expect(linhas[2]).toMatchObject({ situacao: 'pendente', problema: 'A conta 99999 não está no plano de contas' });
    expect(linhas[1].problema).toMatch(/sintética/);
    // sem plano, qualquer código vale
    expect(montarRegistro({ ...base, plano: null, dados: dados(EXTRATO), config, decisoes: {} })[2].situacao).toBe('conciliada');
  });

  it('a sugestão pelo razão fica "sugerida"; o que já está no razão do mês sai da exportação', () => {
    // o razão da conciliação do Alterdata: crédito positivo (a saída do banco), com a contrapartida
    const modelos: Lancamento[] = [
      { data: '2026-08-05', valor: 8990, historico: 'Tarifas bancárias', conta: '81012', complemento: 'TARIFA COBRANCA' },
      { data: '2026-08-02', valor: -900000, historico: 'Cliente Alfa', conta: '11201', complemento: 'PIX RECEBIDO CLIENTE ALFA LTDA' },
    ];
    const razaoDoMes: Lancamento[] = [{ data: '2026-09-02', valor: -1250000, historico: 'Cliente Alfa', conta: '11201', complemento: 'PIX RECEBIDO CLIENTE ALFA LTDA' }];
    const linhas = montarRegistro({ ...base, plano: null, dados: dados(EXTRATO, { modelos, razaoDoMes, razaoInvertido: true }), config: configVazia(), decisoes: {} });
    expect(linhas[0]).toMatchObject({ situacao: 'no-razao', conta: '11201', nomeDaConta: 'Cliente Alfa', origem: 'lancada' });
    expect(linhas[2]).toMatchObject({ conta: '81012', origem: 'razao', situacao: 'sugerida' });
    expect(lancamentosParaImportar(linhas)).toHaveLength(0);
    expect(lancamentosParaImportar(linhas, true).length).toBeGreaterThanOrEqual(2);
  });

  it('ignorar tira da exportação; os totais e o percentual', () => {
    const config = { ...configVazia(), regras: [regra({ expressao: 'TARIFA', conta: '81012' })] };
    const l0 = montarRegistro({ ...base, dados: dados(EXTRATO), config, decisoes: {} });
    const mes = ignorarLinha(mesVazio('2026-09'), 'sicoob', l0[0].chave, true, AGORA, 'Ana');
    const linhas = montarRegistro({ ...base, dados: dados(EXTRATO), config, decisoes: mes.decisoes.sicoob });
    const t = totaisDoRegistro(linhas);
    expect(t).toMatchObject({ linhas: 5, conciliadas: 2, ignoradas: 1, pendentes: 2, entradas: 1250000, saidas: 345090 + 8990 * 2 + 50000 });
    expect(percentualConciliado(t)).toBe(60);
    expect(ignorarLinha(mes, 'sicoob', l0[0].chave, false, AGORA, 'Ana').decisoes.sicoob).toEqual({});
  });

  it('o histórico editado vale e some quando volta a vazio', () => {
    const l0 = montarRegistro({ ...base, dados: dados(EXTRATO), config: configVazia(), decisoes: {} });
    let mes = editarHistorico(mesVazio('2026-09'), 'sicoob', l0[1].chave, 'Pagto. NF 123 de Beta', AGORA, 'Ana');
    expect(montarRegistro({ ...base, dados: dados(EXTRATO), config: configVazia(), decisoes: mes.decisoes.sicoob })[1].historico).toBe('Pagto. NF 123 de Beta');
    mes = editarHistorico(mes, 'sicoob', l0[1].chave, '  ', AGORA, 'Ana');
    expect(mes.decisoes.sicoob).toEqual({});
  });
});

describe('o Gravar da janela da linha', () => {
  const base = { banco: 'sicoob', contaDoBanco: '10503', plano: null };
  it('grava a conta (e aprende), o histórico e o histórico padrão; o que não mudou não fica guardado', () => {
    const config = { ...configVazia(), regras: [regra({ expressao: 'TARIFA', conta: '81012', codHistorico: '92060' })] };
    const l0 = montarRegistro({ ...base, dados: dados(EXTRATO), config, decisoes: {} });
    // a tarifa já vem pela regra: gravar sem mudar nada não guarda nada
    expect(gravarLinha(mesVazio('2026-09'), config, 'sicoob', l0[2], { conta: '81012', historico: l0[2].historico, codHistorico: '92060', documento: '' }, AGORA, 'Ana').mes.decisoes).toEqual({});
    const r = gravarLinha(mesVazio('2026-09'), config, 'sicoob', l0[1], { conta: '32016', historico: 'Pagto. Beta', codHistorico: '10111', documento: '123456' }, AGORA, 'Ana');
    const l1 = montarRegistro({ ...base, dados: dados(EXTRATO), config: r.config, decisoes: r.mes.decisoes.sicoob });
    expect(l1[1]).toMatchObject({ conta: '32016', origem: 'pessoa', historico: 'Pagto. Beta', codHistorico: '10111', documento: '123456', situacao: 'conciliada' });
    expect(lancamentosParaImportar(l1).find(x => x.debito === '32016')?.documento).toBe('123456');
    expect(Object.keys(r.config.lembradas)).toHaveLength(1);
    // o código vazio vale mais que o da regra; a conta vazia deixa sem conta
    const r2 = gravarLinha(mesVazio('2026-09'), config, 'sicoob', l0[2], { conta: '', historico: l0[2].historico, codHistorico: '', documento: '' }, AGORA, 'Ana');
    expect(montarRegistro({ ...base, dados: dados(EXTRATO), config, decisoes: r2.mes.decisoes.sicoob })[2]).toMatchObject({ conta: null, codHistorico: '' });
    expect(mesDoDocumento(documentoDoMes(r2.mes), '2026-09')).toEqual(r2.mes);
    // a sugerida pelo razão, gravada sem mudar nada, fica conciliada (escolhida) e o nads aprende
    const sugerida = { ...l0[0], conta: '11201', origem: 'razao' as const };
    const r3 = gravarLinha(mesVazio('2026-09'), config, 'sicoob', sugerida, { conta: '11201', historico: sugerida.historico, codHistorico: '', documento: '' }, AGORA, 'Ana');
    expect(r3.mes.decisoes.sicoob[sugerida.chave].conta).toBe('11201');
    expect(Object.keys(r3.config.lembradas)).toHaveLength(1);
  });
});

describe('o extrato e o razão do banco no Extrator', () => {
  it('pega só o banco e o mês, e o razão com contrapartida vira modelo', () => {
    const e: EmpresaExtrator = {
      nome: 'X', auditoria: [], arquivos: [
        { id: 'a', lado: 'banco', nome: 'set.pdf', importadoEm: '', modo: 'primeira', banco: 'sicoob', lancamentos: [EXTRATO[0], { data: '2026-10-01', valor: 1, historico: 'OUTUBRO' }] },
        { id: 'b', lado: 'banco', nome: 'itau.pdf', importadoEm: '', modo: 'primeira', banco: 'itau', lancamentos: [EXTRATO[1]] },
        { id: 'c', lado: 'sistema', nome: 'razao.xls', importadoEm: '', modo: 'primeira', banco: 'sicoob', lancamentos: [{ data: '2026-08-05', valor: 8990, historico: 'Tarifas', conta: '81012' }] },
      ],
    };
    const d = dadosDoBanco(e, 'sicoob', 'sicoob', '2026-09');
    expect(d.extrato).toEqual([EXTRATO[0]]);
    expect(d.razaoDoMes).toEqual([]);
    expect(d.modelos).toHaveLength(1);
    expect(d.razaoInvertido).toBe(true);
    // os meses com extrato do banco, o mais novo primeiro (o razão não conta)
    expect(mesesComExtrato(e, 'sicoob', 'sicoob')).toEqual(['2026-10', '2026-09']);
    expect(mesesComExtrato(e, 'bradesco', 'sicoob')).toEqual([]);
  });
});

describe('a exportação para o Alterdata', () => {
  const config = { ...configVazia(), regras: [regra({ expressao: 'TARIFA', conta: '81012' }), regra({ expressao: 'CLIENTE ALFA', conta: '11201', tipo: 'favorecido' })] };
  const linhas = montarRegistro({ banco: 'sicoob', contaDoBanco: '10503', plano: null, dados: dados(EXTRATO), config, decisoes: {} });

  it('entrada: D banco / C contrapartida; saída: D contrapartida / C banco', () => {
    const l = lancamentosParaImportar(linhas);
    expect(l[0]).toEqual({ automatico: '', data: '02/09/2026', debito: '10503', credito: '11201', codHistorico: '', historico: 'PIX RECEBIDO CLIENTE ALFA LTDA', valor: 12500, documento: '' });
    expect(l[1]).toMatchObject({ debito: '81012', credito: '10503', valor: 89.9 });
    expect(l).toHaveLength(3);
  });

  it('a Simples Conferência: duas linhas por lançamento, com a classificação do plano', () => {
    const plano = [...PLANO, { codigo: '11201', nome: 'Cliente Alfa', classificacao: '1.1.2.01.001', ordem: 9 }];
    const wb = XLSX.read(planilhaDaConferencia(linhas, plano), { type: 'array' });
    const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    expect(aoa[0]).toEqual(['Data', 'Histórico', 'Débito', 'Crédito', 'Conta', 'Classificação', 'Nome da conta']);
    expect(aoa).toHaveLength(1 + 3 * 2);
    expect(aoa[1]).toEqual(['02/09/2026', 'PIX RECEBIDO CLIENTE ALFA LTDA', 12500, '', 10503, '1.1.1.02.003', 'Banco Sicoob']);
    expect(aoa[2].slice(3, 7)).toEqual([12500, 11201, '1.1.2.01.001', 'Cliente Alfa']);
  });
});

describe('as regras da empresa', () => {
  const dadosDaRegra: DadosDaRegra = { tipo: 'historico', expressao: ' TARIFA ', sentido: 'saida', conta: '81012', comHistoricoDoExtrato: true, historico: '', banco: '' };
  it('o que falta para gravar', () => {
    expect(problemaDaRegra({ ...dadosDaRegra, expressao: ' ' })).toMatch(/histórico do banco/);
    expect(problemaDaRegra({ ...dadosDaRegra, expressao: '**' })).toMatch(/só \*/);
    expect(problemaDaRegra({ ...dadosDaRegra, conta: '1.1.2' })).toMatch(/código reduzido/);
    expect(problemaDaRegra({ ...dadosDaRegra, codHistorico: 'abc' })).toMatch(/código do histórico/);
    expect(problemaDaRegra(dadosDaRegra)).toBeNull();
  });
  it('criar limpa os campos vazios; excluir tira', () => {
    const c = criarRegra(configVazia(), dadosDaRegra, AGORA, 'Ana');
    expect(c.regras[0]).toEqual({ id: c.regras[0].id, tipo: 'historico', expressao: 'TARIFA', sentido: 'saida', conta: '81012', comHistoricoDoExtrato: true, criadaEm: AGORA.toISOString(), por: 'Ana' });
    const c2 = criarRegra(c, dadosDaRegra, AGORA, 'Ana');
    expect(c2.regras[1].id).not.toBe(c2.regras[0].id);
    expect(excluirRegras(c2, [c2.regras[0].id]).regras).toHaveLength(1);
  });

  it('alterar mantém quem criou e guarda quem alterou (18/11/2026: "coloca o nome de quem criou")', () => {
    const c = criarRegra(configVazia(), dadosDaRegra, AGORA, 'Ana');
    const depois = new Date('2026-11-20T10:00:00Z');
    const r = editarRegra(c, c.regras[0].id, { ...dadosDaRegra, conta: '81013' }, 'Bia', depois).regras[0];
    expect([r.por, r.criadaEm, r.alteradaPor, r.alteradaEm, r.conta]).toEqual(['Ana', AGORA.toISOString(), 'Bia', depois.toISOString(), '81013']);
  });
});

describe('o documento no banco', () => {
  it('ida e volta, e o documento estragado não quebra', () => {
    let c = criarRegra(configVazia(), { tipo: 'favorecido', expressao: 'ACME', sentido: 'ambos', conta: '32016', comHistoricoDoExtrato: false }, AGORA, 'Ana');
    c = escolherConta(mesVazio('2026-09'), c, 'sicoob', [{ chave: 'k-1', historicoDoBanco: 'TED ACME', valor: -1 }], '32016', AGORA, 'Ana').config;
    expect(configDoDocumento(documentoDaConfig(c))).toEqual(c);
    let m = escolherConta(mesVazio('2026-09'), c, 'sicoob', [{ chave: 'k-1', historicoDoBanco: 'TED ACME', valor: -1 }], '32016', AGORA, 'Ana').mes;
    m = registrarExportacao(m, { em: AGORA.toISOString(), por: 'Ana', banco: 'sicoob', quantidade: 3, destino: 'arquivo' });
    expect(mesDoDocumento(documentoDoMes(m), '2026-09')).toEqual(m);
    expect(configDoDocumento({ regras: [{ id: 1 }, null, 'x'], lembradas: { a: 1 } })).toEqual(configVazia());
    expect(mesDoDocumento(null, '2026-09')).toEqual(mesVazio('2026-09'));
  });
  it('o código contábil do banco escolhido no Lançatudo: só dígitos, vale sem o do Cadastro, vai e volta do banco', () => {
    const c = definirContaDoBanco(configVazia(), 'sicoob', '1.05.03');
    expect(c.contasDosBancos).toEqual({ sicoob: '10503' });
    expect(contaDoBancoNaConfig(c, 'sicoob', '')).toBe('10503');
    expect(contaDoBancoNaConfig(c, 'sicoob', '11111')).toBe('11111');
    expect(contaDoBancoNaConfig(c, 'bb', undefined)).toBe('');
    expect(configDoDocumento(documentoDaConfig(c))).toEqual(c);
    expect(definirContaDoBanco(c, 'sicoob', '').contasDosBancos).toEqual({});
  });
});
