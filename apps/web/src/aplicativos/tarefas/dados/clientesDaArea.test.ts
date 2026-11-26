// A seção Clientes da Área do Cliente (26/11/2026, o módulo refeito): as regras puras de clientesDaArea.ts.
import { describe, expect, it } from 'vitest';
import type { LeituraDaGuia, LinkDaEmpresa, PessoaComSenha } from './areaCliente';
import { clientesDoFiltro, contarFiltros, documentosDoEscritorioNoDrive, montarClientes, nuncaAbriu, pastaDaEmpresaNoMapa, resumoDosClientes, textoDaSenha } from './clientesDaArea';

const T1 = 'a'.repeat(40), T2 = 'b'.repeat(40), T3 = 'c'.repeat(40);
const links: LinkDaEmpresa[] = [
  { codigo: 1, token: T1, atualizadoEm: '2026-11-01T10:00:00.000Z' },
  { codigo: 2, token: T2, atualizadoEm: '2026-11-02T10:00:00.000Z' },
  { codigo: 99, token: T3, atualizadoEm: '2026-11-03T10:00:00.000Z' },
];
const pessoa = (id: string, codigo: number, ativo = true): PessoaComSenha => ({ id, codigo, nome: id, email: id + '@x.com', ativo, situacao: 'pronto', erro: '', criadoEm: '' });
const leitura = (token: string, guiaId: string, ultimaEm: string): LeituraDaGuia => ({ token, guiaId, tipo: 'DAS', competencia: '2026-10', primeiraEm: ultimaEm, ultimaEm, vezes: 1 });

const lista = montarClientes({
  empresas: [{ codigo: 2, nome: 'Bravo' }, { codigo: 1, nome: 'Álamo' }, { codigo: 3, nome: 'Cedro' }, { codigo: null, nome: 'Sem código' }],
  links,
  logos: [{ codigo: 1, logo: 'data:image/png;base64,xx', atualizadoEm: '' }],
  pessoas: [pessoa('p1', 1), pessoa('p2', 1), pessoa('p3', 1, false), pessoa('p4', 2)],
  leituras: [leitura(T1, 'g1', '2026-11-10T10:00:00.000Z'), leitura(T1, 'g2', '2026-11-20T10:00:00.000Z')],
  exigeSenha: t => t === T1,
});

describe('montarClientes', () => {
  it('junta as empresas com código e os links órfãos, pelo nome', () => {
    expect(lista.map(c => c.codigo)).toEqual([1, 2, 3, 99]);
    expect(lista.find(c => c.codigo === 99)?.nome).toBe('Empresa 99');
  });
  it('conta as pessoas ativas, a logo, a senha e a última guia aberta', () => {
    const a = lista[0];
    expect(a).toMatchObject({ pessoas: 2, exigeSenha: true, guiasAbertas: 2, ultimaAtividade: '2026-11-20T10:00:00.000Z' });
    expect(a.logo).toContain('data:image');
    expect(lista.find(c => c.codigo === 3)).toMatchObject({ token: '', exigeSenha: false, guiasAbertas: 0 });
  });
});

describe('os filtros', () => {
  it('contam cada um', () => {
    expect(contarFiltros(lista)).toEqual({ todas: 4, com: 3, sem: 1, senha: 1, nunca: 2 });
  });
  it('"nunca abriu" é ter link e nenhuma guia aberta', () => {
    expect(lista.filter(nuncaAbriu).map(c => c.codigo)).toEqual([2, 99]);
  });
  it('a busca pega o código e o nome sem acento', () => {
    expect(clientesDoFiltro(lista, 'todas', 'alamo').map(c => c.codigo)).toEqual([1]);
    expect(clientesDoFiltro(lista, 'com', '99').map(c => c.codigo)).toEqual([99]);
    expect(clientesDoFiltro(lista, 'sem', 'bravo')).toEqual([]);
  });
  it('o resumo e a coluna Senha', () => {
    expect(resumoDosClientes(contarFiltros(lista))).toBe('3 com acesso · 1 exige senha');
    expect(textoDaSenha(lista[0])).toBe('Exige senha · 2 pessoas');
    expect(textoDaSenha(lista[1])).toBe('Abre sem senha');
    expect(textoDaSenha(lista[2])).toBe('');
  });
});

describe('os documentos do escritório no Drive', () => {
  const itens = [
    { i: 'area', n: 'ÁREA DO CLIENTE', p: 'emp', t: 'd' as const },
    { i: 'esc', n: 'DO ESCRITÓRIO', p: 'area', t: 'd' as const },
    { i: 'fis', n: 'FISCAL', p: 'esc', t: 'd' as const },
    { i: 'sub', n: '2026', p: 'fis', t: 'd' as const },
    { i: 'f1', n: 'Alvará.pdf', p: 'esc', t: 'f' as const, m: '2026-11-01T00:00:00Z' },
    { i: 'f2', n: 'Certidão.pdf', p: 'sub', t: 'f' as const, m: '2026-11-05T00:00:00Z' },
    { i: 'f3', n: 'extrato.pdf', p: 'area', t: 'f' as const, m: '2026-11-09T00:00:00Z' },
  ];
  it('lista só o que está em DO ESCRITÓRIO, com a área da subpasta de cima', () => {
    const docs = documentosDoEscritorioNoDrive(itens, 'emp');
    expect(docs.map(d => [d.nome, d.area])).toEqual([['Certidão.pdf', 'fiscal'], ['Alvará.pdf', 'societario']]);
    expect(docs[0].rotuloDaArea).toBe('Fiscal');
  });
  it('sem a pasta, nada', () => {
    expect(documentosDoEscritorioNoDrive(itens, 'outra')).toEqual([]);
  });
  it('acha a pasta da empresa pelo código', () => {
    const pastas = [{ id: 'x', nome: 'A', nomePasta: '7 - A', codigo: '7', arquivos: 0, pastas: 0, bytes: 0, mod: null }];
    expect(pastaDaEmpresaNoMapa(pastas, 7)?.id).toBe('x');
    expect(pastaDaEmpresaNoMapa(pastas, 8)).toBeNull();
  });
});
