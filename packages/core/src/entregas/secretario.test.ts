import { describe, expect, it } from 'vitest';
import { andamentoDoEnvio, competenciaDe, competenciaValida, MAX_ENVIO, nomeParaEnviar, ondeVai, partesDoArquivo, problemaDoArquivo } from '.';

describe('envio para o Claudio Secretario', () => {
  it('parte o arquivo em pedaços na ordem, sem perder byte', () => {
    const bytes = Uint8Array.from({ length: 10 }, (_, i) => i);
    const partes = partesDoArquivo(bytes, 4);
    expect(partes.map(p => Array.from(p))).toEqual([[0, 1, 2, 3], [4, 5, 6, 7], [8, 9]]);
    expect(partesDoArquivo(new Uint8Array(0))).toEqual([]);
  });

  it('nome sem caminho e sem caractere que o Windows recusa; tamanho e mês', () => {
    expect(nomeParaEnviar('C:\\fakepath\\extrato: agosto?.pdf')).toBe('extrato_ agosto_.pdf');
    expect(nomeParaEnviar('')).toBe('arquivo');
    expect(problemaDoArquivo({ nome: 'a', tamanho: 0 })).toBe('está vazio');
    expect(problemaDoArquivo({ nome: 'a', tamanho: MAX_ENVIO + 1 })).toBe('passa de 25 MB');
    expect(problemaDoArquivo({ nome: 'a', tamanho: 10 })).toBe('');
    expect(competenciaDe(new Date(2026, 8, 30))).toBe('2026-09');
    expect(competenciaValida('2026-13')).toBe(false);
  });

  it('andamento e destino', () => {
    expect(andamentoDoEnvio({ status: 'pronto', pasta: '2026-09/X', nomeFinal: 'a.pdf' })).toEqual({ status: 'pronto', pasta: '2026-09/X', nomeFinal: 'a.pdf' });
    expect(andamentoDoEnvio({ status: 'qualquer' }).status).toBe('enviando');
    expect(ondeVai({ competencia: '2026-09', cliente: '' })).toBe('Claudio Secretario › 2026-09 › Enviados pelo nads');
    expect(ondeVai({ competencia: '2026-09', cliente: '58 - TORNEARIA' })).toBe('Claudio Secretario › 2026-09 › 58 - TORNEARIA');
  });
});
