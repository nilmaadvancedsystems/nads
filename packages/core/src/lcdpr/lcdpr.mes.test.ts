// O LCDPR mês a mês (11/11/2026): o mês guardado, a conta de pagamento (o Caixa ou um banco do produtor), a conta lembrada
// por fornecedor e as notas puxadas do SIEG (o resumo do "Baixar XMLs do SIEG"), com notas fictícias.
import { describe, expect, it } from 'vitest';
import type { NotaDoSieg, NotasSieg } from '../tarefas/sieg';
import {
  aplicarAutomatico, aplicarContaCredora, aplicarHistoricoPadrao, comContaDosFornecedores, configPadrao, contasDaPesquisa, historicosDaPesquisa, imoveisDaPesquisa,
  lancamentoDoRascunho, mudarNoRascunho, nomeNaPesquisa, pesquisar, problemasDoRascunho, rascunhoDoLancamento, rascunhoNovo, contasDePagamento, contasDoDocumento, documentoDoMes, juntarNoMes, lembrarContas, lerDoSieg,
  linhasDaPlanilha, marcaDaConta, mesDoDocumento, notaDoLancamento, semEntidades, alternarMes, baseDoMes, mesDoId, mesesAte, mesesDoAno, porMes, mesVazio, proximoIdDoMes, resumoServeParaOLcdpr, rotuloDaConta, situacaoDoMes, type Lancamento,
} from '.';

const ids = () => { let n = 1; return () => n++; };
const posto = { doc: '11222333000181', nome: 'POSTO FICTICIO LTDA' };
const produtor = { doc: '52998224725', nome: 'PRODUTOR FICTICIO' };

/** uma NF-e recebida do resumo do SIEG */
const nfe = (o: Partial<NotaDoSieg> = {}): NotaDoSieg => ({
  tipo: 'NF-e', chave: 'K1', numero: '123', serie: '1', data: '15/10/2026', emitente: posto, destinatario: produtor, valor: 1000,
  itens: [{ ncm: '27101921', cfop: '5656', cst: '060', cest: '', valor: 900 }, { ncm: '84212300', cfop: '5102', cst: '000', cest: '', valor: 100 }],
  ieDest: '0011288860404', produto: 'OLEO DIESEL S10 | FILTRO', ...o,
});
const resumo = (recebidas: NotaDoSieg[], o: Partial<NotasSieg> = {}): NotasSieg => ({
  codigo: '62', competencia: '2026-10', em: '2026-11-01T10:00:00Z', pasta: '', arquivos: 0, novos: 0, emitidas: [], recebidas, resumo: 6, ...o,
});

