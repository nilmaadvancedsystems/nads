// O Importador LCDPR (o que veio do lcdpr.html), com relatórios do SIEG fictícios.
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  aplicarCategoria, aplicarRegraNosPendentes, backupDaConfig, configDoBackup, configDoDocumento, configPadrao, dataBr, dataDaCelula, documentoDaConfig,
  gruposParaRevisar, lancamentosVisiveis, lerRelatorio, linhasDaPlanilha, numeroDaCelula, numeroDoDocumento, planilhaDoLcdpr, regraNoFiltro,
  regraSugerida, tipoDoRelatorio, type ConfigLcdpr, type Lancamento,
} from '.';

const CPF_FICTICIO = '52998224725';
function config(): ConfigLcdpr {
  const c = configPadrao();
  c.config.cpfProdutor = CPF_FICTICIO;
  c.ieDest = [{ ie: '0012345678901', imovel: '007' }];
  return c;
}
const ids = () => { let n = 1; return () => n++; };

/** uma linha do Detalhamento de Produtos (as colunas do SIEG) */
const item = (o: Record<string, unknown>) => ({
  Numero: 123, Serie: 1, Status: 'Autorizado o uso da NF-e', Tp_NF: 'Saída', Rz_Emit: 'POSTO FICTICIO LTDA', CNPJ_CPF_Emit: '11.222.333/0001-81',
  Valor_Total_Nota: 1000, Dt_Emissao: 45672, IE_Dest: '12345678901', Produto: 'OLEO DIESEL S10', NCM: 27101921, Valor_Produto: 900, Valor_Unitario: 6.5, ...o,
});
/** uma linha do relatório de CT-e */
const frete = (o: Record<string, unknown>) => ({
  Numero: 77, Serie: 2, Status: 'Autorizado o uso do CT-e', Rz_Emit: 'TRANSPORTADORA FICTICIA', CNPJ_CPF_Emitente: '11444777000161',
  CNPJ_CPF_Dest: CPF_FICTICIO, Valor_Transporte: '1.234,56', Dt_Emissao: '20/01/2025 08:30:00', Prod_Predominante: 'CAFE', ...o,
});

describe('a leitura dos relatórios do SIEG', () => {
  it('reconhece o relatório pelas colunas', () => {
    expect(tipoDoRelatorio(Object.keys(item({})))).toBe('detalhamento');
    expect(tipoDoRelatorio(Object.keys(frete({})))).toBe('cte');
    expect(tipoDoRelatorio(['Numero', 'Valor'])).toBe('desconhecido');
    expect(lerRelatorio([], config(), ids()).erro).toBe('planilha vazia');
    expect(lerRelatorio([{ Numero: 1, Valor: 2 }], config(), ids()).erro).toBe('não é Detalhamento de Produtos nem CT-e');
  });

  it('junta os itens de cada nota; a regra do item que vale mais manda (o brinde não muda a conta)', () => {
    const r = lerRelatorio([
      item({}),
      item({ Produto: 'FILTRO DE OLEO (brinde)', NCM: 84212300, Valor_Produto: 100 }),
      item({ Numero: 124, Status: 'Cancelado' }),
      item({ Numero: 125, Tp_NF: 'Entrada' }),
      item({ Numero: '' }),
    ], config(), ids());
    expect(r.tipo).toBe('detalhamento');
    expect(r.lancamentos).toHaveLength(1);
    const l = r.lancamentos[0];
    expect(l).toMatchObject({
      origem: 'NF', data: '2025-01-15', documento: '123', cnpj: '11222333000181', fornecedor: 'POSTO FICTICIO LTDA', valor: 1000,
      contaDeved: '924', codHist: '00061', categoria: 'Combustíveis e Lubrificantes', contaCred: '35', tipoDoc: '1', tipoLanc: '2',
      imovel: '007', revisar: false, origemRegra: 'NCM', produto: 'OLEO DIESEL S10 | FILTRO DE OLEO (brinde)', ncm: '27101921, 84212300',
    });
    expect(l.historico).toBe('Pela compra de combustíveis/lubrificantes conf. nota fiscal 123 - POSTO FICTICIO LTDA - 11.222.333/0001-81');
  });

  it('o NCM que o Excel guardou como número volta com o zero; a série que não é 1 vai no documento', () => {
    const r = lerRelatorio([item({ Numero: 9, Serie: '2', NCM: 1022190, Produto: 'BEZERRO', IE_Dest: '999' })], config(), ids());
    expect(r.lancamentos[0]).toMatchObject({ documento: '9/2', contaDeved: '730', ncm: '01022190', imovel: '001' });
    expect(numeroDoDocumento('10', '1.0')).toBe('10');
    expect(numeroDoDocumento('10', '')).toBe('10');
  });

  it('a nota de mesmo número de dois fornecedores são dois lançamentos', () => {
    const r = lerRelatorio([item({}), item({ Rz_Emit: 'OUTRO FICTICIO', CNPJ_CPF_Emit: '11444777000161' })], config(), ids());
    expect(r.lancamentos.map(l => l.fornecedor)).toEqual(['POSTO FICTICIO LTDA', 'OUTRO FICTICIO']);
  });

  it('sem regra de NCM, vai para REVISAR', () => {
    const l = lerRelatorio([item({ NCM: 95030099, Produto: 'BRINQUEDO' })], config(), ids()).lancamentos[0];
    expect(l).toMatchObject({ revisar: true, contaDeved: '', origemRegra: 'Nenhuma', categoria: '' });
    expect(l.historico).toMatch(/Sem regra/);
  });

  it('o CT-e é frete, só do produtor (o CPF como número, sem o zero, também vale)', () => {
    const c = config();
    c.config.cpfProdutor = '04246072761';
    const r = lerRelatorio([frete({ CNPJ_CPF_Dest: 4246072761 }), frete({ Numero: 78, CNPJ_CPF_Dest: '11222333000181' }), frete({ Numero: 79, Status: 'Cancelado' })], c, ids());
    expect(r.tipo).toBe('cte');
    expect(r.lancamentos).toHaveLength(1);
    expect(r.lancamentos[0]).toMatchObject({
      origem: 'CTe', documento: '77/2', valor: 1234.56, data: '2025-01-20', contaDeved: '805', codHist: '91011', origemRegra: 'Padrão CT-e',
      categoria: 'Fretes e Carretos', produto: 'CAFE', historico: 'Pelo valor de fretes s/ CTe nº 77/2 - TRANSPORTADORA FICTICIA', imovel: '001',
    });
  });

  it('as células: número em texto brasileiro, datas sem fuso', () => {
    expect(numeroDaCelula('1.234,56')).toBe(1234.56);
    expect(numeroDaCelula('1234.5')).toBe(1234.5);
    expect(numeroDaCelula('')).toBe(0);
    expect(dataDaCelula(45658)).toBe('2025-01-01');
    expect(dataDaCelula('2025-03-04T10:00:00-03:00')).toBe('2025-03-04');
    expect(dataDaCelula(new Date(2025, 2, 4))).toBe('2025-03-04');
    expect(dataDaCelula('31/02x')).toBe('');
    expect(dataBr('2025-03-04')).toBe('04/03/2025');
  });
});

