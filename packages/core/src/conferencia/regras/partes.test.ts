import { describe, expect, it } from 'vitest';
import { empresa, nota } from '../__legado__/fixtures';
import { dividirEmPartes, idDoPedaco, juntarPartes, precisaDePartes } from './partes';

describe('as notas em pedaços (27/10/2026: as 24 mil saídas do posto não cabiam num documento)', () => {
  const saidas = Array.from({ length: 6000 }, (_, i) => nota('5656', '1', 10 + i, String(100000 + i), { nome: 'CONSUMIDOR FINAL' }));
  it('passou do limite, precisa dos pedaços; a empresa pequena não', () => {
    expect(precisaDePartes(empresa({ saidas }))).toBe(true);
    expect(precisaDePartes(empresa({ saidas: saidas.slice(0, 50) }))).toBe(false);
  });
  it('corta pelo tamanho e junta de volta na mesma ordem (só os pedaços da versão)', () => {
    const partes = dividirEmPartes(saidas, 200_000);
    expect(partes.length).toBeGreaterThan(1);
    expect(partes.every(p => JSON.stringify(p).length <= 200_000 + 1000)).toBe(true);
    const docs = partes.map((itens, n) => ({ id: idDoPedaco('saidas', 'v2', n), itens })).reverse();
    // um pedaço velho (outra versão) no meio não entra
    docs.push({ id: idDoPedaco('saidas', 'v1', 0), itens: [saidas[0]] });
    expect(juntarPartes(docs, 'saidas', { versao: 'v2', partes: partes.length })).toEqual(saidas);
    // faltando pedaço: null (a tela espera)
    expect(juntarPartes(docs.slice(1), 'saidas', { versao: 'v2', partes: partes.length })).toBeNull();
  });
});
