import { describe, expect, it } from 'vitest';
import type { ItemDrive } from '../../creditor/regras/drive';
import { arquivosDoMesNoDrive } from './drive';

// "Selecionar no Drive" (17/11/2026): os arquivos do mês na pasta da empresa, para a pessoa escolher o extrato
describe('arquivosDoMesNoDrive', () => {
  const itens: ItemDrive[] = [
    { i: 'c', n: 'CONTÁBIL', p: 'raiz', t: 'd' },
    { i: 'e', n: 'EXTRATOS', p: 'c', t: 'd' },
    { i: 'a26', n: '2026', p: 'e', t: 'd' },
    { i: 'm09', n: '09', p: 'a26', t: 'd' },
    { i: 'm08', n: '08', p: 'a26', t: 'd' },
    { i: 'x1', n: 'SICOOB 09-2026.pdf', p: 'm09', t: 'f' },
    { i: 'x2', n: 'Titulos por periodo.pdf', p: 'm09', t: 'f' },
    { i: 'x3', n: 'SICOOB 08-2026.pdf', p: 'm08', t: 'f' },
    { i: 'r', n: 'RECEBIMENTO DE CLIENTES', p: 'raiz', t: 'd' },
    { i: 'x4', n: 'CREDLIQUIDACAO 09-2026.pdf', p: 'r', t: 'f' },
    { i: 'x5', n: 'foto.png', p: 'm09', t: 'f' },
  ];
  it('só os do mês, os da pasta EXTRATOS primeiro, sem os tipos que não se importam', () => {
    const l = arquivosDoMesNoDrive(itens, 'raiz', '2026-09');
    expect(l.map(a => a.nome)).toEqual(['SICOOB 09-2026.pdf', 'Titulos por periodo.pdf', 'CREDLIQUIDACAO 09-2026.pdf']);
    expect(l[2].credliquidacao).toBe(true);
    expect(l[0].caminho).toBe('CONTÁBIL › EXTRATOS › 2026 › 09 › SICOOB 09-2026.pdf');
  });
  it('sem a pasta do cliente, nada', () => {
    expect(arquivosDoMesNoDrive(itens, null, '2026-09')).toEqual([]);
  });
});
