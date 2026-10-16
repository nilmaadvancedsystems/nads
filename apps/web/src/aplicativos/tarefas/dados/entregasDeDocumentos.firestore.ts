// A entrega de documentos no banco do Entregas (16/10/2026, a cópia fiel do entregas.html), nas MESMAS coleções e campos
// da página antiga, que continua funcionando junto (as regras são as de lá; nenhuma coleção nova):
//   entregas (+ anexos/comprovante e anexos/guia-<tipo>)   a rota, o mês do painel, o que foi feito hoje, o histórico do
//        cliente, os protocolos do período; registrar, confirmar (um lote: tudo ou nada), as paradas juntas, tentar de novo,
//        a ordem (só o ordemRota), editar a parada e tirar da rota (com o comprovante e as guias, num lote)
//   clientes        a carga curta (entrega == true; a base inteira quando precisa) e o que a equipe pode ajustar pelas
//                   regras: zona, geo, grupoLocal e a marca `entrega`; o admin: ativo, os dados pessoais e o portalToken
//   config/rotaPadrao, config/metas, config/competencias, config/obrigacoes, config/escritorio
//   lembretesCliente   os "pra falar com o cliente" (criar e resolver)
//   solicitacoes       os atestados para buscar (ler e concluir)
//   assinaturas        o link de assinar no celular do cliente (criar e ouvir)
//   rotaLinks          a fila pública (a do link do cliente: regravar a projeção, como qualquer aparelho com a Rota aberta)
//   portais (+ comprovantes, guias)   o link do cliente: regravar a projeção, criar/trocar (admin)
//   protocolos         o retrato do protocolo de papel (o código de conferência)
//   auditoria          quem fez o quê (só cresce)
//   documentosMensal   o Extrato do mês (só leitura)
//   driveIndice e aberturasDrive   as guias da pasta do cliente (o robô do Drive lê o PDF; admin e contábil)
// O e-mail de quem grava é o do login (as regras conferem entregadoPor == o e-mail do token).
import { entregas } from '@nads/core';
import {
  addDoc as addDocBruto, collection, deleteDoc as deleteDocBruto, deleteField, doc, getDoc, getDocFromServer, getDocs, getDocsFromServer, limit, onSnapshot, orderBy, query,
  setDoc as setDocBruto, Timestamp, updateDoc as updateDocBruto, where, writeBatch as writeBatchBruto, type DocumentData, type Unsubscribe,
} from 'firebase/firestore';
import { guardar, guardarLote, guardarPedido } from '../../../comum/modoDesenvolvedor';
import type { ListaAoVivo } from './agentes';
import { bancoDoEntregas, contaDoEntregas } from './entregas.firestore';
import type { ArquivoDoDrive, AtestadoParaBuscar, ComprovanteDaEntrega, EscritaPerdida, GuiaAnexada, LembreteDoCliente, QuemNoEntregas, RepoEntregasDeDocumentos, ResultadoDaGravacao } from './entregasDeDocumentos';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const updateDoc = guardar(updateDocBruto) as typeof updateDocBruto;
const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const addDoc = guardarPedido(addDocBruto) as typeof addDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;
const writeBatch = ((...a: Parameters<typeof writeBatchBruto>) => guardarLote(writeBatchBruto(...a))) as typeof writeBatchBruto;

type T = typeof entregas;
type Entrega = ReturnType<T['entregaDoDocumento']>;
type Cliente = ReturnType<T['clienteDaRotaDoDocumento']>;

/** As guias que o Entregas anexa à parada (anexos/guia-<tipo>): saem junto quando a parada sai da rota. */
const GUIAS_ANEXADAS = ['fgts', 'darf', 'das'];
const LIMITE_PAINEL = 1500;
const ESPERA_DRIVE_MS = 90000;
const MINUTOS_ASSINATURA = 120;
const DIAS_ROTA_PORTAL = 7;
const CHAVE_PERDIDAS = 'nilma_escritas_perdidas';
const CHAVE_PORTAL_FILA = 'nilma_portal_fila';
const CHAVE_SEM_ENTREGA = 'nilma_com_entrega_v1';

const erroDe = (err: Error) => (/permission|insufficient/i.test(err.message) ? 'Sem permissão no banco do Entregas.' : err.message);
const codigo = (e: unknown) => String((e as { code?: string })?.code || '');
const aleatorio = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const lerLocal = <V,>(chave: string, padrao: V): V => { try { return JSON.parse(localStorage.getItem(chave) || 'null') ?? padrao; } catch { return padrao; } };
const gravarLocal = (chave: string, v: unknown) => { try { localStorage.setItem(chave, JSON.stringify(v)); } catch { /* sem armazenamento */ } };

