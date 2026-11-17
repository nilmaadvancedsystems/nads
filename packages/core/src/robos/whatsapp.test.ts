import { describe, expect, it } from 'vitest';
import { mesmoNumero, PEDACO_DO_ANEXO, paraBase64, pedacosDoAnexo, textoDaEntrega } from './whatsapp';

describe('o WhatsApp do robô: o número, o anexo e os tiques', () => {
  it('o celular com e sem o 9 da frente é o mesmo número', () => {
    expect(mesmoNumero('553899197340', '5538999197340')).toBe(true);
    expect(mesmoNumero('5538999197340', '553899197340')).toBe(true);
    expect(mesmoNumero('553899197340', '553891383638')).toBe(false);
    expect(mesmoNumero('', '553899197340')).toBe(false);
  });

  it('o base64 é o mesmo do Node', () => {
    for (const t of ['', 'a', 'ab', 'abc', 'Solicitação de documentos ✓']) {
      const bytes = new TextEncoder().encode(t);
      expect(paraBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
    }
  });

  it('o anexo em pedaços que a regra do banco aceita, e nada acima de 5 MB', () => {
    const bytes = new Uint8Array(PEDACO_DO_ANEXO).fill(7);
    const pedacos = pedacosDoAnexo(bytes);
    expect(pedacos.length).toBe(2);
    expect(pedacos.every(p => p.length <= PEDACO_DO_ANEXO)).toBe(true);
    expect(pedacos.join('')).toBe(Buffer.from(bytes).toString('base64'));
    expect(pedacosDoAnexo(new Uint8Array())).toEqual([]);
    expect(() => pedacosDoAnexo(new Uint8Array(5 * 1024 * 1024 + 1))).toThrow(/5 MB/);
  });

  it('os tiques na hora de Brasília', () => {
    expect(textoDaEntrega({})).toBe('');
    expect(textoDaEntrega({ entregueEm: '2026-11-17T17:02:00.000Z' })).toBe('entregue 17/11 14:02');
    expect(textoDaEntrega({ entregueEm: '2026-11-17T17:02:00.000Z', lidoEm: '2026-11-17T17:10:00.000Z' })).toBe('entregue 17/11 14:02 · lido 17/11 14:10');
  });
});
