// ViewModel de Entregas › Rota (16/10/2026, a cópia fiel da aba Rota do entregas.html: "só copia o entregas e joga aqui no
// design n1"). As categorias de lá: Paradas (a rota de entregas — a busca, a pessoa, as regiões, a previsão no ritmo
// medido, arrastar ou Alt+↑/↓ para mudar a ordem, o sino do lembrete, o aviso que faz desviar, "Assinar" e "Assinar as N";
// Ler guia e Protocolo; e os cartões Vencendo, Atestados para buscar e Obrigações do mês), Ordem fixa (o admin), Protocolos
// (as feitas no período, para imprimir; o fechamento do dia) e Qualidade (o admin: sem região, endereço impreciso).
import { entregas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDaPagina } from '../../casca/navegacao';
import { useOperador } from '../../casca/operador';
import { useEntregasDeDocumentos } from '../../dados/repo';
import { useJanelasDasEntregas } from './contextoDasJanelas';
import { abrirAbaDoPapel, escreverNaAba, fechamentoDoDia, protocoloDeEntregas } from './papeisParaImprimir';
import { textoDoErro } from './useJanelaDaParada';
import { sabeLerGuia } from './useJanelasPequenas';

type Entrega = ReturnType<typeof entregas.entregaDoDocumento>;
export type CategoriaDaRota = 'paradas' | 'ordem' | 'protocolos' | 'qualidade';

