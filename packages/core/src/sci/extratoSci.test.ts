// Extrato → SCI no minimum (25/11/2026): um extrato fictício em PDF, lido pelo leitor do Rotinas, vira a planilha do gerador do
// SCI (o modelo "nads"). Banco, nomes e valores inventados.
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { lerArquivo } from '../extratudo/extrator/arquivos/leitura';
import type { RegraDoLancatudo } from '../lancatudo/tipos';
import {
  COLUNAS_DO_SCI, contaDoNadsNoSci, lancamentosDoExtratoSci, linhasDoExtratoSci, loteDoExtrato, planilhaDoSci, planoDoSci,
  regraDoMinimumDaLinha, resumoDoExtratoSci, saldoDoExtrato, type EntradaDoExtratoSci,
} from './index';

/** PDF de uma página com Helvetica: cada linha é [x, y, texto] (o mesmo do teste do extrator). */
function pdfMinimo(linhas: [number, number, string][]): Uint8Array {
  const esc = (s: string) => s.replace(/[\\()]/g, m => '\\' + m);
  const conteudo = linhas.map(([x, y, t]) => 'BT /F1 9 Tf ' + x + ' ' + y + ' Td (' + esc(t) + ') Tj ET').join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    '<< /Length ' + conteudo.length + ' >>\nstream\n' + conteudo + '\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let s = '%PDF-1.4\n';
  const pos: number[] = [];
  objs.forEach((o, i) => { pos.push(s.length); s += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'; });
  const xref = s.length;
  s += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('');
  s += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
  return new TextEncoder().encode(s);
}

/** O extrato fictício de agosto: o saldo anterior, 4 lançamentos e o saldo de cada dia. */
const EXTRATO = pdfMinimo([
  [40, 760, 'BANCO EXEMPLO - Extrato de 01/08/2026 a 31/08/2026'],
  [40, 740, 'Data'], [100, 740, 'Historico'], [400, 740, 'Valor'], [480, 740, 'Saldo'],
  [40, 730, '31/07/2026'], [100, 730, 'SALDO ANTERIOR'], [480, 730, '10.000,00'],
  [40, 720, '03/08/2026'], [100, 720, 'PIX RECEBIDO CLIENTE ALFA'], [400, 720, '4.500,00'], [480, 720, '14.500,00'],
  [40, 706, '04/08/2026'], [100, 706, 'TARIFA PACOTE'], [400, 706, '-45,90'], [480, 706, '14.454,10'],
  [40, 692, '05/08/2026'], [100, 692, 'DEBITO ENERGIA ELETRICA'], [400, 692, '-200,00'], [480, 692, '14.254,10'],
  [40, 678, '06/08/2026'], [100, 678, 'PAGTO FULANO DESCONHECIDO'], [400, 678, '-100,00'], [480, 678, '14.154,10'],
]);

const plano = planoDoSci('90113');
const regra = (x: Partial<RegraDoLancatudo>): RegraDoLancatudo => ({
  id: 'r', tipo: 'historico', expressao: '', sentido: 'ambos', conta: '', comHistoricoDoExtrato: true, criadaEm: '2026-11-01T00:00:00Z', por: 'teste', ...x,
});

/** As regras: a do minimum (contas do SCI) e as do Lançatudo (contas do nads, que passam pelo de/para). */
const entrada = (lancamentos: EntradaDoExtratoSci['lancamentos']): EntradaDoExtratoSci => ({
  lancamentos, banco: 'sicoob1', contaDoBanco: '652', plano, historicoPadrao: { entrada: '2000', saida: '1000' },
  regrasDoMinimum: [regra({ id: 'm1', expressao: 'PIX RECEBIDO', sentido: 'entrada', conta: '614', codHistorico: '2000' })],
  regrasDoLancatudo: [
    regra({ id: 'l1', expressao: 'TARIFA', sentido: 'saida', conta: '1200', codHistorico: '77' }),
    regra({ id: 'l2', expressao: 'ENERGIA', sentido: 'saida', conta: '999' }),
    // a do minimum vale antes desta
    regra({ id: 'l3', expressao: 'PIX RECEBIDO CLIENTE', sentido: 'entrada', conta: '1200' }),
  ],
  dePara: new Map([['1200', { codigo: '565', nome: 'Despesas Bancárias' }]]),
});

describe('extrato → SCI', () => {
  it('lê o PDF, põe a contrapartida pelas regras e baixa a planilha no layout "nads"', { timeout: 20000 }, async () => {
    const lido = await lerArquivo('extrato agosto.pdf', EXTRATO, 'banco');
    expect(lido.erro).toBeNull();
    expect(lido.lancamentos.map(l => l.valor)).toEqual([450000, -4590, -20000, -10000]);

    // o saldo: 10.000,00 + 4.500,00 − 345,90 = 14.154,10, e os saldos impressos fecham
    const saldo = saldoDoExtrato(lido);
    expect(saldo).toMatchObject({ saldoAnterior: 1000000, entradas: 450000, saidas: 34590, saldoFinal: 1415410 });
    expect(saldo.fecha).toBe(true);

    const linhas = linhasDoExtratoSci(entrada(lido.lancamentos));
    // o que entrou debita o banco; o que saiu credita o banco
    expect(linhas[0]).toMatchObject({ origem: 'minimum', contrapartida: '614', debito: '652', credito: '614', historico: '2000', complemento: 'PIX RECEBIDO CLIENTE ALFA' });
    // a regra do Lançatudo pelo de/para; o código do histórico do Alterdata não vale no SCI: fica o padrão (o das saídas)
    expect(linhas[1]).toMatchObject({ origem: 'regra', contrapartida: '565', nomeDaContrapartida: 'Despesas Bancárias', debito: '565', credito: '652', historico: '1000' });
    // a conta da regra sem par no SCI: em branco, com o aviso
    expect(linhas[2]).toMatchObject({ origem: null, contrapartida: '', semPar: '999', regra: 'ENERGIA' });
    // sem regra: em branco para a pessoa escolher (decisão do dono)
    expect(linhas[3]).toMatchObject({ origem: null, contrapartida: '', semPar: '', debito: '', credito: '652' });
    expect(resumoDoExtratoSci(linhas)).toEqual({ linhas: 4, comConta: 2, emBranco: 2, ignoradas: 0 });

    // a pessoa escolhe a conta da última pelo apelido e tira a terceira da planilha
    const decisoes = { [linhas[3].chave]: { conta: 'ENGELE' }, [linhas[2].chave]: { ignorar: true } };
    const conferidas = linhasDoExtratoSci({ ...entrada(lido.lancamentos), decisoes });
    expect(conferidas[3]).toMatchObject({ origem: 'pessoa', contrapartida: '397', debito: '397', contaEscolhida: true });

    const lancamentos = lancamentosDoExtratoSci(conferidas, { cnpjEmpresa: '11.222.333/0001-81', nomeDoBanco: 'Sicoob', plano });
    expect(lancamentos).toHaveLength(3);
    expect(lancamentos.every(l => !l.problemas.length)).toBe(true);
    expect(lancamentos[0]).toMatchObject({ lote: 'SICO2608', cnpjEmpresa: '11.222.333/0001-81', valor: 450000, documento: '' });

    // a aba Importar: os títulos do gerador na linha 1, os lançamentos da linha 2 e o Total no fim (descarta 1)
    const wb = XLSX.read(planilhaDoSci(lancamentos), { type: 'array' });
    expect(wb.SheetNames).toEqual(['Importar']);
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Importar, { header: 1, raw: true });
    expect(aoa[0]).toEqual([...COLUNAS_DO_SCI]);
    expect(aoa.slice(1, 4).map(r => r.slice(1, 5))).toEqual([[652, 614, 4500, 2000], [565, 652, 45.9, 1000], [397, 652, 100, 1000]]);
    expect(aoa[4][0]).toBe('Total');
  });

  it('a linha sem contrapartida ou sem a conta do banco vai para a Conferir, com o motivo', () => {
    const ls = linhasDoExtratoSci({ ...entrada([{ data: '2026-08-06', valor: -10000, historico: 'PAGTO FULANO' }]), contaDoBanco: '' });
    const [l] = lancamentosDoExtratoSci(ls, { cnpjEmpresa: '11.222.333/0001-81', nomeDoBanco: 'Sicoob', plano });
    expect(l.problemas).toEqual(['falta a conta do banco no SCI', 'sem contrapartida']);
    const wb = XLSX.read(planilhaDoSci([l]), { type: 'array' });
    expect(wb.SheetNames).toEqual(['Importar', 'Conferir']);
  });

  it('sem regra com histórico, o histórico padrão do lado: o das entradas no que entrou, o das saídas no que saiu', () => {
    const [entrou, saiu] = linhasDoExtratoSci(entrada([{ data: '2026-08-06', valor: 500, historico: 'DEPOSITO' }, { data: '2026-08-06', valor: -500, historico: 'SAQUE' }]));
    expect([entrou.historico, saiu.historico]).toEqual(['2000', '1000']);
  });

  it('a conta do nads no SCI: pelo de/para; sem de/para nenhum, o mesmo código se existe no plano', () => {
    const dePara = new Map([['10503', { codigo: '652', nome: 'Banco Sicoob' }]]);
    expect(contaDoNadsNoSci('10503', dePara, plano)).toBe('652');
    // com de/para, a conta sem par não vale (o mesmo número no SCI pode ser outra conta)
    expect(contaDoNadsNoSci('652', dePara, plano)).toBe('');
    expect(contaDoNadsNoSci('652', null, plano)).toBe('652');
    expect(contaDoNadsNoSci('99999999', null, plano)).toBe('');
  });

  it('a regra do minimum a partir da linha, o lote por extrato e o saldo que não fecha', () => {
    const r = regraDoMinimumDaLinha({ historicoDoBanco: 'PIX ENVIADO 12.345.678/0001-90 FORNECEDOR', valor: -500 }, ' 565 ', 'Ana', new Date('2026-11-25T12:00:00Z'), '1000');
    expect(r).toMatchObject({ tipo: 'favorecido', expressao: '12345678000190', sentido: 'saida', conta: '565', codHistorico: '1000', por: 'Ana' });
    expect(loteDoExtrato('Banco do Brasil', '2026-11')).toBe('BANC2611');
    expect(loteDoExtrato('BB', '2026-11')).toBe('BB2611');
    const s = saldoDoExtrato({ lancamentos: [{ data: '2026-08-03', valor: 100, historico: 'x' }], conferenciaPeloSaldo: { conferidos: 3, naoFecham: 1, exemplos: [{ data: '2026-08-03', impresso: 200, calculado: 100 }] } });
    expect(s).toMatchObject({ saldoAnterior: null, saldoFinal: null, fecha: false, naoFecham: 1 });
    expect(saldoDoExtrato({ lancamentos: [] }).fecha).toBeNull();
  });
});
