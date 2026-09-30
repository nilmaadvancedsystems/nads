// ViewModel do Drive (a pasta do ano, pelo mapa do robô do Entregas): a lista das pastas de cliente, a pasta aberta
// (fica na URL: ?c=<pasta do cliente>&p=<pasta>, então o voltar do navegador funciona), a trilha, a busca, a seleção
// e os pedidos ao robô (abrir, baixar, .zip), com o prazo recomeçando a cada avanço que o robô informa.
import { entregas as e } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useDriveDoEntregas } from '../../dados/repo';

const PRAZO_MS = 90 * 1000;
const PRAZO_ZIP_MS = 3 * 60 * 1000;

export interface PedidoNaTela { id: number; rotulo: string; texto: string; erro?: string }

export function useExploradorDoDrive() {
  const repo = useDriveDoEntregas();
  const { toast } = useRetorno();
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [marcados, setMarcados] = useState<Map<string, e.ItemDoDrive>>(new Map());
  const [pedidos, setPedidos] = useState<PedidoNaTela[]>([]);

  const mapa = repo.mapa();
  const cliente = params.get('c') || '';
  const pastaCliente = mapa.clientes.find(x => x.id === cliente) || null;
  const pasta = params.get('p') || cliente;
  const conteudo = cliente ? repo.itens(cliente) : { carregados: true, itens: [] as e.ItemDoDrive[] };
  const itens = conteudo.itens;

  const clientes = useMemo(() => (cliente ? [] : e.buscarClientes(mapa.clientes, busca)), [cliente, mapa.clientes, busca]);
  const filhos = useMemo(() => (cliente && !busca.trim() ? e.filhosDe(itens, pasta) : []), [cliente, itens, pasta, busca]);
  const achados = useMemo(() => (cliente && busca.trim().length >= 2 ? e.buscarNaPasta(itens, pasta, busca) : []), [cliente, itens, pasta, busca]);
  const caminho = cliente ? e.caminhoAte(itens, pasta, cliente) : [];
  const pastaAtual = pasta === cliente ? (pastaCliente ? { i: cliente, n: pastaCliente.nomePasta } : null) : caminho[caminho.length - 1] || null;

  function ir(c: string, p?: string) {
    setBusca('');
    const novo = new URLSearchParams();
    if (c) novo.set('c', c);
    if (p && p !== c) novo.set('p', p);
    setParams(novo);
  }

  function marcar(it: e.ItemDoDrive) {
    setMarcados(m => { const n = new Map(m); if (n.has(it.i)) n.delete(it.i); else n.set(it.i, it); return n; });
  }

  /** Pede ao robô e devolve o link quando ele terminar (ou o motivo de não ter dado). */
  function pedirLink(pedido: e.PedidoAoDrive, rotulo: string): Promise<string> {
    const id = Date.now() + Math.random();
    const zip = pedido.modo === 'zip';
    setPedidos(l => [...l, { id, rotulo, texto: (zip ? 'Preparando o .zip de ' : 'Buscando ') + rotulo + '…' }]);
    const tirar = () => setPedidos(l => l.filter(x => x.id !== id));
    return new Promise((resolver, recusar) => {
      let prazo: ReturnType<typeof setTimeout>;
      const relogio = () => {
        clearTimeout(prazo);
        prazo = setTimeout(() => { parar(); tirar(); recusar(new Error('o robô não respondeu a tempo. Confira se ele está online e tente de novo')); }, zip ? PRAZO_ZIP_MS : PRAZO_MS);
      };
      relogio();
      let ultimo = '';
      const parar = repo.pedir(pedido, a => {
        if (a.progresso && a.progresso !== ultimo) {
          ultimo = a.progresso;
          setPedidos(l => l.map(x => (x.id === id ? { ...x, texto: (zip ? 'Preparando o .zip de ' : 'Buscando ') + rotulo + ': ' + a.progresso } : x)));
          relogio();
        }
        if (a.status === 'pronto' && a.url) { clearTimeout(prazo); parar(); tirar(); resolver(a.url); }
        else if (a.status === 'erro') { clearTimeout(prazo); parar(); tirar(); recusar(new Error(a.erro || 'erro do robô')); }
      });
    });
  }

  const falhou = (oque: string) => (err: Error): never => { toast('Não consegui ' + oque + ': ' + err.message + '.'); throw err; };

  return {
    exemplos: repo.exemplos,
    carregando: !mapa.carregado || (!!cliente && !conteudo.carregados),
    erro: mapa.erro ? 'Não consegui ler o mapa do Drive (' + mapa.erro + '). Ele é do robô do Entregas; confira se sua conta é do contábil.' : '',
    ano: mapa.pastaAno?.nome || 'Drive',
    naRaiz: !cliente,
    pastaCliente,
    caminho: caminho.map(x => ({ id: x.i, nome: x.n })),
    busca, setBusca,
    buscando: !!cliente && busca.trim().length >= 2,
    clientes,
    filhos: filhos.map(x => ({ item: x, onde: '' })),
    achados,
    quantos: (it: e.ItemDoDrive) => e.quantosDentro(itens, it.i),
    marcados: [...marcados.values()],
    estaMarcado: (it: e.ItemDoDrive) => marcados.has(it.i),
    marcar,
    limparSelecao: () => setMarcados(new Map()),
    pedidos,
    irParaRaiz: () => ir(''),
    abrirCliente: (id: string) => ir(id),
    abrirPasta: (id: string) => ir(cliente, id),
    /** o link para abrir o arquivo no navegador */
    linkParaAbrir: (it: e.ItemDoDrive) => pedirLink({ modo: 'abrir', fileId: it.i, nome: it.n }, '"' + it.n + '"').catch(falhou('abrir "' + it.n + '"')),
    /** o link de download dos marcados (um só: o arquivo; vários: um .zip) */
    linkDosMarcados(): Promise<string> {
      const lista = [...marcados.values()];
      if (lista.length === 1) return pedirLink({ modo: 'baixar', fileId: lista[0].i, nome: lista[0].n }, '"' + lista[0].n + '"').catch(falhou('baixar'));
      const pedido = e.pedidoDeZip(lista, (pastaCliente?.nomePasta || 'arquivos') + '.zip');
      if (!pedido) return Promise.reject(new Error('nada para baixar'));
      if (lista.length > e.MAX_NO_ZIP) toast('Só os ' + e.MAX_NO_ZIP + ' primeiros vão no .zip.');
      return pedirLink(pedido, lista.length + ' arquivos').catch(falhou('juntar os arquivos'));
    },
    /** o link do .zip da pasta aberta */
    linkDaPasta(): Promise<string> {
      if (!pastaAtual) return Promise.reject(new Error('sem pasta'));
      return pedirLink(e.pedidoDaPasta(pastaAtual), 'a pasta "' + pastaAtual.n + '"').catch(falhou('juntar a pasta'));
    },
    tamanho: e.tamanhoLegivel,
  };
}

export type VmDrive = ReturnType<typeof useExploradorDoDrive>;
