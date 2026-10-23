// ViewModel das ações de Admin › Arquivador › Para resolver (Vitor, 23/10/2026: "coloca um botão para abrir o arquivo
// direto daqui e selecionar para onde vai também"). Tudo vira pedido ao robô do PC (pedidosArquivador), que confere o
// arquivo e responde:
//   Abrir o arquivo     o robô manda o conteúdo em partes; o visor mostra (PDF e imagem no navegador, XML/TXT como texto;
//                       o resto, baixar).
//   Arquivar em…        o cliente (busca por código ou nome), o tipo e a competência; a prévia do destino vem do robô
//                       (as mesmas regras, em simulação) e o Confirmar arquiva pelo mesmo executor.
//   Descartar           para a quarentena (nunca apagado), com confirmação.
//   Em lote             marcar vários: o mesmo Arquivar em… (um pedido por arquivo; a prévia é a do primeiro) ou Descartar.
// O arquivo resolvido sai da lista na hora; o robô confere NÃO IDENTIFICADOS logo depois.
import { entregas } from '@nads/core';
import { formatoPeloNome, useRetorno, type FormatoDoArquivo } from '@nads/ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useArquivadorNovo } from '../../dados/repo';

type Item = entregas.ItemDoArquivador;
const ESPERA_DA_PREVIA_MS = 600;
const FINAIS = ['pronto', 'feito', 'erro'];

/** O arquivo aberto no visor. */
export interface ArquivoNoVisor {
  nome: string; formato: FormatoDoArquivo; mime: string; carregando: boolean; erro: string;
  /** o endereço do conteúdo (blob:) para o PDF, a imagem e o Baixar */
  url: string;
  /** o XML, o TXT e afins: o texto */
  texto: string;
  como: 'pdf' | 'imagem' | 'texto' | 'baixar';
}

