// Combinações do Verificar por conta, dos lançamentos faltando, da importação (mescla), da consulta, dos pedaços e da sugestão:
// a diferença se explica sem sobra, nenhuma nota some nem é contada duas vezes, a ordem não importa, reprocessar não muda nada.
// Laços determinísticos, com semente fixa e dados inventados.
import { describe, expect, it } from 'vitest';
import { conta, empresa, linha, nota, servico } from '../__legado__/fixtures';
import { CFOP_DESC } from '../tabelas/cfop';
import type { Empresa, Nota, NotaServico, TipoCfop, TipoServico } from '../tipos';
import { chaveNaturezaNota, tipoDoCfop } from './cfop';
import { csvConsulta, filtrarConsulta, FILTRO_CONSULTA_VAZIO, listaConsulta } from './consulta';
import { mesclarNotas, mesclarServicos } from './importacao';
import { lancamentosFaltando } from './lancamentosFaltando';
import { dividirEmPartes, juntarPartes } from './partes';
import { sugestaoDaNatureza } from './sugestaoDeConta';
import { ehCfopVenda, ehVendaVista } from './vendaVista';
import { conferirConta, csvVerificacao, semPendencias, totaisVerificacao, type LinhaRazao, type ResultadoVerificacao } from './verificarConta';

