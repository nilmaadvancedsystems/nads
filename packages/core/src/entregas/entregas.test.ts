import { describe, expect, it } from 'vitest';
import {
  buscarClientes, buscarNaPasta, caminhoAte, clienteParecido, clientesDoEntregas, entradaDoCliente, entradaDoItem, estadoDoRobo,
  filhosDe, itensDasPartes, linhasDaArvore, mapaDaRaiz, ordenarEntradas, tipoDoItem, mensagemIdValido, pedidoDaPasta, pedidoDeZip, quantosDentro, semCliente, tamanhoLegivel, type ItemDoDrive,
} from '.';

const ITENS: ItemDoDrive[] = [
  { i: 'a', n: 'CONTÁBIL', p: 'raiz', t: 'd' },
  { i: 'b', n: 'EXTRATOS', p: 'a', t: 'd' },
  { i: 'f10', n: 'extrato 10.pdf', p: 'b', t: 'f', s: 2048 },
  { i: 'f2', n: 'extrato 2.pdf', p: 'b', t: 'f', s: 1024 },
  { i: 'z', n: 'Anotações', p: 'raiz', t: 'g' },
];

describe('mapa do Drive', () => {
  it('lê a raiz e as partes (item estranho fica de fora)', () => {
    const m = mapaDaRaiz({ pastaId: 'ano', pastaNome: '2026', clientes: [{ id: 'p1', nome: 'X', codigo: '58' }, { nome: 'sem id' }] });
    expect(m.pastaAno).toEqual({ id: 'ano', nome: '2026' });
    expect(m.clientes.map(c => c.codigo)).toEqual(['58']);
    expect(itensDasPartes([{ itens: [{ i: 'x', n: 'a', p: 'r', t: 'f', s: 3 }, { i: 'y', t: 'q' }] }, { itens: 'nada' }])).toEqual([{ i: 'x', n: 'a', p: 'r', t: 'f', s: 3 }]);
  });

  it('filhos: pastas primeiro e ordem natural; caminho e contagem', () => {
    expect(filhosDe(ITENS, 'raiz').map(x => x.i)).toEqual(['a', 'z']);
    expect(filhosDe(ITENS, 'b').map(x => x.n)).toEqual(['extrato 2.pdf', 'extrato 10.pdf']);
    expect(caminhoAte(ITENS, 'b', 'raiz').map(x => x.n)).toEqual(['CONTÁBIL', 'EXTRATOS']);
    expect(quantosDentro(ITENS, 'raiz')).toEqual({ arquivos: 3, pastas: 2 });
  });

  it('busca em qualquer nível, sem acento, com onde está', () => {
    const r = buscarNaPasta(ITENS, 'raiz', 'contabil');
    expect(r.map(x => x.item.i)).toEqual(['a']);
    expect(buscarNaPasta(ITENS, 'raiz', 'extrato 10').map(x => [x.item.i, x.onde])).toEqual([['f10', 'CONTÁBIL › EXTRATOS']]);
    expect(buscarNaPasta(ITENS, 'raiz', ' ')).toEqual([]);
  });

  it('clientes por código ou nome; tamanho legível; pedidos de zip', () => {
    const cs = mapaDaRaiz({ clientes: [{ id: '1', nome: 'B', nomePasta: '10 - B', codigo: '10' }, { id: '2', nome: 'Árvore', nomePasta: '2 - Árvore', codigo: '2' }] }).clientes;
    expect(buscarClientes(cs, '').map(c => c.codigo)).toEqual(['2', '10']);
    expect(buscarClientes(cs, 'arvore').map(c => c.codigo)).toEqual(['2']);
    expect(tamanhoLegivel(1536)).toBe('1,5 KB');
    expect(pedidoDeZip(ITENS, 'x.zip')).toMatchObject({ modo: 'zip', fileId: 'f10', fileIds: ['f10', 'f2', 'z'] });
    expect(pedidoDeZip([ITENS[0]], 'x')).toBeNull();
    expect(pedidoDaPasta({ i: 'b', n: 'EXTRATOS' })).toMatchObject({ modo: 'zip', fileId: 'b', pastaId: 'b' });
  });

  it('explorador: tipo como no Windows, pastas em cima ao ordenar, árvore só com pastas e sob demanda', () => {
    expect(ITENS.map(tipoDoItem)).toEqual(['Pasta de arquivos', 'Pasta de arquivos', 'Documento PDF', 'Documento PDF', 'Documento Google']);
    expect(tipoDoItem({ n: 'razao.XLSX', t: 'f' })).toBe('Planilha do Excel');
    expect(tipoDoItem({ n: 'nota.abc', t: 'f' })).toBe('Arquivo ABC');
    const es = ITENS.map(x => entradaDoItem(x));
    expect(ordenarEntradas(es, 'nome', false).map(e => e.id)).toEqual(['a', 'b', 'z', 'f2', 'f10']);
    expect(ordenarEntradas(es, 'tamanho', true).map(e => e.id)).toEqual(['b', 'a', 'f10', 'f2', 'z']);
    const cs = mapaDaRaiz({ clientes: [{ id: 'raiz', nomePasta: '1 - A', pastas: 2 }, { id: 'c2', nomePasta: '2 - B', pastas: 0 }] }).clientes;
    expect(entradaDoCliente(cs[0])).toMatchObject({ nome: '1 - A', pasta: true, tipo: 'Pasta de cliente' });
    const pedidos: string[] = [];
    const itensDe = (c: string) => { pedidos.push(c); return { carregados: true, itens: ITENS }; };
    expect(linhasDaArvore(cs, () => false, itensDe).map(n => [n.nome, n.temFilhos])).toEqual([['1 - A', true], ['2 - B', false]]);
    expect(pedidos).toEqual([]);
    const aberta = linhasDaArvore(cs, id => id === 'raiz' || id === 'a', itensDe);
    expect(aberta.map(n => [n.nome, n.nivel])).toEqual([['1 - A', 0], ['CONTÁBIL', 1], ['EXTRATOS', 2], ['2 - B', 0]]);
    expect(linhasDaArvore(cs, id => id === 'raiz', () => ({ carregados: false, itens: [] }))[0].carregando).toBe(true);
  });
});