describe('a classificação à mão', () => {
  const base = (o: Partial<Lancamento>): Lancamento => ({
    id: 1, origem: 'NF', data: '2025-01-10', documento: '1', cnpj: '11222333000181', fornecedor: 'LOJA FICTICIA', categoria: '', contaDeved: '', contaCred: '35',
    codHist: '', historico: 'x', valor: 10, imovel: '001', tipoDoc: '1', tipoLanc: '2', produto: 'PRODUTO', ncm: '95030099', revisar: true, origemRegra: 'Nenhuma', ...o,
  });

  it('a categoria leva a conta, o código e o histórico; a vazia só tira a categoria', () => {
    const c = config();
    const l = aplicarCategoria(base({}), 'Uso e Consumo', c.categorias);
    expect(l).toMatchObject({ categoria: 'Uso e Consumo', contaDeved: '812', codHist: '00044', revisar: false, origemRegra: 'Manual' });
    expect(l.historico).toBe('Pela compra de materiais para uso e consumo conforme nota fiscal 1 - LOJA FICTICIA - 11.222.333/0001-81');
    expect(aplicarCategoria(l, '', c.categorias)).toMatchObject({ categoria: '', contaDeved: '812', revisar: false });
  });

  it('sugere a regra do capítulo (com o modelo da categoria) e ela vale para o que está em REVISAR', () => {
    const c = config();
    const outros = [base({ id: 2, ncm: '95030010, 39231000' }), base({ id: 3, ncm: '84212300' }), base({ id: 4, ncm: '95039000', revisar: false, contaDeved: '999', origemRegra: 'Manual' })];
    const feito = aplicarCategoria(base({}), 'Uso e Consumo', c.categorias);
    const s = regraSugerida(feito, [feito, ...outros], c);
    expect(s).toEqual({ regra: { prefixo: '9503', conta: '812', codHist: '00044', historico: c.categorias.find(x => x.nome === 'Uso e Consumo')!.historico }, quantas: 3 });
    const depois = aplicarRegraNosPendentes(outros, s!.regra, c.categorias);
    expect(depois[0]).toMatchObject({ revisar: false, contaDeved: '812', origemRegra: 'NCM', categoria: 'Uso e Consumo' });
    expect(depois[1]).toBe(outros[1]);
    expect(depois[2]).toBe(outros[2]);
    // já tem regra, sem NCM ou sem conta: nada a sugerir
    expect(regraSugerida(aplicarCategoria(base({ ncm: '27101921' }), 'Uso e Consumo', c.categorias), [], c)).toBeNull();
    expect(regraSugerida(aplicarCategoria(base({ ncm: '' }), 'Uso e Consumo', c.categorias), [], c)).toBeNull();
    expect(regraSugerida(base({}), [], c)).toBeNull();
  });

  it('agrupa o que falta revisar por NCM e fornecedor (o maior grupo primeiro) e filtra a tabela', () => {
    const lancs = [
      base({ id: 1, data: '2025-01-03' }), base({ id: 2, data: '2025-01-01', fornecedor: 'loja ficticia' }), base({ id: 3, fornecedor: 'OUTRA', valor: 99 }),
      base({ id: 4, revisar: false, fornecedor: 'BUSCAVEL', data: '' }),
    ];
    const g = gruposParaRevisar(lancs);
    expect(g.map(x => [x.ncm, x.ids])).toEqual([['9503', [1, 2]], ['9503', [3]]]);
    expect(lancamentosVisiveis(lancs, { busca: '', soRevisar: false }).map(l => l.id)).toEqual([4, 2, 1, 3]);
    expect(lancamentosVisiveis(lancs, { busca: 'buscav', soRevisar: false }).map(l => l.id)).toEqual([4]);
    expect(lancamentosVisiveis(lancs, { busca: '', soRevisar: true }).map(l => l.id)).toEqual([2, 1, 3]);
  });

  it('o filtro das regras acha pelo campo ou pelo NCM inteiro', () => {
    const r = { prefixo: '2710', conta: '924', codHist: '00061', historico: 'combustível' };
    expect(regraNoFiltro(r, '')).toBe(true);
    expect(regraNoFiltro(r, '924')).toBe(true);
    expect(regraNoFiltro(r, '27101921')).toBe(true);
    expect(regraNoFiltro(r, 'COMBUST')).toBe(true);
    expect(regraNoFiltro(r, '8421')).toBe(false);
  });
});

