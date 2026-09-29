import { describe, expect, it } from 'vitest';
import type { ArquivoLido, Lancamento } from '../tipos';
import { competencias, empresaNova, excluirArquivo, importar, jaTemNoPeriodo, lancamentosDe, linhasAuditoria, periodo, rotuloPeriodo, soNovos } from './importacao';

const l = (dia: number, valor: number, historico = 'H'): Lancamento => ({ data: '2026-08-' + String(dia).padStart(2, '0'), valor, historico });
const lido = (nome: string, lancamentos: Lancamento[], erro: string | null = null): ArquivoLido => ({ nome, lancamentos, erro });
const agora = new Date('2026-09-29T12:00:00Z');
function ids() { let n = 0; return () => 'a' + ++n; }

describe('importação', () => {
  it('primeira vez grava tudo; arquivo com erro ou vazio fica de fora', () => {
    const r = importar(empresaNova('X'), 'banco', [lido('a.pdf', [l(1, 10), l(2, -5)]), lido('b.pdf', [], 'sem texto'), lido('c.pdf', [])], 'primeira', agora, ids());
    expect(r.gravados).toBe(2);
    expect(r.arquivos).toBe(1);
    expect(r.empresa.arquivos[0]).toMatchObject({ id: 'a1', nome: 'a.pdf', lado: 'banco', modo: 'primeira', importadoEm: agora.toISOString() });
    expect(lancamentosDe(r.empresa, 'banco').map(x => x.id)).toEqual(['a1:0', 'a1:1']);
    expect(lancamentosDe(r.empresa, 'sistema')).toEqual([]);
    expect(r.empresa.auditoria[0].acao).toBe('Importou extrato');
  });

  it('apenas novas: reimportar o mesmo arquivo não grava nada; repetido conta', () => {
    const e = importar(empresaNova('X'), 'banco', [lido('a.pdf', [l(1, 10), l(1, 10), l(2, -5)])], 'primeira', agora, ids()).empresa;
    expect(jaTemNoPeriodo(e, 'banco', [lido('a.pdf', [l(1, 10)])])).toBeGreaterThan(0);
    expect(jaTemNoPeriodo(e, 'sistema', [lido('a.pdf', [l(1, 10)])])).toBe(0);
    const r = importar(e, 'banco', [lido('a.pdf', [l(1, 10), l(1, 10), l(1, 10), l(2, -5), l(3, 7)])], 'novas', agora, ids());
    expect([r.gravados, r.jaExistiam]).toEqual([2, 3]);
    expect(lancamentosDe(r.empresa, 'banco').length).toBe(5);
    const de = importar(r.empresa, 'banco', [lido('a.pdf', [l(1, 10)])], 'novas', agora, ids());
    expect([de.gravados, de.arquivos, de.empresa.arquivos.length]).toEqual([0, 0, 2]);
  });

  it('sobrepor apaga só as datas do arquivo novo', () => {
    const e = importar(empresaNova('X'), 'banco', [lido('jul-ago.pdf', [l(1, 10), l(15, 20), l(30, 30)])], 'primeira', agora, ids()).empresa;
    const r = importar(e, 'banco', [lido('novo.pdf', [l(10, 1), l(20, 2)])], 'sobrepor', agora, ids());
    expect(r.substituidos).toBe(1);
    expect(lancamentosDe(r.empresa, 'banco').map(x => x.valor).sort((a, b) => a - b)).toEqual([1, 2, 10, 30]);
  });

  it('sobrepor que esvazia um arquivo tira o arquivo', () => {
    const e = importar(empresaNova('X'), 'banco', [lido('a.pdf', [l(5, 10)])], 'primeira', agora, ids()).empresa;
    const r = importar(e, 'banco', [lido('b.pdf', [l(1, 1), l(9, 2)])], 'sobrepor', agora, ids());
    expect(r.empresa.arquivos.map(a => a.nome)).toEqual(['b.pdf']);
  });

  it('excluir arquivo registra na auditoria', () => {
    const e = importar(empresaNova('X'), 'sistema', [lido('razao.xlsx', [l(5, 10)])], 'primeira', new Date('2026-09-01T00:00:00Z'), ids()).empresa;
    const x = excluirArquivo(e, 'a1', agora);
    expect(x.arquivos).toEqual([]);
    expect(linhasAuditoria(x).map(a => [a.acao, a.detalhe])).toEqual([
      ['Excluiu arquivo', 'Sistema: razao.xlsx · 1 lançamento(s)'],
      ['Importou lançamentos do sistema', 'razao.xlsx · 1 gravado(s)'],
    ]);
    expect(excluirArquivo(e, 'nao-existe', agora)).toBe(e);
  });

  it('período e competências', () => {
    expect(rotuloPeriodo(periodo([l(9, 1), l(2, 1), l(30, 1)]))).toBe('02/08/2026 a 30/08/2026');
    expect(rotuloPeriodo(periodo([]))).toBe('—');
    const e = importar(empresaNova('X'), 'banco', [lido('a', [l(1, 1), { data: '2026-07-31', valor: 1, historico: '' }])], 'primeira', agora, ids()).empresa;
    expect(competencias(e)).toEqual(['2026-07', '2026-08']);
  });

  it('soNovos conta repetições', () => {
    expect(soNovos([l(1, 1, 'Á')], [l(1, 1, 'a'), l(1, 1, 'a')])).toEqual([l(1, 1, 'a')]);
  });
});
