// @vitest-environment jsdom
// Configurações › Integração SCI (24/11/2026): começa tudo desligado; ligar, escrever as empresas e o código de uma guia e
// gravar manda a configuração limpa para o repositório (aqui, o de exemplo).
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RetornoProvider } from '@nads/ui';
import { afterEach, describe, expect, it } from 'vitest';
import { IntegracaoSci } from './IntegracaoSci';

afterEach(() => { cleanup(); });

describe('Configurações › Integração SCI', () => {
  it('começa desligada; ligar, dizer as empresas e o relatório e gravar', async () => {
    render(<RetornoProvider><IntegracaoSci /></RetornoProvider>);
    const chaves = screen.getAllByRole('switch');
    expect(chaves).toHaveLength(6);
    expect(chaves.every(c => c.getAttribute('aria-checked') === 'false')).toBe(true);
    expect(screen.getByText('Nenhuma empresa: nada vai ao SCI.')).toBeTruthy();
    const gravar = screen.getByRole('button', { name: 'Gravar' }) as HTMLButtonElement;
    expect(gravar.disabled).toBe(true);

    // ler de volta sem publicar não liga
    fireEvent.click(screen.getByRole('switch', { name: 'Ler de volta se o cliente viu e pagou' }));
    expect(screen.getByRole('switch', { name: 'Ler de volta se o cliente viu e pagou' }).getAttribute('aria-checked')).toBe('false');

    fireEvent.click(screen.getByRole('switch', { name: 'Publicar no SCI Report pelo Enviar guias' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Ler de volta se o cliente viu e pagou' }));
    fireEvent.change(screen.getByLabelText('Códigos das empresas com o SCI ligado'), { target: { value: '583, 602' } });
    fireEvent.change(screen.getByLabelText('Código do relatório: DAS (Simples Nacional)'), { target: { value: '1a' } });
    expect(screen.getByText('2 empresas')).toBeTruthy();

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Gravar' })); });
    // depois de gravar, a tela mostra o que ficou gravado (sem rascunho): o Gravar apaga e os valores ficam
    expect((screen.getByRole('button', { name: 'Gravar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('switch', { name: 'Publicar no SCI Report pelo Enviar guias' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Ler de volta se o cliente viu e pagou' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('switch', { name: 'Guias do SCI Report na Área do Cliente' }).getAttribute('aria-checked')).toBe('false');
    expect((screen.getByLabelText('Códigos das empresas com o SCI ligado') as HTMLInputElement).value).toBe('583, 602');
    expect((screen.getByLabelText('Código do relatório: DAS (Simples Nacional)') as HTMLInputElement).value).toBe('001A');
  });

  it('o RH NET: ligado e gravado, cada empresa da lista ganha o Testar, que mostra os cadastros', async () => {
    render(<RetornoProvider><IntegracaoSci /></RetornoProvider>);
    // o cartão só aparece com a chave gravada (o robô lê o que está gravado)
    expect(screen.queryByText('Empresa 583')).toBeNull();
    fireEvent.click(screen.getByRole('switch', { name: 'RH NET (folha)' }));
    fireEvent.change(screen.getByLabelText('Códigos das empresas com o SCI ligado'), { target: { value: '583' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Gravar' })); });
    expect(screen.getByText('Empresa 583')).toBeTruthy();
    expect(screen.getByText('Ainda não testada')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Testar' })); });
    expect(screen.getByText(/Departamentos 2 · Funções 1/)).toBeTruthy();
  });
});