describe('as notas puxadas do SIEG', () => {
  it('a NF-e de compra vira o lançamento: classificada pelo NCM que pesa mais, o imóvel pela IE e o produto', () => {
    const r = lerDoSieg(resumo([nfe()]), configPadrao(), ids());
    expect(r.notas).toBe(1);
    const l = r.lancamentos[0];
    expect([l.origem, l.data, l.documento, l.cnpj, l.fornecedor, l.valor]).toEqual(['NF', '2026-10-15', '123', '11222333000181', 'POSTO FICTICIO LTDA', 1000]);
    expect([l.contaDeved, l.codHist, l.origemRegra, l.revisar, l.categoria]).toEqual(['924', '00061', 'NCM', false, 'Combustíveis e Lubrificantes']);
    expect(l.historico).toBe('Pela compra de combustíveis/lubrificantes conf. nota fiscal 123 - POSTO FICTICIO LTDA - 11.222.333/0001-81');
    expect([l.imovel, l.produto, l.ncm, l.contaCred]).toEqual(['007', 'OLEO DIESEL S10 | FILTRO', '27101921, 84212300', '35']);
  });

  it('o CT-e tomado é frete; a cancelada e a nota de entrada (venda do produtor) ficam de fora; a NFS-e não entra', () => {
    const cte: NotaDoSieg = { tipo: 'CT-e', chave: 'C1', numero: '77', serie: '2', data: '20/10/2026', emitente: { doc: '11444777000161', nome: 'TRANSPORTADORA FICTICIA' }, destinatario: produtor, valor: 1234.56 };
    const r = lerDoSieg(resumo([
      nfe(), nfe({ chave: 'K2', numero: '124', cancelada: true }), nfe({ chave: 'K3', numero: '900', entrada: true }), cte,
      { tipo: 'NFS-e', chave: '', numero: '5', serie: '', data: '01/10/2026', emitente: posto, destinatario: produtor, valor: 50 },
    ]), configPadrao(), ids());
    expect([r.notas, r.fretes, r.canceladas, r.entradas]).toEqual([1, 1, 1, 1]);
    const f = r.lancamentos[1];
    expect([f.origem, f.documento, f.contaDeved, f.origemRegra, f.valor]).toEqual(['CTe', '77/2', '805', 'Padrão CT-e', 1234.56]);
  });

  it('a chave fica no lançamento e acha a nota para a DANFE; o do relatório acha pelo número e o emitente', () => {
    const res = resumo([nfe(), nfe({ chave: 'K2', numero: '124', serie: '2' })]);
    const [a, b] = lerDoSieg(res, configPadrao(), ids()).lancamentos;
    expect([a.chave, b.chave, notaDoLancamento(a, res)?.numero]).toEqual(['K1', 'K2', '123']);
    expect(mesDoDocumento(documentoDoMes({ ...mesVazio(62, '2026-10'), lancamentos: [a] }), 62, '2026-10').lancamentos[0].chave).toBe('K1');
    const doRelatorio = { origem: 'NF' as const, documento: '124/2', cnpj: '11.222.333/0001-81' };
    expect(notaDoLancamento(doRelatorio, res)?.chave).toBe('K2');
    expect([notaDoLancamento({ ...doRelatorio, origem: 'CTe' }, res), notaDoLancamento({ ...doRelatorio, origem: 'Manual' }, res), notaDoLancamento(a, null)]).toEqual([null, null, null]);
  });

  it('o nome com as entidades do XML sai limpo (no SIEG e no que já estava guardado no mês)', () => {
    const r = lerDoSieg(resumo([nfe({ emitente: { doc: posto.doc, nome: 'ALVES &amp; ALVES BATERIAS LTDA' }, produto: 'BATERIA 12V &#8211; 60A' })]), configPadrao(), ids());
    expect([r.lancamentos[0].fornecedor, r.lancamentos[0].produto]).toEqual(['ALVES & ALVES BATERIAS LTDA', 'BATERIA 12V – 60A']);
    expect(r.lancamentos[0].historico).toContain('ALVES & ALVES BATERIAS LTDA');
    const guardado = mesDoDocumento({ lancamentos: [{ ...lanc({ id: 1 }), fornecedor: 'A &amp; B', historico: 'Pela compra - A &amp; B' }] }, 62, '2026-10').lancamentos[0];
    expect([guardado.fornecedor, guardado.historico]).toEqual(['A & B', 'Pela compra - A & B']);
    expect([semEntidades('R&D &copy; &#x41;&#0;'), semEntidades('')]).toEqual(['R&D &copy; A&#0;', '']);
  });

  it('a nota sem itens (o resumo grande demais) vai para REVISAR e avisa; o resumo antigo não serve', () => {
    const r = lerDoSieg(resumo([nfe({ itens: undefined })], { itensCortados: true }), configPadrao(), ids());
    expect([r.semItens, r.lancamentos[0].revisar]).toEqual([true, true]);
    expect([resumoServeParaOLcdpr(resumo([])), resumoServeParaOLcdpr(resumo([], { resumo: 5 })), resumoServeParaOLcdpr(resumo([], { resumo: undefined })), resumoServeParaOLcdpr(null)]).toEqual([true, false, false, false]);
  });
});

