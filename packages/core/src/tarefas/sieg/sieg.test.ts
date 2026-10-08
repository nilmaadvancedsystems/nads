import { describe, expect, it } from 'vitest';
import { conferirSaidas, emFaixas, faltamNoAlterdata, notasDoXml, totalDe, type NotasSieg } from '.';

describe('SIEG: a conferência das saídas', () => {
  it('acha os buracos da numeração e separa as canceladas, série por série', () => {
    const r = conferirSaidas({
      codigo: '292', competencia: '2026-10', em: '',
      series: [
        { modelo: '55', serie: '1', numeros: [101, 102, 104, 105, 108], canceladas: [102], valor: 900 },
        { modelo: '65', serie: '2', numeros: [7, 8, 9], canceladas: [], valor: 50.5 },
      ],
    });
    expect(r.series[0]).toMatchObject({ rotulo: 'NF-e · série 1', primeira: 101, ultima: 108, autorizadas: 4, canceladas: [102], faltando: [103, 106, 107] });
    expect(r.series[1]).toMatchObject({ rotulo: 'NFC-e · série 2', faltando: [], autorizadas: 3 });
    expect(r).toMatchObject({ autorizadas: 7, canceladas: 1, faltando: 3, valor: 950.5, ok: false });
  });
  it('sem buraco: ok; série vazia não entra', () => {
    const r = conferirSaidas({ codigo: '1', competencia: '2026-10', em: '', series: [{ modelo: '55', serie: '1', numeros: [1, 2, 3], canceladas: [], valor: 10 }, { modelo: '55', serie: '9', numeros: [], canceladas: [], valor: 0 }] });
    expect(r.ok).toBe(true);
    expect(r.series).toHaveLength(1);
  });
  it('faixas e totais', () => {
    expect(emFaixas([9, 3, 4, 5, 12, 13])).toBe('3–5, 9, 12–13');
    expect(totalDe({ NFe: 2, NFCe: 3, NFSe: 0, CTe: 1, CFe: 0 })).toBe(6);
  });
});

describe('os XMLs nas tabelas de verificação (08/10/2026)', () => {
  const cli = { doc: '11111111000111', nome: 'CLIENTE' };
  const forn = { doc: '22222222000122', nome: 'FORNECEDOR' };
  const x: NotasSieg = {
    codigo: '1', competencia: '2026-09', em: '', pasta: '', arquivos: 0, novos: 0,
    emitidas: [
      { tipo: 'NF-e', chave: 'a', numero: '10', serie: '1', data: '05/09/2026', emitente: cli, destinatario: forn, valor: 30, itens: [{ ncm: '1', cfop: '5102', cst: '000', cest: '', valor: 10 }, { ncm: '2', cfop: '5405', cst: '060', cest: '99', valor: 20 }] },
      { tipo: 'NF-e', chave: 'b', numero: '11', serie: '1', data: '06/09/2026', emitente: cli, destinatario: forn, valor: 5, cancelada: true, itens: [{ ncm: '1', cfop: '5102', cst: '000', cest: '', valor: 5 }] },
      { tipo: 'NFS-e', chave: '', numero: '7', serie: '', data: '07/09/2026', emitente: cli, destinatario: forn, valor: 100, nbs: '1.01', descricao: 'Consultoria', retencoes: [{ imposto: 'ISS', valor: 5 }, { imposto: 'IRRF', valor: 1.5 }] },
    ],
    recebidas: [
      { tipo: 'NF-e', chave: 'c', numero: '0099', serie: '1', data: '08/09/2026', emitente: forn, destinatario: cli, valor: 50, itens: [{ ncm: '3', cfop: '6102', cst: '090', cest: '', valor: 50 }] },
      { tipo: 'CT-e', chave: 'd', numero: '5', serie: '1', data: '08/09/2026', emitente: forn, destinatario: cli, valor: 9 },
    ],
  };
  it('saídas e entradas item por item, sem as canceladas nem o CT-e', () => {
    const r = notasDoXml(x);
    expect(r.saidas.map(n => [n.numero, n.ncm, n.cst, n.cest, n.cfop, n.valor, n.nome, n.comp])).toEqual([
      ['10', '1', '000', '', '5102', 10, 'FORNECEDOR', '2026-09'], ['10', '2', '060', '99', '5405', 20, 'FORNECEDOR', '2026-09'],
    ]);
    expect(r.entradas.map(n => [n.numero, n.cfop, n.nome])).toEqual([['0099', '6102', 'FORNECEDOR']]);
  });
  it('a NFS-e com NBS, descrição e as retenções da nota', () => {
    const r = notasDoXml(x);
    expect(r.prestados).toHaveLength(1);
    expect(r.prestados[0]).toMatchObject({ numero: '7', nbs: '1.01', descricao: 'Consultoria', valor: 100, issRet: 5, irrf: 1.5, inss: 0 });
    expect(r.tomados).toEqual([]);
  });
  it('o que falta no Alterdata, pelo número sem os zeros', () => {
    const alterdata = [{ cfop: '6102', lanc: '', valor: 50, numero: '99', nome: 'F', data: '', desc: '', comp: '2026-09' }];
    expect(faltamNoAlterdata(x.recebidas, alterdata, 'recebidas')).toEqual([]);
    expect(faltamNoAlterdata(x.emitidas, [], 'emitidas').map(n => n.numero)).toEqual(['10']);
  });
});
