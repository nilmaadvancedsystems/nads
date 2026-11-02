import { describe, expect, it } from 'vitest';
import { cadastroDoDocumento, cadastroVazio, definirParametrosFiscais, documentoDoCadastro, voltarFiscalAPlanilha } from './cadastro';
import { EMPRESAS_NA_PLANILHA_DO_FISCAL, parametrosFiscaisDaPlanilha, parametrosFiscaisQueValem } from './fiscal';

const AGORA = new Date('2026-10-29T12:00:00Z');

describe('parâmetros do Fiscal: a planilha', () => {
  it('traz as 134 empresas das abas da Fabiana, do Heverton e do Gustavo', () => {
    expect(EMPRESAS_NA_PLANILHA_DO_FISCAL).toBe(134);
  });
  it('o que o Gustavo escreveu no lugar do Sim vale Sim, com o texto nas Observações', () => {
    expect(parametrosFiscaisDaPlanilha(602)).toMatchObject({ aba: 'GUSTAVO', retencoes: true, observacoes: 'Retenções: ISS' });
    expect(parametrosFiscaisDaPlanilha(371)).toMatchObject({ segmentos: [], especificidades: 'Associação' });
    expect(parametrosFiscaisDaPlanilha(66)).toMatchObject({ especificidades: 'Posto de Gasolina' });
    expect(parametrosFiscaisDaPlanilha(15)).not.toHaveProperty('observacoes');
  });
  it('lê o segmento e os de sim ou não da linha (Dornas Havana, 10, do Heverton)', () => {
    expect(parametrosFiscaisDaPlanilha(10)).toEqual({
      aba: 'HEVERTON', segmentos: ['comercio', 'industria', 'servico'],
      monofasico: false, icmsSt: true, icmsAntecipacao: true, icmsDifal: true, retencoes: true,
      beneficioFiscal: false, parcelamento: false, declaracoesAdicionais: false,
    });
    expect(parametrosFiscaisDaPlanilha(15)?.aba).toBe('FABIANA');
  });
  it('empresa fora da planilha ou sem código: null', () => {
    expect(parametrosFiscaisDaPlanilha(494)).toBeNull(); // a Caixa Escolar veio sem nada marcado
    expect(parametrosFiscaisDaPlanilha(null)).toBeNull();
  });
});

describe('parâmetros do Fiscal: o Cadastro por cima da planilha', () => {
  const c0 = cadastroVazio('DORNAS HAVANA LTDA', 10);

  it('sem mudança, vale a planilha', () => {
    const q = parametrosFiscaisQueValem(10, c0.fiscal);
    expect(q.valores.icmsSt).toBe(true);
    expect(q.origem.icmsSt).toBe('planilha');
    expect(q.aba).toBe('HEVERTON');
  });

  it('o mudado vale, fica no histórico e vai para o documento', () => {
    const c1 = definirParametrosFiscais(c0, { icmsSt: false, segmentos: ['servico', 'comercio'], observacoes: '  confere a ST  ' }, 'Heverton', AGORA);
    expect(c1.fiscal).toEqual({ icmsSt: false, segmentos: ['comercio', 'servico'], observacoes: 'confere a ST' });
    expect(c1.historico[0]).toMatchObject({ por: 'Heverton', acao: 'Fiscal' });
    const q = parametrosFiscaisQueValem(10, c1.fiscal);
    expect(q.valores.icmsSt).toBe(false);
    expect(q.origem.icmsSt).toBe('cadastro');
    expect(q.origem.monofasico).toBe('planilha');
    const lido = cadastroDoDocumento(c1.nome, 10, documentoDoCadastro(c1));
    expect(lido.fiscal).toEqual(c1.fiscal);
  });

  it('o mesmo valor de novo não muda nada; null volta o da planilha', () => {
    const c1 = definirParametrosFiscais(c0, { icmsSt: false }, 'Heverton', AGORA);
    expect(definirParametrosFiscais(c1, { icmsSt: false }, 'Heverton', AGORA)).toBe(c1);
    const c2 = definirParametrosFiscais(c1, { icmsSt: null }, 'Heverton', AGORA);
    expect(c2.fiscal).toBeUndefined();
    expect('fiscal' in documentoDoCadastro(c2)).toBe(false);
  });

  it('voltar à planilha tira tudo o que foi mudado', () => {
    const c1 = definirParametrosFiscais(c0, { parcelamento: true, especificidades: 'x' }, 'Heverton', AGORA);
    const c2 = voltarFiscalAPlanilha(c1, 'Heverton', AGORA);
    expect(c2.fiscal).toBeUndefined();
    expect(voltarFiscalAPlanilha(c2, 'Heverton', AGORA)).toBe(c2);
  });

  it('o documento com campo estranho ou do tipo errado fica de fora', () => {
    const lido = cadastroDoDocumento('X', 10, { nome: 'X', historico: [], fiscal: { icmsSt: 'sim', monofasico: true, segmentos: ['comercio', 'outro'], xyz: 1 } });
    expect(lido.fiscal).toEqual({ monofasico: true, segmentos: ['comercio'] });
  });
});
