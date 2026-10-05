import { describe, expect, it } from 'vitest';
import { CONTAS_PADRAO } from '../tipos';
import { comHistoricos, HISTORICOS_PADRAO, historicosDoDocumento, mesmosHistoricos } from './historicos';

describe('históricos do escritório', () => {
  it('o documento guardado: o que faltar (ou vier vazio) é o padrão', () => {
    expect(historicosDoDocumento(null)).toEqual(HISTORICOS_PADRAO);
    expect(historicosDoDocumento({ histPrincipal: ' 300 ', histJuros: '', histDesconto: 9 })).toEqual({ histPrincipal: '300', histJuros: '59648', histDesconto: '256' });
  });
  it('passam por cima dos da empresa; as contas ficam', () => {
    const c = comHistoricos({ ...CONTAS_PADRAO, histPrincipal: '1', banco: '10999' }, { histPrincipal: '300', histJuros: '59648', histDesconto: '256' });
    expect([c.histPrincipal, c.banco]).toEqual(['300', '10999']);
    expect(mesmosHistoricos(HISTORICOS_PADRAO, { ...HISTORICOS_PADRAO })).toBe(true);
  });
});
