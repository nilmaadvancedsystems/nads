// @vitest-environment jsdom
// O Tentar de novo da tela que quebrou (revisão da UI, 18/10/2026): primeiro remonta a rota sem recarregar; se quebrar de
// novo, recarrega; o pedaço do site que sumiu (depois de publicar) recarrega sozinho uma vez.
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErroDaTela } from './ErroDaTela';
import { ehPedacoQueSumiu } from './pedacoQueSumiu';

let quebrando = false;
let montagens = 0;
function TelaQueQuebra() {
  montagens++;
  if (quebrando) throw new Error('a tela quebrou');
  return <p>a tela abriu</p>;
}

const recarregar = vi.fn();
beforeEach(() => {
  quebrando = false; montagens = 0; recarregar.mockReset();
  sessionStorage.clear();
  Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, reload: recarregar } });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// cada caso numa rota (a tentativa de um caso, há menos de 10 s, valeria para o outro na mesma rota)
const abrir = (rota: string) => render(<RouterProvider router={createMemoryRouter([{ path: '*', element: <TelaQueQuebra />, errorElement: <ErroDaTela /> }], { initialEntries: [rota] })} />);

describe('o Tentar de novo da tela que quebrou', () => {
  it('quebrou uma vez: o Tentar de novo remonta a rota sem recarregar a página', async () => {
    quebrando = true;
    abrir('/uma-vez');
    expect(await screen.findByText('Esta tela não abriu')).toBeTruthy();
    quebrando = false;
    const antes = montagens;
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ })); });
    expect(await screen.findByText('a tela abriu')).toBeTruthy();
    expect(montagens).toBeGreaterThan(antes);
    expect(recarregar).not.toHaveBeenCalled();
  });

  it('quebrou de novo logo depois: o Tentar de novo recarrega a página', async () => {
    quebrando = true;
    abrir('/de-novo');
    await screen.findByText('Esta tela não abriu');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ })); });
    expect(await screen.findByText(/quebrou de novo/)).toBeTruthy();
    expect(recarregar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Tentar de novo/ }));
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it('o pedaço do site que sumiu: recarrega sozinho uma vez (não fica recarregando)', async () => {
    const sumiu = () => { throw new TypeError('Failed to fetch dynamically imported module: https://tarefas-nilma.web.app/assets/Executor-abc.js'); };
    const Rota = () => sumiu();
    const montar = () => render(<RouterProvider router={createMemoryRouter([{ path: '/', element: <Rota />, errorElement: <ErroDaTela /> }])} />);
    montar();
    // recarregando sozinho: só a bolinha, sem o "não abriu" (28/10/2026)
    expect(await screen.findByLabelText('Carregando')).toBeTruthy();
    expect(screen.queryByText('Esta tela não abriu')).toBeNull();
    expect(recarregar).toHaveBeenCalledTimes(1);
    cleanup();
    montar(); // recarregou e o pedaço ainda falta: mostra o erro com o botão, sem recarregar de novo
    expect(await screen.findByText('Esta tela não abriu')).toBeTruthy();
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it('reconhece o erro do pedaço que sumiu nos navegadores', () => {
    expect(ehPedacoQueSumiu(new TypeError('Failed to fetch dynamically imported module: x.js'))).toBe(true);
    expect(ehPedacoQueSumiu(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(ehPedacoQueSumiu(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(ehPedacoQueSumiu(new Error('Unable to preload CSS for /assets/x.css'))).toBe(true);
    expect(ehPedacoQueSumiu(new Error('a tela quebrou'))).toBe(false);
    expect(ehPedacoQueSumiu(null)).toBe(false);
  });
});

describe('o pedaço que chega vazio (28/10/2026)', () => {
  it('a página está recarregando (o vite:preloadError cancelado): a bolinha no lugar da tela, sem erro', async () => {
    const { pedaco, NaEspera } = await import('./pedaco');
    // o import() do Vite devolve undefined quando o preloadError foi cancelado pelo main.tsx
    const Tela = pedaco(() => Promise.resolve(undefined as unknown as { Tela: () => null }), 'Tela');
    render(<RouterProvider router={createMemoryRouter([{ path: '/', element: <NaEspera><Tela /></NaEspera>, errorElement: <ErroDaTela /> }])} />);
    expect(await screen.findByLabelText('Carregando')).toBeTruthy();
    expect(screen.queryByText('Esta tela não abriu')).toBeNull();
  });
});
