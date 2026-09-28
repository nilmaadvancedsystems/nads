// Paridade: a mesma entrada no código original (recortado do conferencia.html) e na cópia
// tem de dar a mesma saída.
import { describe, expect, it } from 'vitest';
import { comp, docLimpo, lancN, nomeNorm, num } from '../../formatos';
import { empresasDeExemplo } from '../__exemplos__/empresas';
import { lerBalancete, lerNotas, lerRazao, lerServicos } from '../arquivos';
import { agruparTotaisPorNatureza, chaveNaturezaNota, chaveNota, comTipo, DESC_AMBOS, tipoDoCfop } from '../regras/cfop';
import { gruposConciliacao, nomeBaseConta, nomeComumContas } from '../regras/conciliacao';
import { acharDivergencias, padraoPorCfop } from '../regras/divergencias';
import { empresaNova } from '../regras/empresa';
import { assinaturaBalancete, verificarBalancete } from '../regras/importacao';
import { melhorConta } from '../regras/lancamentosAuto';
import { ehCfopVenda, ehVendaVista } from '../regras/vendaVista';
import { ehLinhaIcms, numerosDoHistorico, partesDoHistorico } from '../regras/verificarConta';
import { CFOP_DESC } from '../tabelas/cfop';
import type { Empresa, Nota } from '../tipos';
import { carregarLegado, temLegado } from './carregar';

const L = temLegado() ? carregarLegado() : null;
const d = L ? describe : describe.skip;
const leg = () => L as NonNullable<typeof L>;
const clone = <T>(x: T): T => structuredClone(x);

function nota(cfop: string, lanc: string, valor: number, numero: string, nome = 'FORNECEDOR X LTDA', doc = '11222333000100', data = '05/07/2026'): Nota {
  return { cfop, lanc, valor, numero, nome, data, desc: '', doc, exportado: '', comp: comp(data) };
}

/** Saídas com venda à vista: CPF, consumidor final, sem nome/doc, CNPJ com lançamento à vista. */
function empresaVista(ativo: boolean, prazo: boolean): Empresa {
  const e = empresaNova('PARIDADE VISTA');
  const V = 'Venda de mercadoria adquirida ou recebida de terceiros';
  e.vendaVista = { ativo, lancs: { [V]: '1' }, prazo: prazo ? { [V]: '2' } : {} };
  e.saidas = [
    nota('5102', '00001', 10, '1', 'MARIA', '12345678901'),
    nota('5102', '00002', 11, '2', 'JOAO', '12345678902'),
    nota('5102', '00001', 12, '3', 'CONSUMIDOR FINAL', ''),
    nota('5102', '00001', 13, '4', '', ''),
    nota('5102', '00002', 14, '5', 'MERCADO A LTDA'),
    nota('5102', '00002', 15, '6', 'MERCADO B LTDA'),
    nota('5102', '00001', 16, '7', 'MERCADO C LTDA'),
    nota('5102', '00009', 17, '8', 'MERCADO D LTDA'),
    nota('6102', '00002', 18, '9', 'MERCADO E LTDA'),
    nota('5405', '00227', 19, '10', 'PADARIA', ''),
    nota('5405', '00227', 20, '11', 'PADARIA'),
    nota('5405', '00227', 21, '12', 'PADARIA'),
    nota('5405', '00228', 22, '13', 'PADARIA'),
    nota('5910', '00260', 23, '14', 'RESTAURANTE'),
    nota('5551', '00300', 24, '15', 'COMPRADOR', '12345678901'),
  ];
  return e;
}

