// A entrega de documentos aos clientes no nads (16/10/2026: "quero integrar no app … o entregas"; e, depois de ver a
// primeira versão, "só copia o entregas e joga aqui no design n1"): tudo o que as abas Nova entrega, Rota e Painel e a
// página do cliente do entregas.html leem e gravam, nos MESMOS documentos do banco do Entregas (a página antiga continua
// funcionando junto; nenhuma coleção nova). As regras puras ficam no core (entregas/*). Aqui: a interface e a versão de
// exemplo (nada sai deste navegador); a do banco é entregasDeDocumentos.firestore.ts.
import { entregas, type entregas as tipos } from '@nads/core';
import type { ListaAoVivo } from './agentes';

export interface ComprovanteDaEntrega { assinatura: string; foto: string }
/** A guia que veio da pasta do cliente e foi anexada à entrega (entregas/{id}/anexos/guia-<tipo>). */
export interface GuiaAnexada { tipo: string; nome: string; pdf: string | null }
/** A guia para anexar ao gravar (o PDF em Base64, se coube no documento do banco). */
export interface GuiaParaAnexar { tipo: string; nome: string; driveId: string; tamanho: number; pdf: string | null }
/** Quem está: o e-mail da conta (as regras conferem entregadoPor com o login), o nome, o uid e os papéis. */
export interface QuemNoEntregas { email: string; nome: string; uid: string; papeis: string[] }
/** "Algo pra falar com o cliente" (lembretesCliente): só os ativos. */
export interface LembreteDoCliente { id: string; clienteId: string; clienteNome: string; texto: string; criadoPor: string; criadoPorNome: string; criadoEm: string }
/** Os atestados para buscar na clínica (solicitacoes tipo 'atestado' ainda não concluídas): o cartão da Rota. */
export interface AtestadoParaBuscar { id: string; funcionario: string; empresa: string; clinica: string; urgente: boolean; criadoPor: string; criadoPorNome: string; criadoEm: string }
/** Uma gravação que o servidor recusou depois do "salvo" (fica no aparelho até alguém ler). */
export interface EscritaPerdida { oQue: string; motivo: string; quando: string }
/** O resultado de uma gravação que não trava: 'aparelho' = sem sinal, sobe sozinho quando voltar. */
export type ResultadoDaGravacao = 'servidor' | 'aparelho';
/** O documento do mês da Pendências (documentosMensal), só o que o protocolo de extratos usa. */
export interface DocumentoMensal { clienteId: string; competencia: string; extrato: boolean; semMovimento: boolean }
/** O arquivo do Drive trazido pelo robô (modo "ler"). */
export interface ArquivoDoDrive { bytes: Uint8Array; base64: string; tamanho: number }

export interface RepoEntregasDeDocumentos {
  readonly exemplos: boolean;
  quem(): QuemNoEntregas | null;

  // ---- ao vivo ----
  /** os clientes do Entregas (a carga curta, só os de entrega; a base inteira depois de garantirTodosOsClientes) */
  clientes(): ListaAoVivo<tipos.ClienteDaRota>;
  /** a base inteira já veio */
  clientesCompletos(): boolean;
  garantirTodosOsClientes(): Promise<void>;
  /** a ordem fixa da rota do escritório (config/rotaPadrao) */
  rotaPadrao(): tipos.RotaPadrao;
  /** as paradas na rota (status 'pendente') */
  naRota(): ListaAoVivo<tipos.Entrega>;
  /** o que foi confirmado hoje (de qualquer competência) */
  hoje(): ListaAoVivo<tipos.Entrega>;
  /** as entregas da competência (uma por vez) */
  doMes(competencia: string): ListaAoVivo<tipos.Entrega>;
  lembretes(): ListaAoVivo<LembreteDoCliente>;
  atestados(): ListaAoVivo<AtestadoParaBuscar>;
  /** config/metas.porPessoa (0 = sem meta) */
  metaPorPessoa(): number;
  /** config/competencias.fechadas */
  competenciasFechadas(): string[];
  /** config/obrigacoes (ou as padrão) */
  obrigacoes(): tipos.Obrigacao[];
  /** config/escritorio (o PIX e o recado do honorário) */
  escritorio(): tipos.DadosDoEscritorio;
  /** as gravações recusadas depois do "salvo" */
  perdidas(): EscritaPerdida[];
  limparPerdidas(): void;
  /** quantas gravações ainda esperam o servidor */
  pendentesDeSubir(): number;