const lanc = (o: Partial<Lancamento>): Lancamento => ({
  id: 1, origem: 'NF', data: '2026-10-15', documento: '123', cnpj: '11222333000181', fornecedor: 'POSTO', categoria: '', contaDeved: '924', contaCred: '35',
  codHist: '', historico: 'h', valor: 10, imovel: '001', tipoDoc: '1', tipoLanc: '2', produto: '', ncm: '', revisar: false, origemRegra: 'NCM', ...o,
});

describe('o mês guardado', () => {
  it('o documento volta igual, e o que não é lançamento fica de fora', () => {
    const m = { ...mesVazio(62, '2026-10'), lancamentos: [lanc({ id: 2026100003 }), lanc({ id: 2026100007, origem: 'CTe', revisar: true, origemRegra: 'Nenhuma' })], baixadaEm: '2026-11-02T10:00:00Z' };
    m.importacoes = [{ id: 'i1', arquivo: 'SIEG', bytes: 0, em: 'x', quantos: 2, repetidos: 0, erro: '', ids: [2026100003, 2026100007], desfeita: '', por: 'Ana' }];
    expect(mesDoDocumento(documentoDoMes(m), 62, '2026-10')).toEqual(m);
    const sujo = mesDoDocumento({ lancamentos: [{ id: 0 }, 'x', { id: 2, origem: 'outra', origemRegra: '??', valor: '12.5', cnpj: '11.222.333/0001-81' }], importacoes: [{}] }, 62, '2026-10');
    expect(sujo.lancamentos.map(l => [l.id, l.origem, l.origemRegra, l.valor, l.cnpj])).toEqual([[2026100002, 'NF', 'Nenhuma', 12.5, '11222333000181']]);
    expect(sujo.importacoes).toEqual([]);
    expect(mesDoDocumento(undefined, 62, '2026-10')).toEqual(mesVazio(62, '2026-10'));
  });

  it('importar de novo não duplica: o mesmo documento do mesmo fornecedor (do relatório ou do SIEG) fica uma vez só', () => {
    const atuais = [lanc({ id: 1, contaCred: '49' })];
    const r = juntarNoMes(atuais, [lanc({ id: 5, cnpj: '11.222.333/0001-81' }), lanc({ id: 6, documento: '124' }), lanc({ id: 7, documento: '124' }), lanc({ id: 8, origem: 'CTe' })]);
    expect([r.entraram.map(l => l.id), r.repetidos, r.lancamentos.map(l => l.id)]).toEqual([[6, 8], 2, [1, 6, 8]]);
    expect(r.lancamentos[0].contaCred).toBe('49');
    expect(proximoIdDoMes(r.lancamentos)).toBe(9);
    expect(proximoIdDoMes([])).toBe(1);
    expect([proximoIdDoMes([], '2026-10'), proximoIdDoMes([lanc({ id: 2026100041 })], '2026-10')]).toEqual([2026100001, 2026100042]);
  });

  it('mais de um mês aberto: o id diz o mês, os guardados antes ganham a base, e o que entra vai para o mês da data', () => {
    expect([baseDoMes('2026-10'), mesDoId(2026100005), mesDoId(5)]).toEqual([2026100000, '2026-10', '']);
    const antigo = mesDoDocumento({ lancamentos: [{ ...lanc({ id: 4 }) }], importacoes: [{ id: 'i', ids: [4] }] }, 62, '2026-09');
    expect([antigo.lancamentos[0].id, antigo.importacoes[0].ids]).toEqual([2026090004, [2026090004]]);
    const mapa = porMes([lanc({ id: 1, data: '2026-09-30' }), lanc({ id: 2, data: '2026-10-01' }), lanc({ id: 3, data: '' }), lanc({ id: 4, data: '2025-01-01' })], ['2026-09', '2026-10'], '2026-10');
    expect([...mapa].map(([k, v]) => [k, v.map(l => l.id)])).toEqual([['2026-09', [1]], ['2026-10', [2, 3, 4]]]);
    expect(mesesAte('2026-02', 4)).toEqual(['2026-02', '2026-01', '2025-12', '2025-11']);
    expect(mesesAte('x', 3)).toEqual([]);
    expect(mesesDoAno('2026-03')).toEqual(['2026-01', '2026-02', '2026-03']);
    expect([alternarMes(['2026-10'], '2026-09'), alternarMes(['2026-09', '2026-10'], '2026-09'), alternarMes(['2026-10'], '2026-10')]).toEqual([['2026-09', '2026-10'], ['2026-10'], ['2026-10']]);
  });

  it('a situação: vazio, com o que revisar, pronto e a planilha baixada', () => {
    expect(situacaoDoMes({ lancamentos: [], baixadaEm: '' }).situacao).toBe('vazio');
    expect(situacaoDoMes({ lancamentos: [lanc({}), lanc({ revisar: true })], baixadaEm: 'x' })).toEqual({ situacao: 'revisar', rotulo: '1 para revisar' });
    expect(situacaoDoMes({ lancamentos: [lanc({})], baixadaEm: '' }).situacao).toBe('pronto');
    expect(situacaoDoMes({ lancamentos: [lanc({})], baixadaEm: 'x' }).situacao).toBe('baixado');
  });
});

