import { describe, expect, it } from 'vitest';
import { caminhoDaConversa, NAO_RESOLVEU, OUTRO, passoDoSuporte, telaPeloRotulo, vereditoDoReport, type ContextoDoSuporte } from './index';

const ctx: ContextoDoSuporte = { tela: 'bancos', rotuloDaTela: 'Bancos', empresa: 'EMPRESA EXEMPLO', codigo: 1, meses: ['2026-07', '2026-08'], bancos: ['Bradesco', 'Sicoob'] };

describe('suporte de leitura: a conversa por cápsulas', () => {
  it('começa pelo problema da tela, com o Outro no fim', () => {
    const p = passoDoSuporte(ctx, []);
    expect(p.tipo).toBe('pergunta');
    if (p.tipo === 'pergunta') expect(p.opcoes.map(o => o.id)).toEqual(['leu-errado', 'faltou', 'mes', 'travou', 'drive', OUTRO]);
  });
  it('nos bancos, pergunta o banco e o mês e termina nas instruções diretas', () => {
    expect(passoDoSuporte(ctx, ['faltou'])).toMatchObject({ tipo: 'pergunta', texto: 'Qual banco?' });
    expect(passoDoSuporte(ctx, ['faltou', 'b:Bradesco'])).toMatchObject({ tipo: 'pergunta', texto: 'Qual mês?' });
    const fim = passoDoSuporte(ctx, ['faltou', 'b:Bradesco', 'm:2026-08']);
    expect(fim.tipo).toBe('instrucoes');
    if (fim.tipo === 'instrucoes') expect(fim.passos[0]).toBe('Clique no ✓ de 08/2026 do Bradesco para tirar o importado.');
  });
  it('um banco só e um mês só: não pergunta', () => {
    const um = { ...ctx, bancos: ['Bradesco'], meses: ['2026-08'] };
    const p = passoDoSuporte(um, ['leu-errado']);
    expect(p.tipo).toBe('instrucoes');
    if (p.tipo === 'instrucoes') expect(p.passos[2]).toBe('Suba o PDF em 08/2026 do Bradesco.');
  });
  it('não resolveu (e o Outro) vão para o encaminhar', () => {
    expect(passoDoSuporte(ctx, ['travou', NAO_RESOLVEU]).tipo).toBe('encaminhar');
    expect(passoDoSuporte(ctx, [OUTRO]).tipo).toBe('encaminhar');
  });
  it('o caminho em texto, para o report', () => {
    expect(caminhoDaConversa(ctx, ['faltou', 'b:Bradesco', 'm:2026-08', NAO_RESOLVEU])).toBe('Faltou lançamento › Bradesco › 08/2026 › Não resolveu');
  });
  it('a tela pelo nome da aba', () => {
    expect(telaPeloRotulo('Bancos')).toBe('bancos');
    expect(telaPeloRotulo('Balancete e razões')).toBe('balancete');
    expect(telaPeloRotulo('Saídas')).toBe('notas');
    expect(telaPeloRotulo('Caixa')).toBe('razao');
    expect(telaPeloRotulo('Cheque especial')).toBe('outra');
  });
  it('o veredito pela última linha do report', () => {
    expect(vereditoDoReport('A causa é…\n\n**Realmente, isso é erro do sistema.**')).toBe('erro');
    expect(vereditoDoReport('O usuário quer outro fluxo.\nPrecisa da sua análise')).toBe('analise');
    expect(vereditoDoReport('sem final')).toBeNull();
  });
});
