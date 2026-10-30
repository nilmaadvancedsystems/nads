import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, ArquivoLido, Lancamento } from '../tipos';
import { gravacao, LIMITE_DO_DOCUMENTO, lotesDaGravacao } from './banco';
import { bytesNoBanco, caberNoBanco, empresaNova, importar, TAMANHO_PARA_CORTAR } from './importacao';

// um razão grande (como o do BB de um posto: ~7 mil lançamentos, mais de 1 MB): 8 meses de 900 lançamentos
const lancamentos: Lancamento[] = [];
for (let m = 1; m <= 8; m++) for (let i = 0; i < 900; i++) {
  lancamentos.push({ data: '2026-0' + m + '-' + String(1 + (i % 28)).padStart(2, '0'), valor: (i % 2 ? -1 : 1) * (1000 + i), historico: 'Cielo Vendas Débito', conta: '11005', complemento: '0000 14024 732 Cielo Vendas Débito 47.206.312.001 lançamento ' + i });
}
const lido: ArquivoLido = { nome: 'BANCO DO BRASIL.xls', lancamentos, erro: null };

describe('o arquivo grande demais para um documento do banco (Vitor, 26/10/2026: o razão do BB da 237 sumia)', () => {
  it('entra cortado por mês, cada pedaço abaixo do limite, sem perder lançamento', () => {
    let n = 0;
    const r = importar(empresaNova('t'), 'sistema', [lido], 'primeira', new Date('2026-10-26T12:00:00Z'), () => 'a' + ++n);
    expect(JSON.stringify(lancamentos).length).toBeGreaterThan(1_048_576);
    expect(r.empresa.arquivos.length).toBe(8);
    expect(r.empresa.arquivos.every(a => JSON.stringify(a).length < TAMANHO_PARA_CORTAR)).toBe(true);
    expect(r.empresa.arquivos.flatMap(a => a.lancamentos)).toEqual(lancamentos);
    expect(r.gravados).toBe(7200);
    expect(r.arquivos).toBe(1);
  });
  it('o arquivo pequeno continua inteiro', () => {
    const r = importar(empresaNova('t'), 'sistema', [{ ...lido, lancamentos: lancamentos.slice(0, 50) }], 'primeira', new Date(), () => 'b');
    expect(r.empresa.arquivos.map(a => a.id)).toEqual(['b']);
  });
});

