// Os históricos e as contas aprendidos do movimento do LCDPR exportado do Alterdata (11/11/2026), com linhas fictícias no
// mesmo formato da planilha (Status, Data, Lançamento automático, Contrapartida, Descrição, Valor, Histórico, Descrição
// histórico, Saldo, Observação).
import { describe, expect, it } from 'vitest';
import {
  aplicarHistoricoPadrao, cadastrosDoDocumento, cadastrosDoMovimento, linhasDaPlanilhaDoMovimento, configPadrao, contasDaPesquisa, historicosDaPesquisa, modeloDoHistorico, pesquisar, rascunhoNovo,
} from '.';

const CAB = ['', 'Status conciliação', 'Data', 'Lançamento automático', 'Contrapartida', 'Descrição', 'Valor', 'Histórico', 'Descrição histórico', 'Saldo', 'Observação'];
const linha = (data: string, conta: string, nome: string, cod: string, texto: string) => ['Falso', 'Não conciliado', data, '', conta, nome, '100', cod, texto, '-1', ''];

const PLANILHA = [
  CAB,
  linha('01/06/2023', '875', 'Maquinas Equip. Conservacao e Reparos', '00066', 'Pelo serviço/aquisiçao de peças conf nota fiscal nº 6490 POSTO FICTICIO LTDA'),
  linha('02/06/2023', '875', 'Maquinas Equip. Conservacao e Reparos', '00066', 'Pelo serviço/aquisiçao de peças conf nota fiscal nº  273359 LOJA FICTICIA'),
  linha('03/06/2023', '784', 'Conservacao e Manutencao', '00066', 'Pelo serviço/aquisiçao de peças conf nota fiscal nº 11 OFICINA TESTE'),
  linha('02/06/2023', '966', 'Energia Elétrica', '92023', 'Pagamento de Energia Elétrica ref. 052023'),
  linha('02/07/2023', '966', 'Energia Elétrica', '92023', 'Pagamento de Energia Elétrica ref. 062023'),
  linha('05/01/2024', '711', 'FGTS Rescisório', '00036', 'Pago Recolhimento Rescisório de FGTS conforme Guia de GRRF quitada.'),
  linha('10/02/2024', '712', 'Férias', '00035', 'Pagamento de férias - FULANO TESTE'),
  linha('10/03/2024', '712', 'Férias', '00035', 'Pagamento de férias - CICLANO TESTE'),
  linha('10/04/2024', '712', 'Férias', '00035', 'Pagamento de verbas - BELTRANO TESTE'),
  linha('31/12/2025', '903', 'Despesas c/ Servicos Terceiros (PF)', '', 'Pelo valor de fretes s/ vendas - NFSe 123 - FULANO'),
  ['', '', '', '', '', '', '', '', '', '', ''],
];

