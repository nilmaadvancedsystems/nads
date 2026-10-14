import { describe, expect, it } from 'vitest';
import { empresasDeExemplo } from '../__exemplos__/empresas';
import { empresa, nota } from '../__legado__/fixtures';
import { FILTRO_MOVIMENTO_VAZIO } from '../tipos';
import { chaveNaturezaNota } from './cfop';
import { foraDoPadraoFiscalDaConta, foraDoPadraoServDaConta } from './foraDoPadraoDaConta';
import { contasDoPart } from './servicos';

// Verificar por conta (Vitor, 14/10/2026): o fora do padrão só das notas da conta conferida
describe('fora do padrão da conta', () => {
  // 1102 (conta 66005): padrão 6 → notas 2 e 4 fora; 1556 (conta 31122): padrão 215 → nota 9 fora
  const e = empresa({
    entradas: [...['6', '182', '6', '182', '6'].map((l, i) => nota('1102', l, 100 + i, String(i + 1))), nota('1556', '215', 10, '7'), nota('1556', '215', 10, '8'), nota('1556', '99', 10, '9')],
    naturezaConta: { [chaveNaturezaNota({ cfop: '1102', desc: '' })]: ['66005'], [chaveNaturezaNota({ cfop: '1556', desc: '' })]: ['31122'] },
  });
  it('nota fiscal: pela conta da natureza do CFOP', () => {
    const r = foraDoPadraoFiscalDaConta(e, 'entradas', 'cfop', ['66005']);
    expect(r.pendentes.flatMap(g => g.itens.map(d => d.nota.numero))).toEqual(['2', '4']);
    expect(foraDoPadraoFiscalDaConta(e, 'entradas', 'cfop', ['31122']).pendentes.flatMap(g => g.itens.map(d => d.nota.numero))).toEqual(['9']);
    expect(foraDoPadraoFiscalDaConta(e, 'entradas', 'cfop', ['99999']).temDivergencias).toBe(false);
  });
  it('serviço: pela conta da categoria do participante', () => {
    const [comercio] = empresasDeExemplo();
    const contas = contasDoPart(comercio, 'tomados', 'PROVEDOR LAMBDA INTERNET LTDA');
    expect(contas.length).toBeGreaterThan(0);
    const r = foraDoPadraoServDaConta(comercio, 'tomados', FILTRO_MOVIMENTO_VAZIO, 'nome', contas);
    expect(r.pendentes.map(g => g.nome)).toContain('PROVEDOR LAMBDA INTERNET LTDA');
    expect(r.pendentes.every(g => contasDoPart(comercio, 'tomados', g.nome).some(c => contas.includes(c)))).toBe(true);
    expect(foraDoPadraoServDaConta(comercio, 'tomados', FILTRO_MOVIMENTO_VAZIO, 'nome', ['99999']).temDivergencias).toBe(false);
  });
});