export function useResolver(pendentes: readonly Item[]) {
  const d = useArquivadorNovo();
  const { toast, modal } = useRetorno();
  const [marcados, setMarcados] = useState<Set<string>>(() => new Set());
  // os pedidos de arquivar/descartar de cada item (o item some da lista quando o robô diz "feito")
  const [acoes, setAcoes] = useState<Record<string, { pedido: string; nome: string }>>({});
  // o formulário Arquivar em… (alvo: os ids dos itens; um só ou o lote)
  const [alvo, setAlvo] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [cliente, setCliente] = useState<entregas.ClienteDoFormulario | null>(null);
  const [tipoDoc, setTipoDoc] = useState('');
  const [mes, setMes] = useState('');
  const [ano, setAno] = useState('');
  const [previaId, setPreviaId] = useState('');
  const [enviando, setEnviando] = useState(false);
  // o visor
  const [abrindo, setAbrindo] = useState<{ pedido: string; nome: string } | null>(null);
  const [visor, setVisor] = useState<ArquivoNoVisor | null>(null);
  const urlDoVisor = useRef('');

  const porId = useMemo(() => new Map(pendentes.map(x => [x.id, x])), [pendentes]);
  const cadastro = alvo.length ? d.cadastroDoFormulario() : null;
  const tipo = cadastro?.tipos.find(t => t.id === tipoDoc) || null;
  const competencia = tipo?.precisa === 'mes' ? mes : tipo?.precisa === 'ano' ? ano : '';
  const formularioPronto = !!cliente && !!tipo && (!tipo.precisa || (tipo.precisa === 'mes' ? /^\d{4}-\d{2}$/.test(mes) : /^\d{4}$/.test(ano)));

  // a prévia: pede ao robô quando o formulário fica pronto (com uma folga para a pessoa terminar de escolher)
  const chaveDaPrevia = formularioPronto ? [alvo[0], cliente!.codigo, tipoDoc, competencia].join('|') : '';
  useEffect(() => {
    if (!chaveDaPrevia) { setPreviaId(''); return; }
    const x = porId.get(alvo[0]);
    if (!x) return;
    const t = setTimeout(() => {
      d.pedir({ tipo: 'previa', rel: entregas.caminhoDoArquivo(x), hash: x.hash, nome: x.nome, codigo: cliente!.codigo, tipoDoc, ...(competencia ? { competencia } : {}) })
        .then(setPreviaId, err => toast('Não consegui pedir a prévia: ' + (err instanceof Error ? err.message : String(err))));
    }, ESPERA_DA_PREVIA_MS);
    return () => clearTimeout(t);
    // a chave junta o que muda a prévia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDaPrevia]);
  const previa = previaId ? d.pedido(previaId) : null;

  // o arquivo aberto: quando o robô diz "pronto", junta as partes e mostra
  const pedidoAberto = abrindo ? d.pedido(abrindo.pedido) : null;
  useEffect(() => {
    if (!abrindo || !pedidoAberto) return;
    if (pedidoAberto.status === 'erro') { setVisor(v => v && { ...v, carregando: false, erro: pedidoAberto.erro || 'o robô não conseguiu abrir o arquivo' }); setAbrindo(null); return; }
    if (pedidoAberto.status !== 'pronto' || !pedidoAberto.arquivo) return;
    const a = pedidoAberto.arquivo;
    setAbrindo(null);
    d.conteudo(pedidoAberto.id, a.partes).then(bytes => {
      // o Chrome do Android não mostra PDF dentro da página (pdfViewerEnabled = false): fica o Abrir em outra aba e o Baixar
      const mostraPdf = typeof navigator === 'undefined' || navigator.pdfViewerEnabled !== false;
      const como: ArquivoNoVisor['como'] = /pdf/.test(a.mime) ? (mostraPdf ? 'pdf' : 'baixar') : /^image\//.test(a.mime) ? 'imagem' : /^text\/|xml/.test(a.mime) ? 'texto' : 'baixar';
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: a.mime }));
      if (urlDoVisor.current) URL.revokeObjectURL(urlDoVisor.current);
      urlDoVisor.current = url;
      const texto = como === 'texto' ? new TextDecoder(/xml/.test(a.mime) ? 'utf-8' : 'latin1').decode(bytes) : '';
      setVisor({ nome: a.nome, formato: formatoPeloNome(a.nome), mime: a.mime, carregando: false, erro: '', url, texto, como });
    }, err => setVisor(v => v && { ...v, carregando: false, erro: err instanceof Error ? err.message : String(err) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedidoAberto?.status]);
  useEffect(() => () => { if (urlDoVisor.current) URL.revokeObjectURL(urlDoVisor.current); }, []);

  // o que o robô respondeu aos pedidos de arquivar/descartar
  const situacaoDe = (id: string) => (acoes[id] ? d.pedido(acoes[id].pedido) : null);
  const feitos = new Set(Object.keys(acoes).filter(id => situacaoDe(id)?.status === 'feito'));
  const avisados = useRef(new Set<string>());
  useEffect(() => {
    for (const { pedido: pid, nome } of Object.values(acoes)) {
      const p = d.pedido(pid);
      if (!p || !FINAIS.includes(p.status) || avisados.current.has(pid)) continue;
      avisados.current.add(pid);
      if (p.status === 'feito') toast((p.resposta?.acao === 'DESCARTAR' ? 'Descartado: ' : p.resposta?.acao === 'JA_ARQUIVADO' ? 'Já estava arquivado: ' : 'Arquivado: ') + nome + (p.resposta?.destino && p.resposta.acao !== 'DESCARTAR' ? ' → ' + p.resposta.destino : ''));
      else if (p.status === 'erro') toast('Não deu para ' + (p.tipo === 'descartar' ? 'descartar ' : 'arquivar ') + nome + ': ' + (p.erro || 'erro sem detalhe'));
    }
  });

  function abrirFormulario(ids: string[]) {
    // a competência começa no mês passado (a de quase todo documento que chega) e o ano no atual; a pessoa troca
    const d0 = new Date(); const passado = new Date(d0.getFullYear(), d0.getMonth() - 1, 1);
    setAlvo(ids); setBusca(''); setCliente(null); setTipoDoc(''); setPreviaId('');
    setMes(passado.getFullYear() + '-' + String(passado.getMonth() + 1).padStart(2, '0')); setAno(String(d0.getFullYear()));
    // o cliente que o robô achou (o primeiro do lote) já vem escolhido
    const x = porId.get(ids[0]);
    if (x?.cliente) setBusca(x.cliente);
  }
  const fecharFormulario = () => { setAlvo([]); setPreviaId(''); };

  async function pedirVarios(tipo: 'arquivar' | 'descartar', ids: string[], extra: Partial<{ codigo: number; tipoDoc: string; competencia: string }>) {
    const novos: Record<string, { pedido: string; nome: string }> = {};
    for (const id of ids) {
      const x = porId.get(id);
      if (!x) continue;
      try { novos[id] = { nome: x.nome, pedido: await d.pedir({ tipo, rel: entregas.caminhoDoArquivo(x), hash: x.hash, nome: x.nome, ...extra }) }; }
      catch (err) { toast('Não consegui pedir ' + (tipo === 'descartar' ? 'o descarte' : 'o arquivamento') + ' de ' + x.nome + ': ' + (err instanceof Error ? err.message : String(err))); break; }
    }
    setAcoes(a => ({ ...a, ...novos }));
    setMarcados(m => { const n = new Set(m); for (const id of Object.keys(novos)) n.delete(id); return n; });
  }

  const sugeridos = cadastro && !cliente ? entregas.buscarClientesDoFormulario(cadastro.clientes, busca) : [];
  // o código exato (o cliente que o robô achou, já posto na busca, ou digitado) escolhe sozinho
  const exato = cadastro && !cliente ? cadastro.clientes.find(c => String(c.codigo) === busca.trim()) : undefined;
  useEffect(() => { if (exato) { setCliente(exato); setBusca(exato.codigo + ' · ' + exato.nome); } }, [exato]);
  const anos = Array.from({ length: 8 }, (_, i) => String(new Date().getFullYear() + 1 - i));

  return {
    /** os itens que já saíram (o robô disse "feito"): a lista esconde na hora */
    feitos,
    /** o rótulo do pedido em andamento de um item ("Arquivando…") */
    andamento: (id: string) => {
      const p = situacaoDe(id);
      if (!p || p.status === 'feito') return '';
      if (p.status === 'erro') return 'Não deu: ' + (p.erro || 'erro');
      return p.tipo === 'descartar' ? 'Descartando…' : 'Arquivando…';
    },
    // a marcação em lote
    marcados,
    alternar: (id: string) => setMarcados(m => { const n = new Set(m); if (n.has(id)) n.delete(id); else n.add(id); return n; }),
    marcarTodos: (ids: string[]) => setMarcados(new Set(ids)),
    desmarcar: () => setMarcados(new Set()),
    // abrir o arquivo
    abrindo: !!abrindo,
    async abrir(x: Item) {
      setVisor({ nome: x.nome, formato: formatoPeloNome(x.nome), mime: '', carregando: true, erro: '', url: '', texto: '', como: 'baixar' });
      try { const id = await d.pedir({ tipo: 'abrir', rel: entregas.caminhoDoArquivo(x), hash: x.hash, nome: x.nome }); setAbrindo({ pedido: id, nome: x.nome }); }
      catch (err) { setVisor(v => v && { ...v, carregando: false, erro: err instanceof Error ? err.message : String(err) }); }
    },
    visor: visor ? { ...visor, aguardando: visor.carregando ? (pedidoAberto?.status === 'trabalhando' ? 'O robô do PC está lendo o arquivo…' : 'Pedido ao robô do PC…') : '' } : null,
    fecharVisor: () => { setVisor(null); setAbrindo(null); },
    // descartar
    async descartar(ids: string[]) {
      const nomes = ids.map(id => porId.get(id)?.nome).filter(Boolean);
      const ok = await modal<boolean>({ icone: 'alert', titulo: ids.length === 1 ? 'Descartar ' + nomes[0] + '?' : 'Descartar ' + ids.length + ' arquivos?',
        texto: 'Vai para a quarentena do arquivador (nunca é apagado direto) e sai de NÃO IDENTIFICADOS, com uma linha no manifesto dizendo que foi você.',
        botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Descartar', valor: true, variante: 'btn-danger' }] });
      if (ok) await pedirVarios('descartar', ids, {});
    },
    // o formulário Arquivar em…
    formulario: alvo.length ? {
      alvo,
      lote: alvo.length,
      nomes: alvo.map(id => porId.get(id)?.nome || '').filter(Boolean),
      carregando: !cadastro?.carregado,
      semCadastro: !!cadastro?.carregado && !cadastro.clientes.length,
      busca, setBusca: (t: string) => { setBusca(t); setCliente(null); },
      sugeridos,
      cliente,
      escolher: (c: entregas.ClienteDoFormulario) => { setCliente(c); setBusca(c.codigo + ' · ' + c.nome); },
      tipos: cadastro?.tipos ?? [],
      tipoDoc, setTipoDoc,
      precisa: tipo?.precisa ?? null,
      mes, setMes, ano, setAno, anos,
      pronto: formularioPronto,
      previa: previa ? {
        carregando: !FINAIS.includes(previa.status),
        erro: previa.status === 'erro' ? previa.erro || 'o robô não chegou a um destino' : '',
        destino: previa.resposta?.destino || '', nomeFinal: previa.resposta?.nomeFinal || '', pastaNova: previa.resposta?.pastaNova || '',
        jaArquivado: previa.resposta?.acao === 'JA_ARQUIVADO', copias: previa.resposta?.copias ?? [],
      } : formularioPronto ? { carregando: true, erro: '', destino: '', nomeFinal: '', pastaNova: '', jaArquivado: false, copias: [] } : null,
      enviando,
      podeConfirmar: formularioPronto && !enviando && !!previa && previa.status === 'pronto',
      async confirmar() {
        if (!formularioPronto || enviando) return;
        setEnviando(true);
        try { await pedirVarios('arquivar', alvo, { codigo: cliente!.codigo, tipoDoc, ...(competencia ? { competencia } : {}) }); fecharFormulario(); }
        finally { setEnviando(false); }
      },
      fechar: fecharFormulario,
    } : null,
    abrirFormulario,
  };
}
