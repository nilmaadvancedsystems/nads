import { describe, expect, it } from 'vitest';
import type { ArquivoImportado, EmpresaExtrator, RegistroAuditoria } from '../tipos';
import { empresaDoBanco, gravacao, semMudanca } from './banco';

const arq = (id: string, importadoEm: string, valor = 100): ArquivoImportado => ({
  id, lado: 'banco', nome: id + '.pdf', importadoEm, modo: 'primeira', lancamentos: [{ data: '2026-07-01', valor, historico: 'PIX' }],
});
const aud = (acao: string): RegistroAuditoria => ({ ts: '2026-09-29T10:00:00.000Z', acao, detalhe: '', tom: 'ok' });
const emp = (arquivos: ArquivoImportado[], auditoria = [aud('importou')]): EmpresaExtrator => ({ nome: 'FITO', arquivos, auditoria });

describe('o que gravar no banco', () => {
  it('empresa nova: grava o documento e todos os arquivos', () => {
    const g = gravacao(null, emp([arq('a', '2026-09-29T10:00:00Z')]));
    expect(g.empresa).toEqual({ nome: 'FITO', auditoria: [aud('importou')] });
    expect(g.arquivos.map(a => a.id)).toEqual(['a']);
    expect(g.apagar).toEqual([]);
  });
  it('importação nova: grava só o arquivo novo e a auditoria', () => {
    const antes = emp([arq('a', '2026-09-29T10:00:00Z')]);
    const depois = emp([...antes.arquivos, arq('b', '2026-09-29T11:00:00Z')], [...antes.auditoria, aud('importou b')]);
    const g = gravacao(antes, depois);
    expect(g.arquivos.map(a => a.id)).toEqual(['b']);
    expect(g.empresa?.auditoria).toHaveLength(2);
    expect(g.apagar).toEqual([]);
  });
  it('arquivo excluído: apaga só ele; arquivo sobreposto: regrava', () => {
    const antes = emp([arq('a', '2026-09-29T10:00:00Z'), arq('b', '2026-09-29T11:00:00Z')]);
    const depois = emp([arq('b', '2026-09-29T11:00:00Z', 250)]);
    const g = gravacao(antes, depois);
    expect(g.apagar).toEqual(['a']);
    expect(g.arquivos.map(a => a.id)).toEqual(['b']);
    expect(g.empresa).toBeNull();
  });
  it('nada mudou: nada a gravar', () => {
    const e = emp([arq('a', '2026-09-29T10:00:00Z')]);
    expect(semMudanca(gravacao(e, structuredClone(e)))).toBe(true);
  });
});

describe('remontar a empresa lida do banco', () => {
  it('arquivos na ordem de importação; documento faltando vira auditoria vazia', () => {
    const e = empresaDoBanco('FITO', null, [arq('b', '2026-09-29T11:00:00Z'), arq('a', '2026-09-29T10:00:00Z')]);
    expect(e.arquivos.map(a => a.id)).toEqual(['a', 'b']);
    expect(e.auditoria).toEqual([]);
    expect(empresaDoBanco('FITO', { auditoria: [aud('x')] }, []).auditoria).toEqual([aud('x')]);
  });
});

describe('dados de teste do protótipo', () => {
  it('extrato e razão na competência, com diferenças de propósito', async () => {
    const { arquivoDeTeste } = await import('./teste');
    const banco = arquivoDeTeste('banco', '2026-02');
    const sistema = arquivoDeTeste('sistema', '2026-02');
    expect(banco.nome).toBe('TESTE - Extrato Fevereiro/2026.pdf');
    expect(banco.lancamentos.every(l => l.data.startsWith('2026-02'))).toBe(true);
    expect(banco.lancamentos.some(l => l.data === '2026-02-28')).toBe(true); // dia 28 existe em fevereiro
    expect(sistema.lancamentos).toHaveLength(banco.lancamentos.length + 1); // −1 falta, +1 a mais, +1 duplicada
  });
});
