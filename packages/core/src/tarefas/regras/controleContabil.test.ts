import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
  anoDeTrabalhoContabil, controleContabilLiberadoPara, idDaLinhaContabil, lerPlanilhaDoControleContabil, linhaContabilEmBranco, linhaContabilVazia,
  linhasDaPlanilhaContabil, mesDoTexto, mesEsperadoContabil, planoDaImportacaoContabil, regimeDaPlanilhaContabil, rotuloDoMesFeito,
  situacaoContabil, sugestaoDoExecutor, textoDoComentario, type LinhaDoControleContabil,
} from './controleContabil';

// só empresas de exemplo (a planilha de verdade entra pela tela)
const CABECALHO = ['Nº', 'EMPRESAS', 'Meses', 'Regime', 'OBSERVAÇÕES'];

describe('o Controle contábil (23/11/2026)', () => {
  it('liberado só para o Fernando fora do modo desenvolvedor', () => {
    expect(['Fernando', 'Fernando Souza', 'FERNANDO', 'fernando.s', 'Clara', 'Felipe', '', null].map(controleContabilLiberadoPara))
      .toEqual([true, true, true, true, false, false, false, false]);
  });

  it('o mês da coluna Meses em qualquer jeito de escrever', () => {
    expect(['OUT', 'out', 'Outubro', 'Março', 'MAR', '10', '10/2026', '2026-09', 3, '-', '—', '', 'nenhum'].map(mesDoTexto))
      .toEqual([10, 10, 10, 3, 3, 10, 10, 9, 3, 0, 0, null, 0]);
    expect(['13', 'outro', 'OUTU', 14].map(mesDoTexto)).toEqual([undefined, undefined, undefined, undefined]);
    expect([0, 1, 10, 12].map(rotuloDoMesFeito)).toEqual(['—', 'JAN', 'OUT', 'DEZ']);
  });

  it('o mês esperado é o anterior ao de hoje; o ano que passou espera dezembro', () => {
    const hoje = new Date(2026, 10, 23); // 23/11/2026
    expect(mesEsperadoContabil(2026, hoje)).toBe(10);
    expect(mesEsperadoContabil(2025, hoje)).toBe(12);
    expect(mesEsperadoContabil(2027, hoje)).toBe(0);
    // em janeiro, o esperado é dezembro do ano anterior, e a tela abre nele
    const janeiro = new Date(2027, 0, 10);
    expect(mesEsperadoContabil(2026, janeiro)).toBe(12);
    expect(mesEsperadoContabil(2027, janeiro)).toBe(0);
    expect(anoDeTrabalhoContabil(janeiro)).toBe(2026);
    expect(anoDeTrabalhoContabil(hoje)).toBe(2026);
  });

  it('a situação: em dia, atrasada, não iniciada e não acompanhar', () => {
    expect(situacaoContabil({ feitaAte: 10, pausada: '' }, 10)).toEqual({ situacao: 'em-dia', atraso: 0, rotulo: 'Em dia' });
    expect(situacaoContabil({ feitaAte: 11, pausada: '' }, 10).situacao).toBe('em-dia');
    expect(situacaoContabil({ feitaAte: 9, pausada: '' }, 10)).toEqual({ situacao: 'atrasada', atraso: 1, rotulo: 'Atrasada 1 mês' });
    expect(situacaoContabil({ feitaAte: 7, pausada: '' }, 10).rotulo).toBe('Atrasada 3 meses');
    expect(situacaoContabil({ feitaAte: 0, pausada: '' }, 10)).toEqual({ situacao: 'nao-iniciada', atraso: 10, rotulo: 'Não iniciada' });
    expect(situacaoContabil({ feitaAte: 7, pausada: 'Arrendada' }, 10)).toEqual({ situacao: 'pausada', atraso: 0, rotulo: 'Não acompanhar' });
    // o ano que ainda não começou: nada esperado, todo mundo em dia
    expect(situacaoContabil({ feitaAte: 0, pausada: '' }, 0).situacao).toBe('em-dia');
  });

  it('a sugestão do executor: os meses concluídos em seguida ao feito, sem buraco', () => {
    expect(sugestaoDoExecutor(2026, 8, ['2026-09', '2026-10'])).toBe(10);
    expect(sugestaoDoExecutor(2026, 8, ['2026-10'])).toBeNull(); // setembro não está concluído
    expect(sugestaoDoExecutor(2026, 10, ['2026-09', '2026-10'])).toBeNull(); // nada à frente
    expect(sugestaoDoExecutor(2026, 0, ['2026-01', '2026-02', '2025-03'])).toBe(2);
    expect(sugestaoDoExecutor(2026, 11, ['2026-12', '2027-01'])).toBe(12);
  });

  it('a linha em branco e o id por empresa e ano', () => {
    expect(idDaLinhaContabil(2026, 901)).toBe('2026_901');
    const b = linhaContabilEmBranco(2026, 901);
    expect(linhaContabilVazia(b)).toBe(true);
    expect(linhaContabilVazia({ ...b, observacao: 'falta extrato' })).toBe(false);
    expect(linhaContabilVazia({ ...b, feitaAte: 3 })).toBe(false);
  });

  it('lê a planilha: acha o cabeçalho abaixo do título, o código, o mês, o regime e a observação', () => {
    const matriz = [
      ['', 'PLANILHA DE EMPRESAS'], [], ['N°', 'EMPRESAS', 'Meses', 'Regime', 'OBSERVAÇÕES'],
      [901, 'EMPRESA EXEMPLO UM LTDA', 'OUT', 'Presumido', ''],
      [902, 'EMPRESA EXEMPLO DOIS LTDA', '-', 'Isentas', 'Falta extrato'],
      ['903', 'EMPRESA EXEMPLO TRÊS LTDA', '', 'Simples Nacional', ''],
      ['', 'SEM CÓDIGO LTDA', 'AGO', 'Real', ''],
      [904, 'EMPRESA EXEMPLO QUATRO', 'TALVEZ', 'Real', ''],
      [901, 'EMPRESA EXEMPLO UM LTDA', 'SET', 'Presumido', ''],
      ['', '', '', '', ''],
    ];
    const r = linhasDaPlanilhaContabil(matriz, new Map([[4, 'Feita até 07/2026, balancete enviado']]));
    expect(r.erro).toBeUndefined();
    expect(r.linhas).toEqual([
      { codigo: 901, nome: 'EMPRESA EXEMPLO UM LTDA', feitaAte: 10, regime: 'Presumido', observacao: '' },
      { codigo: 902, nome: 'EMPRESA EXEMPLO DOIS LTDA', feitaAte: 0, regime: 'Isentas', observacao: 'Falta extrato — Feita até 07/2026, balancete enviado' },
      { codigo: 903, nome: 'EMPRESA EXEMPLO TRÊS LTDA', feitaAte: null, regime: 'Simples Nacional', observacao: '' },
    ]);
    expect(r.ignoradas.map(i => i.linha)).toEqual([7, 8, 9]);
    expect(r.ignoradas[0].motivo).toContain('sem o código');
    expect(r.ignoradas[1].motivo).toContain('TALVEZ');
    expect(r.ignoradas[2].motivo).toContain('de novo');
  });

  it('sem as colunas EMPRESAS e Meses, avisa', () => {
    expect(linhasDaPlanilhaContabil([['Código', 'Nome'], [1, 'X']]).erro).toContain('EMPRESAS e Meses');
  });

  it('lê o .xlsx com o comentário encadeado do Excel', () => {
    const ws = XLSX.utils.aoa_to_sheet([['', 'PLANILHA DE EMPRESAS'], CABECALHO, [905, 'EMPRESA EXEMPLO CINCO LTDA', 'JUL', 'Presumido', 'A empresa foi arrendada']]);
    ws.E3.c = [{ a: 'tc', t: '[Threaded comment]\n Your version of Excel allows you to read this threaded comment.\nComment:\n\tContabilidade feita até 07/2026' }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'PRESUMIDO');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    const r = lerPlanilhaDoControleContabil(buf);
    expect(r.linhas).toEqual([{ codigo: 905, nome: 'EMPRESA EXEMPLO CINCO LTDA', feitaAte: 7, regime: 'Presumido', observacao: 'A empresa foi arrendada — Contabilidade feita até 07/2026' }]);
    expect(lerPlanilhaDoControleContabil(new ArrayBuffer(0)).linhas).toEqual([]);
    expect(textoDoComentario('só o texto')).toBe('só o texto');
  });

  it('o regime da planilha no nome do Cadastro', () => {
    expect(['Simples Nacional', 'Presumido', 'Lucro Real', 'Real', 'Isentas', 'Imune', '', 'MEI'].map(regimeDaPlanilhaContabil))
      .toEqual(['Simples', 'Presumido', 'Real', 'Real', 'Isentas', 'Isentas', '', 'MEI']);
  });

  it('a importação: casa pelo código, não volta o mês, não apaga com célula em branco e só avisa o regime', () => {
    const ano = 2026;
    const empresas = [
      { codigo: 901, nome: 'Exemplo Um', regime: 'Presumido' }, { codigo: 902, nome: 'Exemplo Dois', regime: 'Isentas' },
      { codigo: 903, nome: 'Exemplo Três', regime: 'Presumido' }, { codigo: 904, nome: 'Exemplo Quatro', regime: 'Real' },
    ];
    const existentes = new Map<number, LinhaDoControleContabil>([
      [902, { ano, codigo: 902, feitaAte: 0, observacao: 'Falta extrato', pausada: '' }],
      [903, { ano, codigo: 903, feitaAte: 10, observacao: 'nota antiga', pausada: '' }],
      [904, { ano, codigo: 904, feitaAte: 5, observacao: '', pausada: 'Arrendada' }],
    ]);
    const lidas = [
      { codigo: 901, nome: 'EXEMPLO UM', feitaAte: 10, regime: 'Presumido', observacao: '' },
      { codigo: 902, nome: 'EXEMPLO DOIS', feitaAte: 0, regime: 'Isentas', observacao: '' },
      { codigo: 903, nome: 'EXEMPLO TRÊS', feitaAte: 8, regime: 'Simples Nacional', observacao: '' },
      { codigo: 904, nome: 'EXEMPLO QUATRO', feitaAte: null, regime: 'Real', observacao: 'Falta provisão' },
      { codigo: 999, nome: 'NÃO CADASTRADA', feitaAte: 3, regime: 'Real', observacao: '' },
    ];
    const p = planoDaImportacaoContabil({ ano, lidas, empresas, existentes });
    expect(p.gravar).toEqual([
      { ano, codigo: 901, feitaAte: 10, observacao: '', pausada: '' },
      { ano, codigo: 904, feitaAte: 5, observacao: 'Falta provisão', pausada: 'Arrendada' },
    ]);
    expect(p.iguais).toBe(2); // a 902 igual; a 903 fica com outubro e a nota de antes
    expect(p.mantidas).toEqual([{ codigo: 903, nome: 'Exemplo Três', noNads: 10, naPlanilha: 8 }]);
    expect(p.naoAchadas.map(l => l.codigo)).toEqual([999]);
    expect(p.regimeDiferente).toEqual([{ codigo: 903, nome: 'Exemplo Três', naPlanilha: 'Simples Nacional', noCadastro: 'Presumido' }]);
  });
});

describe('os dados de exemplo do Controle contábil', () => {
  it('as mesmas linhas para os mesmos códigos, com todas as situações', async () => {
    const { linhasDeExemploContabil } = await import('./controleContabil');
    const a = linhasDeExemploContabil(2026, [1, 2, 3, 4, 5, 6, 7], 10);
    expect(a).toEqual(linhasDeExemploContabil(2026, [1, 2, 3, 4, 5, 6, 7], 10));
    expect(new Set(a.map(l => situacaoContabil(l, 10).situacao))).toEqual(new Set(['em-dia', 'atrasada', 'nao-iniciada', 'pausada']));
  });
});
