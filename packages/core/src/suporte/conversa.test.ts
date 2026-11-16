import { describe, expect, it } from 'vitest';
import {
  conversaParaAbrir, emOrdem, esperandoMinhaResposta, lerMensagem, lerResumoDaConversa, mensagemNova, podeEscrever, problemaDaMensagem,
  resumir, RESUMO_MAXIMO, seloDaConversa, situacaoDaConversa, TEXTO_MAXIMO, type ResumoDaConversa,
} from './conversa';

const agora = new Date('2026-11-16T14:00:00.000Z');
const resumo = (qtd: number, ultimaDe: 'admin' | 'autor'): ResumoDaConversa => ({ qtd, ultimaDe, ultimaEm: '2026-11-16T13:00:00.000Z', ultimoTexto: 'oi' });

describe('a conversa do feedback (16/11/2026)', () => {
  it('a mensagem precisa de texto e cabe em 2000 letras', () => {
    expect(problemaDaMensagem('   ')).toMatch(/Escreva/);
    expect(problemaDaMensagem('Qual banco?')).toBeNull();
    expect(problemaDaMensagem('x'.repeat(TEXTO_MAXIMO))).toBeNull();
    expect(problemaDaMensagem('x'.repeat(TEXTO_MAXIMO + 1))).toMatch(/2000/);
  });

  it('só o admin começa; depois os dois escrevem; resolvido, ninguém', () => {
    expect(podeEscrever('admin', 'novo', null)).toBe(true);
    expect(podeEscrever('autor', 'novo', null)).toBe(false);
    expect(podeEscrever('autor', 'resolvendo', resumo(1, 'admin'))).toBe(true);
    expect(podeEscrever('autor', 'visto', resumo(2, 'autor'))).toBe(true);
    expect(podeEscrever('admin', 'feito', resumo(2, 'autor'))).toBe(false);
    expect(podeEscrever('autor', 'feito', resumo(1, 'admin'))).toBe(false);
  });

  it('a mensagem nova soma uma no resumo, com quem e o começo do texto', () => {
    const a = mensagemNova(null, 'admin', ' Vitor ', '  Qual banco era?  ', agora);
    expect(a.mensagem).toEqual({ de: 'admin', nome: 'Vitor', texto: 'Qual banco era?', em: '2026-11-16T14:00:00.000Z' });
    expect(a.resumo).toEqual({ qtd: 1, ultimaDe: 'admin', ultimaEm: '2026-11-16T14:00:00.000Z', ultimoTexto: 'Qual banco era?' });
    const b = mensagemNova(a.resumo, 'autor', 'Clara', 'Bradesco', agora);
    expect(b.resumo).toMatchObject({ qtd: 2, ultimaDe: 'autor', ultimoTexto: 'Bradesco' });
  });

  it('quem mandou não começa a conversa, e mensagem vazia não vai', () => {
    expect(() => mensagemNova(null, 'autor', 'Clara', 'Oi', agora)).toThrow(/depois que o suporte perguntar/);
    expect(() => mensagemNova(null, 'admin', 'Vitor', ' ', agora)).toThrow(/Escreva/);
  });

  it('o resumo fica numa linha e corta com reticências', () => {
    expect(resumir('Linha 1\n\nLinha   2')).toBe('Linha 1 Linha 2');
    const longo = resumir('a'.repeat(RESUMO_MAXIMO + 50));
    expect(longo.length).toBe(RESUMO_MAXIMO);
    expect(longo.endsWith('…')).toBe(true);
  });

  it('lê do banco só o que fecha', () => {
    expect(lerResumoDaConversa({ qtd: 2, ultimaDe: 'autor', ultimaEm: 'x', ultimoTexto: 'y' })).toEqual({ qtd: 2, ultimaDe: 'autor', ultimaEm: 'x', ultimoTexto: 'y' });
    expect(lerResumoDaConversa(undefined)).toBeNull();
    expect(lerResumoDaConversa({ qtd: 0, ultimaDe: 'admin' })).toBeNull();
    expect(lerResumoDaConversa({ qtd: 1, ultimaDe: 'outro' })).toBeNull();
    expect(lerMensagem('m1', { de: 'admin', nome: 'Vitor', texto: 'Oi', em: 'x' })).toEqual({ id: 'm1', de: 'admin', nome: 'Vitor', texto: 'Oi', em: 'x' });
    expect(lerMensagem('m2', { de: 'admin', texto: '  ' })).toBeNull();
    expect(lerMensagem('m3', { de: 'robo', texto: 'Oi' })).toBeNull();
  });

  it('as mensagens da mais velha para a mais nova', () => {
    const m = (id: string, em: string) => ({ id, em });
    expect(emOrdem([m('b', '2026-11-16T10:00'), m('a', '2026-11-16T09:00'), m('c', '2026-11-16T10:00')]).map(x => x.id)).toEqual(['a', 'b', 'c']);
  });

  it('o selo da lista: esperando a resposta de quem mandou, ou ele respondeu', () => {
    expect(situacaoDaConversa(null)).toBe('');
    expect(seloDaConversa(null)).toBeNull();
    expect(seloDaConversa(resumo(1, 'admin'))).toEqual({ rotulo: 'Esperando resposta', tom: 'neutro' });
    expect(seloDaConversa(resumo(2, 'autor'))).toEqual({ rotulo: 'Respondeu', tom: 'novo' });
  });

  it('abre sozinha a pergunta nova que este navegador ainda não mostrou, a mais velha primeiro', () => {
    const f = (id: string, criadoEm: string, conversa: ResumoDaConversa | null, status = 'visto') => ({ id, criadoEm, conversa, status });
    const meus = [
      f('novo', '2026-11-15', resumo(1, 'admin')),
      f('velho', '2026-11-10', resumo(3, 'admin')),
      f('respondido', '2026-11-01', resumo(2, 'autor')),
      f('resolvido', '2026-11-02', resumo(1, 'admin'), 'feito'),
      f('sem', '2026-11-03', null),
    ];
    expect(conversaParaAbrir(meus, {})).toBe('velho');
    expect(conversaParaAbrir(meus, { velho: 3 })).toBe('novo');
    expect(conversaParaAbrir(meus, { velho: 3, novo: 1 })).toBeNull();
    // o admin perguntou de novo: abre outra vez
    expect(conversaParaAbrir(meus, { velho: 2, novo: 1 })).toBe('velho');
    expect(esperandoMinhaResposta(meus)).toBe(2);
  });
});
