import { describe, expect, it } from 'vitest';
import { empresasDeExemplo } from '../__exemplos__/empresas';
import { gravarVerificacao } from '../acoes';
import { FILTRO_MOVIMENTO_VAZIO, type Empresa } from '../tipos';
import { podeConferir } from './conciliacao';
import { montarRelatorio } from './relatorio';

const comercio = (): Empresa => empresasDeExemplo().find(e => e.nome === 'EXEMPLO COMERCIO DE ALIMENTOS LTDA') as Empresa;
const linhaDa = (e: Empresa, codigo: string) => montarRelatorio(e, FILTRO_MOVIMENTO_VAZIO, '').saldo.find(l => l.contas.indexOf(codigo) > -1);

describe('montarRelatorio na empresa de exemplo', () => {
  const r = montarRelatorio(comercio(), FILTRO_MOVIMENTO_VAZIO, '');

  it('compras à prazo + à vista juntas batem (ok)', () => {
    const l = r.saldo.find(x => x.contas.join('+') === '66005+66006');
    expect(l?.titulo).toBe('66005 + 66006 — Compras de Mercadorias');
    expect(l?.situacao.tipo).toBe('ok');
  });
  it('fretes com diferença', () => {
    const l = r.saldo.find(x => x.contas[0] === '66015');
    expect(l?.situacao.tipo).toBe('diferenca');
    expect(l?.situacao.tipo === 'diferenca' && l.situacao.diferenca).toBeCloseTo(95.5, 2);
  });
  it('vínculo no Passivo (21101) traz o aviso', () => {
    expect(r.saldo.find(x => x.contas[0] === '21101')?.avisoPassivo).toContain('Conta do passivo: 21101');
    expect(r.saldo.find(x => x.contas[0] === '66015')?.avisoPassivo).toBeNull();
  });
  it('energia (31105) pode ser conferida e, conferida, vira "conferido"', () => {
    const e = comercio();
    expect(podeConferir(e, ['31105'])).toBe(true);
    expect(linhaDa(e, '31105')?.situacao.tipo).toBe('diferenca');
    const e2 = gravarVerificacao(e, FILTRO_MOVIMENTO_VAZIO, '31105', 'conferido', 'Conta 31105 · conferido', new Date());
    expect(linhaDa(e2, '31105')?.situacao.tipo).toBe('conferido');
  });
  it('gráfico com 2 meses e totais de entrada/saída', () => {
    expect(r.meses.map(m => m.comp)).toEqual(['2026-07', '2026-08']);
    expect(r.totEnt).toBeGreaterThan(0);
    expect(r.totSai).toBeGreaterThan(0);
  });
  it('marca sozinho as naturezas que batem (compras sim, fretes não)', () => {
    const chaves = r.marcarSozinho.map(x => x.chave);
    expect(chaves.some(k => k.endsWith('||Compra para comercialização'))).toBe(true);
    expect(chaves.some(k => k.endsWith('||Frete Comercial (entrada)'))).toBe(false);
  });
  it('aba Entradas mostra só linhas com natureza de entrada', () => {
    const s = montarRelatorio(comercio(), FILTRO_MOVIMENTO_VAZIO, 'Entrada').saldo;
    expect(s.some(x => x.contas[0] === '40104')).toBe(false);
    expect(s.some(x => x.contas[0] === '66015')).toBe(true);
  });
});