describe('a planilha e o documento', () => {
  it('a planilha .xls tem as 13 colunas e as linhas em ordem de data', () => {
    const c = config();
    const { lancamentos } = lerRelatorio([item({ Numero: 2, Dt_Emissao: 45680 }), item({ Numero: 1, Dt_Emissao: 45670 })], c, ids());
    const linhas = linhasDaPlanilha(lancamentos);
    expect(linhas[0]).toEqual(['Lancamento Automatico', 'Data', 'Conta Devedora', 'Conta Credora', 'Codigo Historico', 'Historico', 'Valor', 'Documento', 'Imovel', 'Tipo de Documento', 'Tipo de Lancamento', 'CPF/CNPJ', 'Produto']);
    expect(linhas.slice(1).map(l => [l[1], l[7]])).toEqual([['13/01/2025', '1'], ['23/01/2025', '2']]);
    const wb = XLSX.read(planilhaDoLcdpr(lancamentos), { type: 'array' });
    expect(wb.SheetNames).toEqual(['Lancamentos LCDPR']);
    const lido = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['Lancamentos LCDPR'], { header: 1, defval: '' });
    expect(lido[1]).toEqual(['', '13/01/2025', '924', '35', '00061', lancamentos[1].historico, 1000, '1', '007', '1', '2', '11222333000181', 'OLEO DIESEL S10']);
  });

  it('o documento do banco: o campo que veio troca o inteiro; o que falta fica com o padrão; grava só os 8 campos', () => {
    const c = configDoDocumento({ ncmRules: [{ prefixo: 2710, conta: '924' }], config: { cpfProdutor: CPF_FICTICIO }, outro: 1 });
    expect(c.ncmRules).toEqual([{ prefixo: '2710', conta: '924', codHist: '', historico: '' }]);
    expect(c.config).toEqual({ cpfProdutor: CPF_FICTICIO, contaCredoraPadrao: '', imovelPadrao: '', tipoDocPadrao: '', tipoLancPadrao: '', categoriaFretesCTe: '' });
    expect(c.categorias).toEqual(configPadrao().categorias);
    expect(Object.keys(documentoDaConfig(c))).toEqual(['config', 'categorias', 'planoContas', 'ncmRules', 'imoveis', 'ieDest', 'tipoDoc', 'tipoLanc']);
    expect(configDoDocumento(undefined)).toEqual(configPadrao());
  });

  it('o backup volta igual; o que não é backup dá erro', () => {
    const c = config();
    expect(configDoBackup(backupDaConfig(c), configPadrao())).toEqual(c);
    expect(configDoBackup('{"imoveis":[{"codigo":"9","descricao":"FAZENDA FICTICIA"}]}', c).imoveis).toEqual([{ codigo: '9', descricao: 'FAZENDA FICTICIA' }]);
    expect(() => configDoBackup('não é json', c)).toThrow(/JSON/);
    expect(() => configDoBackup('{"x":1}', c)).toThrow(/nenhuma regra/);
  });
});
