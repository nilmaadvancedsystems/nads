// ViewModel do Drive (a pasta do ano, pelo mapa do robô do Entregas), no jeito do Explorador de Arquivos do Windows:
// a árvore das pastas à esquerda (abre sob demanda), a barra de endereço (voltar, avançar, acima, a trilha), a lista em
// Detalhes (Nome, Data de modificação, Tipo, Tamanho; clicar no título ordena) ou em Ícones, a seleção (clique,
// Ctrl e Shift) e a barra de status. A pasta aberta fica na URL (?c=<pasta do cliente>&p=<pasta>), então o voltar do
// navegador funciona. Os pedidos ao robô (abrir, baixar, .zip) recomeçam o prazo a cada avanço que ele informa.
// A exibição, a árvore, a tela cheia e a ordem ficam guardadas neste navegador (localStorage; se ele recusar, vale o padrão).
import { entregas as e } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useDriveDoEntregas } from '../../dados/repo';

const PRAZO_MS = 90 * 1000;
const PRAZO_ZIP_MS = 3 * 60 * 1000;
const GUARDADO = 'nads.drive.explorador';

export interface PedidoNaTela { id: number; rotulo: string; texto: string; erro?: string }
export type Exibicao = 'detalhes' | 'icones';
interface Preferencias { exibicao: Exibicao; arvore: boolean; telaCheia: boolean; coluna: e.ColunaDoExplorador; desc: boolean }

const PADRAO: Preferencias = { exibicao: 'detalhes', arvore: true, telaCheia: false, coluna: 'nome', desc: false };

function lerPreferencias(): Preferencias {
  try {
    const p = JSON.parse(localStorage.getItem(GUARDADO) || '{}') as Partial<Preferencias>;
    return {
      exibicao: p.exibicao === 'icones' ? 'icones' : 'detalhes',
      arvore: p.arvore !== false,
      telaCheia: p.telaCheia === true,
      coluna: p.coluna === 'data' || p.coluna === 'tipo' || p.coluna === 'tamanho' ? p.coluna : 'nome',
      desc: p.desc === true,
    };
  } catch { return PADRAO; }
}

function guardarPreferencias(p: Preferencias) {
  try { localStorage.setItem(GUARDADO, JSON.stringify(p)); } catch { /* navegador sem armazenamento */ }
}

const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');

