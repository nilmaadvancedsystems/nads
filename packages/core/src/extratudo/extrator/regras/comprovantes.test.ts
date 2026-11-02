import { describe, expect, it } from 'vitest';
import type { ItemDrive } from '../../creditor/regras/drive';
import { comprovantesDoBanco, comprovantesNoDrive, mesDoComprovante, nomeDoComprovante, nomeDoComprovanteDoMes } from './comprovantes';

const d = (i: string, n: string, p: string): ItemDrive => ({ i, n, p, t: 'd' });
const f = (i: string, n: string, p: string, s = 1000): ItemDrive => ({ i, n, p, t: 'f', s, m: '2026-02-10T10:00:00Z' });

describe('os comprovantes no Drive (26/10/2026)', () => {
  const itens: ItemDrive[] = [
    d('c', 'CONTÁBIL', 'raiz'), d('e', 'EXTRATOS', 'c'), d('a', '2026', 'e'),
    d('m2', '02', 'a'), d('b2', 'BANCÁRIOS', 'm2'), f('x2', '02-2026.pdf', 'b2'), d('k2', 'COMPROVANTES', 'm2'),
    f('p1', 'Comprovantes 02-2026.pdf', 'k2'), d('sub', 'BRADESCO', 'k2'), f('p2', 'COMPROVANTE - pix fornecedor.pdf', 'sub'), d('sub2', 'SICOOB', 'k2'), f('p4', 'Comprovantes 02-2026.pdf', 'sub2'),
    d('m3', '03-2026', 'a'), d('k3', 'Comprovantes', 'm3'), f('p3', 'boleto.pdf', 'k3'),
  ];
  it('os arquivos da pasta COMPROVANTES de cada mês (com as subpastas); o extrato fica de fora', () => {
    const r = comprovantesNoDrive(itens, 'raiz', ['2026-01', '2026-02', '2026-03']);
    expect(r['2026-01']).toEqual([]);
    expect(r['2026-02'].map(x => [x.nome, x.banco])).toEqual([['COMPROVANTE - pix fornecedor.pdf', 'Bradesco'], ['Comprovantes 02-2026.pdf', ''], ['Comprovantes 02-2026.pdf', 'Sicoob']]);
    // por banco: a subpasta manda; o sem banco vai para o banco só quando a empresa tem um
    expect(comprovantesDoBanco(r['2026-02'], 'Bradesco', false).map(x => x.id)).toEqual(['p2']);
    expect(comprovantesDoBanco(r['2026-02'], 'Bradesco', true).map(x => x.id)).toEqual(['p2', 'p1']);
    expect(r['2026-03'].map(x => x.id)).toEqual(['p3']);
    expect(r['2026-02'][0]).toEqual({ id: 'p2', nome: 'COMPROVANTE - pix fornecedor.pdf', banco: 'Bradesco', tamanho: 1000, em: '2026-02-10T10:00:00Z' });
  });
  it('sem a pasta do cliente, nada; o nome que vai para o Drive', () => {
    expect(comprovantesNoDrive(itens, null, ['2026-02'])).toEqual({ '2026-02': [] });
    expect([nomeDoComprovante('pix.pdf'), nomeDoComprovante('Comprovante Itau.pdf'), nomeDoComprovante('TITULOS PAGOS FEV2026.pdf', 'Bradesco'), nomeDoComprovante('pix bradesco.pdf', 'Bradesco')])
      .toEqual(['COMPROVANTE - pix.pdf', 'Comprovante Itau.pdf', 'COMPROVANTE - BRADESCO - TITULOS PAGOS FEV2026.pdf', 'COMPROVANTE - pix bradesco.pdf']);
  });
});

describe('o mês do comprovante (vários de uma vez)', () => {
  const meses = ['2026-05', '2026-06'];
  it('pela data do nome, só no período', () => {
    expect(mesDoComprovante('Comprovante 02-06-2026 13h05.pdf', '', meses)).toBe('2026-06');
    expect(mesDoComprovante('Comprovante 02-07-2026.pdf', 'pago em 15/05/2026', meses)).toBe('2026-05');
  });
  it('pelo mês e ano do nome, ou pelo texto do PDF; sem nada, null', () => {
    expect(mesDoComprovante('05-2026 pix.pdf', '', meses)).toBe('2026-05');
    expect(mesDoComprovante('pix.pdf', 'Data: 10/06/2026', meses)).toBe('2026-06');
    expect(mesDoComprovante('pix.pdf', '', meses)).toBeNull();
  });
});

describe('o nome do comprovante do mês, no molde do extrato (27/10/2026)', () => {
  it('"Comprovante <BANCO> MM-AAAA - <nome original>": o robô grava direto na pasta COMPROVANTES do banco', () => {
    expect(nomeDoComprovanteDoMes('Bradesco', '2026-02', 'TITULOS PAGOS FEV2026 (2).pdf')).toBe('Comprovante BRADESCO 02-2026 - TITULOS PAGOS FEV2026 (2).pdf');
    expect(nomeDoComprovanteDoMes('Banco do Brasil', '2026-11', 'pasta/sub/pix.pdf')).toBe('Comprovante BANCO DO BRASIL 11-2026 - pix.pdf');
  });
});