describe('o mês grande demais para um documento (30/10/2026: o mês sozinho passava de 1 MB e o lote falhava inteiro)', () => {
  // um mês só com 9.000 lançamentos (uns 2 MB), do dia 1 ao 30, com o saldo anterior e os saldos do dia
  const doMes: Lancamento[] = [];
  for (let i = 0; i < 9000; i++) doMes.push({ data: '2026-03-' + String(1 + (i % 30)).padStart(2, '0'), valor: (i % 3 ? -1 : 1) * (100 + i), historico: 'Cielo Vendas Crédito Ágil', complemento: 'lançamento número ' + i + ' do posto' });
  const saldosDoDia = Array.from({ length: 30 }, (_, d) => ({ data: '2026-03-' + String(d + 1).padStart(2, '0'), saldo: d * 10 }));
  const grande: ArquivoImportado = { id: 'g', lado: 'banco', nome: 'EXTRATO MARCO.pdf', importadoEm: '2026-10-30T12:00:00Z', modo: 'primeira', lancamentos: doMes, saldoAnterior: 5000, saldosDoDia };
  const ordem = (ls: Lancamento[]) => ls.slice().sort((a, b) => a.data.localeCompare(b.data) || doMes.indexOf(a) - doMes.indexOf(b));

  it('é cortado em dias seguidos, cada pedaço abaixo do limite, sem perder nem repetir lançamento', () => {
    expect(bytesNoBanco(grande)).toBeGreaterThan(LIMITE_DO_DOCUMENTO);
    const p = caberNoBanco(grande);
    expect(p.length).toBeGreaterThan(1);
    expect(p.every(x => bytesNoBanco(x) <= TAMANHO_PARA_CORTAR)).toBe(true);
    expect(p.flatMap(x => x.lancamentos)).toEqual(ordem(doMes));
    expect(new Set(p.map(x => x.id)).size).toBe(p.length);
    // os dias não se misturam: cada dia num pedaço só (o dia cabe sozinho)
    const dias = p.map(x => new Set(x.lancamentos.map(l => l.data)));
    expect(dias.flatMap(d => [...d]).length).toBe(30);
  });
  it('cada pedaço leva o saldo anterior dele e os saldos dos dias dele', () => {
    const p = caberNoBanco(grande);
    let saldo = 5000;
    for (const x of p) {
      expect(x.saldoAnterior).toBe(saldo);
      saldo += x.lancamentos.reduce((t, l) => t + l.valor, 0);
      expect(x.saldosDoDia?.map(s => s.data)).toEqual([...new Set(x.lancamentos.map(l => l.data))].sort());
    }
  });
  it('o dia sozinho maior que o limite vai em partes', () => {
    const umDia = { ...grande, lancamentos: doMes.map(l => ({ ...l, data: '2026-03-10' })), saldosDoDia: [{ data: '2026-03-10', saldo: 1 }] };
    const p = caberNoBanco(umDia);
    expect(p.length).toBeGreaterThan(1);
    expect(p.every(x => bytesNoBanco(x) <= TAMANHO_PARA_CORTAR)).toBe(true);
    expect(p.flatMap(x => x.lancamentos)).toEqual(umDia.lancamentos);
    // o saldo do dia fica no último pedaço do dia
    expect(p.map(x => x.saldosDoDia?.length)).toEqual([...p.slice(1).map(() => 0), 1]);
  });
});

describe('a gravação em lotes (30/10/2026)', () => {
  const arq = (id: string, n: number): ArquivoImportado => ({ id, lado: 'banco', nome: id + '.pdf', importadoEm: '2026-10-30T12:00:00Z', modo: 'primeira',
    lancamentos: Array.from({ length: n }, (_, i) => ({ data: '2026-01-01', valor: i, historico: 'x'.repeat(80) })) });
  it('o arquivo maior que um documento fica de fora (para avisar); os outros gravam, com a empresa no último lote', () => {
    const depois = { ...empresaNova('t'), arquivos: [arq('a', 10), arq('enorme', 12000), arq('b', 10)], auditoria: [{ ts: '', acao: 'Importou extrato', detalhe: '', tom: 'ok' as const }] };
    const { lotes, naoCabem } = lotesDaGravacao(gravacao(null, depois));
    expect(naoCabem.map(a => a.id)).toEqual(['enorme']);
    expect(lotes.flatMap(l => l.arquivos.map(a => a.id))).toEqual(['a', 'b']);
    expect(lotes.at(-1)?.empresa?.nome).toBe('t');
  });
  it('muitos arquivos grandes: vários lotes, cada um abaixo do pedido do banco; os apagados depois dos arquivos', () => {
    const antes = { ...empresaNova('t'), arquivos: [arq('velho', 1)] };
    const depois = { ...empresaNova('t'), arquivos: Array.from({ length: 20 }, (_, i) => arq('p' + i, 5000)) };
    const { lotes, naoCabem } = lotesDaGravacao(gravacao(antes, depois));
    expect(naoCabem).toEqual([]);
    expect(lotes.length).toBeGreaterThan(1);
    expect(lotes.every(l => l.arquivos.reduce((t, a) => t + bytesNoBanco(a), 0) <= 8_000_000)).toBe(true);
    expect(lotes.flatMap(l => l.arquivos).length).toBe(20);
    expect(lotes.slice(0, -1).every(l => !l.apagar.length)).toBe(true);
    expect(lotes.at(-1)?.apagar).toEqual(['velho']);
  });
});
