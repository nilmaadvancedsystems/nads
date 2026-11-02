// @vitest-environment jsdom
import { conferencia } from '@nads/core';
import { act, fireEvent, render } from '@testing-library/react';
import { createElement as h } from 'react';
import { describe, expect, it } from 'vitest';
import { RepoProvider } from '../dados/repo';
import { GravacaoNaNuvem } from './GravacaoNaNuvem';

// (.ts com createElement: a View não importa o repositório, a trava das camadas vale para os .tsx)
const comRepo = (repo: conferencia.RepoConferencia) => h(RepoProvider, { repo, children: h(GravacaoNaNuvem) });

// um repositório de exemplo com a gravação que a gente controla (a do banco conta os pedaços que chegam)
function comGravacao() {
  let atual: conferencia.GravacaoNaNuvem | null = null;
  const ouvintes = new Set<() => void>();
  const repo: conferencia.RepoConferencia = {
    ...conferencia.criarRepoConferenciaMemoria(),
    gravacao: { atual: () => atual, pendente: () => !!atual, assinar: f => { ouvintes.add(f); return () => { ouvintes.delete(f); }; } },
  };
  const mudar = (g: conferencia.GravacaoNaNuvem | null) => act(() => { atual = g; for (const f of ouvintes) f(); });
  return { repo, mudar };
}

describe('a janela "Salvando as notas" (27/10/2026: o progresso e não sair da tela)', () => {
  it('aparece enquanto os pedaços sobem, fica verde no fim e o × fecha', () => {
    const { repo, mudar } = comGravacao();
    render(comRepo(repo));
    expect(document.body.textContent).not.toContain('Salvando');
    mudar({ empresa: 'EMPRESA X', notas: 23884, feitos: 3, total: 9 });
    expect(document.body.textContent).toContain('Salvando as notas na nuvem');
    expect(document.body.textContent).toContain('Não feche nem atualize a página');
    expect(document.body.textContent).toContain('33%');
    expect(document.body.textContent).toContain('23.884 notas da EMPRESA X · 3 de 9 partes');
    // subindo, não dá para fechar
    expect(document.querySelector('.sieg-flutuante [aria-label="Fechar"]')).toBeNull();
    mudar({ empresa: 'EMPRESA X', notas: 23884, feitos: 9, total: 9, pronto: true });
    expect(document.body.textContent).toContain('Notas salvas na nuvem');
    expect(document.body.textContent).toContain('Pode sair da tela');
    fireEvent.click(document.querySelector('.sieg-flutuante [aria-label="Fechar"]')!);
    expect(document.querySelector('.sieg-flutuante')).toBeNull();
  });
  it('nos exemplos (sem banco) não aparece nada', () => {
    render(comRepo(conferencia.criarRepoConferenciaMemoria()));
    expect(document.querySelector('.sieg-flutuante')).toBeNull();
  });
});
