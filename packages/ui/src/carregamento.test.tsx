// @vitest-environment jsdom
// O Atualizar da versão nova espera o que está carregando ou enviando (Vitor, 12/11/2026: "se o processo estiver rolando,
// bloqueie a atualização da página, para que não haja bugs").
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { motivoParaEsperar, useCarregando, useMotivoParaEsperar, useOcupado } from './carregamento';

function Enviando({ ativo }: { ativo: boolean }) { useOcupado(ativo, 'Espere terminar de enviar ao Drive.'); return null; }
function Carregando({ ativo }: { ativo: boolean }) { useCarregando(ativo); return null; }
function Botao() {
  const espera = useMotivoParaEsperar();
  return <button type="button" disabled={!!espera} title={espera}>Atualizar</button>;
}

afterEach(cleanup);

describe('a espera para atualizar a página', () => {
  it('nada rolando: pode atualizar', () => {
    render(<Botao />);
    expect(motivoParaEsperar()).toBe('');
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(false);
  });
  it('enviando ao Drive: o botão trava com o motivo e solta quando termina', () => {
    const { rerender } = render(<><Botao /><Enviando ativo /></>);
    const botao = screen.getByRole('button') as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    expect(botao.title).toBe('Espere terminar de enviar ao Drive.');
    act(() => rerender(<><Botao /><Enviando ativo={false} /></>));
    expect(botao.disabled).toBe(false);
    expect(motivoParaEsperar()).toBe('');
  });
  it('a barra do topo andando também segura', () => {
    const { rerender } = render(<><Botao /><Carregando ativo /></>);
    expect(motivoParaEsperar()).toBe('Espere terminar de carregar.');
    act(() => rerender(<><Botao /><Carregando ativo={false} /></>));
    expect(motivoParaEsperar()).toBe('');
  });
  it('a tela que estava enviando fechou: solta', () => {
    const { unmount } = render(<Enviando ativo />);
    expect(motivoParaEsperar()).not.toBe('');
    unmount();
    expect(motivoParaEsperar()).toBe('');
  });
});