describe('o movimento do LCDPR do Alterdata', () => {
  it('cada histórico vira o modelo (o começo que se repete + o número e o fornecedor) e a conta em que mais cai', () => {
    const c = cadastrosDoMovimento(PLANILHA, 'movimento.xls', '2026-11-11T10:00:00Z');
    expect(c.historicos).toEqual([
      { codigo: '00035', modelo: 'Pagamento de férias {{doc}} - {{fornecedor}}', conta: '712', contaNome: 'Férias', usos: 3 },
      { codigo: '00066', modelo: 'Pelo serviço/aquisiçao de peças conf nota fiscal nº {{doc}} - {{fornecedor}}', conta: '875', contaNome: 'Maquinas Equip. Conservacao e Reparos', usos: 3 },
      { codigo: '92023', modelo: 'Pagamento de Energia Elétrica ref. {{doc}} - {{fornecedor}}', conta: '966', contaNome: 'Energia Elétrica', usos: 2 },
      { codigo: '00036', modelo: 'Pago Recolhimento Rescisório de FGTS conforme Guia de GRRF quitada.', conta: '711', contaNome: 'FGTS Rescisório', usos: 1 },
    ]);
    expect(c.contas.map(x => x.codigo + ' ' + x.usos)).toEqual(['712 3', '875 2', '966 2', '711 1', '784 1', '903 1']);
    expect([c.lancamentos, c.de, c.ate, c.arquivo]).toEqual([10, '2023-06', '2025-12', 'movimento.xls']);
  });

  it('o modelo: um texto só corta no primeiro número; sem nada que mude, fica como está', () => {
    expect(modeloDoHistorico(['Impostos e demais taxas 15912 - REGISTRO DE IMOVEIS'])).toBe('Impostos e demais taxas {{doc}} - {{fornecedor}}');
    expect(modeloDoHistorico(['  Pagamento de título nº   350 LOJA', 'Pagamento de título nº 9 OUTRA'])).toBe('Pagamento de título nº {{doc}} - {{fornecedor}}');
    expect(modeloDoHistorico([])).toBe('');
  });

  it('o .csv em UTF-8 e no padrão do Windows é lido com os acentos', () => {
    const csv = PLANILHA.slice(0, 3).map(l => l.map(c => '"' + c + '"').join(';')).join('\n');
    const utf8 = new TextEncoder().encode(csv);
    const win = Uint8Array.from([...csv].map(ch => ch.charCodeAt(0) < 256 ? ch.charCodeAt(0) : 63));
    for (const b of [utf8, win]) {
      const c = cadastrosDoMovimento(linhasDaPlanilhaDoMovimento(b.buffer as ArrayBuffer), 'm.csv', '');
      expect(c.historicos.map(h => h.codigo + ' ' + h.modelo)).toEqual(['00066 Pelo serviço/aquisiçao de peças conf nota fiscal nº {{doc}} - {{fornecedor}}']);
    }
  });

  it('planilha que não é o movimento dá erro', () => {
    expect(() => cadastrosDoMovimento([['Código', 'Nome'], ['1', 'x']], 'a.xls', '')).toThrow(/movimento do LCDPR/);
  });

  it('o documento do banco volta igual, e o que não tem a forma certa fica de fora', () => {
    const c = cadastrosDoMovimento(PLANILHA, 'movimento.xls', '2026-11-11T10:00:00Z');
    expect(cadastrosDoDocumento(JSON.parse(JSON.stringify(c)))).toEqual(c);
    expect(cadastrosDoDocumento({ historicos: [{ codigo: '1' }, 'x'], contas: [{}] }).historicos).toEqual([]);
    expect(cadastrosDoDocumento(null).contas).toEqual([]);
  });

  it('na janela: os históricos aprendidos vêm primeiro (com a conta usual) e escolher um preenche a conta devedora vazia', () => {
    const c = configPadrao();
    const aprendidos = cadastrosDoMovimento(PLANILHA, 'm.xls', '');
    const hs = historicosDaPesquisa(c, aprendidos.historicos);
    expect(hs.slice(0, 2).map(h => [h.codigo, h.detalhe])).toEqual([['00035', '712 · Férias'], ['00066', '875 · Maquinas Equip. Conservacao e Reparos']]);
    expect(hs.filter(h => h.codigo === '00066').length).toBe(1);
    expect(pesquisar(hs, 'ferias').map(h => h.codigo)).toEqual(['00035']);
    const r = aplicarHistoricoPadrao({ ...rascunhoNovo(c), documento: '7', fornecedor: 'OFICINA' }, '00066', hs);
    expect([r.codHist, r.contaDeved, r.historico]).toEqual(['00066', '875', 'Pelo serviço/aquisiçao de peças conf nota fiscal nº 7 - OFICINA']);
    expect(aplicarHistoricoPadrao({ ...rascunhoNovo(c), contaDeved: '784' }, '00066', hs).contaDeved).toBe('784');
    // as contas do movimento que o plano do LCDPR não tem entram na lupa das contas
    const contas = contasDaPesquisa(c, [], aprendidos.contas);
    expect(contas.filter(x => x.detalhe === 'Alterdata').map(x => x.codigo)).toEqual(['712', '711', '903']);
  });
});
