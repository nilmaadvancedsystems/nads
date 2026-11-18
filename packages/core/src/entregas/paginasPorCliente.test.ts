// Um PDF com guias de vários clientes vira um arquivo por cliente (plano do Acessórias, 17/11/2026, ficha E16).
import { describe, expect, it } from 'vitest';
import { documentosDoTexto, paginasPorCliente, RAIZ_DO_ESCRITORIO } from './paginasPorCliente';

const CLIENTES = [
  { codigo: 10, documento: '11.222.333/0001-81' },
  { codigo: 20, documento: '44555666000199' },
  { codigo: 30, documento: '123.456.789-09' },
];
const guia = (doc: string) => 'DOCUMENTO DE ARRECADAÇÃO CNPJ/CPF ' + doc + ' VALOR R$ 100,00';

describe('as páginas por cliente', () => {
  it('3 páginas com 3 documentos = 3 grupos', () => {
    const r = paginasPorCliente([guia('11.222.333/0001-81'), guia('44.555.666/0001-99'), guia('123.456.789-09')], CLIENTES);
    expect(r).toEqual({ grupos: [{ codigo: 10, paginas: [0] }, { codigo: 20, paginas: [1] }, { codigo: 30, paginas: [2] }], semCliente: [] });
  });
  it('a página 2 sem documento fica junto da 1 (a guia de duas páginas)', () => {
    const r = paginasPorCliente([guia('11.222.333/0001-81'), 'INSTRUÇÕES DE PAGAMENTO', guia('44.555.666/0001-99')], CLIENTES);
    expect(r.grupos).toEqual([{ codigo: 10, paginas: [0, 1] }, { codigo: 20, paginas: [2] }]);
  });
  it('a página sem documento logo no começo, ou depois de uma sem cliente, fica sem cliente', () => {
    const r = paginasPorCliente(['CAPA', guia('99.999.999/0001-99'), 'CONTINUAÇÃO'], CLIENTES);
    expect(r).toEqual({ grupos: [], semCliente: [0, 1, 2] });
  });
  it('documento que não está no Cadastro = sem cliente (não vira cliente)', () => {
    const r = paginasPorCliente([guia('99.999.999/0001-99'), guia('11.222.333/0001-81')], CLIENTES);
    expect(r).toEqual({ grupos: [{ codigo: 10, paginas: [1] }], semCliente: [0] });
  });
  it('o CPF do contador junto do cliente não atrapalha; o CNPJ do escritório nem conta', () => {
    const r = paginasPorCliente([guia('11.222.333/0001-81') + ' CONTADOR CPF 987.654.321-00 NILMA CNPJ 27.872.981/0001-55'], CLIENTES);
    expect(r.grupos).toEqual([{ codigo: 10, paginas: [0] }]);
    expect(documentosDoTexto('CNPJ 27.872.981/0001-55')).toEqual([]);
    expect(RAIZ_DO_ESCRITORIO).toHaveLength(8);
  });
  it('a página que só tem o CNPJ do escritório depois de um cliente continua com ele', () => {
    const r = paginasPorCliente([guia('11.222.333/0001-81'), 'RODAPÉ NILMA CNPJ 27.872.981/0001-55'], CLIENTES);
    expect(r.grupos).toEqual([{ codigo: 10, paginas: [0, 1] }]);
  });
  it('dois clientes na mesma página = dúvida, sem cliente', () => {
    const r = paginasPorCliente([guia('11.222.333/0001-81') + ' ' + guia('44.555.666/0001-99')], CLIENTES);
    expect(r).toEqual({ grupos: [], semCliente: [0] });
  });
  it('o mesmo cliente em páginas separadas junta num grupo só', () => {
    const r = paginasPorCliente([guia('11.222.333/0001-81'), guia('44.555.666/0001-99'), guia('11.222.333/0001-81')], CLIENTES);
    expect(r.grupos).toEqual([{ codigo: 10, paginas: [0, 2] }, { codigo: 20, paginas: [1] }]);
  });
});
