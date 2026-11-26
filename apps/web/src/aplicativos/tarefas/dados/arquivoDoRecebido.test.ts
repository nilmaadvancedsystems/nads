import type { entregas as e } from '@nads/core';
import { describe, expect, it } from 'vitest';
import { arquivoNaPasta, jeitoDaPrevia, partesDaPasta, pastaDoClienteNoMapa } from './arquivoDoRecebido';

const cli = (id: string, nomePasta: string, codigo: string): e.PastaDeCliente => ({ id, nome: nomePasta, nomePasta, codigo, arquivos: 0, pastas: 0, bytes: 0, mod: null });

describe('o arquivo recebido no mapa do Drive (26/11/2026)', () => {
  it('as partes da pasta que o robô anota', () => {
    expect(partesDaPasta('2026\\292 - FITO INDUSTRIA\\ÁREA DO CLIENTE\\11')).toEqual({ ano: '2026', cliente: '292 - FITO INDUSTRIA', dentro: ['ÁREA DO CLIENTE', '11'] });
    expect(partesDaPasta('462 › 2026 › Bancos')).toBeNull();
    expect(partesDaPasta('')).toBeNull();
  });
  it('a pasta do cliente pelo nome; sem ela, pelo código', () => {
    const lista = [cli('a', '292 - FITO INDUSTRIA', '292'), cli('b', '58 - OUTRA', '58')];
    expect(pastaDoClienteNoMapa(lista, '292 - fito industria')?.id).toBe('a');
    expect(pastaDoClienteNoMapa(lista, '58 - NOME ANTIGO')?.id).toBe('b');
    expect(pastaDoClienteNoMapa(lista, '7 - NADA')).toBeNull();
  });
  it('desce pelas pastas e acha o arquivo', () => {
    const itens: e.ItemDoDrive[] = [
      { i: 'area', n: 'ÁREA DO CLIENTE', p: 'cli', t: 'd' },
      { i: 'm11', n: '11', p: 'area', t: 'd' },
      { i: 'm10', n: '10', p: 'area', t: 'd' },
      { i: 'f1', n: 'extrato.jpeg', p: 'm10', t: 'f' },
      { i: 'f2', n: 'extrato.jpeg', p: 'm11', t: 'f' },
    ];
    expect(arquivoNaPasta(itens, 'cli', ['ÁREA DO CLIENTE', '11'], 'extrato.jpeg')?.i).toBe('f2');
    expect(arquivoNaPasta(itens, 'cli', ['ÁREA DO CLIENTE', '12'], 'extrato.jpeg')).toBeNull();
    expect(arquivoNaPasta(itens, 'cli', ['ÁREA DO CLIENTE', '11'], 'outro.pdf')).toBeNull();
  });
  it('o jeito da prévia pelo nome', () => {
    expect(jeitoDaPrevia('WhatsApp Image.jpeg')).toBe('imagem');
    expect(jeitoDaPrevia('extrato.PDF')).toBe('pdf');
    expect(jeitoDaPrevia('nota.xml')).toBe('outro');
  });
});
