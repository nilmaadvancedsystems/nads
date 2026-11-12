// O espelho da nota de serviço do SIEG (11/11/2026: a NFS-e passa a abrir no Fiscal › SIEG).
import { describe, expect, it } from 'vitest';
import { espelhoDoServico, type NotaDoSieg } from '.';

const nfse: NotaDoSieg = {
  tipo: 'NFS-e', chave: '31701062200000000000000000000000000000000000001306', numero: '1306', serie: '', data: '26/10/2026',
  emitente: { doc: '03662866000156', nome: 'FREIOS TURBO LTDA' }, destinatario: { doc: '11222333000181', nome: 'CLIENTE EXEMPLO LTDA' },
  valor: 1000, nbs: '1.1403.10.00', descricao: 'Manutenção de freios',
  retencoes: [{ imposto: 'ISS', valor: 50 }, { imposto: 'IRRF', valor: 15 }, { imposto: 'PIS', valor: 0 }],
};

describe('o espelho da NFS-e do SIEG', () => {
  it('quem prestou, quem tomou, o valor, as retenções e o líquido', () => {
    const e = espelhoDoServico(nfse);
    expect(e.titulo).toBe('NFS-e 1306 · 26/10/2026');
    expect(e.prestador.nome).toBe('FREIOS TURBO LTDA');
    expect(e.tomador.nome).toBe('CLIENTE EXEMPLO LTDA');
    expect(e.retencoes.map(r => r.imposto)).toEqual(['ISS', 'IRRF']);
    expect([e.valor, e.retido, e.liquido]).toEqual([1000, 65, 935]);
    expect(e.chave.split(' ')[0]).toBe('3170');
    expect([e.nbs, e.descricao]).toEqual(['1.1403.10.00', 'Manutenção de freios']);
  });
  it('sem chave, sem retenções e sem descrição', () => {
    const e = espelhoDoServico({ ...nfse, chave: '', retencoes: undefined, nbs: undefined, descricao: undefined });
    expect([e.chave, e.retido, e.liquido, e.nbs, e.descricao]).toEqual(['', 0, 1000, '', '']);
  });
});
