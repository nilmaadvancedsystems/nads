// Repositório da Conferência ligado ao MESMO banco da conferencia-nilma.web.app.
// Faz o que o original faz (conferencia.html):
// - lê a coleção inteira `empresas` ao vivo (onSnapshot, ~L4757), cada documento pelo norm();
// - na primeira carga, cria as empresas do SEED que ainda não existem (~L4764);
// - salva a empresa inteira em empresas/{slug(nome)}, sem os campos undefined (save(), ~L1494);
// - a lista da entrada é CLIENTES + as empresas do banco (candidatosBusca, ~L1620).
// A mais que o original:
// - nada é gravado antes da primeira carga chegar (senão uma empresa aberta cedo demais seria regravada vazia);
// - EMPRESA GRANDE (Vitor, 27/10/2026: as saídas da 237 sumiam ao atualizar): o Firestore recusa documento acima de
//   1 MiB, desfazia a gravação e a tela voltava ao que estava no servidor, sem as notas. Agora, quando não cabe, as
//   listas de notas vão para empresas/{slug}/partes (as regras estão em @nads/core, conferencia/regras/partes.ts) e o
//   principal aponta a versão delas;
// - O QUE FOI IMPORTADO NÃO SOME (Vitor, 27/10/2026: "devem ser obrigatoriamente armazenados"): uma gravação por vez
//   por empresa; se o banco recusar, a tela fica com o que a pessoa fez (não volta ao servidor), avisa, tenta de novo
//   e o navegador pergunta antes de fechar a aba com algo sem salvar. Empresa cujas notas não chegaram não grava (não
//   regrava as notas vazias por cima).
// Este é o ÚNICO arquivo do Concilia aí que fala com o Firebase (a trava scripts/conexoes.mjs garante).
import { conferencia as c, formatos } from '@nads/core';
import { initializeApp } from 'firebase/app';
import { collection, doc, getDoc, getDocs, initializeFirestore, onSnapshot, writeBatch, type Firestore } from 'firebase/firestore';
import { guardarLote } from '../../../comum/modoDesenvolvedor';

/** Configuração web pública do projeto conferencia-nilma (a mesma do conferencia.html). */
const CONFIG_CONFERENCIA = {
  apiKey: 'AIzaSyAkYvoKljQFKJDiYvkpYHwFmjc2cpEl9Go',
  authDomain: 'conferencia-nilma.firebaseapp.com',
  projectId: 'conferencia-nilma',
  storageBucket: 'conferencia-nilma.firebasestorage.app',
  messagingSenderId: '1037380082378',
  appId: '1:1037380082378:web:c21407e582534572953233',
};

/** tom 'ok' = deu certo (depois de uma recusa); sem tom = erro */
type Aviso = (mensagem: string, tom?: 'ok') => void;

export interface RepoConferenciaFirestore extends c.RepoConferencia {
  /** Quem mostra os avisos (na tela). */
  definirAviso(fn: Aviso): void;
}

/** Até quanto vai num lote (o Firestore aceita até 10 MiB por lote). */
const LIMITE_DO_LOTE = 8_000_000;
/** Novas tentativas quando o banco recusa (ms). */
const TENTATIVAS = [5_000, 20_000, 60_000];

type Bruta = Partial<c.Empresa> & { nome: string };

/** Tira os campos undefined do topo, como o save() original. */
function paraGravar(e: c.Empresa): Record<string, unknown> {
  const d: Record<string, unknown> = { ...e, nome: e.nome };
  for (const k of Object.keys(d)) if (d[k] === undefined) delete d[k];
  return d;
}

/** As listas que estão nas partes (para reaproveitar quando o principal muda e as notas não). */
interface PartesConhecidas { versao: string; listas: Record<string, unknown[]>; assinaturas: Record<string, string> }

function listasDoMarcador(junto: Record<string, unknown>, m: c.MarcadorDePartes) {
  const listas: Record<string, unknown[]> = {}, assinaturas: Record<string, string> = {};
  for (const campo of Object.keys(m.campos)) {
    const l = Array.isArray(junto[campo]) ? (junto[campo] as unknown[]) : [];
    listas[campo] = l;
    assinaturas[campo] = c.assinaturaDaLista(l);
  }
  return { listas, assinaturas };
}

/** Grava em lotes: as partes primeiro e o principal no último (quem lê só vê a versão nova quando ela está inteira). */
async function gravarEmLotes(db: Firestore, id: string, principal: Record<string, unknown>, partes: c.ParteDeNotas[]) {
  let lote = guardarLote(writeBatch(db)), tam = 0, ops = 0;
  for (const p of partes) {
    const t = c.tamanhoNoFirestore(p);
    if (ops && (tam + t > LIMITE_DO_LOTE || ops >= 400)) { await lote.commit(); lote = guardarLote(writeBatch(db)); tam = 0; ops = 0; }
    lote.set(doc(db, 'empresas', id, 'partes', c.idDaParte(p)), p);
    tam += t; ops++;
  }
  if (ops && tam + c.tamanhoDoDocumento(principal, id) > LIMITE_DO_LOTE) { await lote.commit(); lote = guardarLote(writeBatch(db)); }
  lote.set(doc(db, 'empresas', id), principal);
  await lote.commit();
}