export function useRotaDeEntregas() {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const janelas = useJanelasDasEntregas();
  const navegar = useNavigate();
  const { operador } = useOperador();
  const quem = repo.quem();
  const admin = !!operador?.admin || !!quem?.papeis.includes('admin');
  const clientes = repo.clientes();
  const naRota = repo.naRota();
  const hoje = repo.hoje();
  const fixa = repo.rotaPadrao();
  const lembretes = repo.lembretes().lista;
  const atestados = repo.atestados();
  const avisar = (titulo: string, tom: 'ok' | 'erro' | 'info' = 'ok') => retorno.aviso({ tom, titulo });
  const porId = useMemo(() => new Map(clientes.lista.map(c => [c.id, c])), [clientes.lista]);
  const [categoria, setCategoria] = useState<CategoriaDaRota>('paradas');

  // ---- Paradas ----
  const [busca, setBusca] = useState('');
  const [pessoa, setPessoa] = useState('');
  const [zonas, setZonas] = useState<string[]>([]);
  const [ordemNaTela, setOrdemNaTela] = useState<string[] | null>(null);
  const [todosVencimentos, setTodosVencimentos] = useState(false);
  const ordenadas = useMemo(() => entregas.ordenarPendentes(naRota.lista, fixa, porId), [naRota.lista, fixa, porId]);
  const pessoas = useMemo(() => entregas.pessoasDasEntregas(naRota.lista), [naRota.lista]);
  const pessoaValida = pessoas.includes(pessoa) ? pessoa : '';
  const q = busca.trim();
  const filtradas = ordenadas.filter(e => (!q || entregas.clienteCombina({ nome: e.clienteNome, codigoOrigem: '', documento: (e.clienteId && porId.get(e.clienteId)?.documento) || '' }, q))
    && (!pessoaValida || entregas.quemEntregou(e) === pessoaValida)
    && (!zonas.length || zonas.includes(e.zona)));
  // enquanto arrasta, a tela segue a ordem do dedo; ao soltar, grava e volta a seguir o banco
  const visiveis = ordemNaTela ? ordemNaTela.map(id => filtradas.find(e => e.id === id)).filter((e): e is Entrega => !!e) : filtradas;
  const porParada = entregas.paradasDaRota(visiveis, porId);
  const paradas = porParada.size;
  const jaComecou = hoje.lista.some(e => e.status === 'confirmada' && e.confirmadoEm && new Date(e.confirmadoEm).toDateString() === new Date().toDateString());
  const previsao = entregas.previsaoDaRota(entregas.minutosPorParada(hoje.lista), paradas, jaComecou);
  const vistas = new Set<string>();
  const linhas = visiveis.map((e, i) => {
    const c = e.clienteId ? porId.get(e.clienteId) : null;
    const total = entregas.totalDosItens(e.itens);
    const chave = entregas.chaveDaParada(e, porId);
    const doParada = porParada.get(chave) || [e];
    const primeira = !vistas.has(chave);
    vistas.add(chave);
    const nomes = [...new Set(doParada.map(x => x.clienteNome || '?'))];
    const doCliente = lembretes.filter(l => l.clienteId && l.clienteId === e.clienteId);
    return {
      e, posicao: i + 1,
      sub: entregas.rotuloDaCompetencia(e.competencia) + ' · ' + entregas.textoDosItens(e.itens) + (total > 0 ? ' · ' + entregas.dinheiro(total) : '') + (e.zona ? ' · ' + entregas.rotuloDaZona(e.zona) : ''),
      aviso: entregas.avisoDaParada(e, c),
      lembretes: doCliente.length, lembretesTexto: doCliente.map(l => l.texto).join(' · '),
      juntas: primeira && doParada.length > 1 ? {
        n: doParada.length, titulo: nomes.join(' + '), lista: doParada,
        dica: 'Assinar as ' + doParada.length + ' entregas desta parada juntas' + (entregas.totalDaParada(doParada) > 0 ? ' · ' + entregas.dinheiro(entregas.totalDaParada(doParada)) : '') + (nomes.length > 1 ? ' (' + nomes.join(' + ') + ')' : ''),
      } : null,
    };
  });
  async function salvarOrdem(ids: string[]) {
    const finais = entregas.ordemComAsVisiveis(entregas.ordemCompletaDaRota(naRota.lista), ids);
    try {
      const r = await repo.reordenar(finais);
      if (r.soAsMinhas) avisar('Só as suas paradas mudaram de ordem; as de outras pessoas ficaram como estavam.', 'erro');
    } catch (err) {
      avisar(textoDoErro(err, 'Não foi possível salvar a nova ordem.'), 'erro');
    } finally {
      setOrdemNaTela(null);
    }
  }
  const vencimentos = entregas.vencimentosDaRota(naRota.lista);
  const obrigacoes = entregas.obrigacoesDoMes(repo.obrigacoes(), naRota.lista);

  // ---- Ordem fixa ----
  const [estadoFixa, setEstadoFixa] = useState<entregas.EstadoDaOrdemFixa | null>(null);
  const fixaNaTela = estadoFixa || entregas.estadoDaOrdemFixa(fixa, id => porId.has(id));
  const [salvandoFixa, setSalvandoFixa] = useState(false);
  const [buscaFixa, setBuscaFixa] = useState<Record<string, string>>({});
  const colocados = new Set([...fixaNaTela.superior, ...fixaNaTela.central, ...fixaNaTela.inferior]);

  // ---- Protocolos ----
  const [de, setDe] = useState(entregas.hojeIso());
  const [ate, setAte] = useState(entregas.hojeIso());
  const [deTexto, setDeTexto] = useState(entregas.dataBr(entregas.hojeIso()));
  const [ateTexto, setAteTexto] = useState(entregas.dataBr(entregas.hojeIso()));
  const [buscaProt, setBuscaProt] = useState('');
  const [pessoaProt, setPessoaProt] = useState('');
  const [protocolos, setProtocolos] = useState<{ chave: string; lista: Entrega[]; erro: string } | null>(null);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const janela = entregas.janelaDoPeriodo(de || entregas.hojeIso(), ate || entregas.hojeIso());
  const chaveDoPeriodo = janela.de + '|' + janela.ate;
  useEffect(() => {
    if (categoria !== 'protocolos' || protocolos?.chave === chaveDoPeriodo) return;
    let vivo = true;
    repo.doPeriodo(janela.inicio, janela.fim).then(l => { if (vivo) { setProtocolos({ chave: chaveDoPeriodo, lista: l, erro: '' }); setMarcadas([]); } },
      err => { if (vivo) setProtocolos({ chave: chaveDoPeriodo, lista: [], erro: textoDoErro(err, 'Não foi possível buscar as entregas.') }); });
    return () => { vivo = false; };
  }, [categoria, chaveDoPeriodo, janela.inicio, janela.fim, protocolos?.chave, repo]);
  const listaProt = protocolos?.chave === chaveDoPeriodo ? protocolos.lista : null;
  const pessoasProt = entregas.pessoasDasEntregas(listaProt || []);
  const pessoaProtValida = pessoasProt.includes(pessoaProt) ? pessoaProt : '';
  const visiveisProt = entregas.protocolosVisiveis(listaProt || [], buscaProt, pessoaProtValida, porId);
  const marcadasVisiveis = visiveisProt.filter(e => marcadas.includes(e.id));
  const diasProt: { dia: string; rotulo: string; lista: Entrega[] }[] = [];
  for (const e of visiveisProt) {
    const dia = entregas.diaLocal(String(e.confirmadoEm));
    let g = diasProt.find(x => x.dia === dia);
    if (!g) { g = { dia, rotulo: new Date(String(e.confirmadoEm)).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' }), lista: [] }; diasProt.push(g); }
    g.lista.push(e);
  }
  async function imprimir(titulo: string, lista: Entrega[]) {
    if (!lista.length) { avisar('Não há entregas para imprimir.', 'erro'); return; }
    const aba = abrirAbaDoPapel();
    if (!aba) { avisar('O navegador bloqueou a nova aba. Permita pop-ups para este site.', 'erro'); return; }
    try {
      const ordenadasP = [...lista].sort((a, b) => entregas.quandoFoi(a).localeCompare(entregas.quandoFoi(b)));
      const assinaturas = await Promise.all(ordenadasP.map(e => (e.temAssinatura ? repo.comprovante(e.id).then(c => c.assinatura || null, () => null) : Promise.resolve(null))));
      escreverNaAba(aba, protocoloDeEntregas(titulo, ordenadasP, assinaturas, quem?.nome || ''));
      repo.registrarAuditoria('protocolo_emitido', titulo + ' · ' + ordenadasP.length + ' entrega(s)');
    } catch (err) {
      aba.close();
      avisar(textoDoErro(err, 'Não foi possível montar o protocolo.'), 'erro');
    }
  }

  // ---- Qualidade ----
  const qualidade = useMemo(() => entregas.qualidadeDaRota(clientes.lista, naRota.lista), [clientes.lista, naRota.lista]);
  const [todosSemZona, setTodosSemZona] = useState(false);
  const [todosImprecisos, setTodosImprecisos] = useState(false);

  // as categorias: some a que não tem nada a mostrar; com uma só, o menu some
  const categorias = ([
    { id: 'paradas', rotulo: 'Paradas', icone: 'caminhao' },
    ...(admin ? [{ id: 'ordem', rotulo: 'Ordem fixa', icone: 'list' }] : []),
    { id: 'protocolos', rotulo: 'Protocolos', icone: 'printer' },
    ...(admin && (qualidade.semZona.length || qualidade.enderecoImpreciso.length) ? [{ id: 'qualidade', rotulo: 'Qualidade', icone: 'mapaPin' }] : []),
  ] as { id: CategoriaDaRota; rotulo: string; icone: 'caminhao' | 'list' | 'printer' | 'mapaPin' }[]);
  const categoriaValida = categorias.some(c => c.id === categoria) ? categoria : 'paradas';

  return {
    exemplos: repo.exemplos,
    carregando: !naRota.carregada || !clientes.carregada,
    erro: naRota.erro || clientes.erro,
    categorias, categoria: categoriaValida, setCategoria,
    // ---- Paradas ----
    quantas: naRota.lista.length,
    previsao,
    adicionarARota: () => navegar(caminhoDaPagina('entregas', 'nova')),
    lerGuia: sabeLerGuia() ? () => janelas.abrir({ tipo: 'lerGuia' }) : null,
    protocoloDaRota() {
      const hojeConf = entregas.confirmadasHoje([hoje.lista]).filter(e => e.status === 'confirmada');
      void imprimir('Rota de ' + new Date().toLocaleDateString('pt-BR'), [...naRota.lista, ...hojeConf]);
    },
    busca, setBusca,
    pessoas, pessoa: pessoaValida, setPessoa,
    zonasDaRota: entregas.ZONAS, zonas,
    rotuloDasZonas: !zonas.length ? 'Todas as regiões' : zonas.length === 1 ? entregas.rotuloDaZona(zonas[0]) : zonas.length + ' regiões selecionadas',
    alternarZona: (z: string) => setZonas(l => (l.includes(z) ? l.filter(x => x !== z) : [...l, z])),
    linhas,
    abrirParada: (e: Entrega) => janelas.abrir({ tipo: 'parada', entrega: e }),
    abrirJuntas: (titulo: string, lista: Entrega[]) => janelas.abrir({ tipo: 'juntas', titulo, entregas: lista }),
    /** arrastar: a ordem da tela muda enquanto o dedo anda */
    arrastarPara(id: string, para: number) { setOrdemNaTela(entregas.moverPara(visiveis.map(e => e.id), id, para)); },
    soltar() { if (ordemNaTela) void salvarOrdem(ordemNaTela); },
    /** Alt+↑/↓ no puxador */
    moverComTeclado(id: string, passo: -1 | 1) {
      const ids = entregas.moverNaRota(visiveis.map(e => e.id), id, passo);
      setOrdemNaTela(ids);
      void salvarOrdem(ids);
    },
    vencimentos: (todosVencimentos ? vencimentos : vencimentos.slice(0, entregas.LIMITE_VENCIMENTOS_VISIVEL)).map(x => ({
      e: x.e, vencido: x.dias < 0, prazo: entregas.textoPrazo(x.dias), sub: entregas.textoDosItens(x.e.itens) + ' · ' + entregas.rotuloDaCompetencia(x.e.competencia),
    })),
    maisVencimentos: vencimentos.length > entregas.LIMITE_VENCIMENTOS_VISIVEL ? (todosVencimentos ? 'Mostrar menos' : 'Mostrar mais ' + (vencimentos.length - entregas.LIMITE_VENCIMENTOS_VISIVEL)) : '',
    alternarVencimentos: () => setTodosVencimentos(v => !v),
    atestados: atestados.lista.map((s, i) => ({
      s, posicao: i + 1, titulo: (s.funcionario || 'funcionário') + ' — ' + (s.empresa || 'empresa não informada'),
      sub: 'Clínica: ' + (s.clinica || 'não informada') + ' · pedido por ' + (s.criadoPorNome || s.criadoPor || 'alguém da equipe') + ' · ' + entregas.dataHoraDaEntrega(s.criadoEm),
      podeConcluir: !!quem && (quem.papeis.includes('office_boy') || s.criadoPor === quem.email),
    })),
    async concluirAtestado(id: string) { try { await repo.concluirAtestado(id); } catch (err) { avisar(textoDoErro(err, 'Não foi possível concluir.'), 'erro'); } },
    obrigacoes: obrigacoes.map(o => ({ ...o, data: String(o.data.getDate()).padStart(2, '0') + '/' + String(o.data.getMonth() + 1).padStart(2, '0'), prazo: entregas.textoPrazo(o.dias) })),
    // ---- Ordem fixa ----
    zonasDaOrdemFixa: entregas.ZONAS_DA_ORDEM_FIXA,
    fixa: fixaNaTela,
    nomeDoCliente: (id: string) => { const c = porId.get(id); return c ? entregas.rotuloDoCliente(c) : id; },
    buscaFixa, setBuscaFixa: (z: string, v: string) => setBuscaFixa(b => ({ ...b, [z]: v })),
    sugestoesDaFixa(z: string) {
      const t = (buscaFixa[z] || '').trim();
      if (!t) return null;
      return clientes.lista.filter(c => c.ativo && !colocados.has(c.id) && entregas.clienteCombina(c, t)).slice(0, 8).map(c => ({ id: c.id, nome: entregas.rotuloDoCliente(c) }));
    },
    incluirNaFixa(z: keyof entregas.EstadoDaOrdemFixa, id: string) { setEstadoFixa({ ...fixaNaTela, [z]: [...fixaNaTela[z], id] }); setBuscaFixa(b => ({ ...b, [z]: '' })); },
    tirarDaFixa(z: keyof entregas.EstadoDaOrdemFixa, id: string) { setEstadoFixa({ ...fixaNaTela, [z]: fixaNaTela[z].filter(x => x !== id) }); },
    moverNaFixa(z: keyof entregas.EstadoDaOrdemFixa, id: string, para: number) { setEstadoFixa({ ...fixaNaTela, [z]: entregas.moverPara(fixaNaTela[z], id, para) }); },
    salvandoFixa,
    async salvarFixa() {
      setSalvandoFixa(true);
      try {
        const n = await repo.salvarOrdemFixa(entregas.rotaPadraoDoEstado(fixaNaTela));
        setEstadoFixa(null);
        avisar('Ordem salva' + (n ? ' e região ajustada em ' + n + ' cliente(s).' : '.'));
      } catch (err) { avisar(textoDoErro(err, 'Não foi possível salvar a ordem.'), 'erro'); }
      setSalvandoFixa(false);
    },
    // ---- Protocolos ----
    de: deTexto, setDe: (v: string) => { setDeTexto(v); const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); if (m) setDe(m[3] + '-' + m[2] + '-' + m[1]); },
    ate: ateTexto, setAte: (v: string) => { setAteTexto(v); const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); if (m) setAte(m[3] + '-' + m[2] + '-' + m[1]); },
    buscaProt, setBuscaProt, pessoasProt, pessoaProt: pessoaProtValida, setPessoaProt,
    carregandoProt: !listaProt && !protocolos?.erro,
    erroProt: protocolos?.chave === chaveDoPeriodo ? protocolos.erro : '',
    filtrandoProt: !!(buscaProt.trim() || pessoaProtValida),
    contagemProt: visiveisProt.length,
    diasProt: diasProt.map(d => ({ ...d, linhas: d.lista.map(e => ({
      e, marcada: marcadas.includes(e.id),
      sub: entregas.horaDaEntrega(e) + (e.status === 'falha' ? ' · não entregue' : '') + (e.itens.length ? ' · ' + entregas.textoDosItens(e.itens) : '') + (entregas.quemEntregou(e) ? ' · ' + entregas.quemEntregou(e) : ''),
    })) })),
    marcar: (id: string, v: boolean) => setMarcadas(m => (v ? [...m, id] : m.filter(x => x !== id))),
    todasMarcadas: visiveisProt.length > 0 && marcadasVisiveis.length === visiveisProt.length,
    marcarTodas: (v: boolean) => setMarcadas(m => (v ? [...new Set([...m, ...visiveisProt.map(e => e.id)])] : m.filter(id => !visiveisProt.some(e => e.id === id)))),
    rotuloImprimir: marcadasVisiveis.length ? 'Imprimir ' + marcadasVisiveis.length + (marcadasVisiveis.length === 1 ? ' selecionada' : ' selecionadas') : 'Imprimir selecionados',
    imprimirSelecionadas() {
      const d = entregas.dataBr(janela.de), a = entregas.dataBr(janela.ate);
      void imprimir('Entregas de ' + d + (a !== d ? ' a ' + a : ''), marcadasVisiveis);
    },
    imprimirUma: (e: Entrega) => void imprimir(e.clienteNome || 'Protocolo', [e]),
    fechamentoDoDia(dia: string) {
      const aba = abrirAbaDoPapel('Preparando o fechamento...');
      if (!aba) { avisar('O navegador bloqueou a nova aba. Permita pop-ups para este site.', 'erro'); return; }
      escreverNaAba(aba, fechamentoDoDia(dia, entregas.fechamentoDoDia(listaProt || [], dia), dia === entregas.hojeIso() ? naRota.lista.length : null, quem?.nome || ''));
      repo.registrarAuditoria('fechamento_do_dia', dia);
    },
    // ---- Qualidade ----
    semZona: (todosSemZona ? qualidade.semZona : qualidade.semZona.slice(0, entregas.LIMITE_QUALIDADE_VISIVEL)).map(c => ({ c, nome: entregas.rotuloDoCliente(c), sub: c.endereco || 'sem endereço cadastrado', naRota: qualidade.naRota.has(c.id) })),
    totalSemZona: qualidade.semZona.length,
    maisSemZona: qualidade.semZona.length > entregas.LIMITE_QUALIDADE_VISIVEL ? (todosSemZona ? 'Mostrar menos' : 'Mostrar mais ' + (qualidade.semZona.length - entregas.LIMITE_QUALIDADE_VISIVEL)) : '',
    alternarSemZona: () => setTodosSemZona(v => !v),
    imprecisos: (todosImprecisos ? qualidade.enderecoImpreciso : qualidade.enderecoImpreciso.slice(0, entregas.LIMITE_QUALIDADE_VISIVEL)).map(c => ({ c, nome: entregas.rotuloDoCliente(c), sub: c.endereco || 'sem endereço cadastrado', naRota: qualidade.naRota.has(c.id) })),
    totalImprecisos: qualidade.enderecoImpreciso.length,
    maisImprecisos: qualidade.enderecoImpreciso.length > entregas.LIMITE_QUALIDADE_VISIVEL ? (todosImprecisos ? 'Mostrar menos' : 'Mostrar mais ' + (qualidade.enderecoImpreciso.length - entregas.LIMITE_QUALIDADE_VISIVEL)) : '',
    alternarImprecisos: () => setTodosImprecisos(v => !v),
    corrigir: (id: string) => janelas.abrir({ tipo: 'corrigirLocal', clienteId: id, voltar: null }),
  };
}
