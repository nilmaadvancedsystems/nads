import { describe, expect, it } from 'vitest';
import { competenciaParaEtiqueta, ETIQUETAS_POR_PAGINA, FOLHA_A4, htmlDasEtiquetas, LINHAS_POR_PAGINA, paginasDe, quantidadeValida, quintoDiaUtilDoMesSeguinte } from './etiquetasDaFolha';

describe('etiquetas da folha (Savio, 15/10/2026)', () => {
  it('a grade cabe na folha A4 e fecha a página cheia', () => {
    expect(LINHAS_POR_PAGINA * FOLHA_A4.alturaDaEtiqueta + (LINHAS_POR_PAGINA - 1) * FOLHA_A4.espaco).toBeLessThanOrEqual(FOLHA_A4.altura - 2 * FOLHA_A4.margem);
    expect(ETIQUETAS_POR_PAGINA).toBe(LINHAS_POR_PAGINA * 2);
  });
  it('a quantidade: vazio ou inválido é uma página cheia; limita ao teto', () => {
    expect(quantidadeValida('')).toBe(ETIQUETAS_POR_PAGINA);
    expect(quantidadeValida('abc')).toBe(ETIQUETAS_POR_PAGINA);
    expect(quantidadeValida(0)).toBe(ETIQUETAS_POR_PAGINA);
    expect(quantidadeValida('5')).toBe(5);
    expect(quantidadeValida(99999)).toBe(1000);
    expect(paginasDe(ETIQUETAS_POR_PAGINA + 1)).toBe(2);
  });
  it('a competência escrita como na etiqueta', () => {
    expect(competenciaParaEtiqueta('2026-10')).toBe('10/2026');
    expect(competenciaParaEtiqueta('10/2026')).toBe('10/2026');
  });
  it('o 5º dia útil do mês seguinte (sábado conta; domingo e feriado nacional não)', () => {
    // nov/2026: dia 1 é domingo e dia 2 é Finados; então 3, 4, 5, 6 e o sábado 7
    expect(quintoDiaUtilDoMesSeguinte('2026-10')).toBe('07/11/2026');
    // fev/2026: dia 1 é domingo; 2, 3, 4, 5, 6
    expect(quintoDiaUtilDoMesSeguinte('2026-01')).toBe('06/02/2026');
    // jan/2027: 1/1 é feriado (sexta), sáb 2, (dom 3), 4, 5, 6 e 7
    expect(quintoDiaUtilDoMesSeguinte('2026-12')).toBe('07/01/2027');
    expect(quintoDiaUtilDoMesSeguinte('lixo')).toBe('');
  });
  it('o documento: as páginas fecham cheias, o texto leva os dois parâmetros e o que vem de fora é escapado', () => {
    const h = htmlDasEtiquetas({ competencia: '2026-10', dataDePagamento: '<b>05/11/2026', quantidade: ETIQUETAS_POR_PAGINA + 1 });
    expect(h.match(/<section class="pagina">/g)).toHaveLength(2);
    expect(h.match(/class="etq"/g)).toHaveLength(ETIQUETAS_POR_PAGINA + 1);
    expect(h).toContain('<b>10/2026</b>');
    expect(h).toContain('&lt;b&gt;05/11/2026');
    expect(h).toContain('size:A4');
    expect(h).toContain('break-inside:avoid');
  });
});
