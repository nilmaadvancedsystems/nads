import { describe, expect, it } from 'vitest';
import { clienteNoTexto, destinoDaAjuda, mesNoTexto, ondeVaiNaAjuda, andamentoDoEnvio, envioFeitoDoDocumento, pastaPeloCaminho, situacaoDoEnvioFeito, competenciaDe, competenciaValida, MAX_ENVIO, nomeParaEnviar, ondeVai, partesDoArquivo, problemaDoArquivo } from '.';

describe('Ajudar o Claude', () => {
  const a = { nome: 'ALFA COMERCIO LTDA', cliente: '1 - ALFA COMERCIO LTDA', codigo: '1' };
  const b = { nome: 'BETA SERVICOS ME', cliente: '2 - BETA SERVICOS ME', codigo: '2' };
  const c = { nome: 'BETA SERVICOS GERAIS LTDA', cliente: '3 - BETA SERVICOS GERAIS LTDA', codigo: '3' };

  it('acha o único cliente da lista no texto, sem acento, caixa ou sufixo', () => {
    expect(clienteNoTexto('Pagador: Alfa Comércio Ltda - CNPJ', [a, b])).toBe(a);
    expect(clienteNoTexto('Pagador: ALFA COMERCIO', [a, b])).toBe(a);
    expect(clienteNoTexto('ALFA COMERCIO e BETA SERVICOS', [a, b])).toBeNull();
    expect(clienteNoTexto('nada aqui', [a, b])).toBeNull();
    expect(clienteNoTexto('ALFABETA COMERCIO', [a])).toBeNull();
  });

  it('o nome contido no de outro achado não conta', () => {
    expect(clienteNoTexto('BETA SERVICOS GERAIS LTDA', [b, c])).toBe(c);
  });

  it('acha o único mês da lista no texto', () => {
    expect(mesNoTexto('pago em 15/10/2026', ['2026-09', '2026-10'])).toBe('2026-10');
    expect(mesNoTexto('competência 09/2026', ['2026-09', '2026-10'])).toBe('2026-09');
    expect(mesNoTexto('09/2026 e 10/2026', ['2026-09', '2026-10'])).toBeNull();
    expect(mesNoTexto('15/08/2026', ['2026-09', '2026-10'])).toBeNull();
  });

  it('um só vale para todos; vários, pelo texto; sem achar, como no automático', () => {
    expect(destinoDaAjuda('', [a], ['2026-09'], '2026-11')).toEqual({ competencia: '2026-09', cliente: a.cliente, codigo: '1' });
    expect(destinoDaAjuda('', [], [], '2026-11')).toEqual({ competencia: '2026-11', cliente: '', codigo: '' });
    expect(destinoDaAjuda('BETA SERVICOS 10/2026', [a, b], ['2026-09', '2026-10'], '2026-11')).toEqual({ competencia: '2026-10', cliente: b.cliente, codigo: '2' });
    expect(destinoDaAjuda('sem pista', [a, b], ['2026-09', '2026-10'], '2026-11')).toEqual({ competencia: '2026-11', cliente: '', codigo: '' });
  });

  it('mostra para onde vai', () => {
    expect(ondeVaiNaAjuda([], [], '2026-11')).toBe('Claudio Secretario › 2026-11 › Enviados pelo nads');
    expect(ondeVaiNaAjuda([a], ['2026-09'], '2026-11')).toBe('Claudio Secretario › 2026-09 › 1 - ALFA COMERCIO LTDA');
    expect(ondeVaiNaAjuda([a, b], ['2026-09', '2026-10'], '2026-11')).toBe('Claudio Secretario › o mês do arquivo › o cliente do arquivo');
  });
});

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

  it('meus envios: onde foi parar e a pasta pelo caminho', () => {
    const esperando = envioFeitoDoDocumento('a', { status: 'pronto', nome: 'x.pdf', pasta: '2026-09/TORNEARIA', criadoEm: '2026-10-01T10:00:00Z' });
    expect(situacaoDoEnvioFeito(esperando)).toEqual({ tom: 'espera', texto: 'Em Claudio Secretario › 2026-09 › TORNEARIA — esperando a próxima rodada do arquivamento' });
    const arq = envioFeitoDoDocumento('b', { status: 'pronto', nomeFinal: 'x (2).pdf', nome: 'x.pdf',
      arquivamento: { situacao: 'arquivado', codigo: '58', cliente: 'TORNEARIA', subpasta: 'CONTÁBIL/EXTRATOS/2026/08', final: '08-2026.pdf' } });
    expect(arq.nome).toBe('x (2).pdf');
    expect(situacaoDoEnvioFeito(arq).texto).toBe('Arquivado em 58 - TORNEARIA › CONTÁBIL › EXTRATOS › 2026 › 08 › 08-2026.pdf');
    expect(situacaoDoEnvioFeito(envioFeitoDoDocumento('c', { status: 'pronto', arquivamento: { situacao: 'nao_identificado', motivo: 'sem CNPJ' } })))
      .toEqual({ tom: 'aviso', texto: 'O arquivamento não identificou o cliente (sem CNPJ)' });
    expect(situacaoDoEnvioFeito(envioFeitoDoDocumento('d', { status: 'erro', erro: 'faltou parte' })).tom).toBe('aviso');
    expect(envioFeitoDoDocumento('e', { status: 'pronto', arquivamento: { situacao: 'outra' } }).arquivamento).toBeNull();
    const itens = [
      { i: 'c1', n: 'CONTÁBIL', p: 'raiz', t: 'd' as const }, { i: 'e1', n: 'Extratos', p: 'c1', t: 'd' as const },
      { i: 'a1', n: '2026', p: 'e1', t: 'd' as const }, { i: 'f1', n: 'x.pdf', p: 'a1', t: 'f' as const },
    ];
    expect(pastaPeloCaminho(itens, 'raiz', 'contabil/EXTRATOS/2026/08')).toBe('a1');
    expect(pastaPeloCaminho(itens, 'raiz', 'FISCAL/NOTAS')).toBe('raiz');
  });
});