function sorteador(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function embaralhar<T>(l: readonly T[], r: () => number): T[] {
  const a = l.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const cent = (v: number) => Math.round(v * 100);
const VALORES = [0.01, 0.1, 0.2, 0.3, 8.03, 19.99, 1234.56, 999999.99, 1234567.89];

interface Montagem { e: Empresa; codigo: string; cfopGrupo: string | null; servTipo: TipoServico | null; numeros: string[]; valores: number[] }

function montarFiscal(cfop: string, valores: number[]): Montagem {
  const notas = valores.map((v, i) => nota(cfop, '6', v, String(1001 + i)));
  const lista = tipoDoCfop(cfop) === 'Entrada' ? 'entradas' : 'saidas';
  const k = chaveNaturezaNota(notas[0]);
  return { e: empresa({ contas: [conta('66005', 'Conta conferida')], [lista]: notas, naturezaConta: { [k]: ['66005'] } }), codigo: '66005', cfopGrupo: k, servTipo: null, numeros: notas.map(n => n.numero), valores };
}
function montarServico(tipo: TipoServico, valores: number[]): Montagem {
  const notas = valores.map((v, i) => servico(String(1001 + i), 'FORNECEDOR X LTDA', v, '527'));
  const campo = tipo === 'tomados' ? 'servTomados' : 'servPrestados';
  return { e: empresa({ contas: [conta('66005', 'Conta conferida')], [campo]: notas, naturezaConta: { ['serv|' + tipo + '|*']: ['66005'] } }), codigo: '66005', cfopGrupo: null, servTipo: tipo, numeros: notas.map(n => n.numero), valores };
}
const conferir = (m: Montagem, linhas: LinhaRazao[]): ResultadoVerificacao =>
  conferirConta({ empresa: m.e, contas: [m.e.contas[0]], razaoPorConta: { [m.codigo]: linhas }, cfopGrupo: m.cfopGrupo, servTipo: m.servTipo });

const MONTAGENS: [string, (v: number[]) => Montagem][] = [
  ['compra 1102', v => montarFiscal('1102', v)],
  ['interestadual 2102', v => montarFiscal('2102', v)],
  ['importação 3102', v => montarFiscal('3102', v)],
  ['devolução de venda 1202', v => montarFiscal('1202', v)],
  ['venda 5102', v => montarFiscal('5102', v)],
  ['venda 6102', v => montarFiscal('6102', v)],
  ['exportação 7102', v => montarFiscal('7102', v)],
  ['devolução de compra 5202', v => montarFiscal('5202', v)],
  ['tomados', v => montarServico('tomados', v)],
  ['prestados', v => montarServico('prestados', v)],
];

const explicada = (r: ResultadoVerificacao) => Math.abs(totaisVerificacao(r).semExplicacao) < 0.005;

describe('Verificar por conta: operação × valores × o que aconteceu no razão', () => {
  it('razão igual às notas: sem pendência e diferença zero', () => {
    for (const [nome, montar] of MONTAGENS) for (let q = 1; q <= 4; q++) for (const v0 of VALORES) {
      const m = montar(Array.from({ length: q }, (_, i) => (cent(v0) + i) / 100));
      const r = conferir(m, m.numeros.map((n, i) => linha(n, m.valores[i])));
      expect(semPendencias(r), nome + ' ' + q + ' ' + v0).toBe(true);
      expect(cent(totaisVerificacao(r).diferenca), nome + ' ' + q + ' ' + v0).toBe(0);
    }
  });
  it('cada nota: lançada, faltando, duplicada; a diferença se explica sem sobra', () => {
    for (const [nome, montar] of MONTAGENS) for (const v0 of VALORES) for (let mascara = 0; mascara < 27; mascara++) {
      const valores = [v0, (cent(v0) + 7) / 100, (cent(v0) + 13) / 100];
      const m = montar(valores);
      const linhas: LinhaRazao[] = [];
      const estado = [mascara % 3, Math.floor(mascara / 3) % 3, Math.floor(mascara / 9) % 3]; // 0 lançada, 1 faltando, 2 duplicada
      estado.forEach((s, i) => { if (s !== 1) linhas.push(linha(m.numeros[i], valores[i])); if (s === 2) linhas.push(linha(m.numeros[i], valores[i])); });
      const r = conferir(m, linhas);
      const rot = nome + ' ' + v0 + ' ' + estado.join('');
      expect(r.faltando.map(n => n.numero).sort(), rot).toEqual(m.numeros.filter((_, i) => estado[i] === 1));
      expect(r.duplicada.map(d => d.numero).sort(), rot).toEqual(m.numeros.filter((_, i) => estado[i] === 2));
      expect(explicada(r), rot).toBe(true);
      const t = totaisVerificacao(r);
      expect(cent(t.faltando), rot).toBe(valores.reduce((s, v, i) => s + (estado[i] === 1 ? cent(v) : 0), 0));
      expect(cent(t.duplicadas), rot).toBe(valores.reduce((s, v, i) => s + (estado[i] === 2 ? cent(v) : 0), 0));
    }
  });
  it('a ordem das linhas e das notas não muda quem falta nem quem duplica; reprocessar é igual', () => {
    for (let s = 1; s <= 40; s++) {
      const r = sorteador(s);
      const valores = Array.from({ length: 12 }, () => Math.floor(r() * 500000) / 100 + 1);
      const m = montarFiscal('1102', valores);
      const linhas: LinhaRazao[] = [];
      m.numeros.forEach((n, i) => { const x = r(); if (x < 0.7) linhas.push(linha(n, valores[i])); else if (x < 0.85) { linhas.push(linha(n, valores[i])); linhas.push(linha(n, valores[i])); } });
      linhas.push({ txt: 'Pagamento sem nota', data: '05/07/2026', valor: 12.34, sinal: 1, contra: '' });
      const base = conferir(m, linhas);
      const m2: Montagem = { ...m, e: { ...m.e, entradas: embaralhar(m.e.entradas, r) } };
      const outra = conferir(m2, embaralhar(linhas, r));
      const res = (x: ResultadoVerificacao) => ({ f: x.faltando.map(n => n.numero).sort(), d: x.duplicada.map(d => d.numero + ':' + cent(d.valor)).sort(), a: x.aMais.map(l => l.txt).sort(), t: cent(totaisVerificacao(x).diferenca) });
      expect(res(outra), 'semente ' + s).toEqual(res(base));
      expect(res(conferir(m, linhas)), 'semente ' + s).toEqual(res(base));
    }
  });
  it('não muda as linhas do relatório recebido', () => {
    const m = montarFiscal('1102', [10, 20]);
    const linhas = [linha(m.numeros[0], 10), linha(m.numeros[1], 20)];
    const antes = JSON.stringify(linhas);
    conferir(m, linhas);
    expect(JSON.stringify(linhas)).toBe(antes);
  });
  it('nota de valor zero não falta; a soma fica certa', () => {
    const m = montarFiscal('1102', [0, 10]);
    const r = conferir(m, [linha(m.numeros[1], 10)]);
    expect(r.faltando).toEqual([]);
    expect(semPendencias(r)).toBe(true);
  });
  it('conta pelo valor até 5 dias, com a data em qualquer máscara do relatório e na virada do ano', () => {
    const datas: [string, string, boolean][] = [
      ['31/12/2025', '02/01/2026', true],
      ['28/12/2025', '02/01/2026', true],
      ['27/12/2025', '02/01/2026', false],
      ['05/07/2026', '05/07/26', true],
      ['05/07/2026', '10-07-2026', true],
      ['05/07/2026', '07/07/2026 00:00:00', true],
      ['05/07/2026 00:00:00', '07/07/2026', true],
      ['05/07/26', '07/07/2026', true],
    ];
    for (const [dNota, dLinha, acha] of datas) {
      const n = nota('1102', '6', 99.9, '5555', { data: dNota });
      const k = chaveNaturezaNota(n);
      const e = empresa({ contas: [conta('66005', 'Conta')], entradas: [n], naturezaConta: { [k]: ['66005'] } });
      const r = conferirConta({ empresa: e, contas: [e.contas[0]], razaoPorConta: { 66005: [{ txt: 'Pago no banco', data: dLinha, valor: 99.9, sinal: 1, contra: '' }] }, cfopGrupo: k, servTipo: null });
      expect(r.peloValor.length, dNota + ' × ' + dLinha).toBe(acha ? 1 : 0);
      expect(r.faltando.length, dNota + ' × ' + dLinha).toBe(acha ? 0 : 1);
      expect(r.aMais.length, dNota + ' × ' + dLinha).toBe(acha ? 0 : 1);
    }
  });
  it('CSV: o totalizador sem "-0,00" quando não tem nada', () => {
    for (const [nome, montar] of MONTAGENS) for (const v of [0.1, 0.3, 19.99]) {
      const m = montar([v, v]);
      const csv = csvVerificacao(conferir(m, m.numeros.map(n => linha(n, v))));
      expect(csv.join('\n'), nome + ' ' + v).not.toMatch(/-0,00/);
    }
  });
  it('CSV: a diferença zero com centavos quebrados também não sai negativa', () => {
    const notas = [nota('1102', '6', 0.1, '1001'), nota('1102', '6', 0.2, '1002')];
    const k = chaveNaturezaNota(notas[0]);
    const e = empresa({ contas: [conta('66005', 'Conta')], entradas: notas, naturezaConta: { [k]: ['66005'] } });
    const r = conferirConta({ empresa: e, contas: [e.contas[0]], razaoPorConta: { 66005: [linha('1001', 0.1), linha('1002', 0.2)] }, cfopGrupo: k, servTipo: null });
    expect(r.somaFiscal).toBe(0.3);
    expect(r.somaRazao).toBe(0.3);
    expect(Object.is(totaisVerificacao(r).diferenca, -0)).toBe(false);
  });
});

describe('Lançamentos faltando: lado do débito e crédito × operação', () => {
  const CASOS: { nome: string; montar: (v: number[]) => Montagem; credita: boolean }[] = [
    { nome: 'compra 1102', montar: v => montarFiscal('1102', v), credita: false },
    { nome: 'devolução de venda 1202 (entrada)', montar: v => montarFiscal('1202', v), credita: false },
    { nome: 'venda 5102', montar: v => montarFiscal('5102', v), credita: true },
    { nome: 'devolução de compra 5202 (saída)', montar: v => montarFiscal('5202', v), credita: true },
    { nome: 'exportação 7102', montar: v => montarFiscal('7102', v), credita: true },
    { nome: 'importação 3102', montar: v => montarFiscal('3102', v), credita: false },
    { nome: 'tomados', montar: v => montarServico('tomados', v), credita: false },
    { nome: 'prestados', montar: v => montarServico('prestados', v), credita: true },
  ];
  it('conta e participante do lado certo; soma preservada; nenhuma nota some', () => {
    for (const { nome, montar, credita } of CASOS) for (const v0 of VALORES) {
      const valores = [v0, (cent(v0) + 5) / 100, (cent(v0) + 9) / 100];
      const m = montar(valores);
      const r = conferir(m, [linha(m.numeros[0], valores[0], { contra: '21101' })]);
      const l = lancamentosFaltando(r);
      expect(l.lancamentos.length + l.semConta.length, nome + ' ' + v0).toBe(r.faltando.length);
      expect(l.semConta, nome + ' ' + v0).toEqual([]);
      expect(l.lancamentos.reduce((s, x) => s + cent(x.valor), 0), nome + ' ' + v0).toBe(r.faltando.reduce((s, n) => s + cent(n.valor), 0));
      for (const x of l.lancamentos) {
        expect(x.debito, nome).toBe(credita ? '21101' : '66005');
        expect(x.credito, nome).toBe(credita ? '66005' : '21101');
      }
    }
  });
  it('sem o participante no razão: vai para "sem conta" e a soma das duas listas fecha', () => {
    const m = montarFiscal('1102', [10, 20]);
    const r = conferir(m, [{ txt: 'Outro assunto', data: '05/07/2026', valor: 5, sinal: 1, contra: '21101' }]);
    const l = lancamentosFaltando(r);
    expect(l.lancamentos).toEqual([]);
    expect(l.semConta.length).toBe(2);
  });
});

describe('Importação: mescla das notas', () => {
  const gerar = (s: number, q: number): Nota[] => {
    const r = sorteador(s);
    return Array.from({ length: q }, (_, i) => nota(['1102', '2102', '1556'][i % 3], '6', Math.floor(r() * 100000) / 100 + 0.01, String(i + 1), { data: String(1 + (i % 28)).padStart(2, '0') + '/07/2026' }));
  };
  it('reimportar o mesmo arquivo não muda nada (idempotente), nos dois modos', () => {
    for (let s = 1; s <= 25; s++) {
      const notas = gerar(s, 40);
      for (const modo of ['novas', 'sobrepor'] as const) {
        const um = mesclarNotas([], notas, modo);
        const dois = mesclarNotas(um.notas, notas, modo);
        expect(dois.notas.length, 'semente ' + s).toBe(notas.length);
        expect(dois.notas).toEqual(um.notas);
        if (modo === 'novas') expect([dois.adicionadas, dois.atualizadas]).toEqual([0, 0]);
      }
    }
  });
  it('a ordem do arquivo não muda o conjunto importado', () => {
    for (let s = 1; s <= 25; s++) {
      const notas = gerar(s, 40);
      const r = sorteador(s * 3);
      const a = mesclarNotas([], notas, 'novas').notas.map(n => n.numero).sort();
      const b = mesclarNotas([], embaralhar(notas, r), 'novas').notas.map(n => n.numero).sort();
      expect(b).toEqual(a);
    }
  });
  it('dois fornecedores com o mesmo número, data, CFOP e valor são duas notas (nenhuma se perde), em qualquer ordem', () => {
    const a = nota('1102', '6', 100, '77', { doc: '11222333000100', nome: 'FORNECEDOR A' });
    const b = nota('1102', '6', 100, '77', { doc: '44555666000199', nome: 'FORNECEDOR B' });
    for (const modo of ['novas', 'sobrepor'] as const) for (const lista of [[a, b], [b, a]]) {
      const um = mesclarNotas([], lista, modo);
      expect(um.notas.length, modo).toBe(2);
      expect(um.adicionadas, modo).toBe(2);
      const dois = mesclarNotas(um.notas, lista, modo);
      expect(dois.notas.length, modo).toBe(2);
    }
    const parcial = mesclarNotas([a], [b, a], 'novas');
    expect(parcial.notas.map(n => n.nome).sort()).toEqual(['FORNECEDOR A', 'FORNECEDOR B']);
    expect(parcial.adicionadas).toBe(1);
  });
  it('a nota guardada sem documento recebe o documento no reimportar, sem duplicar', () => {
    const velha = nota('1102', '6', 100, '77', { doc: '' });
    const r = mesclarNotas([velha], [nota('1102', '6', 100, '77', { doc: '11.222.333/0001-00' })], 'novas');
    expect(r.notas.length).toBe(1);
    expect(r.notas[0].doc).toBe('11.222.333/0001-00');
    expect(r.adicionadas).toBe(0);
  });
  it('o mesmo documento com máscara diferente é a mesma nota', () => {
    const a = nota('1102', '6', 100, '77', { doc: '11222333000100' });
    const b = nota('1102', '6', 100, '77', { doc: '11.222.333/0001-00' });
    expect(mesclarNotas([], [a, b], 'novas').notas.length).toBe(1);
    expect(mesclarNotas([a], [b], 'novas').notas.length).toBe(1);
  });
  it('NCM, CST e CEST que o relatório passou a trazer entram nas notas já guardadas (como a conta)', () => {
    const velha = nota('1102', '6', 100, '77');
    const r = mesclarNotas([velha], [{ ...velha, ncm: '21069090', cst: '102', cest: '0300700' }], 'novas');
    expect(r.notas[0]).toMatchObject({ ncm: '21069090', cst: '102', cest: '0300700' });
    expect(r.atualizadas).toBe(0);
  });
});

describe('Importação: mescla dos serviços', () => {
  const gerar = (s: number): NotaServico[] => {
    const r = sorteador(s);
    return Array.from({ length: 30 }, (_, i) => servico(String(i + 1), 'PRESTADOR ' + (i % 5), Math.floor(r() * 100000) / 100 + 0.01, '527'));
  };
  it('idempotente nos dois modos', () => {
    for (let s = 1; s <= 25; s++) for (const modo of ['novas', 'sobrepor'] as const) {
      const notas = gerar(s);
      const um = mesclarServicos([], notas, modo);
      const dois = mesclarServicos(um.notas, notas, modo);
      expect(dois.notas).toEqual(um.notas);
    }
  });
  it('a retenção corrigida no relatório entra, mesmo sem mudar lançamento nem ISS', () => {
    const velha: NotaServico = { ...servico('1', 'X', 100, '527'), issRet: 0, irrf: 0, inss: 0 };
    const nova: NotaServico = { ...velha, issRet: 5, irrf: 1.5, inss: 11, pis: 0.65, cofins: 3, csll: 1 };
    const r = mesclarServicos([velha], [nova], 'novas');
    expect(r.notas[0]).toMatchObject({ issRet: 5, irrf: 1.5, inss: 11, pis: 0.65, cofins: 3, csll: 1 });
    expect(r.adicionadas).toBe(0);
  });
  it('relatório sem a coluna não apaga a retenção guardada', () => {
    const velha: NotaServico = { ...servico('1', 'X', 100, '527'), issRet: 5, irrf: 1.5 };
    const semRetencao: NotaServico = { ...velha };
    delete semRetencao.issRet;
    delete semRetencao.irrf;
    const r = mesclarServicos([velha], [semRetencao], 'novas');
    expect(r.notas[0]).toMatchObject({ issRet: 5, irrf: 1.5 });
  });
});

describe('Venda à vista: documento', () => {
  it('CPF: com máscara, sem máscara e o número do Excel sem o zero da frente', () => {
    for (const doc of ['12345678901', '123.456.789-01', '1234567890', '012.345.678-90', '123456789']) {
      expect(ehVendaVista({ nome: 'MARIA', doc }), doc).toBe(true);
    }
  });
  it('CNPJ nunca é à vista, com ou sem o zero da frente', () => {
    for (const doc of ['11222333000100', '11.222.333/0001-00', '1222333000100']) {
      expect(ehVendaVista({ nome: 'MERCADO LTDA', doc }), doc).toBe(false);
    }
  });
  it('venda: só a saída de venda; devolução, remessa e bem do ativo não', () => {
    expect(['5102', '6102', '7102', '5405'].every(cfop => ehCfopVenda({ cfop }))).toBe(true);
    expect(['1102', '5202', '5910', '5949', '5551'].some(cfop => ehCfopVenda({ cfop }))).toBe(false);
  });
});

describe('Consulta', () => {
  const e = empresa({
    entradas: [nota('1102', '6', 10, '1', { nome: 'FORNECEDOR; COM PONTO E VÍRGULA' })],
    saidas: [nota('5102', '7', 20, '2', { nome: 'CLIENTE\nCOM QUEBRA' })],
    servTomados: [servico('3', 'PRESTADOR; X', 30, '527')],
  });
  it('o CSV tem as mesmas colunas em toda linha, mesmo com ; ou quebra no nome', () => {
    for (const g of ['fiscais', 'servicos'] as const) {
      const linhas = csvConsulta(listaConsulta(e, g), g);
      const colunas = linhas[0].split(';').length;
      expect(linhas.join('\n').split('\n').length, g).toBe(linhas.length);
      for (const l of linhas) expect(l.split(';').length, l).toBe(colunas);
    }
  });
  it('ordenar é só reordenar: nenhuma linha some, em nenhuma coluna ou direção', () => {
    const lista = listaConsulta(e, 'fiscais');
    for (const sortCol of ['tipo', 'data', 'numero', 'nome', 'cfop', 'lanc', 'valor', 'iss'] as const) for (const sortDir of ['asc', 'desc'] as const) {
      expect(filtrarConsulta(lista, { ...FILTRO_CONSULTA_VAZIO, sortCol, sortDir }).length, sortCol).toBe(lista.length);
    }
  });
});

describe('Pedaços da empresa grande', () => {
  it('cortar e juntar devolve a mesma lista, em qualquer ordem dos documentos', () => {
    for (let s = 1; s <= 25; s++) {
      const r = sorteador(s);
      const lista = Array.from({ length: 200 + Math.floor(r() * 400) }, (_, i) => ({ i, t: 'x'.repeat(Math.floor(r() * 300)) }));
      const tamanho = 200 + Math.floor(r() * 3000);
      const partes = dividirEmPartes(lista, tamanho);
      expect(partes.flat(), 'semente ' + s).toEqual(lista);
      const docs = embaralhar(partes.map((itens, n) => ({ id: 'saidas-v1-' + String(n).padStart(4, '0'), itens })), r);
      expect(juntarPartes(docs.concat({ id: 'saidas-v0-0000', itens: [{ i: -1, t: '' }] }), 'saidas', { versao: 'v1', partes: partes.length }), 'semente ' + s).toEqual(lista);
      if (partes.length > 1) expect(juntarPartes(docs.slice(1), 'saidas', { versao: 'v1', partes: partes.length }), 'semente ' + s).toBeNull();
    }
  });
});

describe('Sugestão de conta em todos os CFOPs da tabela', () => {
  const plano = [
    conta('96001', 'Vendas de Mercadorias', 0, 'Receita', 'C'), conta('96002', 'Vendas de Produtos de Produção', 0, 'Receita', 'C'), conta('96003', 'Vendas de Mercadorias Mercado Externo', 0, 'Receita', 'C'),
    conta('60001', 'Compras de Mercadorias', 0, 'Despesa', 'D'), conta('60002', 'Devolução de Compras', 0, 'Despesa', 'C'), conta('96004', 'Devolução de Vendas', 0, 'Receita', 'D'),
  ];
  it('não quebra, é determinística, e venda ao exterior nunca cai na conta do mercado interno', () => {
    for (const cfop of Object.keys(CFOP_DESC)) {
      const tipo = tipoDoCfop(cfop) as TipoCfop;
      const a = sugestaoDaNatureza([cfop], tipo, plano);
      expect(sugestaoDaNatureza([cfop], tipo, plano.slice().reverse()), cfop).toEqual(a);
      if (a && a.tipo === 'conta' && cfop.charAt(0) === '7' && /venda/i.test(a.pede)) expect(a.contas!.map(c => c.codigo), cfop).toEqual(['96003']);
      if (a && a.tipo === 'conta' && /^[56]/.test(cfop) && /Venda de mercadorias/.test(a.pede)) expect(a.contas!.map(c => c.codigo), cfop).toEqual(['96001']);
    }
  });
});