  // ---- leituras pontuais ----
  /** todas as entregas do cliente (até 200) */
  doCliente(clienteId: string): Promise<tipos.Entrega[]>;
  /** as últimas 40 do cliente (quem costuma receber, a dica de horário; uma vez por cliente) */
  recentesDoCliente(clienteId: string): Promise<tipos.Entrega[]>;
  /** as do cliente numa competência (repetir o mês passado) */
  doClienteNoMes(clienteId: string, competencia: string): Promise<tipos.Entrega[]>;
  comprovante(entregaId: string): Promise<ComprovanteDaEntrega>;
  guiasAnexadas(entregaId: string): Promise<GuiaAnexada[]>;
  /** as feitas (confirmadas ou não) no período (protocolos), até 800 */
  doPeriodo(inicio: string, fim: string): Promise<tipos.Entrega[]>;
  /** os clientes com entrega confirmada nas últimas 3 competências (guardado 12 h no aparelho) */
  comEntregaRecente(): Promise<string[]>;
  /** a assinatura que o cliente já fez no celular dele para esta parada */
  assinaturaFeita(entregaId: string): Promise<{ assinatura: string; recebedor: string } | null>;
  /** quando o cliente abriu o link pela última vez */
  vistoNoLink(token: string): Promise<{ ultima: string; vezes: number } | null>;
  /** documentosMensal/{cliente}_{comp} (o Extrato do mês) */
  documentosDoMes(clienteId: string, competencia: string): Promise<Record<string, unknown>>;
  /** os documentosMensal das competências (até 30), de todos os clientes: o extrato e o sem movimento (o protocolo de extratos) */
  documentosDasCompetencias(competencias: readonly string[]): Promise<DocumentoMensal[]>;

  // ---- gravações ----
  /** põe na rota (ou no link); devolve o id e se ficou só no aparelho */
  registrar(n: tipos.EntregaNova, guias: readonly GuiaParaAnexar[]): Promise<{ id: string; resultado: ResultadoDaGravacao }>;
  confirmar(e: tipos.Entrega, c: tipos.Confirmacao, avaliacao: tipos.AvaliacaoDoLocal): Promise<ResultadoDaGravacao>;
  confirmarJuntas(lista: readonly tipos.Entrega[], c: tipos.ConfirmacaoEmLote, avaliacao: tipos.AvaliacaoDoLocal): Promise<ResultadoDaGravacao>;
  /** a confirmação recusada: outra pessoa confirmou ou tirou a parada um instante antes? (o texto, ou '' se não) */
  explicarRecusa(entregaId: string): Promise<string>;
  novaTentativa(lista: readonly tipos.Entrega[], motivo: string): Promise<ResultadoDaGravacao>;
  /** a nova ordem da rota inteira (o ordemRota de cada id); `soAsMinhas` = a regra antiga só deixou as da pessoa */
  reordenar(ids: readonly string[]): Promise<{ soAsMinhas: boolean }>;
  editar(e: tipos.Entrega, competencia: string, zona: string, itens: readonly tipos.ItemDaEntrega[]): Promise<ResultadoDaGravacao>;
  /** tira da rota / exclui (com o comprovante e as guias anexadas, num lote) */
  excluir(e: tipos.Entrega): Promise<void>;
  /** a ordem fixa (e a região de cada cliente); devolve quantos clientes mudaram de região */
  salvarOrdemFixa(rp: tipos.RotaPadrao): Promise<number>;
  salvarMeta(porPessoa: number): Promise<void>;
  corrigirLocal(c: tipos.ClienteDaRota, dados: { geo?: tipos.Geo; zona?: string }): Promise<void>;
  aglutinar(c: tipos.ClienteDaRota, com: tipos.ClienteDaRota): Promise<void>;
  desaglutinar(c: tipos.ClienteDaRota): Promise<void>;
  ativarCliente(c: tipos.ClienteDaRota, ativo: boolean): Promise<void>;
  /** "Já vi" as mudanças na Receita (só o admin: receita.mudancas fica vazio) */
  receitaVista(c: tipos.ClienteDaRota): Promise<void>;
  /** LGPD: tudo o que o sistema tem do cliente, num objeto (a tela baixa o JSON) */
  dadosDoCliente(c: tipos.ClienteDaRota, historico: readonly tipos.Entrega[]): Promise<Record<string, unknown>>;
  /** LGPD: tira os dados pessoais e derruba o link */
  apagarDadosPessoais(c: tipos.ClienteDaRota): Promise<void>;
  /** "+ Adicionar novo cliente" (só o admin cria cliente, pelas regras); devolve o id */
  adicionarCliente(nome: string): Promise<string>;
  criarLembrete(clienteId: string, clienteNome: string, texto: string): Promise<void>;
  resolverLembrete(id: string): Promise<void>;
  concluirAtestado(id: string): Promise<void>;
  /** as solicitações pendentes (o office boy: a fila da equipe; os outros: as que pediram), ao vivo */
  solicitacoesPendentes(): ListaAoVivo<tipos.Solicitacao>;
  /** as últimas concluídas (uma leitura) */
  solicitacoesConcluidas(): Promise<tipos.Solicitacao[]>;
  enviarSolicitacao(n: tipos.SolicitacaoNova): Promise<ResultadoDaGravacao>;
  concluirSolicitacao(id: string): Promise<void>;
  registrarAuditoria(acao: string, detalhe: string): void;