/** Apaga as partes mais velhas que a versão gravada (sobras). Falhar aqui não perde nada: só sobra espaço. */
async function apagarPartesVelhas(db: Firestore, id: string, gravada: string) {
  const s = await getDocs(collection(db, 'empresas', id, 'partes'));
  const velhas = c.partesVelhas(gravada, s.docs.map(d => ({ id: d.id, versao: (d.data() as { versao?: string }).versao })));
  for (let i = 0; i < velhas.length; i += 400) {
    const lote = guardarLote(writeBatch(db));
    for (const v of velhas.slice(i, i + 400)) lote.delete(doc(db, 'empresas', id, 'partes', v));
    await lote.commit();
  }
}

export function criarRepoConferenciaFirestore(): RepoConferenciaFirestore {
  const app = initializeApp(CONFIG_CONFERENCIA, 'conferencia');
  // campo undefined dentro de nota/cadastro não derruba a gravação (o original perdia o save)
  const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  const colecao = collection(db, 'empresas');

  let dados: Record<string, c.Empresa> = {};
  let primeiroRetrato = false;
  let carregou = false;
  let ver = 0;
  let avisar: Aviso = () => {};
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };

  /** a última versão das partes de cada empresa (lida ou gravada) */
  const conhecidas = new Map<string, PartesConhecidas>();
  /** empresas com marcador cujas partes ainda estão chegando: não aparecem pela metade */
  const carregando = new Set<string>();
  /** empresas cujas partes não deu para ler: não gravam (senão regravariam as notas vazias por cima) */
  const ilegiveis = new Set<string>();
  /** gravações na fila e as recusadas pelo banco: enquanto houver, a tela fica com o que a pessoa fez */
  const naFila = new Map<string, number>();
  const naoSalvas = new Set<string>();
  const filas = new Map<string, Promise<void>>();

  function terminarCarga() {
    if (carregou || !primeiroRetrato || carregando.size) return;
    carregou = true;
    for (const nome of Object.keys(c.SEED)) {
      if (dados[nome]) continue;
      const e = c.normalizarEmpresa({ ...structuredClone(c.SEED[nome]), nome });
      dados[nome] = e;
      gravar(e);
    }
    mudou();
  }

  /** Lê as partes da versão que o principal aponta e põe a empresa inteira em `dados`. */
  async function carregarPartes(nome: string, id: string, principal: Record<string, unknown>, tentativa = 0): Promise<void> {
    try {
      const s = await getDocs(collection(db, 'empresas', id, 'partes'));
      const junto = c.juntarPartes(principal, s.docs.map(d => d.data() as c.ParteDeNotas));
      if (!junto) {
        // a versão ainda não está inteira (ou outra aba acabou de trocar): relê o principal e tenta de novo
        if (tentativa >= 5) throw new Error('as partes das notas não fecham com o documento principal');
        await new Promise(r => setTimeout(r, 800 * (tentativa + 1)));
        const p = await getDoc(doc(db, 'empresas', id));
        return carregarPartes(nome, id, (p.data() || {}) as Record<string, unknown>, tentativa + 1);
      }
      const m = c.marcadorDe(principal);
      if (m) conhecidas.set(nome, { versao: m.versao, ...listasDoMarcador(junto, m) });
      ilegiveis.delete(nome);
      if (!naFila.get(nome) && !naoSalvas.has(nome)) dados = { ...dados, [nome]: c.normalizarEmpresa({ ...(junto as Bruta), nome }) };
    } catch (err) {
      ilegiveis.add(nome);
      avisar('Não consegui ler as notas de "' + nome + '" na nuvem (' + (err instanceof Error ? err.message : String(err)) + '). Recarregue a página antes de mexer nesta empresa.');
    } finally {
      carregando.delete(nome);
      if (carregou) mudou(); else terminarCarga();
    }
  }

  async function gravarAgora(e: c.Empresa) {
    const id = formatos.slug(e.nome);
    const dadosDoc = paraGravar(e);
    const versao = c.novaVersao(Date.now(), Math.random().toString(36).slice(2));
    const dividido = c.dividirParaGravar(dadosDoc, id, versao);
    const m = c.marcadorDe(dividido.principal);
    if (!m) {
      // cabe num documento só, como sempre foi (as partes antigas, se houver, ficam lá sem uso: nada se apaga sem querer)
      await gravarEmLotes(db, id, dividido.principal, []);
      conhecidas.delete(e.nome);
      return;
    }
    const agora = listasDoMarcador(dadosDoc, m);
    const antes = conhecidas.get(e.nome);
    const mesmas = !!antes && Object.keys(agora.assinaturas).length === Object.keys(antes.assinaturas).length
      && Object.entries(agora.assinaturas).every(([k, a]) => antes.assinaturas[k] === a);
    if (mesmas && antes) {
      // as notas não mudaram: o principal aponta as partes que já estão no banco (não regrava os MB das notas)
      await gravarEmLotes(db, id, { ...dividido.principal, notasEmPartes: { ...m, versao: antes.versao } }, []);
      return;
    }
    await gravarEmLotes(db, id, dividido.principal, dividido.partes);
    conhecidas.set(e.nome, { versao, ...agora });
    await apagarPartesVelhas(db, id, versao).catch(() => { /* sobra de espaço, sem perda */ });
  }

  function gravar(e: c.Empresa, tentativa = 0) {
    const nome = e.nome;
    naFila.set(nome, (naFila.get(nome) || 0) + 1);
    const esta = (filas.get(nome) || Promise.resolve()).then(async () => {
      // já há uma versão mais nova desta empresa na tela? é ela que vai (vem logo atrás na fila)
      if (dados[nome] && dados[nome] !== e) return;
      await gravarAgora(e);
      if (naoSalvas.delete(nome)) avisar('"' + nome + '" foi salva na nuvem.', 'ok');
    }).catch(err => {
      naoSalvas.add(nome);
      const proxima = TENTATIVAS[tentativa];
      avisar('Não deu para salvar "' + nome + '" na nuvem: ' + (err?.message || err) +
        (proxima ? '. O que você fez continua na tela; tento de novo em ' + Math.round(proxima / 1000) + ' s.'
          : '. O que você fez continua na tela: não feche a aba e chame o suporte.'));
      if (proxima) setTimeout(() => { if (naoSalvas.has(nome) && dados[nome]) gravar(dados[nome], tentativa + 1); }, proxima);
    }).finally(() => {
      naFila.set(nome, Math.max(0, (naFila.get(nome) || 1) - 1));
    });
    filas.set(nome, esta);
  }

  // fechar a aba com algo sem salvar: o navegador pergunta antes
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', ev => {
      if (naoSalvas.size || [...naFila.values()].some(n => n > 0)) { ev.preventDefault(); ev.returnValue = ''; }
    });
  }

  onSnapshot(colecao, snap => {
    // só as empresas que mudaram (Vitor, 19/10/2026: "o nads está lerdo em outras máquinas")
    const novo: Record<string, c.Empresa> = { ...dados };
    let mexeu = !primeiroRetrato;
    for (const ch of snap.docChanges()) {
      const bruto = ch.doc.data() as Record<string, unknown>;
      const nome = (bruto.nome as string) || ch.doc.id;
      if (ch.type === 'removed') { delete novo[nome]; conhecidas.delete(nome); mexeu = true; continue; }
      // o eco do que esta aba acabou de salvar: o salvar() já pôs a empresa em `dados`
      if (ch.doc.metadata.hasPendingWrites && dados[nome]) continue;
      // gravando, ou recusada pelo banco: a tela fica com o que a pessoa fez até salvar (antes, voltava ao servidor
      // e as notas importadas sumiam)
      if ((naFila.get(nome) || naoSalvas.has(nome)) && dados[nome]) continue;
      const m = c.marcadorDe(bruto);
      if (!m) { novo[nome] = c.normalizarEmpresa({ ...(c.juntarPartes(bruto, []) as Bruta), nome }); mexeu = true; continue; }
      const k = conhecidas.get(nome);
      if (k && k.versao === m.versao) {
        // só o principal mudou: as notas são as que já estão aqui
        novo[nome] = c.normalizarEmpresa({ ...(c.juntarPartes(bruto, []) as Bruta), ...k.listas, nome });
        mexeu = true;
        continue;
      }
      // versão nova das partes: busca (até chegar, fica a versão anterior, se houver)
      if (!carregando.has(nome)) { carregando.add(nome); void carregarPartes(nome, ch.doc.id, bruto); }
    }
    primeiroRetrato = true;
    if (!mexeu) return;
    dados = novo;
    if (carregou) mudou(); else terminarCarga();
  }, err => avisar('Não consegui conectar com a nuvem: ' + (err?.message || err)));

  return {
    exemplos: false,
    pronto: () => carregou,
    listarEmpresas: () => c.montarListaEmpresas(c.CLIENTES, Object.keys(dados)),
    obter: nome => dados[nome] || null,
    empresaPelaRota: rota => c.empresaPelaRota(c.CLIENTES, Object.keys(dados), rota),
    salvar(e) {
      if (!carregou) return; // antes da primeira carga, nunca grava
      if (carregando.has(e.nome)) { avisar('As notas de "' + e.nome + '" ainda estão chegando da nuvem. Espere um instante e faça de novo.'); return; }
      if (ilegiveis.has(e.nome)) { avisar('As notas de "' + e.nome + '" não foram lidas da nuvem: nada foi gravado. Recarregue a página.'); return; }
      dados = { ...dados, [e.nome]: e };
      mudou();
      gravar(e);
    },
    assinar(fn) {
      ouvintes.add(fn);
      return () => { ouvintes.delete(fn); };
    },
    versao: () => ver,
    restaurarExemplos() { /* só existe no modo exemplos */ },
    definirAviso(fn) { avisar = fn; },
  };
}
