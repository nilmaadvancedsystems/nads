import { describe, expect, it } from 'vitest';
import { empresa } from '../__legado__/fixtures';
import type { RegistroConferencia } from '../tipos';
import { linhasAuditoria, registrarHist, registrarMarcaChecklist } from './auditoria';

const t0 = new Date(2026, 8, 28, 10, 0, 10);
const mesmoMinuto = new Date(2026, 8, 28, 10, 0, 50);
const outroMinuto = new Date(2026, 8, 28, 10, 1, 5);
const reg = (acao: 'marcado' | 'desmarcado', origem: 'manual' | 'automatico' = 'manual'): RegistroConferencia =>
  ({ ts: t0.toISOString(), chave: 'k', texto: 't', acao, origem });

describe('registrarHist', () => {
  it('desfazer no mesmo minuto apaga o registro', () => {
    expect(registrarHist([reg('marcado')], 'k', 't', false, mesmoMinuto)).toEqual([]);
  });
  it('em outro minuto guarda os dois', () => {
    const h = registrarHist([reg('marcado')], 'k', 't', false, outroMinuto, 'divergencia');
    expect(h.length).toBe(2);
    expect(h[1]).toMatchObject({ acao: 'desmarcado', origem: 'manual', categoria: 'divergencia' });
  });
  it('registro automático não é desfeito', () => {
    expect(registrarHist([reg('marcado', 'automatico')], 'k', 't', false, mesmoMinuto).length).toBe(2);
  });
});

describe('registrarMarcaChecklist', () => {
  it('só some ao desmarcar o que acabou de marcar', () => {
    expect(registrarMarcaChecklist([reg('marcado')], 'k', 't', false, mesmoMinuto)).toEqual([]);
    expect(registrarMarcaChecklist([reg('desmarcado')], 'k', 't', true, mesmoMinuto).length).toBe(2);
  });
});

describe('linhasAuditoria', () => {
  const e = empresa({
    importHistorico: [
      { ts: '2026-09-01T10:00:00.000Z', tipo: 'Entradas', qtd: 5, acao: 'importado' },
      { ts: '2026-09-01T10:01:00.000Z', tipo: 'Saídas', qtd: 3, acao: 'importado', modo: 'sobreposto', substituidas: 7 },
      { ts: '2026-09-01T10:02:00.000Z', tipo: 'Balancete', qtd: 20, acao: 'excluido', auto: true },
      { ts: '2026-09-01T10:03:00.000Z', tipo: 'Balancete', qtd: 20, acao: 'importado', forcado: true, aviso: 'outra empresa?' },
    ],
    confHistorico: [
      { ts: '2026-09-01T11:00:00.000Z', chave: 'verif|a', texto: 'Conta 1 · relatório sem pendências', acao: 'marcado', origem: 'manual', categoria: 'verificacao' },
      { ts: '2026-09-01T11:01:00.000Z', chave: 'verif|b', texto: 'Conta 2 · conferido', acao: 'marcado', origem: 'manual', categoria: 'verificacao' },
      { ts: '2026-09-01T11:02:00.000Z', chave: 'verif|a', texto: 'Conta 1 · voltou', acao: 'desmarcado', origem: 'manual', categoria: 'verificacao' },
      { ts: '2026-09-01T11:03:00.000Z', chave: 'auto1', texto: 'início a fim — 1102 — Compra', acao: 'marcado', origem: 'automatico' },
      { ts: '2026-09-01T11:04:00.000Z', chave: 'auto2', texto: '5102 — Venda', acao: 'marcado', origem: 'automatico' },
    ],
    confAutoMarcados: ['auto1'],
  });
  const l = linhasAuditoria(e);
  const acao = (ts: string) => l.find(x => x.ts === ts);

  it('importações: Importado / Sobreposto / Excluído ao sair / Importado com aviso', () => {
    expect(acao('2026-09-01T10:00:00.000Z')).toMatchObject({ acao: 'Importado', tom: 'ok', detalhe: 'Entradas · 5 nota(s)', origem: 'Manual' });
    expect(acao('2026-09-01T10:01:00.000Z')?.detalhe).toBe('Saídas · 3 nota(s) · substituiu 7 nota(s)');
    expect(acao('2026-09-01T10:01:00.000Z')?.acao).toBe('Sobreposto');
    expect(acao('2026-09-01T10:02:00.000Z')).toMatchObject({ acao: 'Excluído ao sair', tom: 'bad', origem: 'Automático', detalhe: 'Balancete · 20 conta(s)' });
    expect(acao('2026-09-01T10:03:00.000Z')).toMatchObject({ acao: 'Importado com aviso', tom: 'bad', detalhe: 'Balancete · 20 conta(s) — outra empresa?' });
  });
  it('Verificar por conta: Ok, Conferido, Desfeito', () => {
    expect(acao('2026-09-01T11:00:00.000Z')).toMatchObject({ tipo: 'Verificar por conta', acao: 'Ok' });
    expect(acao('2026-09-01T11:01:00.000Z')?.acao).toBe('Conferido');
    expect(acao('2026-09-01T11:02:00.000Z')?.acao).toBe('Desfeito');
  });
  it('Remover só na automática que ainda está marcada; tira o prefixo do período', () => {
    expect(acao('2026-09-01T11:03:00.000Z')?.remover).toEqual({ chave: 'auto1', texto: '1102 — Compra' });
    expect(acao('2026-09-01T11:04:00.000Z')?.remover).toBeUndefined();
  });
  it('mais novo primeiro', () => {
    expect(l[0].ts).toBe('2026-09-01T11:04:00.000Z');
    expect(l[l.length - 1].ts).toBe('2026-09-01T10:00:00.000Z');
  });
});
