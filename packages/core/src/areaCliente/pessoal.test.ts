// O Registro da Área do Cliente (12/11/2026): as categorias dos documentos do DP (com os nomes de verdade da pasta do
// Drive), os funcionários pelas guias do FGTS e o dono de cada arquivo.
import { describe, expect, it } from 'vitest';
import type { GuiaDoFgts } from '../tarefas/regras/fgts';
import { categoriaDoArquivoDp, documentosPorCategoria, donoDoArquivo, ehDoDp, idDoFuncionario, mascararCpf, mesesDosDocumentosDp, registroDasGuias } from './pessoal';

describe('o que é cada documento do DP (os nomes da pasta do Drive)', () => {
  const casos: [string, string, string][] = [
    ['DEPARTAMENTO PESSOAL/10/FOLHA', 'Folha de pagamento 10-2026.pdf', 'folha'],
    ['DEPARTAMENTO PESSOAL/10/FOLHA', 'recibo_mensal_horista_2026_10_01_2026_10_31.pdf', 'recibo'],
    ['DEPARTAMENTO PESSOAL/10', 'Recibo de Salário.pdf', 'recibo'],
    ['DEPARTAMENTO PESSOAL/10', 'Recibo de Pró Labore.pdf', 'pro-labore'],
    ['DEPARTAMENTO PESSOAL/10', 'recibo_socio_2026_10_01_2026_10_31.pdf', 'pro-labore'],
    ['DEPARTAMENTO PESSOAL/10/PRÓ-LABORE', '30-10-2026 DENISE PRO-LABORE OUTUBRO-2026 3M R$1.442,69.pdf', 'pro-labore'],
    ['DEPARTAMENTO PESSOAL/10', 'Previsão - Vencimento de Férias.pdf', 'ferias'],
    ['DEPARTAMENTO PESSOAL/10/CARTÃO DE PONTO', 'Elisene.xlsx', 'ponto'],
    ['DEPARTAMENTO PESSOAL/10/FGTS', 'FGTS 10-2026.pdf', 'fgts'],
    ['DEPARTAMENTO PESSOAL/09', '08-2026 - DARF INSS - VALOR R$1321,02 - VENCIMENTO 18-09-2026.pdf', 'inss'],
    ['DEPARTAMENTO PESSOAL/11', 'TRCT - JOAO DA SILVA.pdf', 'rescisao'],
    ['DEPARTAMENTO PESSOAL/12', '13º Salário - 1ª parcela.pdf', 'decimo-terceiro'],
    ['DEPARTAMENTO PESSOAL/10', 'Documento 10-2026.pdf', 'outro'],
    // a data com 13 não é o 13º
    ['DEPARTAMENTO PESSOAL/11', 'Folha 13-11-2026.pdf', 'folha'],
  ];
  it.each(casos)('%s / %s → %s', (pasta, nome, cat) => { expect(categoriaDoArquivoDp(nome, pasta)).toBe(cat); });
  it('só a pasta do DP (a lista do mês às vezes traz o Contábil e o Fiscal)', () => {
    expect(ehDoDp('DEPARTAMENTO PESSOAL/10/FGTS')).toBe(true);
    expect(ehDoDp('Departamento Pessoal')).toBe(true);
    expect(ehDoDp('CONTÁBIL/PAGAMENTOS DE FORNECEDORES/2026/09')).toBe(false);
    expect(ehDoDp('FISCAL/SIMPLES NACIONAL/16. DARF')).toBe(false);
  });
});

const guia = (competencia: string, ts: [string, string, string, number][], numero = competencia): GuiaDoFgts => ({
  numero, competencia, vencimento: '', emissao: '', total: 0,
  trabalhadores: ts.map(([nome, cpf, matricula, base]) => ({ nome, cpf, matricula, base, valor: base * 0.08 })),
});