describe('a conta de pagamento (o Caixa ou um banco do produtor)', () => {
  it('as contas: as "Disponível" do plano (o Caixa e os bancos), sem as sintéticas, e a padrão mesmo fora do plano', () => {
    const c = configPadrao();
    expect(contasDePagamento(c).map(x => x.codigo + ' ' + x.nome)).toEqual(['35 Caixa', '49 Banco do Brasil', '56 Banco Bradesco', '63 Banco do Nordeste', '71 Banco Sicoob']);
    c.planoContas = [...c.planoContas, { codigo: '80', nome: 'Bancos', classificacao: 'DISPONIVEL', tipo: 'S' }, { codigo: '81', nome: 'Caixa 2', classificacao: 'disponivel', tipo: '' }];
    c.config.contaCredoraPadrao = '99';
    expect(contasDePagamento(c).map(x => x.codigo)).toEqual(['99', '35', '49', '56', '63', '71', '81']);
    expect([rotuloDaConta(contasDePagamento(c), '49'), rotuloDaConta(contasDePagamento(c), '12')]).toEqual(['49 — Banco do Brasil', '12']);
  });

  it('o logo de cada conta de pagamento sai do nome (o Caixa não é a Caixa Econômica)', () => {
    expect(contasDePagamento(configPadrao()).map(c => marcaDaConta(c.nome))).toEqual(['', 'banco-do-brasil', 'bradesco', 'bnb', 'sicoob']);
    expect([marcaDaConta('Banco Nordeste do Brasil SA'), marcaDaConta('Caixa Econômica Federal')]).toEqual(['bnb', 'caixa']);
  });

  it('a conta escolhida vai para a Conta Credora da planilha', () => {
    const l = aplicarContaCredora(lanc({}), ' 56 ');
    expect(l.contaCred).toBe('56');
    expect(linhasDaPlanilha([l])[1][3]).toBe('56');
  });

  it('a conta fica lembrada por fornecedor e vem nos próximos lançamentos dele; voltar para a padrão esquece', () => {
    const vazia = {};
    const um = lembrarContas(vazia, [lanc({ contaCred: '49' }), lanc({ cnpj: '', contaCred: '56' })], '35');
    expect(um).toEqual({ '11222333000181': '49' });
    expect(lembrarContas(um, [lanc({ contaCred: '49' })], '35')).toBe(um);
    const novos = comContaDosFornecedores([lanc({ id: 2 }), lanc({ id: 3, cnpj: '99888777000166' })], um);
    expect(novos.map(l => l.contaCred)).toEqual(['49', '35']);
    expect(lembrarContas(um, [lanc({ contaCred: '35' })], '35')).toEqual({});
    expect(contasDoDocumento({ contas: { '11222333000181': '49', 'x': '1', '123': 5 } })).toEqual({ '11222333000181': '49' });
    expect(contasDoDocumento(null)).toEqual({});
  });
});

