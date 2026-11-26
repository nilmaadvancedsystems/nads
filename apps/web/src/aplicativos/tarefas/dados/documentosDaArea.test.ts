import type { entregas as e } from '@nads/core';
import { describe, expect, it } from 'vitest';
import type { RecebidoDoCliente } from './areaCliente';
import { areaPeloNome, cnpjsDoTexto, empresaDoArquivo, enviadosAoCliente, filtroInicial, filtrosDosRecebidos, recebidosDoFiltro } from './documentosDaArea';

const agora = new Date('2026-11-26T15:00:00Z');
const rec = (id: string, tipo: RecebidoDoCliente['tipo'], recebidoEm: string, recusa = false): RecebidoDoCliente => ({
  id, token: 't', codigo: 1, empresa: 'X', nome: id + '.pdf', tipo, tamanho: 1, pastaDrive: '', arquivoDrive: '', recebidoEm, guia: '',
  ...(recusa ? { recusa: { motivo: 'ilegível', por: 'a', em: recebidoEm } } : {}),
});

describe('os recebidos da seção Documentos (26/11/2026)', () => {
  const lista = [rec('velho', 'extrato', '2026-10-01T10:00:00Z'), rec('novo', 'nota', '2026-11-25T10:00:00Z'), rec('rec', 'extrato', '2026-11-24T10:00:00Z', true)];
  it('as contagens: novo é dos últimos 7 dias e sem recusa', () => {
    const f = Object.fromEntries(filtrosDosRecebidos(lista, agora, new Set()).map(x => [x.valor, x.conta]));
    expect(f).toMatchObject({ novos: 1, todos: 3, extrato: 2, nota: 1, recusados: 1 });
  });
  it('o filtro e a ordem (o mais novo primeiro); a recusa feita agora conta antes do robô', () => {
    expect(recebidosDoFiltro(lista, 'todos', agora, new Set()).map(r => r.id)).toEqual(['novo', 'rec', 'velho']);
    expect(recebidosDoFiltro(lista, 'recusados', agora, new Set(['novo'])).map(r => r.id)).toEqual(['novo', 'rec']);
    expect(recebidosDoFiltro(lista, 'novos', agora, new Set(['novo']))).toEqual([]);
  });
  it('começa nos novos quando há algum', () => {
    expect(filtroInicial(lista, agora)).toBe('novos');
    expect(filtroInicial([lista[0]], agora)).toBe('todos');
  });
});

describe('o que a equipe mandou ao cliente', () => {
  const env = (id: string, cliente: string, status: e.EnvioFeito['status'], criadoEm: string): e.EnvioFeito =>
    ({ id, nome: id + '.pdf', criadoEm, status, pasta: '', erro: status === 'erro' ? 'sem pasta' : '', arquivamento: null, cliente, codigo: '292' });
  it('só os envios com a marca, do mais novo ao mais velho', () => {
    const r = enviadosAoCliente([
      env('a', '@area-do-cliente/dp', 'pronto', '2026-11-20'), env('b', 'FITO', 'pronto', '2026-11-26'),
      env('c', '@area-do-cliente/fiscal', 'gravando', '2026-11-25'), env('d', '@area-do-cliente/x', 'erro', '2026-11-24'),
    ]);
    expect(r.map(x => [x.id, x.area, x.situacao])).toEqual([['c', 'fiscal', 'fila'], ['a', 'dp', 'pronto']]);
  });
});

describe('o Enviar ao cliente adivinha a empresa e a área (26/11/2026)', () => {
  it('a área pelo nome do arquivo', () => {
    expect(areaPeloNome('NFS-e 25 - honorários de novembro de 2026.pdf')).toBe('societario');
    expect(areaPeloNome('PGDASD-EXTRATO-0720263.pdf')).toBe('fiscal');
    expect(areaPeloNome('Extrato do Simples Nacional - novembro.pdf')).toBe('fiscal');
    expect(areaPeloNome('Holerite 10-2026.pdf')).toBe('dp');
    expect(areaPeloNome('Guia FGTS outubro.pdf')).toBe('dp');
    expect(areaPeloNome('Balancete 2025.pdf')).toBe('contabil');
    expect(areaPeloNome('Contrato Social.pdf')).toBe('societario');
    // o DARF da Receita (26/11/2026: "ele tem que ler automatico e descobrir empresa e setor")
    expect(areaPeloNome('GuiaPagamento_65116459000109_101120261751337017.pdf')).toBe('fiscal');
    expect(areaPeloNome('foto.jpg')).toBeNull();
  });
  it('a empresa pelo CNPJ do PDF, pelo código ou pelo nome', () => {
    const emp = [{ codigo: 292, nome: 'FITO INDUSTRIA E COMERCIO DE ALIMENTOS LTDA' }, { codigo: 590, nome: 'TORIBA TECNOLOGIA E GESTAO EMPRESARIAL LTDA' }];
    const docs = new Map([[292, '11.222.333/0001-81'], [590, '44.555.666/0001-00']]);
    expect(cnpjsDoTexto('CNPJ: 44.555.666/0001-00 e 44555666000100')).toEqual(['44555666000100']);
    // o CNPJ no nome do arquivo (os da Receita: "GuiaPagamento_65116459000109_1004202608.pdf")
    expect(cnpjsDoTexto('GuiaPagamento_65116459000109_1004202608.pdf')).toEqual(['65116459000109']);
    expect(empresaDoArquivo(emp, 'nota.pdf', ['44555666000100'], docs)?.codigo).toBe(590);
    expect(empresaDoArquivo(emp, 'nota.pdf', ['44555666000299'], docs)?.codigo).toBe(590);
    expect(empresaDoArquivo(emp, '292 - extrato.pdf', [], docs)?.codigo).toBe(292);
    expect(empresaDoArquivo(emp, 'Balancete TORIBA TECNOLOGIA E GESTAO EMPRESARIAL 2025.pdf', [], docs)?.codigo).toBe(590);
    expect(empresaDoArquivo(emp, 'certidao.pdf', [], docs)).toBeNull();
  });
});