d('paridade com o original (conferencia.html)', () => {
  it('tabela CFOP_DESC é a mesma', () => {
    expect({ ...CFOP_DESC }).toEqual(leg().CFOP_DESC);
  });

  it('DESC_AMBOS tem as mesmas descrições', () => {
    expect(Object.keys(DESC_AMBOS).sort()).toEqual(Object.keys(leg().DESC_AMBOS).sort());
  });

  it('formatos: num, comp, lancN, docLimpo, nomeNorm', () => {
    for (const v of ['1.234,56', '(1.234,56)', '1.234,56 D', '10,5 C', '-3', 'abc', '', null, 12.5, '1,2,3'])
      expect(num(v)).toEqual(leg().num(v));
    for (const v of ['05/03/2026', '5-3-26', '2026-03-05', '', 'x']) expect(comp(v)).toBe(leg().comp(v));
    for (const v of ['00182', '182.0', '0', '000', ' 6 ', null, 'A01']) expect(lancN(v)).toBe(leg().lancN(v));
    for (const v of ['11.222.333/0001-00', '000.000.000-00', 'ab-12', '', null]) expect(docLimpo(v)).toBe(leg().docLimpo(v));
    for (const v of ['Energia Elétrica', '  São  João-ME ', '', null]) expect(nomeNorm(v)).toBe(leg().nomeNorm(v));
  });

  it('tipoDoCfop e chaveNaturezaNota em todos os CFOPs da tabela', () => {
    const cfops = Object.keys(CFOP_DESC).concat(['1000', '4102', '', '9999']);
    for (const c of cfops) {
      expect(tipoDoCfop(c)).toBe(leg().tipoDoCfop(c));
      const n = { cfop: c, desc: 'Descrição do arquivo' };
      expect(chaveNaturezaNota(n)).toBe(leg().chaveNaturezaNota(n));
      expect(chaveNaturezaNota({ cfop: c, desc: '' }, 'Saída')).toBe(leg().chaveNaturezaNota({ cfop: c, desc: '' }, 'Saída'));
    }
  });

  it('chave da nota', () => {
    const n = nota('1102', '6', 1234.5, '0042');
    expect(chaveNota(n)).toBe(leg().chave(n));
  });

  it('agruparTotaisPorNatureza nas empresas de exemplo', () => {
    for (const e of empresasDeExemplo()) {
      const notas = comTipo(e.entradas, e.saidas);
      const nova = agruparTotaisPorNatureza(clone(notas));
      const velha = leg().agruparTotaisPorNatureza(clone(notas));
      expect(Object.keys(nova).sort()).toEqual(Object.keys(velha).sort());
      for (const k of Object.keys(velha)) {
        expect(nova[k].cfops).toEqual(velha[k].cfops);
        expect(nova[k].tipo).toBe(velha[k].tipo);
        expect(nova[k].desc).toBe(velha[k].desc);
        expect(nova[k].itens.length).toBe(velha[k].itens.length);
      }
    }
  });

  it('ehCfopVenda e ehVendaVista', () => {
    for (const n of empresaVista(true, true).saidas.concat(nota('1102', '6', 1, '1'), { ...nota('5949', '1', 1, '1'), desc: 'Venda qualquer' })) {
      expect(ehCfopVenda(n)).toBe(leg().ehCfopVenda(clone(n)));
      expect(ehVendaVista(n)).toBe(leg().ehVendaVista(clone(n)));
    }
  });

  describe('padraoPorCfop e acharDivergencias', () => {
    const casos: [string, () => Empresa][] = [
      ['exemplo comércio', () => empresasDeExemplo()[0]],
      ['exemplo serviços', () => empresasDeExemplo()[1]],
      ['à vista desligada', () => empresaVista(false, false)],
      ['à vista ligada, sem a prazo', () => empresaVista(true, false)],
      ['à vista e a prazo ligadas', () => empresaVista(true, true)],
      ['exemplo comércio com à vista ligada', () => {
        const e = empresasDeExemplo()[0];
        e.vendaVista = { ativo: true, lancs: {}, prazo: { 'Venda de mercadoria adquirida ou recebida de terceiros': '00001' } };
        return e;
      }],
    ];
    it('os casos não são vazios (o original acha divergências neles)', () => {
      const qtd = (e: Empresa, t: 'entradas' | 'saidas') => { leg().usarEmpresa(clone(e)); return leg().acharDivergencias(t).length; };
      expect(qtd(empresasDeExemplo()[0], 'entradas')).toBeGreaterThan(0);
      expect(qtd(empresaVista(true, true), 'saidas')).toBeGreaterThan(0);
      expect(qtd(empresaVista(true, false), 'saidas')).toBeGreaterThan(0);
    });
    for (const [nome, fazer] of casos) {
      for (const tipo of ['entradas', 'saidas'] as const) {
        it(nome + ' — ' + tipo, () => {
          const e = fazer();
          leg().usarEmpresa(clone(e));
          expect(padraoPorCfop(e, tipo)).toEqual(leg().padraoPorCfop(tipo));
          expect(acharDivergencias(e, tipo)).toEqual(leg().acharDivergencias(tipo));
        });
      }
    }
  });

  it('gruposConciliacao (exemplo + vínculos cruzados)', () => {
    const e = empresasDeExemplo()[0];
    e.naturezaConta = { ...e.naturezaConta, A: ['1'], B: ['1', '2'], C: ['3'], D: ['2'], E: '3', F: [] };
    const chaves = Object.keys(agruparTotaisPorNatureza(comTipo(e.entradas, e.saidas))).concat(['A', 'B', 'C', 'D', 'E', 'F', 'X']);
    leg().usarEmpresa(clone(e));
    expect(gruposConciliacao(e, chaves)).toEqual(leg().gruposConciliacao(chaves));
  });

  it('nomeBaseConta e nomeComumContas', () => {
    const listas = [
      ['Compras de Mercadorias à Prazo', 'Compras de Mercadorias à Vista'],
      ['Compra de Mercadoria a prazo', 'Compras de Mercadorias á vista'],
      ['Fretes e Carretos', 'Compras'],
      ['Energia Elétrica'],
      ['', ''],
      ['Caixa', 'Caixa', 'Caixas à vista'],
    ];
    for (const l of listas) {
      expect(nomeComumContas(l)).toBe(leg().nomeComumContas(l));
      for (const n of l) expect(nomeBaseConta(n)).toBe(leg().nomeBaseConta(n));
    }
  });

  it('lerBalancete', () => {
    const rows = [
      ['Balancete', '', '', '', '', '', '', ''],
      ['', '', 'ATIVO [10000]', '', '', '', '', '63.941,53 D'],
      ['', '', '   ATIVO CIRCULANTE [11000]', '', '', '', '', '63.941,53 D'],
      ['', '', '        Caixa Geral - [11101]', '', '', '', '', '15.230,44 D'],
      ['', '', '        Banco [11201]', '', '', '', '', '48.711,09'],
      ['', '', 'PASSIVO [20000]', '', '', '', '', '189,90 C'],
      ['', '', '        1.234,56 D Fornecedores [21101]', '', '', '', '', '(189,90) C'],
      ['', '', '  PATRIMÔNIO LÍQUIDO [23000]', '', '', '', '', '0,00 C'],
      ['', '', 'RECEITAS [40000]', '', '', '', '', 'x'],
      ['', '', '      Revenda [40104]', '', '', '', '', '1.000,00 C'],
      ['', '', 'CUSTOS E DESPESAS [30000]', '', '', '', '', '10,00 D'],
      ['', '', '      [31105]', '', '', '', '', '10,00 D'],
      ['', '', 'Sem código', '', '', '', '', '10,00 D'],
    ];
    expect(lerBalancete(clone(rows))).toEqual(leg().lerBalancete(clone(rows)));
  });

  it('lerNotas', () => {
    const rows = [
      ['RELATÓRIO DE ENTRADAS'],
      ['Dt. Escritura', 'Número', 'CFOP', 'Lanc.', 'Nome Forn/Cliente', 'CNPJ/CPF', 'Descrição do CFOP', 'Valor Contábil', 'Exportado'],
      ['05/07/2026', '0042', '1102', '00006.0', 'FORN A', '11.222.333/0001-00', 'Compra', '1.234,56', 'Sim'],
      ['06/07/2026', '43', '5102/01', '1', 'CLIENTE', '123.456.789-01', '', '(10,00)', 'N'],
      ['', '', 'Total', '', '', '', '', '9.999,99', ''],
      ['07/07/2026', '44', '1556', '215', 'PAPELARIA', '', 'Uso', 'x', 'Sim'],
    ];
    expect(lerNotas(clone(rows))).toEqual(leg().lerNotas(clone(rows)));
    expect(() => leg().lerNotas([['a', 'b']])).toThrow();
    expect(() => lerNotas([['a', 'b']])).toThrow();
  });

  it('lerServicos', () => {
    const rows = [
      ['Relatório de ISS'],
      ['Data', 'Nr. Documento', 'Lanc', 'CNPJ', 'Nome do Fornecedor', 'Valor do Documento', 'ISS Valor', 'ISS Valor Retido', 'IRRF', 'INSS', 'Cancelada', 'Exportado'],
      ['05/07/2026', '000123', '0527', '11222333000100', 'DEDETIZADORA', '350,00', '7,00', '0,00', '1,50', '', 'N', 'S'],
      ['06/07/2026', '124', '42.0', '', 'NILMA CONTABILIDADE', '1.100,00', '', '', '', '', 'S', ''],
      ['total', '', '', '', '', '1.450,00'],
    ];
    expect(lerServicos(clone(rows), 'tomados')).toEqual(leg().lerServicos(clone(rows), 'tomados'));
  });

  it('lerRazao (vcLerRazao)', async () => {
    const rows = [
      ['Data', 'Histórico', 'Descrição', 'Valor', 'Contrapartida'],
      ['05/07/2026', 'Compra', 'conf NF-e ? - 29-54540585000161-NOME', '-1.234,56', ' 21101 '],
      ['', '', '', '', ''],
      ['06/07/2026', 'ICMS a Recuperar', '', '90,00', ''],
      ['07/07/2026', '', '', 'x', ''],
    ];
    expect(lerRazao(clone(rows))).toEqual(await leg().vcLerRazao(clone(rows)));
    const semHist = [['a', 'b'], ['1', '2']];
    expect(lerRazao(clone(semHist))).toEqual(await leg().vcLerRazao(clone(semHist)));
  });

  it('números e partes do histórico, linha de ICMS', () => {
    const textos = [
      'conf NF-e ? - 29-54540585000161-NOME DO CLIENTE // NF 9009',
      'NF 12345 ref 9876543210123 e 777',
      'NFS 202600000012345 CNPJ 11222333000100 CPF 12345678901 nr 777',
      'Fornecedores 21101 pelo valor conf NF-e 00029 - 54540585000161 - EMPRESA X',
      'ICMS a Recuperar s/ devolução 1234',
      'Pelo valor do ICMS-ST',
      'DICMS 55',
      '',
      '12 34 5678901234567890',
    ];
    for (const t of textos) {
      for (const serv of [false, true]) expect(numerosDoHistorico(t, serv)).toEqual(leg().vcNumerosDoHistorico(t, serv));
      expect(partesDoHistorico(t)).toEqual(leg().vcPartesHistorico(t));
      expect(ehLinhaIcms({ txt: t })).toBe(leg().ehLinhaIcms({ txt: t }));
    }
  });

  it('melhorConta com o plano do exemplo', () => {
    const contas = empresasDeExemplo()[0].contas.filter(c => !c.sintetica);
    const naturezas = Object.values(CFOP_DESC).filter((_, i) => i % 7 === 0).concat(['', 'de da do', 'Frete Comercial', 'Uso e Consumo']);
    for (const n of naturezas) {
      const a = melhorConta(n, contas);
      const b = leg().melhorConta(n, clone(contas));
      expect(a && a.codigo).toBe(b && b.codigo);
    }
  });

  it('assinatura e verificação do balancete', () => {
    const e = empresasDeExemplo()[0];
    const outra = e.contas.filter((_, i) => i % 3 !== 0).map(c => ({ ...c, nome: c.codigo === '66015' ? 'Fretes' : c.nome }));
    for (const lista of [e.contas, outra, []]) {
      leg().usarEmpresa(clone(e));
      expect(assinaturaBalancete(lista)).toEqual(leg().assinaturaBalancete(clone(lista)));
      expect(verificarBalancete(e, lista)).toEqual(leg().verificarBalancete(clone(lista)));
    }
  });
});