export function useExploradorDoDrive() {
  const repo = useDriveDoEntregas();
  const { toast } = useRetorno();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const [busca, setBusca] = useState('');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [ancora, setAncora] = useState<string | null>(null);
  const [pedidos, setPedidos] = useState<PedidoNaTela[]>([]);
  const [pref, setPref] = useState<Preferencias>(lerPreferencias);
  // na árvore: o que a pessoa abriu e o que fechou (o caminho da pasta aberta já nasce aberto)
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [fechados, setFechados] = useState<Set<string>>(new Set());

  const mapa = repo.mapa();
  const cliente = params.get('c') || '';
  const pastaCliente = mapa.clientes.find(x => x.id === cliente) || null;
  const pasta = params.get('p') || cliente;
  const conteudo = cliente ? repo.itens(cliente) : { carregados: true, itens: [] as e.ItemDoDrive[] };
  const itens = conteudo.itens;
  const q = busca.trim();
  const buscando = cliente ? q.length >= 2 : !!q;

  const caminho = useMemo(() => (cliente ? e.caminhoAte(itens, pasta, cliente) : []), [cliente, itens, pasta]);
  const pastaAtual = pasta === cliente ? (pastaCliente ? { i: cliente, n: pastaCliente.nomePasta } : null) : caminho[caminho.length - 1] || null;
  const porId = useMemo(() => new Map(itens.map(x => [x.i, x])), [itens]);

  const entradas = useMemo(() => {
    const lista = !cliente
      ? e.buscarClientes(mapa.clientes, q).map(e.entradaDoCliente)
      : buscando ? e.buscarNaPasta(itens, pasta, q).map(a => e.entradaDoItem(a.item, a.onde))
        : e.filhosDe(itens, pasta).map(x => e.entradaDoItem(x));
    return e.ordenarEntradas(lista, pref.coluna, pref.desc);
  }, [cliente, mapa.clientes, q, buscando, itens, pasta, pref.coluna, pref.desc]);

  // a árvore: o caminho da pasta aberta fica aberto (ela também, como no GitHub), a não ser que a pessoa feche
  const noCaminho = useMemo(() => new Set([cliente, ...caminho.map(x => x.i)].filter(Boolean)), [cliente, caminho]);
  const estaAberto = (id: string) => !fechados.has(id) && (abertos.has(id) || noCaminho.has(id));
  const arvore = pref.arvore ? e.linhasDaArvore(e.buscarClientes(mapa.clientes, ''), estaAberto, c => repo.itens(c), true) : [];

  function mudarPref(p: Partial<Preferencias>) {
    setPref(atual => { const nova = { ...atual, ...p }; guardarPreferencias(nova); return nova; });
  }

  // "Abrir a pasta" de um envio arquivado: vai para o cliente e, quando as pastas dele chegarem, desce pelo caminho
  const [destino, setDestino] = useState<{ cliente: string; subpasta: string } | null>(null);
  // "Atualizar o mapa": o robô relê na hora (a pasta do cliente aberta, ou a pasta do ano inteira)
  const [atualizandoMapa, setAtualizandoMapa] = useState('');
  useEffect(() => {
    if (!destino || destino.cliente !== cliente || !conteudo.carregados) return;
    const alvo = e.pastaPeloCaminho(itens, cliente, destino.subpasta);
    setDestino(null);
    if (alvo !== cliente) irAgora.current(cliente, alvo);
  }, [destino, cliente, conteudo.carregados, itens]);

  // o efeito acima usa sempre o ir mais novo (sem refazer o efeito a cada render)
  const irAgora = useRef(ir);
  irAgora.current = ir;

  function ir(c: string, p?: string) {
    setBusca('');
    setMarcados(new Set());
    setAncora(null);
    const novo = new URLSearchParams();
    if (c) novo.set('c', c);
    if (p && p !== c) novo.set('p', p);
    setParams(novo);
  }

  /** Entra na pasta da linha (na raiz, a pasta do cliente); o arquivo quem abre é a tela (a aba nasce no clique). */
  function entrar(id: string) {
    if (!cliente) ir(id);
    else ir(cliente, id);
  }

  /** Clique numa linha: só ela; com Ctrl, junta/tira; com Shift, do último clicado até ela. */
  function selecionar(id: string, modo: { ctrl?: boolean; shift?: boolean } = {}) {
    if (modo.shift && ancora) {
      const ids = entradas.map(x => x.id);
      const [a, b] = [ids.indexOf(ancora), ids.indexOf(id)].sort((x, y) => x - y);
      if (a >= 0) { setMarcados(new Set(ids.slice(a, b + 1))); return; }
    }
    setAncora(id);
    if (modo.ctrl) setMarcados(m => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n; });
    else setMarcados(new Set([id]));
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

  function caminhoDe(x: e.EntradaDoExplorador): string {
    const pastas = [mapa.pastaAno?.nome || 'Drive', ...(pastaCliente ? [pastaCliente.nomePasta] : []), ...caminho.map(c => c.n)];
    return [...pastas, ...(x.onde ? x.onde.split(' › ') : []), x.nome].join(' › ');
  }

  const selecionadas = entradas.filter(x => marcados.has(x.id));
  const bytesMarcados = selecionadas.reduce((t, x) => t + (x.pasta ? 0 : x.bytes), 0);
  const acima = !cliente ? null : pasta === cliente ? { c: '', p: '' } : { c: cliente, p: caminho.length >= 2 ? caminho[caminho.length - 2].i : cliente };

  return {
    exemplos: repo.exemplos,
    carregando: !mapa.carregado || (!!cliente && !conteudo.carregados),
    erro: mapa.erro ? 'Não consegui ler o mapa do Drive (' + mapa.erro + '). Ele é do robô do Entregas; confira se sua conta é do contábil.' : '',
    ano: mapa.pastaAno?.nome || 'Drive',
    atualizado: quando(mapa.atualizadoEm || null),
    naRaiz: !cliente,
    /** a trilha da barra de endereço, depois do ano */
    trilha: [
      ...(pastaCliente ? [{ c: cliente, p: '', nome: pastaCliente.nomePasta }] : []),
      ...caminho.map(x => ({ c: cliente, p: x.i, nome: x.n })),
    ],
    busca, setBusca,
    buscando,
    placeholderBusca: 'Pesquisar em ' + (pastaAtual?.n || mapa.pastaAno?.nome || 'Drive'),

    // lista
    entradas,
    exibicao: pref.exibicao,
    mudarExibicao: (x: Exibicao) => mudarPref({ exibicao: x }),
    coluna: pref.coluna,
    desc: pref.desc,
    ordenarPor: (c: e.ColunaDoExplorador) => mudarPref(pref.coluna === c ? { desc: !pref.desc } : { coluna: c, desc: false }),
    quando,
    tamanho: e.tamanhoLegivel,

    /** a pasta de cliente aberta (o "Enviar para o Claudio Secretário" começa nela) */
    pastaCliente,
    /** "2026 › 58 - TORNEARIA › CONTÁBIL › extrato.pdf" */
    caminhoDe,
    /** as Propriedades (como no Windows): tipo, local, tamanho ou o que tem dentro, datas */
    propriedadesDe(x: e.EntradaDoExplorador): { rotulo: string; valor: string }[] {
      const local = caminhoDe(x).split(' › ').slice(0, -1).join(' › ');
      const linhas = [{ rotulo: 'Tipo', valor: x.tipo }, { rotulo: 'Local', valor: local }];
      const doCliente = !cliente ? mapa.clientes.find(c => c.id === x.id) : null;
      if (doCliente) {
        linhas.push({ rotulo: 'Tamanho', valor: e.tamanhoLegivel(doCliente.bytes) || '0 bytes' });
        linhas.push({ rotulo: 'Contém', valor: doCliente.arquivos + ' arquivos, ' + doCliente.pastas + ' pastas' });
        if (doCliente.codigo) linhas.push({ rotulo: 'Código do cliente', valor: doCliente.codigo });
      } else if (x.pasta) {
        const d = e.quantosDentro(itens, x.id);
        const bytes = e.descendentesDe(itens, x.id).reduce((t, i) => t + (i.s || 0), 0);
        linhas.push({ rotulo: 'Tamanho', valor: e.tamanhoLegivel(bytes) || '0 bytes' });
        linhas.push({ rotulo: 'Contém', valor: d.arquivos + ' arquivos, ' + d.pastas + ' pastas' });
      } else {
        linhas.push({ rotulo: 'Tamanho', valor: e.tamanhoLegivel(x.bytes) + (x.bytes ? ' (' + x.bytes.toLocaleString('pt-BR') + ' bytes)' : '') });
      }
      if (x.data) linhas.push({ rotulo: 'Modificado em', valor: quando(x.data) });
      return linhas;
    },
    /** botão direito numa linha: se ela não está na seleção, a seleção passa a ser só ela (como no Windows) */
    selecionarParaMenu(id: string) {
      if (marcados.has(id)) return;
      setMarcados(new Set([id]));
      setAncora(id);
    },

    // seleção
    marcados: selecionadas,
    estaMarcado: (id: string) => marcados.has(id),
    selecionar,
    selecionarTodos: () => setMarcados(new Set(entradas.map(x => x.id))),
    limparSelecao: () => { setMarcados(new Set()); setAncora(null); },
    tamanhoMarcado: e.tamanhoLegivel(bytesMarcados),

    // navegação
    entrar,
    irPara: (c: string, p?: string) => ir(c, p),
    irParaRaiz: () => ir(''),
    atualizandoMapa,
    /** o que o botão ⟳ relê: a pasta do cliente aberta, ou tudo */
    dicaDoAtualizar: cliente ? 'Atualizar o mapa desta pasta (o robô relê agora, em segundos)' : 'Atualizar o mapa da pasta ' + (mapa.pastaAno?.nome || 'do ano') + ' inteira (o robô relê agora, cerca de 1 minuto)',
    atualizarMapa() {
      if (atualizandoMapa) return;
      const rotulo = pastaCliente ? 'a pasta ' + pastaCliente.nomePasta : 'a pasta ' + (mapa.pastaAno?.nome || 'do ano') + ' inteira';
      setAtualizandoMapa('Pedindo ao robô para reler ' + rotulo + '…');
      let parar = () => {};
      const prazo = setTimeout(() => {
        parar();
        setAtualizandoMapa('');
        toast('O robô não respondeu a tempo. Confira se ele está ligado (Cadastro › Configurações › Saúde do robô).');
      }, (cliente ? 3 : 8) * 60 * 1000);
      parar = repo.atualizarMapa(cliente, a => {
        if (a.status === 'atualizando') setAtualizandoMapa('O robô está relendo ' + rotulo + '…');
        else if (a.status === 'pronto' || a.status === 'erro') {
          clearTimeout(prazo);
          parar();
          setAtualizandoMapa('');
          toast(a.status === 'erro' ? 'Não consegui atualizar o mapa: ' + (a.erro || 'erro do robô') + '.'
            : 'Mapa atualizado: ' + (a.pastas === 1 ? '' : (a.pastas || 0) + ' pastas, ') + (a.arquivos || 0).toLocaleString('pt-BR') + ' arquivos.');
        }
      });
    },
    /** abre a pasta onde o arquivamento pôs o arquivo (pelo código do cliente e o caminho dentro dele) */
    abrirDestino(codigo: string, subpasta: string): boolean {
      const c = mapa.clientes.find(x => x.codigo === codigo);
      if (!c) { toast('Não achei a pasta do cliente ' + codigo + ' no mapa do Drive.'); return false; }
      setDestino({ cliente: c.id, subpasta });
      ir(c.id);
      return true;
    },
    podeSubir: !!acima,
    subir: () => { if (acima) ir(acima.c, acima.p); },
    voltar: () => { void navegar(-1); },
    avancar: () => { void navegar(1); },

    // árvore
    mostrarArvore: pref.arvore,
    alternarArvore: () => mudarPref({ arvore: !pref.arvore }),
    /** o Explorador ocupando a tela inteira (sem o cabeçalho e as laterais do nads) */
    telaCheia: pref.telaCheia,
    alternarTelaCheia: () => mudarPref({ telaCheia: !pref.telaCheia }),
    arvore,
    naPasta: (id: string) => id === pasta,
    alternarNo(id: string) {
      const aberto = estaAberto(id);
      setAbertos(s => { const n = new Set(s); if (aberto) n.delete(id); else n.add(id); return n; });
      setFechados(s => { const n = new Set(s); if (aberto) n.add(id); else n.delete(id); return n; });
    },
    abrirNo: (no: e.NoDaArvore) => ir(no.cliente, no.id),

    // pedidos ao robô
    pedidos,
    /** o link para abrir o arquivo no navegador */
    linkParaAbrir(id: string): Promise<string> {
      const it = porId.get(id);
      if (!it) return Promise.reject(new Error('arquivo não encontrado'));
      return pedirLink({ modo: 'abrir', fileId: it.i, nome: it.n }, '"' + it.n + '"').catch(falhou('abrir "' + it.n + '"'));
    },
    /** o link de download da seleção: um arquivo; uma pasta (.zip dela); vários arquivos (um .zip) */
    linkDosMarcados(): Promise<string> {
      const pastas = selecionadas.filter(x => x.pasta);
      const arquivos = selecionadas.filter(x => !x.pasta).map(x => porId.get(x.id)).filter((x): x is e.ItemDoDrive => !!x);
      if (pastas.length === 1 && !arquivos.length) return pedirLink(e.pedidoDaPasta({ i: pastas[0].id, n: pastas[0].nome }), 'a pasta "' + pastas[0].nome + '"').catch(falhou('juntar a pasta'));
      if (!arquivos.length) { toast('Baixe uma pasta de cada vez (ou marque só arquivos).'); return Promise.reject(new Error('várias pastas')); }
      if (pastas.length) toast('As pastas marcadas ficaram de fora: baixe cada pasta sozinha.');
      if (arquivos.length === 1) return pedirLink({ modo: 'baixar', fileId: arquivos[0].i, nome: arquivos[0].n }, '"' + arquivos[0].n + '"').catch(falhou('baixar'));
      const pedido = e.pedidoDeZip(arquivos, (pastaAtual?.n || 'arquivos') + '.zip');
      if (!pedido) return Promise.reject(new Error('nada para baixar'));
      if (arquivos.length > e.MAX_NO_ZIP) toast('Só os ' + e.MAX_NO_ZIP + ' primeiros vão no .zip.');
      return pedirLink(pedido, arquivos.length + ' arquivos').catch(falhou('juntar os arquivos'));
    },
    /** o link do .zip da pasta aberta */
    podeBaixarPasta: !!cliente && !!pastaAtual,
    linkDaPasta(): Promise<string> {
      if (!pastaAtual) return Promise.reject(new Error('sem pasta'));
      return pedirLink(e.pedidoDaPasta(pastaAtual), 'a pasta "' + pastaAtual.n + '"').catch(falhou('juntar a pasta'));
    },
  };
}

export type VmDrive = ReturnType<typeof useExploradorDoDrive>;