  // ---- o link do cliente, a assinatura no celular dele e o protocolo ----
  /** cria (ou troca) o link do cliente; devolve o token novo */
  criarLinkDoCliente(c: tipos.ClienteDaRota): Promise<string>;
  /** uma entrega do cliente mudou: o link dele é regravado (fila no aparelho) */
  linkMudou(clienteId: string | null): void;
  guardarComprovanteNoLink(e: Pick<tipos.Entrega, 'id' | 'clienteId'>, assinatura: string, recebedor: string, quando: string): void;
  /** gera o link de assinatura (uso único, 2 h) e fica ouvindo; devolve o link e o "parar" */
  pedirAssinaturaNoCelular(e: tipos.Entrega, aoAssinar: (a: { assinatura: string; recebedor: string }) => void, aoErrar: (m: string) => void): { link: string; parar: () => void; pronto: Promise<void> };
  /** grava o retrato do protocolo de papel (protocolos/{codigo}); devolve o código */
  registrarProtocolo(retrato: Record<string, unknown>): string;

  // ---- a guia da pasta do cliente (o robô do Drive) ----
  guiasDaPasta(c: tipos.ClienteDaRota, mes: { mm: string; aaaa: string }): Promise<{ guia: tipos.GuiaDaPasta; arquivo: tipos.ItemDoDrive }[]>;
  lerDoDrive(arquivo: tipos.ItemDoDrive): Promise<ArquivoDoDrive>;

  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

// =====================================================================================================================
// os exemplos (nada sai deste navegador)
// =====================================================================================================================

/** Uma assinatura de exemplo (um rabisco). */
const ASSINATURA_EXEMPLO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="120" viewBox="0 0 360 120"><rect width="360" height="120" fill="#fff"/>'
  + '<path d="M30 80 C60 20 80 110 110 60 S150 30 170 75 S220 100 240 50 S300 40 330 70" fill="none" stroke="#16211E" stroke-width="2.2" stroke-linecap="round"/></svg>');