describe('os funcionários pelas guias do FGTS', () => {
  it('ativo quem está na guia mais nova; desde a primeira guia; a remuneração do mês mais novo; o CPF mascarado', () => {
    const r = registroDasGuias([
      guia('2026-08', [['MARIA SOUZA', '123.456.789-09', '001', 2000], ['PEDRO LIMA', '987.654.321-00', '002', 1800]]),
      guia('2026-09', [['MARIA SOUZA', '123.456.789-09', '001', 2100], ['PEDRO LIMA', '987.654.321-00', '002', 1800]]),
      guia('2026-10', [['MARIA  SOUZA', '123.456.789-09', '001', 2200], ['ANA COSTA', '111.222.333-44', '003', 1500]]),
    ]);
    expect(r.competencia).toBe('2026-10');
    expect(r.funcionarios.map(f => [f.nome, f.cpf, f.ativo, f.desde, f.ultimo, f.remuneracao])).toEqual([
      ['ANA COSTA', '***.222.333-**', true, '2026-10', '2026-10', 1500],
      ['MARIA SOUZA', '***.456.789-**', true, '2026-08', '2026-10', 2200],
      ['PEDRO LIMA', '***.654.321-**', false, '2026-08', '2026-09', 1800],
    ]);
    expect(r.total).toBe(3700);
    expect(r.funcionarios[1].id).toBe(idDoFuncionario('12345678909'));
    expect(JSON.stringify(r)).not.toContain('12345678909');
  });
  it('a guia complementar do mesmo mês soma a remuneração; a mesma guia lida duas vezes não', () => {
    const r = registroDasGuias([
      guia('2026-10', [['MARIA SOUZA', '123.456.789-09', '001', 2000]], 'A'),
      guia('2026-10', [['MARIA SOUZA', '123.456.789-09', '001', 300]], 'B'),
    ]);
    expect(r.funcionarios[0].remuneracao).toBe(2300);
    // a mesma guia (o mesmo número) do robô do FGTS e do Drive
    const repetida = guia('2026-10', [['MARIA SOUZA', '123.456.789-09', '001', 2000]], 'A');
    expect(registroDasGuias([repetida, { ...repetida }]).funcionarios[0].remuneracao).toBe(2000);
    expect(registroDasGuias([]).funcionarios).toEqual([]);
  });
  it('o CPF ruim fica de fora', () => {
    expect(registroDasGuias([guia('2026-10', [['X', '123', '', 1]])]).funcionarios).toEqual([]);
    expect(mascararCpf('123')).toBe('');
  });
});

describe('o dono de cada arquivo', () => {
  const fs = [{ id: 'a', nome: 'ELISENE PEREIRA' }, { id: 'b', nome: 'JOAO DA SILVA' }, { id: 'c', nome: 'JOAO SOUZA' }];
  it('pelo primeiro nome; com xará, também o último; dois donos possíveis, nenhum', () => {
    expect(donoDoArquivo('Elisene.xlsx', fs)).toBe('a');
    expect(donoDoArquivo('RECIBO DE FERIAS - JOAO DA SILVA.pdf', fs)).toBe('b');
    expect(donoDoArquivo('Recibo Joao.pdf', fs)).toBe('');
    expect(donoDoArquivo('Folha de pagamento 10-2026.pdf', fs)).toBe('');
  });
});

describe('a lista do mês', () => {
  it('por categoria, na ordem do cliente; os meses do mais novo', () => {
    const docs = [{ categoria: 'fgts' as const, nome: 'FGTS.pdf', competencia: '2026-10' }, { categoria: 'folha' as const, nome: 'Folha.pdf', competencia: '2026-09' }, { categoria: 'recibo' as const, nome: 'B.pdf', competencia: '2026-10' }, { categoria: 'recibo' as const, nome: 'A.pdf', competencia: '2026-10' }];
    expect(documentosPorCategoria(docs).map(g => [g.rotulo, g.documentos.map(d => d.nome)])).toEqual([['Folha de pagamento', ['Folha.pdf']], ['Recibos de pagamento', ['A.pdf', 'B.pdf']], ['FGTS', ['FGTS.pdf']]]);
    expect(mesesDosDocumentosDp(docs)).toEqual(['2026-10', '2026-09']);
  });
});