describe('caixa do robô do Gmail', () => {
  const agora = Date.parse('2026-09-30T15:00:00Z');
  const doc = {
    vigia: { em: '2026-09-30T14:59:00Z' },
    caixa: [{ mensagemId: '1', em: '2026-09-29T10:00:00Z', remetente: 'A@X.COM', arquivos: ['a.pdf'], clienteId: 'c1' }, { mensagemId: '2', em: '2026-09-30T10:00:00Z', remetente: 'b@x.com' }],
    naoReconhecidos: [{ mensagemId: '3', em: 'x', remetente: 'novo@padaria.com.br', nome: 'Padaria Pão Dourado' }, { mensagemId: '4', em: 'x', remetente: 'ja@cadastrado.com' }, { mensagemId: '5', em: 'x', remetente: 'spam@x.com' }],
    andamento: { ativo: true, tipo: 'leitura', feito: 2, total: 4, recentes: [{ texto: 'lendo' }] },
  };

  it('online pelo sinal dos últimos 3 min; caixa do mais novo para o mais antigo', () => {
    const e = estadoDoRobo(doc, agora);
    expect(e.online).toBe(true);
    expect(estadoDoRobo(doc, agora + 10 * 60000).online).toBe(false);
    expect(e.caixa.map(x => x.mensagemId)).toEqual(['2', '1']);
    expect(e.caixa[1]).toMatchObject({ remetente: 'a@x.com', arquivos: ['a.pdf'], clienteId: 'c1' });
    expect(e.andamento?.feito).toBe(2);
  });

  it('sem cliente: tira os já cadastrados e os ignorados; parece ser pelo nome', () => {
    const clientes = clientesDoEntregas([
      { id: 'k1', dados: { nome: 'PADARIA PAO DOURADO LTDA', codigoOrigem: '14', email: 'JA@cadastrado.com' } },
      { id: 'k2', dados: { nome: 'OUTRA', codigoOrigem: '2', ativo: false } },
    ]);
    expect(clientes.map(c => c.id)).toEqual(['k1']);
    const e = estadoDoRobo(doc, agora);
    expect(semCliente(e, clientes, ['SPAM@x.com']).map(x => x.mensagemId)).toEqual(['3']);
    expect(clienteParecido(e.naoReconhecidos.find(x => x.mensagemId === '3') as never, clientes)?.id).toBe('k1');
    expect(mensagemIdValido('18f0a1b2c3d4e5f6')).toBe(true);
    expect(mensagemIdValido('x')).toBe(false);
  });
});