export function criarEntregasDeDocumentosMemoria(): RepoEntregasDeDocumentos {
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const quem: QuemNoEntregas = { email: 'exemplo@nilma.local', nome: 'Pessoa de exemplo', uid: 'exemplo', papeis: ['admin', 'contabil'] };
  const hoje = new Date();
  const comp = (k: number) => entregas.competenciaAtual(new Date(hoje.getFullYear(), hoje.getMonth() - k, 1));
  const iso = (horas: number) => new Date(hoje.getTime() - horas * 3600e3).toISOString();
  const geo = (lat: number, lng: number, precisao = 'rua') => ({ lat: -15.8 + lat, lng: -42.23 + lng, precisao });
  const receita = { situacao: 'ATIVA', situacaoDesde: '2015-03-02', razaoSocial: '', simples: true, mei: false, cnae: '4711-3/02', cnaeDescricao: 'Comércio varejista de mercadorias em geral', naturezaJuridica: 'Sociedade Empresária Limitada', porte: 'ME', abertura: '2015-03-02', endereco: 'Rua das Flores, 120, Centro', socios: ['Sócio Exemplo'], conferidoEm: iso(48), mudancas: [] as unknown[] };
  let clientes: tipos.ClienteDaRota[] = ([
    ['c1', 'ALFA COMERCIO EXEMPLO LTDA', '101', '11222333000181', 'central', '', geo(0, 0), { portalToken: 'exemplo-alfa', honorarioForma: 'Dinheiro', honorarioDia: '10', receita, telefone: '38999990001', endereco: 'Rua das Flores, 120', cidade: 'Taiobeiras', contatos: [{ nome: 'Joana (exemplo)', papel: 'financeiro', telefone: '38999990011' }] }],
    ['c2', 'BETA SERVICOS EXEMPLO ME', '102', '22333444000190', 'superior', 'c3', geo(0.006, 0.002), { janela: { de: '08:00', ate: '11:30' } }],
    ['c3', 'GAMA EXEMPLO TRANSPORTES', '103', '33444555000102', 'superior', '', geo(0.006, 0.002), { papeis: [{ tipo: 'cnd-federal', vence: entregas.hojeIso(new Date(hoje.getTime() + 9 * 864e5)) }] }],
    ['c4', 'DELTA EXEMPLO PADARIA', '104', '44555666000113', 'inferior', '', geo(-0.008, -0.004), { diasEntrega: ['1', '3'], observacao: 'Entregar na porta dos fundos.' }],
    ['c5', 'EPSILON EXEMPLO FARMACIA', '105', '55666777000124', 'central', '', geo(0.001, 0.003, 'cidade'), {}],
    ['c6', 'ZETA EXEMPLO CONSTRUCOES', '106', '66777888000135', '', '', null, { entrega: false }],
    ['c7', 'ETA EXEMPLO MERCEARIA', '107', '77888999000146', '', '', null, {}],
  ] as [string, string, string, string, string, string, unknown, Record<string, unknown>][]).map(([id, nome, cod, doc, zona, grupo, g, extra]) =>
    entregas.clienteDaRotaDoDocumento(id, { nome, codigoOrigem: cod, documento: doc, telefone: '38999990000', ativo: true, entrega: true, zona, grupoLocal: grupo, geo: g, criadoEm: '2024-02-01', ...extra }));
  const rotulo = (id: string) => entregas.rotuloDoCliente(clientes.find(c => c.id === id) as tipos.ClienteDaRota);
  const nova = (id: string, cli: string, d: Record<string, unknown>) => entregas.entregaDoDocumento(id, {
    clienteId: cli, clienteNome: rotulo(cli), competencia: comp(0), entregadoPor: quem.email, entregadoPorNome: 'Maria (exemplo)', ...d,
  });
  const conf = (h: number) => ({ status: 'confirmada', temAssinatura: true, confirmadoEm: iso(h), criadoEm: iso(h + 20) });
  let lista: tipos.Entrega[] = [
    nova('e1', 'c1', { ...conf(30), itens: [{ tipo: 'DAS', valor: 480.9 }, { tipo: 'FGTS', valor: 210 }], recebedor: 'João (exemplo)', geo: { lat: -15.8, lng: -42.23 } }),
    nova('e2', 'c2', { status: 'pendente', itens: [{ tipo: 'DARF', valor: 132.5 }], zona: 'superior', criadoEm: iso(5), vencimento: entregas.hojeIso(new Date(hoje.getTime() + 2 * 864e5)) }),
    nova('e3', 'c3', { status: 'pendente', itens: [{ tipo: 'Honorário', valor: null }], zona: 'superior', criadoEm: iso(4) }),
    nova('e3b', 'c3', { status: 'pendente', itens: [{ tipo: 'DAS', valor: 77.4 }], zona: 'superior', criadoEm: iso(4), competencia: comp(1) }),
    nova('e4', 'c4', { status: 'falha', itens: [{ tipo: 'DAS', valor: 95.3 }], motivoFalha: 'Estabelecimento fechado', temFoto: true, temAssinatura: false, confirmadoEm: iso(26), criadoEm: iso(28), geo: { lat: -15.808, lng: -42.234 } }),
    nova('e5', 'c4', { status: 'pendente', itens: [{ tipo: 'DAS', valor: 95.3 }], zona: 'inferior', tentativa: 2, motivoTentativaAnterior: 'Estabelecimento fechado', criadoEm: iso(3) }),
    nova('e6', 'c1', { ...conf(790), competencia: comp(1), itens: [{ tipo: 'DAS', valor: 455.1 }], recebedor: 'João (exemplo)' }),
    nova('e7', 'c5', { ...conf(6), itens: [{ tipo: 'Notas', valor: null }], recebedor: 'Paula (exemplo)', entregadoPorNome: 'Carlos (exemplo)' }),
    nova('e8', 'c5', { status: 'pendente', itens: [{ tipo: 'FGTS', valor: 64.2 }], zona: 'central', criadoEm: iso(2), codigoPagamento: { tipo: 'boleto', codigo: '85800000000 1 64200328261 1 00000000000 9 10102026090 0' } }),
    entregas.entregaDoDocumento('e9', { clienteId: null, avulso: true, banco: 'Caixa', clienteNome: 'Banco: Caixa', competencia: comp(0), status: 'pendente', itens: [{ tipo: 'Boleto', valor: 1200 }], criadoEm: iso(1), entregadoPor: quem.email, entregadoPorNome: 'Pessoa de exemplo' }),
  ];
  const comprovantes = new Map<string, ComprovanteDaEntrega>([['e1', { assinatura: ASSINATURA_EXEMPLO, foto: '' }], ['e6', { assinatura: ASSINATURA_EXEMPLO, foto: '' }], ['e7', { assinatura: ASSINATURA_EXEMPLO, foto: '' }]]);
  let lembretes: LembreteDoCliente[] = [{ id: 'l1', clienteId: 'c2', clienteNome: rotulo('c2'), texto: 'Falar do honorário de setembro (exemplo).', criadoPor: quem.email, criadoPorNome: 'Maria (exemplo)', criadoEm: iso(50) }];
  let atestados: AtestadoParaBuscar[] = [{ id: 'a1', funcionario: 'Funcionário exemplo', empresa: rotulo('c1'), clinica: 'Assegi', urgente: true, criadoPor: quem.email, criadoPorNome: 'DP (exemplo)', criadoEm: iso(3) }];
  let solicitacoes: tipos.Solicitacao[] = [
    entregas.solicitacaoDoDocumento('s1', { tipo: 'buscar', local: 'Cartório (exemplo)', descricao: 'Buscar a procuração assinada', urgente: true, prazo: entregas.hojeIso(), status: 'pendente', criadoPor: quem.email, criadoPorNome: 'Maria (exemplo)', criadoEm: iso(20) }),
    entregas.solicitacaoDoDocumento('s2', { tipo: 'entregar', local: rotulo('c5'), descricao: 'Entregar o contrato social', prazo: entregas.prazoPadraoDaSolicitacao(), status: 'pendente', criadoPor: 'outra@nilma.local', criadoPorNome: 'Carlos (exemplo)', criadoEm: iso(6) }),
    entregas.solicitacaoDoDocumento('s3', { tipo: 'outro', descricao: 'Pagar a taxa na prefeitura', prazo: entregas.hojeIso(new Date(hoje.getTime() - 3 * 864e5)), status: 'pendente', criadoPor: quem.email, criadoPorNome: 'Pessoa de exemplo', criadoEm: iso(90) }),
    entregas.solicitacaoDoDocumento('s4', { tipo: 'entregar', descricao: 'Levar o alvará', status: 'concluida', criadoPor: quem.email, criadoPorNome: 'Pessoa de exemplo', criadoEm: iso(80), concluidoEm: iso(30), concluidoPor: quem.email, concluidoPorNome: 'Carlos (exemplo)' }),
  ];
  let fixa: tipos.RotaPadrao = { zonas: { c4: 'inferior', c1: 'central' }, ordem: { c4: 1, c1: 1 } };
  let meta = 0;
  let perdidas: EscritaPerdida[] = [];
  const viva = <T,>(l: T[]): ListaAoVivo<T> => ({ carregada: true, lista: l, erro: '' });
  const agora = () => new Date().toISOString();
  const trocar = (id: string, d: Record<string, unknown>) => { lista = lista.map(e => (e.id === id ? entregas.entregaDoDocumento(e.id, { ...e, ...d }) : e)); };
  const doCliente = async (id: string) => lista.filter(e => e.clienteId === id);
  const mudarCliente = (id: string, d: Record<string, unknown>) => { clientes = clientes.map(c => (c.id === id ? entregas.clienteDaRotaDoDocumento(c.id, { ...c, ...d }) : c)); mudou(); };
  return {
    exemplos: true,
    quem: () => quem,
    clientes: () => viva(clientes),
    clientesCompletos: () => true,
    garantirTodosOsClientes: async () => undefined,
    rotaPadrao: () => fixa,
    naRota: () => viva(lista.filter(e => e.status === 'pendente')),
    hoje: () => viva(lista.filter(e => e.confirmadoEm && new Date(e.confirmadoEm).toDateString() === hoje.toDateString())),
    doMes: c => viva(lista.filter(e => e.competencia === c)),
    lembretes: () => viva(lembretes),
    atestados: () => viva(atestados),
    metaPorPessoa: () => meta,
    competenciasFechadas: () => [comp(3)],
    obrigacoes: () => [...entregas.OBRIGACOES_PADRAO],
    escritorio: () => ({ pixChave: '11.222.333/0001-81', pixNome: 'NILMA EXEMPLO', pixCidade: 'TAIOBEIRAS', honorarioTexto: '', whatsapp: '' }),
    perdidas: () => perdidas,
    limparPerdidas() { perdidas = []; mudou(); },
    pendentesDeSubir: () => 0,
    doCliente,
    recentesDoCliente: doCliente,
    async doClienteNoMes(id, c) { return lista.filter(e => e.clienteId === id && e.competencia === c); },
    async comprovante(id) { return comprovantes.get(id) || { assinatura: '', foto: '' }; },
    async guiasAnexadas() { return []; },
    async doPeriodo(inicio, fim) { return lista.filter(e => e.confirmadoEm && e.confirmadoEm >= inicio && e.confirmadoEm < fim && (e.status === 'confirmada' || e.status === 'falha')); },
    async comEntregaRecente() { return entregas.idsComEntregaConfirmada(lista); },
    async assinaturaFeita() { return null; },
    async vistoNoLink() { return { ultima: iso(30), vezes: 3 }; },
    async documentosDoMes() { return { extrato: true }; },
    async documentosDasCompetencias(comps) {
      // o exemplo: os clientes c1 a c5 mandaram o extrato dos meses passados, menos o c4 em alguns; o c3 ficou sem movimento
      return comps.filter(c => c < comp(0)).flatMap((c, i) => ['c1', 'c2', 'c3', 'c4', 'c5']
        .filter(id => !(id === 'c4' && i % 3 === 1)).map(id => ({ clienteId: id, competencia: c, extrato: id !== 'c3', semMovimento: id === 'c3' })));
    },
    async registrar(n) {
      const id = 'ex-' + Date.now();
      lista = [...lista, entregas.entregaDoDocumento(id, entregas.dadosDaEntregaNova(n, quem, agora()))];
      if (n.foto) comprovantes.set(id, { assinatura: '', foto: n.foto });
      if (n.para.tipo === 'cliente' && n.zona && n.modo === 'rota') mudarCliente(n.para.cliente.id, { zona: n.zona, entrega: true });
      mudou();
      return { id, resultado: 'servidor' };
    },
    async confirmar(e, c, av) {
      trocar(e.id, entregas.dadosDaConfirmacao(c, av, quem, agora()));
      const comp = entregas.comprovanteDaConfirmacao(c);
      if (comp) comprovantes.set(e.id, { assinatura: '', foto: '', ...comprovantes.get(e.id), ...comp });
      mudou();
      return 'servidor';
    },
    async confirmarJuntas(l, c, av) {
      for (const e of l) {
        trocar(e.id, entregas.dadosDoLote(c, av, quem, agora()));
        const comp = entregas.comprovanteDaConfirmacao({ falha: c.falha, semAssinatura: false, assinatura: c.assinatura, foto: c.foto });
        if (comp) comprovantes.set(e.id, { assinatura: '', foto: '', ...comprovantes.get(e.id), ...comp });
      }
      mudou();
      return 'servidor';
    },
    async explicarRecusa() { return ''; },
    async novaTentativa(l, motivo) {
      lista = [...lista, ...l.map((e, k) => entregas.entregaDoDocumento('ex-' + Date.now() + '-' + k, entregas.dadosDaNovaTentativa(e, motivo, quem, agora())))];
      mudou();
      return 'servidor';
    },
    async reordenar(ids) { lista = lista.map(e => (ids.includes(e.id) ? { ...e, ordemRota: ids.indexOf(e.id) } : e)); mudou(); return { soAsMinhas: false }; },
    async editar(e, competencia, zona, itens) { trocar(e.id, entregas.dadosDaEdicao(competencia, zona, itens)); mudou(); return 'servidor'; },
    async excluir(e) { lista = lista.filter(x => x.id !== e.id); comprovantes.delete(e.id); mudou(); },
    async salvarOrdemFixa(rp) {
      fixa = rp;
      let n = 0;
      for (const [id, z] of Object.entries(rp.zonas)) { const c = clientes.find(x => x.id === id); if (c && c.zona !== z) { n++; mudarCliente(id, { zona: z }); } }
      mudou();
      return n;
    },
    async salvarMeta(n) { meta = n; mudou(); },
    async corrigirLocal(c, d) { mudarCliente(c.id, d); },
    async aglutinar(c, com) { const g = com.grupoLocal || com.id; mudarCliente(c.id, { grupoLocal: g, ...(com.geo ? { geo: com.geo } : {}) }); },
    async desaglutinar(c) { mudarCliente(c.id, { grupoLocal: '' }); },
    async ativarCliente(c, ativo) { mudarCliente(c.id, { ativo }); },
    async receitaVista(c) { mudarCliente(c.id, { receita: c.receita ? { ...c.receita, mudancas: [] } : null }); },
    async dadosDoCliente(c, h) { return { geradoEm: agora(), cliente: c, entregas: h }; },
    async apagarDadosPessoais(c) { mudarCliente(c.id, { telefone: '', email: '', emails: [], endereco: '', contatos: [], observacao: '', geo: null, ativo: false, portalToken: '' }); },
    async adicionarCliente(nome) { const id = 'cx' + Date.now(); clientes = [...clientes, entregas.clienteDaRotaDoDocumento(id, { nome, ativo: true })]; mudou(); return id; },
    async criarLembrete(clienteId, clienteNome, texto) { lembretes = [...lembretes, { id: 'l' + Date.now(), clienteId, clienteNome, texto, criadoPor: quem.email, criadoPorNome: quem.nome, criadoEm: agora() }]; mudou(); },
    async resolverLembrete(id) { lembretes = lembretes.filter(l => l.id !== id); mudou(); },
    async concluirAtestado(id) { atestados = atestados.filter(a => a.id !== id); mudou(); },
    // como no banco: o office boy vê a fila da equipe; o resto, só o que pediu
    solicitacoesPendentes: () => viva(solicitacoes.filter(s => s.status === 'pendente' && (entregas.veTodasAsSolicitacoes(quem.papeis) || s.criadoPor === quem.email))),
    async solicitacoesConcluidas() { return entregas.ultimasConcluidas(solicitacoes.filter(s => entregas.veTodasAsSolicitacoes(quem.papeis) || s.criadoPor === quem.email)); },
    async enviarSolicitacao(n) { solicitacoes = [...solicitacoes, entregas.solicitacaoDoDocumento('s' + Date.now(), entregas.dadosDaSolicitacao(n, quem, agora()))]; mudou(); return 'servidor'; },
    async concluirSolicitacao(id) { solicitacoes = solicitacoes.map(s => (s.id === id ? { ...s, status: 'concluida', concluidoEm: agora(), concluidoPor: quem.email, concluidoPorNome: quem.nome } : s)); mudou(); },
    registrarAuditoria: () => undefined,
    async criarLinkDoCliente(c) { const t = 'exemplo-' + Date.now(); mudarCliente(c.id, { portalToken: t }); return t; },
    linkMudou: () => undefined,
    guardarComprovanteNoLink: () => undefined,
    pedirAssinaturaNoCelular() { return { link: entregas.linkDaAssinatura('exemplo'), parar: () => undefined, pronto: Promise.resolve() }; },
    registrarProtocolo: () => 'EXEMPLO2345K',
    async guiasDaPasta() { return []; },
    async lerDoDrive() { throw new Error('nos exemplos não há Drive'); },
    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
