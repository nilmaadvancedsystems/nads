import { describe, expect, it } from 'vitest';
import {
  adicionarEnvelopes, buscar, codigoDoLugar, FILTRO_VAZIO, htmlDasEtiquetasDasFileiras, htmlDasPlacasDasPrateleiras, lerLugar, linkDoLugar, lugares, montarCaixa,
  quantidadeDeLugares, rotuloDoLugar,
} from './index';

describe('os lugares do arquivo', () => {
  it('6 prateleiras de 6 fileiras, em ordem', () => {
    const ls = lugares(6, 6);
    expect(ls).toHaveLength(36);
    expect(ls[0]).toEqual({ prateleira: 1, fileira: 1 });
    expect(ls[6]).toEqual({ prateleira: 2, fileira: 1 });
    expect(ls[35]).toEqual({ prateleira: 6, fileira: 6 });
  });

  it('o rótulo, o código e a leitura de volta', () => {
    const l = { prateleira: 3, fileira: 2 };
    expect(rotuloDoLugar(l)).toBe('Prateleira 3 · Fileira 2');
    expect(codigoDoLugar(l)).toBe('P3-F2');
    expect(lerLugar('Prateleira 3 · Fileira 2')).toEqual(l);
    expect(lerLugar('prateleira 3, fileira 2')).toEqual(l);
    expect(lerLugar(' p3-f2 ')).toEqual(l);
    expect(lerLugar('Estante B')).toBeNull();
    expect(lerLugar('Prateleira 0 · Fileira 2')).toBeNull();
  });

  it('as quantidades da tela, de 1 ao teto', () => {
    expect(quantidadeDeLugares('8', 6, 30)).toBe(8);
    expect(quantidadeDeLugares('', 6, 30)).toBe(6);
    expect(quantidadeDeLugares(0, 6, 30)).toBe(6);
    expect(quantidadeDeLugares(99, 6, 30)).toBe(30);
  });

  it('o QR da fileira abre a lista das caixas daquele lugar', () => {
    expect(linkDoLugar('https://nads.exemplo/', { prateleira: 1, fileira: 3 })).toBe('https://nads.exemplo/tarefas/arquivo-fisico/caixas?local=Prateleira%201%20%C2%B7%20Fileira%203');
  });

  it('a busca pelo lugar exato (a Fileira 1 não pega a Fileira 10)', () => {
    const base = { codigo: 1, nome: 'A EXEMPLO', tipo: 'PJ-F', departamento: 'Fiscal' as const, ano: 2026, arquivadaEm: '2026-11-19', observacoes: '' };
    const em = (numero: number, local: string) => adicionarEnvelopes(montarCaixa({ ...base, numero, local }, 'x', 'agora'), ['2026-01'], 'Fiscal', '', 'x', 'agora').caixa;
    const cs = [em(1, 'Prateleira 1 · Fileira 1'), em(2, 'Prateleira 1 · Fileira 10'), em(3, 'prateleira 1 · fileira 1')];
    expect(buscar(cs, { ...FILTRO_VAZIO, local: 'Prateleira 1 · Fileira 1' }).map(a => a.caixa.numero)).toEqual([1, 3]);
  });
});

describe('a impressão das prateleiras', () => {
  it('uma placa por folha', () => {
    const html = htmlDasPlacasDasPrateleiras({ prateleiras: [1, 2, 3], fileiras: 6, logo: { definicao: '<svg id="d"></svg>', uso: '<svg id="u"></svg>' } });
    expect(html.match(/<section class="pagina">/g)).toHaveLength(3);
    expect(html).toContain('<div class="pl-num">3</div>');
    expect(html).toContain('Fileiras 1 a 6');
  });

  it('oito fileiras por folha, com o QR de cada uma', () => {
    const ls = lugares(6, 6);
    const html = htmlDasEtiquetasDasFileiras({ lugares: ls, qr: { 'P2-F4': '<svg id="q24"></svg>' } });
    expect(html.match(/<section class="pagina">/g)).toHaveLength(5);
    expect(html.match(/class="fi"/g)).toHaveLength(36);
    expect(html).toContain('<svg id="q24"></svg>');
    expect(html).toContain('PRATELEIRA 6');
    expect(html).toContain('P6-F6');
  });
});
