// As guias do Fiscal já na pasta do Drive (plano do Acessórias, 17/11/2026, ficha E15).
import { describe, expect, it } from 'vitest';
import { criarControleTributosMemoria } from './controleTributos';
import { criarLoteFiscalMemoria, guiasDoDocumento } from './loteFiscal';

describe('as guias já na pasta', () => {
  it('lê o documento do mês campo a campo; o torto fica de fora', () => {
    const doc = { clientes: {
      444: { arquivos: [{ i: 'd1', n: '10-2026 - DARF PIS.pdf', c: 'FISCAL/LUCRO PRESUMIDO/05. DARF', s: 9000 }, { i: '', n: 'sem id.pdf' }] },
      58: { arquivos: [{ i: 'd2', n: '10-2026.pdf', c: 'FISCAL/SIMPLES NACIONAL/01. DAS' }] },
      abc: { arquivos: [{ i: 'd3', n: 'x.pdf' }] },
    } };
    expect(guiasDoDocumento('2026-10', doc)).toEqual([
      { driveId: 'd2', nome: '10-2026.pdf', pasta: 'FISCAL/SIMPLES NACIONAL/01. DAS', tamanho: 0, codigo: 58, competencia: '2026-10' },
      { driveId: 'd1', nome: '10-2026 - DARF PIS.pdf', pasta: 'FISCAL/LUCRO PRESUMIDO/05. DARF', tamanho: 9000, codigo: 444, competencia: '2026-10' },
    ]);
    expect(guiasDoDocumento('2026-10', null)).toEqual([]);
  });
  it('o exemplo cria o lote com as guias da pasta', async () => {
    const controle = criarControleTributosMemoria();
    const repo = criarLoteFiscalMemoria(() => controle);
    let guias: Parameters<typeof repo.criarDaPasta>[1] = [];
    repo.guiasNaPasta('2026-10', r => { guias = r.guias; })();
    const id = await repo.criarDaPasta('lp', guias.filter(g => g.codigo === 444));
    expect(repo.lotes().lista.find(l => l.id === id)?.total).toBe(2);
  });
});
