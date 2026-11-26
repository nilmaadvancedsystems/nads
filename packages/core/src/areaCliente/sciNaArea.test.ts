import { describe, expect, it } from 'vitest';
import { guiasDoSciNaArea, publicadosIdDaGuia, rotuloDaGuia, tipoDaGuiaDoSci, type GuiaDoSciReport } from './index';

describe('a guia do SCI Report como guia normal da Área (26/11/2026)', () => {
  it('o tipo pelo nome do modelo', () => {
    expect(tipoDaGuiaDoSci('DARF PIS')).toEqual({ tipo: 'DARF', tributo: 'PIS' });
    expect(tipoDaGuiaDoSci('DARF')).toEqual({ tipo: 'DARF' });
    expect(tipoDaGuiaDoSci('DAS - Simples Nacional')).toEqual({ tipo: 'DAS' });
    expect(tipoDaGuiaDoSci('FGTS Digital mensal')).toEqual({ tipo: 'FGTS' });
    expect(tipoDaGuiaDoSci('ICMS normal')).toEqual({ tipo: 'DAE' });
    expect(tipoDaGuiaDoSci('DAM ISS')).toEqual({ tipo: 'DAM' });
    expect(tipoDaGuiaDoSci('Guia DCTFWeb')).toEqual({ tipo: 'DARF', tributo: 'DCTFWeb' });
    expect(tipoDaGuiaDoSci('GPS')).toEqual({ tipo: 'outra' });
  });

  it('as em aberto entram na lista; as pagas vão para Pagas; a que o nads já mandou não repete', () => {
    const sci: GuiaDoSciReport[] = [
      { id: '11', nome: 'DARF PIS', competencia: '2026-10', vencimento: '25/11/2026', valor: 412.88, situacao: 'vencida' },
      { id: '12', nome: 'DAS', competencia: '2026-10', vencimento: '20/11/2026', valor: 1000, situacao: 'vencida' },
      { id: '13', nome: 'DAM ISS', competencia: '2026-10', vencimento: '10/11/2026', valor: 640, situacao: 'pagamento informado', pagamentoEm: '09/11/2026', valorPago: 640 },
      { id: '14', nome: 'GPS', competencia: '2026-10', vencimento: '20/12/2026', valor: 99, situacao: 'a vencer' },
    ];
    const r = guiasDoSciNaArea(sci, [{ vencimento: '20/11/2026', valor: 1000.001 }]);
    expect(r.aPagar.map(g => g.id)).toEqual(['sci-11', 'sci-14']);
    expect(r.aPagar[0]).toEqual({ id: 'sci-11', tipo: 'DARF', tributo: 'PIS', competencia: '2026-10', vencimento: '25/11/2026', valor: 412.88, situacao: 'vencida', temPdf: true });
    expect(rotuloDaGuia(r.aPagar[0])).toBe('DARF PIS');
    expect(rotuloDaGuia(r.aPagar[1])).toBe('GPS');
    expect(r.pagas).toEqual([{ id: 'sci-13', tipo: 'DAM', nome: 'DAM', competencia: '2026-10', valor: 640, pagoEm: '09/11/2026' }]);
    // nada de "SCI" no que o cliente vê
    expect(JSON.stringify(r)).not.toMatch(/sci report/i);
  });

  it('o id de volta para pedir o PDF', () => {
    expect(publicadosIdDaGuia('sci-123')).toBe('123');
    expect(publicadosIdDaGuia('das-2026-10-58')).toBe('');
    expect(publicadosIdDaGuia('sci-../x')).toBe('');
  });
});
