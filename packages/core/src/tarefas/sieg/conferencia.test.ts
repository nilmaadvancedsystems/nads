import { describe, expect, it } from 'vitest';
import { conferirValores, errosDeTributacao } from './conferencia';
import type { NotaDoSieg, NotasSieg } from './index';

const eu = { doc: '11111111000111', nome: 'EMPRESA' };
const cli = { doc: '22222222000122', nome: 'CLIENTE' };
const nota = (numero: string, itens: NotaDoSieg['itens'], extra: Partial<NotaDoSieg> = {}): NotaDoSieg =>
  ({ tipo: 'NF-e', chave: 'k' + numero, numero, serie: '1', data: '05/09/2026', emitente: eu, destinatario: cli, valor: 100, itens, ...extra });
const xml = (emitidas: NotaDoSieg[]): NotasSieg => ({ codigo: '1', competencia: '2026-09', em: '', pasta: '', arquivos: 0, novos: 0, emitidas, recebidas: [] });

describe('erros de tributação nos XMLs (09/10/2026)', () => {
  it('Simples com CST de regime normal; fora do Simples com CSOSN', () => {
    const x = xml([nota('1', [{ ncm: '1', cfop: '5102', cst: '000', cest: '', valor: 10 }]), nota('2', [{ ncm: '1', cfop: '5102', cst: '0102', cest: '', valor: 10 }])]);
    expect(errosDeTributacao(x, 'Simples').map(e => e.numero + ':' + e.problema)).toEqual(['1:CST de regime normal: no Simples é CSOSN']);
    expect(errosDeTributacao(x, 'Presumido').map(e => e.numero + ':' + e.problema)).toEqual(['2:CSOSN numa empresa fora do Simples: é CST']);
  });
  it('CFOP de ST sem ST no código, ST com CFOP de venda e ST sem CEST', () => {
    const x = xml([nota('3', [
      { ncm: '1', cfop: '5405', cst: '0102', cest: '', valor: 10 },
      { ncm: '2', cfop: '5102', cst: '0500', cest: '0300700', valor: 10 },
      { ncm: '3', cfop: '5405', cst: '0500', cest: '', valor: 10 },
      { ncm: '4', cfop: '5405', cst: '0500', cest: '0300700', valor: 10 },
    ])]);
    expect(errosDeTributacao(x, 'Simples').map(e => e.ncm + ':' + e.problema)).toEqual([
      '1:CFOP de substituição tributária (5405) com CST/CSOSN sem ST',
      '2:ST no CST/CSOSN com CFOP de venda normal (5102)',
      '3:Item com ST sem CEST',
    ]);
  });
  it('o CSOSN sem a origem (como o robô guarda: "102") é CSOSN, não CST', () => {
    const x = xml([nota('5', [{ ncm: '1', cfop: '5102', cst: '102', cest: '', valor: 10 }, { ncm: '2', cfop: '5405', cst: '500', cest: '0300700', valor: 10 }])]);
    expect(errosDeTributacao(x, 'Simples')).toEqual([]);
  });
  it('a cancelada não conta', () => {
    expect(errosDeTributacao(xml([nota('9', [{ ncm: '1', cfop: '5102', cst: '000', cest: '', valor: 1 }], { cancelada: true })]), 'Simples')).toEqual([]);
  });
});

describe('valores nota a nota: XML x Alterdata (09/10/2026)', () => {
  const linha = (numero: string, valor: number) => ({ cfop: '5102', lanc: '', valor, numero, nome: 'CLIENTE', data: '05/09/2026', desc: '', comp: '2026-09', doc: '22222222000122' });
  it('valor diferente (somando as linhas da nota), cancelada lançada e lançada sem XML', () => {
    const r = conferirValores([nota('10', []), nota('0011', [], { valor: 50 }), nota('12', [], { cancelada: true })],
      [linha('10', 60), linha('10', 40), linha('11', 45), linha('12', 70), linha('13', 9)], 'emitidas');
    expect(r.diferentes.map(n => n.numero + ':' + n.diferenca)).toEqual(['0011:-5']);
    expect(r.canceladasLancadas.map(n => n.numero)).toEqual(['12']);
    expect(r.semXml.map(n => n.numero)).toEqual(['13']);
  });
});