describe('o lançamento à mão (a janela do Alterdata)', () => {
  const plano = [
    { codigo: '7', nome: 'ATIVO', classificacao: '1', sintetica: true, ordem: 1 },
    { codigo: '35', nome: 'Caixa', classificacao: '1.1.1.01.001', ordem: 3 },
    { codigo: '28', nome: 'CAIXA', classificacao: '1.1.1.01', sintetica: true, ordem: 2 },
    { codigo: '49', nome: 'Banco do Brasil S/A', classificacao: '1.1.1.05.001', ordem: 4 },
    { codigo: '', nome: 'sem código', ordem: 5 },
  ];

  it('as contas vêm do plano da empresa (o do Alterdata), na ordem dele; sem ele, do plano do LCDPR', () => {
    const daEmpresa = contasDaPesquisa(configPadrao(), plano);
    expect(daEmpresa.map(x => x.codigo)).toEqual(['7', '28', '35', '49']);
    expect(daEmpresa[0]).toEqual({ codigo: '7', nome: 'ATIVO', detalhe: '1', sintetica: true });
    expect(contasDaPesquisa(configPadrao(), []).slice(0, 2).map(x => x.codigo + ' ' + x.nome)).toEqual(['35 Caixa', '49 Banco do Brasil']);
  });

  it('a pesquisa: pelo código, pela classificação ou por parte do nome, sem acento', () => {
    const contas = contasDaPesquisa(configPadrao(), plano);
    expect(pesquisar(contas, '4').map(x => x.codigo)).toEqual(['49']);
    expect(pesquisar(contas, '1.1.1.05').map(x => x.codigo)).toEqual(['49']);
    expect(pesquisar(contas, 'brasil').map(x => x.codigo)).toEqual(['49']);
    expect(pesquisar(historicosDaPesquisa(configPadrao()), 'combustiveis').map(x => x.codigo)).toEqual(['00061']);
    expect(pesquisar(contas, ' ').length).toBe(4);
    expect([nomeNaPesquisa(contas, '35'), nomeNaPesquisa(contas, '99')]).toEqual(['Caixa', '']);
    expect(imoveisDaPesquisa(configPadrao())[6]).toEqual({ codigo: '007', nome: 'FAZENDA UNIAO' });
  });

  it('o lançamento automático (a categoria) e o histórico padrão preenchem a conta e o texto', () => {
    const c = configPadrao();
    let r = { ...rascunhoNovo(c), documento: '55', fornecedor: 'CEMIG', cnpj: '06981180000116' };
    expect([r.contaCred, r.imovel, r.tipoDoc, r.tipoLanc]).toEqual(['35', '001', '1', '2']);
    r = aplicarAutomatico(r, 'Energia Elétrica', c);
    expect([r.automatico, r.contaDeved, r.codHist, r.historico]).toEqual(['Energia Elétrica', '966', '92023', 'Pelo pagamento de CEMIG']);
    r = aplicarHistoricoPadrao(r, '00061', historicosDaPesquisa(c));
    expect([r.codHist, r.historico]).toEqual(['00061', 'Pela compra de combustíveis/lubrificantes conf. nota fiscal 55 - CEMIG - 06.981.180/0001-16']);
    expect(aplicarHistoricoPadrao(r, '12345', historicosDaPesquisa(c)).codHist).toBe('12345');
    expect(aplicarAutomatico(r, '', c).automatico).toBe('');
  });

  it('o histórico se refaz quando o fornecedor, o documento ou o CPF/CNPJ chegam depois (menos o texto mudado à mão)', () => {
    const c = configPadrao();
    const hs = historicosDaPesquisa(c);
    let r = aplicarAutomatico(rascunhoNovo(c), 'Energia Elétrica', c);
    expect(r.historico).toBe('Pelo pagamento de');
    r = mudarNoRascunho(r, 'fornecedor', 'CEMIG', c, hs);
    expect(r.historico).toBe('Pelo pagamento de CEMIG');
    r = aplicarHistoricoPadrao(r, '00061', hs);
    r = mudarNoRascunho(mudarNoRascunho(r, 'documento', '77', c, hs), 'cnpj', '06981180000116', c, hs);
    expect(r.historico).toBe('Pela compra de combustíveis/lubrificantes conf. nota fiscal 77 - CEMIG - 06.981.180/0001-16');
    const aMao = mudarNoRascunho({ ...r, historico: 'Conta de luz' }, 'fornecedor', 'OUTRA', c, hs);
    expect([aMao.historico, aMao.fornecedor]).toEqual(['Conta de luz', 'OUTRA']);
    expect(mudarNoRascunho(r, 'valor', '10', c, hs).historico).toBe(r.historico);
  });

  it('o que falta para gravar, e a data tem que ser do mês aberto', () => {
    const c = configPadrao();
    expect(problemasDoRascunho(rascunhoNovo(c), '2026-10')).toEqual(['a data (dd/mm/aaaa)', 'o valor', 'a conta devedora', 'o histórico']);
    const ok = { ...rascunhoNovo(c), data: '05/10/2026', valor: '1.234,56', contaDeved: '966', historico: 'Energia', cnpj: '123' };
    expect(problemasDoRascunho(ok, '2026-10')).toEqual(['o CPF/CNPJ com 11 ou 14 dígitos']);
    expect(problemasDoRascunho({ ...ok, cnpj: '', data: '05/11/2026' }, '2026-10')).toEqual(['a data dentro de 10/2026']);
    expect(problemasDoRascunho({ ...ok, cnpj: '', data: '05/11/2026' }, ['2026-10', '2026-11'])).toEqual([]);
    expect(problemasDoRascunho({ ...ok, cnpj: '', data: '05/12/2026' }, ['2026-10', '2026-11'])).toEqual(['a data dentro de 10/2026 ou 11/2026']);
    expect(problemasDoRascunho({ ...ok, cnpj: '', historico: '⚠ Sem regra correspondente — classificar manualmente' }, '2026-10')).toEqual(['o histórico']);
  });

  it('o novo é "à mão"; o corrigido guarda a origem e sai de REVISAR com a conta', () => {
    const c = configPadrao();
    const r = { ...aplicarAutomatico({ ...rascunhoNovo(c), fornecedor: 'CEMIG' }, 'Energia Elétrica', c), data: '05/10/2026', valor: '1.234,56', contaCred: '49', historico: 'Energia\nde outubro' };
    const novo = lancamentoDoRascunho(r, c, { id: 9 });
    expect([novo.id, novo.origem, novo.data, novo.valor, novo.contaDeved, novo.contaCred, novo.categoria, novo.revisar, novo.origemRegra, novo.historico])
      .toEqual([9, 'Manual', '2026-10-05', 1234.56, '966', '49', 'Energia Elétrica', false, 'Manual', 'Energia de outubro']);
    expect(linhasDaPlanilha([novo])[1]).toEqual(['', '05/10/2026', '966', '49', '92023', 'Energia de outubro', 1234.56, '', '001', '1', '2', '', '']);
    const doSieg = lanc({ id: 4, origem: 'CTe', revisar: true, contaDeved: '', origemRegra: 'Nenhuma', ncm: '' });
    const corrigido = lancamentoDoRascunho({ ...rascunhoDoLancamento(doSieg), contaDeved: '805' }, c, doSieg);
    expect([corrigido.origem, corrigido.revisar, corrigido.origemRegra, corrigido.valor, corrigido.data]).toEqual(['CTe', false, 'Manual', 10, '2026-10-15']);
    const igual = lancamentoDoRascunho(rascunhoDoLancamento(lanc({ id: 2 })), c, lanc({ id: 2 }));
    expect(igual).toEqual(lanc({ id: 2 }));
    expect(mesDoDocumento(documentoDoMes({ ...mesVazio(62, '2026-10'), lancamentos: [novo] }), 62, '2026-10').lancamentos[0].origem).toBe('Manual');
  });
});