export function criarEntregasDeDocumentosFirestore(pessoa: () => { nome: string; papeis: string[] } | null): RepoEntregasDeDocumentos {
  const db = bancoDoEntregas();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };
  const vazia = <V,>(): ListaAoVivo<V> => ({ carregada: false, lista: [], erro: '' });

  const quem = (): QuemNoEntregas | null => {
    const c = contaDoEntregas();
    if (!c || !c.email) return null;
    const p = pessoa();
    return { email: c.email, uid: c.uid, nome: p?.nome || c.email, papeis: p?.papeis || [] };
  };
  const precisaDeQuem = () => {
    const q = quem();
    if (!q) throw new Error('Sem login no Entregas.');
    return q;
  };
  const temPapel = (p: string) => !!quem()?.papeis.includes(p);
  const agora = () => new Date().toISOString();

  // ------------------------------------------------------------------------------------------------------------------
  // a gravação que não trava (escritaQueNaoTrava_): sem sinal, segue em frente em 1,5 s e avisa que sobe depois; se o
  // servidor recusar depois do "salvo", fica registrado no aparelho até alguém ler
  // ------------------------------------------------------------------------------------------------------------------
  let pendentesDeSubir = 0;
  function naoTrava(p: Promise<unknown>, oQue: string): Promise<ResultadoDaGravacao> {
    pendentesDeSubir++;
    mudou();
    p.then(() => { pendentesDeSubir = Math.max(0, pendentesDeSubir - 1); mudou(); }, err => {
      pendentesDeSubir = Math.max(0, pendentesDeSubir - 1);
      const lista = lerLocal<EscritaPerdida[]>(CHAVE_PERDIDAS, []);
      lista.push({ oQue: oQue || 'uma gravação', motivo: codigo(err) || (err as Error)?.message || 'motivo não informado', quando: agora() });
      gravarLocal(CHAVE_PERDIDAS, lista.slice(-20));
      mudou();
    });
    return new Promise((ok, falha) => {
      let respondeu = false;
      const relogio = setTimeout(() => { if (!respondeu) { respondeu = true; ok('aparelho'); } }, 1500);
      p.then(() => { if (!respondeu) { respondeu = true; clearTimeout(relogio); ok('servidor'); } },
        e => { if (!respondeu) { respondeu = true; clearTimeout(relogio); falha(e); } });
    });
  }

  function auditoria(acao: string, detalhe: string) {
    const q = quem();
    if (!q) return;
    addDoc(collection(db, 'auditoria'), { acao, detalhe: detalhe || '', feitoPor: q.email, feitoPorNome: q.nome, quando: agora() }).catch(() => undefined);
  }

  // ------------------------------------------------------------------------------------------------------------------
  // os clientes: a carga curta (só os de entrega) e a base inteira quando precisa
  // ------------------------------------------------------------------------------------------------------------------
  let clientes: ListaAoVivo<Cliente> | null = null;
  let porId = new Map<string, Cliente>();
  let completos = false;
  let pararClientes: Unsubscribe | null = null;
  const esperandoTodos: (() => void)[] = [];
  let primeiraCarga = true;

  function chegaramClientes(docs: { id: string; data: () => DocumentData }[], todos: boolean) {
    const lista = docs.map(d => entregas.clienteDaRotaDoDocumento(d.id, d.data())).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    clientes = { carregada: true, lista, erro: '' };
    porId = new Map(lista.map(c => [c.id, c]));
    completos = todos;
    if (todos) esperandoTodos.splice(0).forEach(f => f());
    else conferirClientesQueFaltam();
    if (primeiraCarga) { primeiraCarga = false; setTimeout(processarFilaDoLink, 8000); }
    sincronizarLinks();
    mudou();
  }
  function ouvirClientes(todos: boolean) {
    pararClientes?.();
    if (todos) {
      pararClientes = onSnapshot(query(collection(db, 'clientes'), orderBy('nome'), limit(1000)), s => chegaramClientes(s.docs, true), err => {
        esperandoTodos.splice(0).forEach(f => f());
        clientes = { carregada: true, lista: clientes?.lista || [], erro: erroDe(err) };
        mudou();
      });
      return;
    }
    pararClientes = onSnapshot(query(collection(db, 'clientes'), where('entrega', '==', true), limit(1000)), s => {
      // ninguém marcado ainda: a base inteira, como sempre foi
      if (s.empty) { ouvirClientes(true); return; }
      chegaramClientes(s.docs, false);
    }, () => ouvirClientes(true));
  }
  function garantirTodos(): Promise<void> {
    if (completos) return Promise.resolve();
    return new Promise(ok => {
      const jaPedido = esperandoTodos.length > 0;
      esperandoTodos.push(ok);
      if (!jaPedido) ouvirClientes(true);
    });
  }
  /** parada da rota ou entrega do mês de um cliente que não veio na carga curta: busca a base inteira */
  function conferirClientesQueFaltam() {
    if (completos || !porId.size) return;
    const listas = [naRota?.lista || [], mes?.lista.lista || []];
    let falta = listas.some(l => l.some(e => e.clienteId && !porId.has(e.clienteId)));
    for (const c of porId.values()) if (c.grupoLocal && !porId.has(c.grupoLocal)) falta = true;
    if (falta) void garantirTodos();
  }
  function marcarClienteDeEntrega(id: string | null) {
    const c = id ? porId.get(id) : undefined;
    if (!c || c.entrega) return;
    updateDoc(doc(db, 'clientes', c.id), { entrega: true }).catch(() => undefined);
  }

  // ------------------------------------------------------------------------------------------------------------------
  // as listas ao vivo
  // ------------------------------------------------------------------------------------------------------------------
  let rotaPadrao: ReturnType<T['rotaPadraoDoDocumento']> | null = null;
  let naRota: ListaAoVivo<Entrega> | null = null;
  let hoje: { dia: string; lista: ListaAoVivo<Entrega>; parar: Unsubscribe } | null = null;
  let mes: { competencia: string; lista: ListaAoVivo<Entrega>; parar: Unsubscribe; noLimite: boolean } | null = null;
  let lembretes: ListaAoVivo<LembreteDoCliente> | null = null;
  let atestados: ListaAoVivo<AtestadoParaBuscar> | null = null;
  let links: ListaAoVivo<ReturnType<T['linkDeRotaDoDocumento']>> | null = null;
  let configsOuvidas = false;
  let meta = 0;
  let fechadas: string[] = [];
  let obrigacoes: ReturnType<T['obrigacoesDoDocumento']> | null = null;
  let escritorio: ReturnType<T['escritorioDoDocumento']> = entregas.ESCRITORIO_VAZIO;
  let escritorioLido = false;

  const entregasDe = (docs: { id: string; data: () => DocumentData }[]) => docs.map(d => entregas.entregaDoDocumento(d.id, d.data()));

  function ouvirConfigs() {
    if (configsOuvidas) return;
    configsOuvidas = true;
    onSnapshot(doc(db, 'config', 'metas'), s => { meta = Number((s.data() || {}).porPessoa) || 0; mudou(); }, () => undefined);
    onSnapshot(doc(db, 'config', 'competencias'), s => { const f = (s.data() || {}).fechadas; fechadas = Array.isArray(f) ? f.map(String) : []; mudou(); }, () => undefined);
  }
  function lerEscritorio() {
    if (escritorioLido) return;
    escritorioLido = true;
    getDoc(doc(db, 'config', 'escritorio')).then(s => { escritorio = entregas.escritorioDoDocumento(s.data()); mudou(); }).catch(() => undefined);
  }

  // ------------------------------------------------------------------------------------------------------------------
  // o link do cliente (portais/{token}): a projeção é regravada quando uma entrega dele muda (fila no aparelho)
  // ------------------------------------------------------------------------------------------------------------------
  async function atualizarPortal(clienteId: string, token?: string): Promise<boolean> {
    const c = porId.get(clienteId);
    const t = token || c?.portalToken;
    if (!c || !t) return false;
    lerEscritorio();
    const empresas = entregas.empresasDoLink({ ...c, portalToken: t }, porId);
    // lê do servidor de propósito: o cache pela metade faria entrega sumir da tela do cliente
    const snaps = await Promise.all(empresas.map(x => getDocsFromServer(query(collection(db, 'entregas'), where('clienteId', '==', x.id)))));
    const todas = snaps.flatMap(s => entregasDe(s.docs));
    await updateDoc(doc(db, 'portais', t), entregas.projecaoDoPortal(c, empresas, todas, escritorio));
    return true;
  }
  let relogioFila: ReturnType<typeof setTimeout> | null = null;
  function processarFilaDoLink() {
    const fila = lerLocal<string[]>(CHAVE_PORTAL_FILA, []);
    if (!fila.length || !navigator.onLine || !quem() || !porId.size) return;
    for (const id of fila) {
      atualizarPortal(id).then(() => gravarLocal(CHAVE_PORTAL_FILA, lerLocal<string[]>(CHAVE_PORTAL_FILA, []).filter(x => x !== id)), () => undefined);
    }
  }
  if (typeof window !== 'undefined') window.addEventListener('online', () => setTimeout(processarFilaDoLink, 2000));
  function linkMudou(clienteId: string | null) {
    const donos = entregas.donosDoLinkDe(clienteId, porId);
    if (!donos.length) return;
    const fila = lerLocal<string[]>(CHAVE_PORTAL_FILA, []);
    for (const d of donos) if (!fila.includes(d.id)) fila.push(d.id);
    gravarLocal(CHAVE_PORTAL_FILA, fila);
    if (relogioFila) clearTimeout(relogioFila);
    relogioFila = setTimeout(processarFilaDoLink, 3000);
  }
  function guardarComprovanteNoLink(e: { id: string; clienteId: string | null }, assinatura: string, recebedor: string, quando: string) {
    if (!assinatura) return;
    for (const dono of entregas.donosDoLinkDe(e.clienteId, porId)) {
      setDoc(doc(db, 'portais', dono.portalToken, 'comprovantes', e.id), { assinatura, recebedor: recebedor || '', confirmadoEm: quando }).catch(() => undefined);
    }
  }
  function guardarGuiaNoLink(e: { id: string; clienteId: string | null }, imagem: string) {
    if (!imagem || imagem.length > 950000) return;
    for (const dono of entregas.donosDoLinkDe(e.clienteId, porId)) {
      setDoc(doc(db, 'portais', dono.portalToken, 'guias', e.id), { imagem, em: agora() }).catch(() => undefined);
    }
  }

  // ------------------------------------------------------------------------------------------------------------------
  // a fila pública (rotaLinks): como qualquer aparelho da equipe com a Rota aberta, mantém a posição dos links abertos
  // ------------------------------------------------------------------------------------------------------------------
  const gravadoEm = new Map<string, number>();
  let retentativa: ReturnType<typeof setTimeout> | null = null;
  const portalEmAndamento = new Map<string, Promise<void>>();
  function garantirRotaDoPortal(token: string, chave: string, zona: string | null, nome: string): Promise<void> {
    const link = links?.lista.find(l => l.id === token);
    const limite = new Date(Date.now() + 24 * 3600000).toISOString();
    const serve = link && link.clienteChave === chave && (link.zona || null) === (zona || null) && link.expiraEm > limite;
    if (serve) {
      if (!link.concluida) return Promise.resolve();
      link.concluida = false;
      return updateDoc(doc(db, 'rotaLinks', token), { concluida: false, paradasAntes: [], atualizadoEm: agora() }).catch(() => undefined);
    }
    const ja = portalEmAndamento.get(token);
    if (ja) return ja;
    const q = quem();
    const ref = doc(db, 'rotaLinks', token);
    // nome, zona e validade são fixos depois de criado (as regras): mudou algum, apaga e cria de novo
    const p = deleteDoc(ref).catch(() => undefined)
      .then(() => setDoc(ref, {
        clienteChave: chave, clienteNomeParada: nome || '', zona: zona || null, portal: true, criadoPor: q?.email || '', criadoPorNome: q?.nome || '',
        criadoEm: agora(), expiraEm: new Date(Date.now() + DIAS_ROTA_PORTAL * 86400000).toISOString(), paradasAntes: [], concluida: false,
        estimativaMinutos: null, atualizadoEm: agora(),
      }))
      .catch(() => undefined)
      .then(() => { portalEmAndamento.delete(token); });
    portalEmAndamento.set(token, p);
    return p;
  }
  function sincronizarLinks() {
    if (!naRota?.carregada || !links?.carregada || !porId.size || !quem()) return;
    const fixa = rotaPadrao || entregas.ROTA_PADRAO_VAZIA;
    const ordenadas = entregas.ordenarPendentes(naRota.lista, fixa, porId);
    const vistos = new Set<string>();
    for (const e of ordenadas) {
      for (const dono of entregas.donosDoLinkDe(e.clienteId, porId)) {
        if (!dono.portalToken || vistos.has(dono.portalToken)) continue;
        vistos.add(dono.portalToken);
        void garantirRotaDoPortal(dono.portalToken, entregas.chaveDaParada(e, porId), e.zona || null, dono.nomeFantasia || dono.nome || '');
      }
    }
    const ritmo = entregas.minutosPorParada([...(hoje?.lista.lista || []), ...(mes?.lista.lista || [])]);
    for (const link of links.lista) {
      const p = entregas.projecaoDoLink(link, ordenadas, porId, ritmo);
      if (!p.mudou) continue;
      const ultima = gravadoEm.get(link.id) || 0;
      if (Date.now() - ultima < 30000) {
        if (!retentativa) retentativa = setTimeout(() => { retentativa = null; sincronizarLinks(); }, 30000 - (Date.now() - ultima) + 500);
        continue;
      }
      gravadoEm.set(link.id, Date.now());
      Object.assign(link, { concluida: p.concluida, paradasAntes: p.paradasAntes, estimativaMinutos: p.estimativaMinutos });
      updateDoc(doc(db, 'rotaLinks', link.id), { paradasAntes: p.paradasAntes, concluida: p.concluida, estimativaMinutos: p.estimativaMinutos, atualizadoEm: agora() }).catch(() => undefined);
    }
  }
  function ouvirLinks() {
    if (links) return;
    links = vazia();
    onSnapshot(query(collection(db, 'rotaLinks'), where('expiraEm', '>', agora()), limit(200)), s => {
      links = { carregada: true, lista: s.docs.map(d => entregas.linkDeRotaDoDocumento(d.id, d.data())), erro: '' };
      sincronizarLinks();
    }, () => { links = { carregada: true, lista: [], erro: '' }; });
  }

  // ------------------------------------------------------------------------------------------------------------------
  // o lugar do cliente: aprende com a confirmação feita na porta dele
  // ------------------------------------------------------------------------------------------------------------------
  function guardarLocalDoCliente(clienteId: string | null, geo: ReturnType<T['geoDoBanco']>) {
    const c = clienteId ? porId.get(clienteId) : undefined;
    if (!c || !geo) return;
    if (!entregas.avaliarLocalDaEntrega(c, geo).aprender) return;
    updateDoc(doc(db, 'clientes', c.id), { geo: entregas.geoAprendido(geo) }).catch(() => undefined);
  }

  const recentes = new Map<string, Entrega[]>();
  let raizDoDrive: { id: string; codigo: string }[] | null = null;

  return {
    exemplos: false,
    quem,

    // ---- ao vivo ----
    clientes() {
      if (!clientes) { clientes = vazia(); ouvirClientes(false); ouvirConfigs(); ouvirLinks(); }
      return clientes;
    },
    clientesCompletos: () => completos,
    garantirTodosOsClientes: garantirTodos,
    rotaPadrao() {
      if (!rotaPadrao) {
        rotaPadrao = entregas.ROTA_PADRAO_VAZIA;
        getDoc(doc(db, 'config', 'rotaPadrao')).then(s => { rotaPadrao = entregas.rotaPadraoDoDocumento(s.data()); sincronizarLinks(); mudou(); }).catch(() => undefined);
      }
      return rotaPadrao;
    },
    naRota() {
      if (!naRota) {
        naRota = vazia();
        onSnapshot(query(collection(db, 'entregas'), where('status', '==', 'pendente'), limit(500)), s => {
          naRota = { carregada: true, lista: entregasDe(s.docs), erro: '' };
          conferirClientesQueFaltam();
          sincronizarLinks();
          mudou();
        }, err => { naRota = { carregada: true, lista: [], erro: erroDe(err) }; mudou(); });
      }
      return naRota;
    },
    hoje() {
      const d = new Date();
      const dia = d.toDateString();
      if (hoje?.dia === dia) return hoje.lista;
      // app aberto de um dia pro outro: refaz a consulta quando o dia vira
      hoje?.parar();
      const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
      const atual: NonNullable<typeof hoje> = { dia, lista: vazia(), parar: () => undefined };
      hoje = atual;
      atual.parar = onSnapshot(query(collection(db, 'entregas'), where('confirmadoEm', '>=', inicio)), s => {
        atual.lista = { carregada: true, lista: entregasDe(s.docs), erro: '' };
        mudou();
      }, () => { atual.lista = { carregada: true, lista: [], erro: '' }; mudou(); });
      return atual.lista;
    },
    doMes(competencia) {
      if (mes?.competencia === competencia) return mes.lista;
      mes?.parar();
      const atual: NonNullable<typeof mes> = { competencia, lista: vazia(), parar: () => undefined, noLimite: false };
      mes = atual;
      atual.parar = onSnapshot(query(collection(db, 'entregas'), where('competencia', '==', competencia), limit(LIMITE_PAINEL)), s => {
        atual.lista = { carregada: true, lista: entregasDe(s.docs), erro: '' };
        atual.noLimite = s.size >= LIMITE_PAINEL;
        conferirClientesQueFaltam();
        mudou();
      }, err => { atual.lista = { carregada: true, lista: [], erro: erroDe(err) }; mudou(); });
      return atual.lista;
    },
    lembretes() {
      if (!lembretes) {
        lembretes = vazia();
        onSnapshot(query(collection(db, 'lembretesCliente'), where('ativo', '==', true), limit(500)), s => {
          const t = (v: unknown) => (v == null ? '' : String(v));
          lembretes = {
            carregada: true, erro: '',
            lista: s.docs.map(d => { const x = d.data(); return { id: d.id, clienteId: t(x.clienteId), clienteNome: t(x.clienteNome), texto: t(x.texto), criadoPor: t(x.criadoPor), criadoPorNome: t(x.criadoPorNome), criadoEm: t(x.criadoEm) }; })
              .sort((a, b) => a.criadoEm.localeCompare(b.criadoEm)),
          };
          mudou();
        }, () => { lembretes = { carregada: true, lista: [], erro: '' }; mudou(); });
      }
      return lembretes;
    },
    atestados() {
      const q = quem();
      if (!atestados && q) {
        atestados = vazia();
        // o office boy vê a fila toda; os outros, os que pediram (como o Entregas)
        const consulta = temPapel('office_boy')
          ? query(collection(db, 'solicitacoes'), orderBy('criadoEm', 'desc'), limit(300))
          : query(collection(db, 'solicitacoes'), where('criadoPor', '==', q.email), limit(300));
        onSnapshot(consulta, s => {
          const t = (v: unknown) => (v == null ? '' : String(v));
          atestados = {
            carregada: true, erro: '',
            lista: s.docs.map(d => ({ id: d.id, ...d.data() } as Record<string, unknown>)).filter(x => x.tipo === 'atestado' && x.status !== 'concluida')
              .map(x => ({ id: t(x.id), funcionario: t(x.atestadoFuncionario), empresa: t(x.atestadoEmpresa), clinica: t(x.atestadoClinica), urgente: !!x.urgente, criadoPor: t(x.criadoPor), criadoPorNome: t(x.criadoPorNome), criadoEm: t(x.criadoEm) }))
              .sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()),
          };
          mudou();
        }, () => { atestados = { carregada: true, lista: [], erro: '' }; mudou(); });
      }
      return atestados || { carregada: true, lista: [], erro: '' };
    },
    metaPorPessoa: () => { ouvirConfigs(); return meta; },
    competenciasFechadas: () => { ouvirConfigs(); return fechadas; },
    obrigacoes() {
      if (!obrigacoes) {
        obrigacoes = [...entregas.OBRIGACOES_PADRAO];
        getDoc(doc(db, 'config', 'obrigacoes')).then(s => { obrigacoes = entregas.obrigacoesDoDocumento(s.data()); mudou(); }).catch(() => undefined);
      }
      return obrigacoes;
    },
    escritorio: () => { lerEscritorio(); return escritorio; },
    perdidas: () => lerLocal<EscritaPerdida[]>(CHAVE_PERDIDAS, []),
    limparPerdidas() { try { localStorage.removeItem(CHAVE_PERDIDAS); } catch { /* nada */ } mudou(); },
    pendentesDeSubir: () => pendentesDeSubir,

    // ---- leituras pontuais ----
    async doCliente(clienteId) {
      const s = await getDocs(query(collection(db, 'entregas'), where('clienteId', '==', clienteId), limit(200)));
      return entregas.maisNovaPrimeiro(entregasDe(s.docs));
    },
    async recentesDoCliente(clienteId) {
      const ja = recentes.get(clienteId);
      if (ja) return ja;
      const s = await getDocs(query(collection(db, 'entregas'), where('clienteId', '==', clienteId), limit(40)));
      const l = entregasDe(s.docs);
      recentes.set(clienteId, l);
      return l;
    },
    async doClienteNoMes(clienteId, competencia) {
      const s = await getDocs(query(collection(db, 'entregas'), where('clienteId', '==', clienteId), where('competencia', '==', competencia), limit(10)));
      return entregasDe(s.docs);
    },
    async comprovante(entregaId): Promise<ComprovanteDaEntrega> {
      const s = await getDoc(doc(db, 'entregas', entregaId, 'anexos', 'comprovante')).catch(() => null);
      const d = s?.data() || {};
      return { assinatura: typeof d.assinatura === 'string' ? d.assinatura : '', foto: typeof d.foto === 'string' ? d.foto : '' };
    },
    async guiasAnexadas(entregaId): Promise<GuiaAnexada[]> {
      const s = await getDocs(collection(db, 'entregas', entregaId, 'anexos'));
      return s.docs.filter(d => d.id.startsWith('guia-')).map(d => { const g = d.data(); return { tipo: String(g.tipo || ''), nome: String(g.nome || ''), pdf: typeof g.pdf === 'string' ? g.pdf : null }; });
    },
    async doPeriodo(inicio, fim) {
      const s = await getDocs(query(collection(db, 'entregas'), where('confirmadoEm', '>=', inicio), where('confirmadoEm', '<', fim), orderBy('confirmadoEm'), limit(800)));
      return entregasDe(s.docs).filter(e => e.status === 'confirmada' || e.status === 'falha');
    },
    async comEntregaRecente() {
      // lê três competências inteiras: guardado 12 h no aparelho (foi o que mais pesou no dia em que o banco bateu o limite)
      const comps = entregas.ultimasCompetencias(3);
      const g = lerLocal<{ em: number; comps: string; ids: string[] } | null>(CHAVE_SEM_ENTREGA, null);
      if (g && g.comps === comps.join(',') && Date.now() - g.em < 12 * 36e5) return g.ids;
      const s = await getDocs(query(collection(db, 'entregas'), where('competencia', 'in', comps), limit(3000)));
      const ids = entregas.idsComEntregaConfirmada(entregasDe(s.docs));
      gravarLocal(CHAVE_SEM_ENTREGA, { em: Date.now(), comps: comps.join(','), ids });
      return ids;
    },
    async assinaturaFeita(entregaId) {
      const s = await getDocs(query(collection(db, 'assinaturas'), where('entregaId', '==', entregaId), where('assinado', '==', true)));
      const mais = s.docs.map(d => d.data()).filter(d => d.assinatura).sort((a, b) => String(b.assinadoEm || '').localeCompare(String(a.assinadoEm || '')))[0];
      return mais ? { assinatura: String(mais.assinatura), recebedor: String(mais.recebedor || '') } : null;
    },
    async vistoNoLink(token) {
      const s = await getDoc(doc(db, 'portais', token));
      const v = (s.data() || {}).visto;
      return v && v.ultima ? { ultima: String(v.ultima), vezes: Number(v.vezes) || 0 } : null;
    },
    async documentosDoMes(clienteId, competencia) {
      const s = await getDoc(doc(db, 'documentosMensal', clienteId + '_' + competencia)).catch(() => null);
      return s?.data() || {};
    },

    // ---- gravações ----
    async registrar(n, guias) {
      const q = precisaDeQuem();
      const ref = doc(collection(db, 'entregas'));
      const dados = entregas.dadosDaEntregaNova(n, q, agora());
      const lote = writeBatch(db);
      lote.set(ref, dados);
      if (n.foto) lote.set(doc(db, 'entregas', ref.id, 'anexos', 'comprovante'), { foto: n.foto });
      // as guias que vieram da pasta do cliente (FGTS, DARF, DAS): o PDF fica anexado à entrega
      for (const g of guias) {
        const guia: Record<string, unknown> = { tipo: g.tipo, nome: g.nome, driveId: g.driveId, tamanho: g.tamanho, em: agora() };
        if (g.pdf) guia.pdf = g.pdf;
        lote.set(doc(db, 'entregas', ref.id, 'anexos', 'guia-' + g.tipo), guia);
      }
      const clienteId = n.para.tipo === 'cliente' ? n.para.cliente.id : null;
      linkMudou(clienteId);
      marcarClienteDeEntrega(clienteId);
      if (dados.temGuia && n.foto) guardarGuiaNoLink({ id: ref.id, clienteId }, n.foto);
      const gravacao = lote.commit().then(() => linkMudou(clienteId));
      // a região que a pessoa escolheu para o cliente (à parte e sem esperar, como no Entregas)
      if (n.modo === 'rota' && n.para.tipo === 'cliente' && n.zona && n.para.cliente.zona !== n.zona) {
        updateDoc(doc(db, 'clientes', n.para.cliente.id), { zona: n.zona }).catch(() => undefined);
      }
      const resultado = await naoTrava(gravacao, 'a entrega de ' + (String(dados.clienteNome) || 'um cliente'));
      return { id: ref.id, resultado };
    },
    async confirmar(e, c, avaliacao) {
      const q = precisaDeQuem();
      const quando = agora();
      const ref = doc(db, 'entregas', e.id);
      // um lote só: sem sinal, a assinatura vai pra fila junto com a entrega; com dois aparelhos, o segundo é recusado inteiro
      const lote = writeBatch(db);
      lote.update(ref, entregas.dadosDaConfirmacao(c, avaliacao, q, quando));
      const comp = entregas.comprovanteDaConfirmacao(c);
      if (comp) lote.set(doc(db, 'entregas', e.id, 'anexos', 'comprovante'), comp, { merge: true });
      linkMudou(e.clienteId);
      if (comp?.assinatura) guardarComprovanteNoLink(e, comp.assinatura, c.recebedor.trim(), quando);
      const gravacao = lote.commit().then(() => {
        linkMudou(e.clienteId);
        if (!c.falha) guardarLocalDoCliente(e.clienteId, c.geo);
      });
      return naoTrava(gravacao, 'a confirmação de ' + (e.clienteNome || 'uma entrega'));
    },
    async confirmarJuntas(lista, c, avaliacao) {
      const q = precisaDeQuem();
      const quando = agora();
      const dados = entregas.dadosDoLote(c, avaliacao, q, quando);
      const comp = entregas.comprovanteDaConfirmacao({ falha: c.falha, semAssinatura: false, assinatura: c.assinatura, foto: c.foto });
      const gravacoes = lista.map(e => {
        const lote = writeBatch(db);
        lote.update(doc(db, 'entregas', e.id), dados);
        if (comp) lote.set(doc(db, 'entregas', e.id, 'anexos', 'comprovante'), comp, { merge: true });
        linkMudou(e.clienteId);
        if (comp?.assinatura) guardarComprovanteNoLink(e, comp.assinatura, c.recebedor.trim(), quando);
        return lote.commit().then(() => {
          linkMudou(e.clienteId);
          // o lugar aprendido com o clienteId de CADA entrega (o lote pode juntar empresas aglutinadas)
          if (!c.falha) guardarLocalDoCliente(e.clienteId, c.geo);
        });
      });
      return naoTrava(Promise.all(gravacoes), 'a confirmação de ' + lista.length + ' entregas de ' + (lista[0]?.clienteNome || 'um cliente'));
    },
    async explicarRecusa(entregaId) {
      try {
        const s = await getDocFromServer(doc(db, 'entregas', entregaId));
        if (!s.exists()) return 'Essa parada já foi tirada da rota por outra pessoa.';
        const d = s.data();
        if (d.status && d.status !== 'pendente' && d.status !== 'link') {
          return 'Essa entrega já foi ' + (d.status === 'falha' ? 'registrada como não realizada' : 'confirmada') + ' por ' + (d.entregadoPorNome || 'outra pessoa') + '.';
        }
      } catch { /* sem sinal */ }
      return '';
    },
    async novaTentativa(lista, motivo) {
      const q = precisaDeQuem();
      const quando = agora();
      // lote e não add(): logo depois de uma entrega que não deu certo, onde costuma faltar sinal
      const lote = writeBatch(db);
      for (const e of lista) lote.set(doc(collection(db, 'entregas')), entregas.dadosDaNovaTentativa(e, motivo, q, quando));
      for (const e of lista) linkMudou(e.clienteId);
      return naoTrava(lote.commit().then(() => { for (const e of lista) linkMudou(e.clienteId); }), 'recolocar ' + (lista[0]?.clienteNome || 'a entrega') + ' na rota');
    },
    async reordenar(ids) {
      const gravar = (l: readonly string[]) => {
        const lote = writeBatch(db);
        l.forEach(id => lote.update(doc(db, 'entregas', id), { ordemRota: ids.indexOf(id) }));
        return lote.commit();
      };
      try {
        await gravar(ids);
        return { soAsMinhas: false };
      } catch (err) {
        // a regra antiga só deixava mexer no que era seu: grava ao menos as da pessoa
        if (codigo(err) !== 'permission-denied' || temPapel('admin')) throw err;
        const email = quem()?.email;
        const minhas = ids.filter(id => naRota?.lista.find(p => p.id === id)?.entregadoPor === email);
        if (!minhas.length || minhas.length === ids.length) throw err;
        await gravar(minhas);
        return { soAsMinhas: true };
      }
    },
    async editar(e, competencia, zona, itens) {
      const p = updateDoc(doc(db, 'entregas', e.id), entregas.dadosDaEdicao(competencia, zona, itens)).then(() => linkMudou(e.clienteId));
      return naoTrava(p, 'a edição da parada de ' + (e.clienteNome || 'um cliente'));
    },
    async excluir(e) {
      // no lote, ou os dois somem, ou nenhum some (antes sobrava uma entrega sem a prova)
      const lote = writeBatch(db);
      lote.delete(doc(db, 'entregas', e.id, 'anexos', 'comprovante'));
      for (const g of GUIAS_ANEXADAS) lote.delete(doc(db, 'entregas', e.id, 'anexos', 'guia-' + g));
      lote.delete(doc(db, 'entregas', e.id));
      await lote.commit();
      linkMudou(e.clienteId);
      auditoria('exclusao_entrega', (e.clienteNome || 'sem cliente') + ' · ' + entregas.rotuloDaCompetencia(e.competencia));
    },
    async salvarOrdemFixa(rp) {
      const q = precisaDeQuem();
      await setDoc(doc(db, 'config', 'rotaPadrao'), { zonas: rp.zonas, ordem: rp.ordem, atualizadoEm: agora(), atualizadoPor: q.nome });
      rotaPadrao = rp;
      auditoria('rota_padrao', Object.keys(rp.ordem).length + ' paradas na ordem');
      // a região de cada cliente vem junto: é o que o filtro da rota usa
      const lote = writeBatch(db);
      let mexidos = 0;
      for (const [id, z] of Object.entries(rp.zonas)) {
        const c = porId.get(id);
        if (!c || c.zona === z || mexidos >= 400) continue;
        lote.update(doc(db, 'clientes', id), { zona: z });
        mexidos++;
      }
      if (mexidos) await lote.commit();
      mudou();
      return mexidos;
    },
    async salvarMeta(porPessoa) {
      await setDoc(doc(db, 'config', 'metas'), { porPessoa }, { merge: true });
      auditoria('meta_definida', porPessoa ? porPessoa + ' entregas por pessoa' : 'meta removida');
    },
    async corrigirLocal(c, dados) {
      await updateDoc(doc(db, 'clientes', c.id), dados);
      auditoria('local_corrigido', entregas.rotuloDoCliente(c) + (dados.geo?.referencia ? ' · ' + dados.geo.referencia : ''));
    },
    async aglutinar(c, com) {
      const novoGrupo = com.grupoLocal || com.id;
      const ancora = porId.get(novoGrupo) || com;
      const geo = ancora.geo;
      // quem seguia esta empresa segue junto para o grupo novo (senão fica órfão)
      const dependentes = [...porId.values()].filter(x => x.id !== c.id && x.grupoLocal === c.id);
      const lote = writeBatch(db);
      lote.update(doc(db, 'clientes', c.id), { grupoLocal: novoGrupo, ...(geo ? { geo } : {}) });
      for (const d of dependentes) lote.update(doc(db, 'clientes', d.id), { grupoLocal: novoGrupo, ...(geo ? { geo } : {}) });
      await lote.commit();
      for (const id of [novoGrupo, c.id]) setTimeout(() => linkMudou(id), 1500);
      auditoria('aglutinado', entregas.rotuloDoCliente(c) + ' + ' + entregas.rotuloDoCliente(com));
    },
    async desaglutinar(c) {
      const antiga = c.grupoLocal;
      await updateDoc(doc(db, 'clientes', c.id), { grupoLocal: deleteField() });
      for (const id of [antiga, c.id]) setTimeout(() => linkMudou(id), 1500);
      auditoria('aglutinacao_desfeita', entregas.rotuloDoCliente(c));
    },
    async ativarCliente(c, ativo) {
      await updateDoc(doc(db, 'clientes', c.id), { ativo });
      auditoria(ativo ? 'cliente_reativado' : 'cliente_desativado', entregas.rotuloDoCliente(c));
    },
    async receitaVista(c) {
      await updateDoc(doc(db, 'clientes', c.id), { 'receita.mudancas': [] });
    },
    async dadosDoCliente(c, historico) {
      const comps = entregas.ultimasCompetencias(12);
      const docs = await Promise.all(comps.map(comp => getDoc(doc(db, 'documentosMensal', c.id + '_' + comp)).then(s => (s.exists() ? { id: s.id, ...s.data() } : null)).catch(() => null)));
      const portal = c.portalToken ? await getDoc(doc(db, 'portais', c.portalToken)).then(s => (s.exists() ? s.data() : null)).catch(() => null) : null;
      auditoria('lgpd_exportou', entregas.rotuloDoCliente(c));
      return { geradoEm: agora(), geradoPor: quem()?.nome || '', cliente: c, entregas: historico, documentosMensais: docs.filter(Boolean), paginaDoCliente: portal };
    },
    async apagarDadosPessoais(c) {
      await updateDoc(doc(db, 'clientes', c.id), {
        telefone: '', email: '', emails: [], endereco: '', pontoReferencia: '', contatos: [], observacao: '', etiquetas: [], geo: null,
        ativo: false, anonimizadoEm: agora(), anonimizadoPor: quem()?.nome || '',
      });
      if (c.portalToken) {
        await deleteDoc(doc(db, 'portais', c.portalToken)).catch(() => undefined);
        await updateDoc(doc(db, 'clientes', c.id), { portalToken: null });
      }
      auditoria('lgpd_apagou', entregas.rotuloDoCliente(c));
    },
    async adicionarCliente(nome) {
      const ref = await addDoc(collection(db, 'clientes'), { nome, documento: '', telefone: '', ativo: true, criadoEm: agora() });
      return ref.id;
    },
    async criarLembrete(clienteId, clienteNome, texto) {
      const q = precisaDeQuem();
      await addDoc(collection(db, 'lembretesCliente'), {
        clienteId, clienteNome: clienteNome || '', texto: String(texto).slice(0, 500), ativo: true, criadoPor: q.email, criadoPorNome: q.nome, criadoEm: agora(),
      });
    },
    async resolverLembrete(id) {
      const q = precisaDeQuem();
      await updateDoc(doc(db, 'lembretesCliente', id), { ativo: false, resolvidoEm: agora(), resolvidoPor: q.email, resolvidoPorNome: q.nome });
    },
    async concluirAtestado(id) {
      const q = precisaDeQuem();
      await updateDoc(doc(db, 'solicitacoes', id), { status: 'concluida', concluidoEm: agora(), concluidoPor: q.email, concluidoPorNome: q.nome });
    },
    registrarAuditoria: auditoria,

    // ---- o link do cliente, a assinatura no celular dele e o protocolo ----
    async criarLinkDoCliente(c) {
      const q = precisaDeQuem();
      const token = entregas.tokenAleatorio(20, aleatorio);
      const antigo = c.portalToken || '';
      await setDoc(doc(db, 'portais', token), { clienteId: c.id, clienteNome: c.nome || '', criadoEm: agora(), criadoPor: q.email });
      await updateDoc(doc(db, 'clientes', c.id), { portalToken: token });
      const comToken = { ...c, portalToken: token };
      porId.set(c.id, comToken);
      auditoria(antigo ? 'portal_link_trocado' : 'portal_link_criado', entregas.rotuloDoCliente(c));
      // as assinaturas das entregas que já existiam (do período que o link mostra) e as guias das paradas na rota
      const copiar = async (x: Cliente) => {
        const comps = entregas.ultimasCompetencias(entregas.MESES_NO_PORTAL);
        const s = await getDocs(query(collection(db, 'entregas'), where('clienteId', '==', x.id)));
        const l = s.docs.map(d => ({ d, e: entregas.entregaDoDocumento(d.id, d.data()) }));
        for (const { e } of l.filter(x2 => x2.e.temGuia && x2.e.status === 'pendente').slice(0, 20)) {
          getDoc(doc(db, 'entregas', e.id, 'anexos', 'comprovante')).then(a => {
            const foto = (a.data() || {}).foto;
            if (typeof foto === 'string' && foto.length <= 950000) return setDoc(doc(db, 'portais', token, 'guias', e.id), { imagem: foto, em: agora() });
          }).catch(() => undefined);
        }
        await Promise.all(l.filter(x2 => x2.e.status === 'confirmada' && x2.e.temAssinatura && comps.includes(x2.e.competencia)).slice(0, 40).map(({ e }) =>
          getDoc(doc(db, 'entregas', e.id, 'anexos', 'comprovante')).then(a => {
            const ass = (a.data() || {}).assinatura;
            if (typeof ass === 'string' && ass) return setDoc(doc(db, 'portais', token, 'comprovantes', e.id), { assinatura: ass, recebedor: e.recebedor || '', confirmadoEm: e.confirmadoEm || '' });
          }).catch(() => undefined)));
      };
      await Promise.all([atualizarPortal(c.id, token).catch(() => false), ...entregas.empresasDoLink(comToken, porId).map(x => copiar(x).catch(() => undefined))]);
      if (antigo) {
        // o link antigo morre de verdade: some o documento e as assinaturas dele
        const [cs, gs] = await Promise.all([getDocs(collection(db, 'portais', antigo, 'comprovantes')), getDocs(collection(db, 'portais', antigo, 'guias'))]);
        const lote = writeBatch(db);
        for (const d of [...cs.docs, ...gs.docs]) lote.delete(d.ref);
        lote.delete(doc(db, 'portais', antigo));
        await lote.commit();
      }
      mudou();
      return token;
    },
    linkMudou,
    guardarComprovanteNoLink,
    pedirAssinaturaNoCelular(e, aoAssinar, aoErrar) {
      const token = entregas.tokenAleatorio(16, aleatorio);
      const q = quem();
      let parar: Unsubscribe | null = null;
      let vivo = true;
      const pronto = setDoc(doc(db, 'assinaturas', token), {
        entregaId: e.id, clienteNome: e.clienteNome || '', competencia: e.competencia || '', itens: entregas.itensDoResumo(e), assinado: false,
        criadoPor: q?.email || '', criadoPorNome: q?.nome || '', criadoEm: agora(),
        // Timestamp de verdade (a regra compara direto com request.time)
        expiraEm: Timestamp.fromDate(new Date(Date.now() + MINUTOS_ASSINATURA * 60000)),
      }).then(() => {
        if (!vivo) return;
        parar = onSnapshot(doc(db, 'assinaturas', token), s => {
          const d = s.data();
          if (!d || !d.assinado || !d.assinatura) return;
          parar?.();
          parar = null;
          aoAssinar({ assinatura: String(d.assinatura), recebedor: String(d.recebedor || '') });
        }, () => undefined);
      }, (err: Error) => { aoErrar(err.message); throw err; });
      return { link: entregas.linkDaAssinatura(token), parar: () => { vivo = false; parar?.(); parar = null; }, pronto };
    },
    registrarProtocolo(retrato) {
      const cod = entregas.codigoDoProtocolo(aleatorio);
      setDoc(doc(db, 'protocolos', cod), retrato).catch(err => {
        const lista = lerLocal<EscritaPerdida[]>(CHAVE_PERDIDAS, []);
        lista.push({ oQue: 'o código de conferência do protocolo ' + cod, motivo: codigo(err) || 'recusado', quando: agora() });
        gravarLocal(CHAVE_PERDIDAS, lista.slice(-20));
        mudou();
      });
      return cod;
    },

    // ---- a guia da pasta do cliente (o robô do Drive) ----
    async guiasDaPasta(c, m) {
      if (!raizDoDrive) {
        const r = await getDoc(doc(db, 'driveIndice', 'raiz'));
        const l = (r.data() || {}).clientes;
        raizDoDrive = Array.isArray(l) ? l.map((x: Record<string, unknown>) => ({ id: String(x?.id || ''), codigo: String(x?.codigo || '').trim() })) : [];
      }
      const pasta = raizDoDrive.find(p => p.codigo === c.codigoOrigem.trim());
      if (!pasta) return [];
      const partes = await getDocs(collection(db, 'driveIndice', pasta.id, 'partes'));
      const itens = entregas.itensDasPartes([...partes.docs].sort((a, b) => Number(a.id) - Number(b.id)).map(d => d.data()));
      return entregas.guiasNaPasta(itens, m);
    },
    async lerDoDrive(arq): Promise<ArquivoDoDrive> {
      const q = precisaDeQuem();
      const ref = await addDoc(collection(db, 'aberturasDrive'), {
        status: 'pendente', fileId: arq.i, nome: arq.n, modo: 'ler', criadoEm: agora(), criadoPor: q.email.replace(/@nilma\.local$/, '') || 'entregas', criadoPorUid: q.uid,
      });
      const partes = await new Promise<number>((ok, falha) => {
        let parar: Unsubscribe = () => undefined;
        const fim = setTimeout(() => { parar(); falha(new Error('o robô do Drive não respondeu a tempo')); }, ESPERA_DRIVE_MS);
        parar = onSnapshot(ref, s => {
          const p = s.data() || {};
          if (p.status === 'erro') { clearTimeout(fim); parar(); falha(new Error(String(p.erro || 'o robô não trouxe o arquivo'))); }
          if (p.status === 'pronto') {
            clearTimeout(fim); parar();
            if (!p.partes) falha(new Error('o robô não entregou o arquivo para leitura')); else ok(Number(p.partes));
          }
        }, err => { clearTimeout(fim); falha(err); });
      });
      const ps = await Promise.all(Array.from({ length: partes }, (_, i) => getDoc(doc(ref, 'partes', String(i)))));
      const base64 = ps.map(x => String((x.data() || {}).dados || '')).join('');
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
      return { bytes, base64, tamanho: bytes.length };
    },

    assinar(f) { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    versao: () => ver,
  };
}
