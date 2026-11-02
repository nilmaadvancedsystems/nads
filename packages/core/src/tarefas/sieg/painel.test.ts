import { describe, expect, it } from 'vitest';
import { linhaCombina, notaDaLinha, painelDoSieg, type NotasSieg } from '.';

const eu = { doc: '11222333000181', nome: 'EU' };
const cli = { doc: '44555666000172', nome: 'CLIENTE' };
const base = { serie: '1', emitente: eu, destinatario: cli };
const deFora = { ...base, emitente: cli, destinatario: eu };
const x: NotasSieg = {
  codigo: '1', competencia: '2026-10', em: '', pasta: '', arquivos: 0, novos: 0,
  emitidas: [
    { ...base, tipo: 'NF-e', chave: 'A', numero: '10', data: '03/10/2026', valor: 1500, itens: [{ ncm: '1', cfop: '5102', cst: '000', cest: '', valor: 1000, icms: 180 }, { ncm: '2', cfop: '5405', cst: '060', cest: '', valor: 500 }] },
    { ...base, tipo: 'NF-e', chave: 'B', numero: '11', data: '09/10/2026', valor: 800, itens: [{ ncm: '1', cfop: '5102', cst: '000', cest: '', valor: 800, icms: 144.1, ipi: 5 }] },
    { ...base, tipo: 'NF-e', chave: 'C', numero: '12', data: '10/10/2026', valor: 999, cancelada: true, itens: [{ ncm: '1', cfop: '5102', cst: '000', cest: '', valor: 999, icms: 99 }] },
    { ...base, tipo: 'NFS-e', chave: '', numero: '7', serie: '', data: '12/10/2026', valor: 3000, nbs: '1.1', retencoes: [{ imposto: 'ISS', valor: 150 }, { imposto: 'IRRF', valor: 45 }] },
  ],
  recebidas: [
    { ...deFora, tipo: 'NF-e', chave: 'D', numero: '50', data: '05/10/2026', valor: 200, itens: [{ ncm: '1', cfop: '1102', cst: '000', cest: '', valor: 200, icms: 24, st: 3 }] },
    { ...deFora, tipo: 'NF-e', chave: 'E', numero: '51', data: '06/10/2026', valor: 50 },
    { ...deFora, tipo: 'NFS-e', chave: '', numero: '8', serie: '', data: '15/10/2026', valor: 4000, retencoes: [{ imposto: 'INSS', valor: 440 }, { imposto: 'ISS', valor: 10 }] },
    { ...deFora, tipo: 'CT-e', chave: 'F', numero: '70', data: '08/10/2026', valor: 500, icms: 60, cfop: '2353' },
  ],
};

describe('o painel do SIEG', () => {
  const p = painelDoSieg(x);

  it('separa as notas nas abas e não soma as canceladas', () => {
    expect(p.abas.saidas.quantidade).toBe(2);
    expect(p.abas.saidas.canceladas).toBe(1);
    expect(p.abas.saidas.linhas).toHaveLength(3);
    expect(p.abas.saidas.valor).toBe(2300);
    expect(p.abas.saidas.icms).toBe(324.1);
    expect(p.abas.saidas.ipi).toBe(5);
    expect(p.abas.entradas.quantidade).toBe(2);
    expect(p.abas.entradas.st).toBe(3);
    expect(p.abas.prestados.quantidade).toBe(1);
    expect(p.abas.tomados.valor).toBe(4000);
    expect(p.abas.ctes.quantidade).toBe(1);
    expect(p.abas.ctes.icms).toBe(60);
    expect(p.total).toBe(7);
  });

  it('lista as mais novas primeiro e mostra a outra parte', () => {
    expect(p.abas.saidas.linhas.map(l => l.numero)).toEqual(['12', '11', '10']);
    expect(p.abas.saidas.linhas[0].nome).toBe('CLIENTE');
    expect(p.abas.entradas.linhas[0].nome).toBe('CLIENTE');
  });

  it('resume por CFOP e por CST, do maior valor ao menor', () => {
    const cfop = p.abas.saidas.porCfop;
    expect(cfop.map(g => g.codigo)).toEqual(['5102', '5405']);
    expect(cfop[0]).toMatchObject({ notas: 2, itens: 2, valor: 1800, icms: 324.1 });
    expect(p.abas.saidas.porCst.map(g => g.codigo)).toEqual(['000', '060']);
    expect(p.abas.entradas.semItens).toBe(1);
    expect(p.abas.ctes.porCfop[0]).toMatchObject({ codigo: '2353', valor: 500, icms: 60 });
  });

  it('soma as retenções por imposto e agrupa os serviços por NBS', () => {
    expect(p.abas.prestados.retencoes).toEqual([{ imposto: 'ISS', valor: 150 }, { imposto: 'IRRF', valor: 45 }]);
    expect(p.abas.prestados.retido).toBe(195);
    expect(p.abas.tomados.retido).toBe(450);
    expect(p.abas.prestados.porNbs).toMatchObject([{ codigo: '1.1', valor: 3000 }]);
    expect(p.abas.tomados.porNbs[0].codigo).toBe('Sem NBS');
  });

  it('volta à nota pelo id da linha', () => {
    const l = p.abas.entradas.linhas.find(y => y.numero === '50')!;
    expect(notaDaLinha(x, l.id)?.chave).toBe('D');
    expect(notaDaLinha(x, 'e9')).toBeNull();
  });

  it('a busca acha pelo número, nome, CNPJ e valor', () => {
    const l = p.abas.saidas.linhas.find(y => y.numero === '11')!;
    for (const q of ['11', 'cliente', '44555666', '800,00', '', '09/10']) expect(linhaCombina(l, q)).toBe(true);
    expect(linhaCombina(l, 'zzz')).toBe(false);
    expect(linhaCombina(l, '777')).toBe(false);
  });
});
