// Repositório da Conferência ligado ao MESMO banco da conferencia-nilma.web.app.
// Faz exatamente o que o original faz (conferencia.html):
// - lê a coleção inteira `empresas` ao vivo (onSnapshot, ~L4757), cada documento pelo norm();
// - na primeira carga, cria as empresas do SEED que ainda não existem (~L4764);
// - salva a empresa inteira em empresas/{slug(nome)} com set(), sem os campos undefined
//   (save(), ~L1494); se falhar, avisa 'Não deu para salvar "…" na nuvem: …';
// - a lista da entrada é CLIENTES + as empresas do banco (candidatosBusca, ~L1620).
// A mais que o original: nada é gravado antes da primeira carga chegar (senão uma empresa aberta
// cedo demais seria regravada vazia). E a empresa grande (Vitor, 27/10/2026: "as saídas da 237 não estão ficando
// armazenadas" — 24 mil cupons, o documento passava de 1 MB e a gravação falhava): as listas grandes vão em pedaços em
// empresas/{slug}/notas (core conferencia/regras/partes.ts), o documento principal guarda onde estão (notasEmPartes); os
// pedaços só são regravados quando as notas mudam, e a empresa só aparece na tela com todos os pedaços lidos. Enquanto
// eles sobem, `gravacao` conta quantos já chegaram (a janela do andamento) e o navegador pede confirmação para sair da página.
// Este é o ÚNICO arquivo do nads que fala com o Firebase (a trava scripts/conexoes.mjs garante).
import { conferencia as c, formatos } from '@nads/core';
import { initializeApp } from 'firebase/app';
import { collection, deleteDoc as deleteDocBruto, doc, getDocs, initializeFirestore, onSnapshot, setDoc as setDocBruto } from 'firebase/firestore';
import { guardar } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const setDoc = guardar(setDocBruto) as typeof setDocBruto;
const deleteDoc = guardar(deleteDocBruto) as typeof deleteDocBruto;

/** Configuração web pública do projeto conferencia-nilma (a mesma do conferencia.html). */
const CONFIG_CONFERENCIA = {
  apiKey: 'AIzaSyAkYvoKljQFKJDiYvkpYHwFmjc2cpEl9Go',
  authDomain: 'conferencia-nilma.firebaseapp.com',
  projectId: 'conferencia-nilma',
  storageBucket: 'conferencia-nilma.firebasestorage.app',
  messagingSenderId: '1037380082378',
  appId: '1:1037380082378:web:c21407e582534572953233',
};

type Aviso = (mensagem: string) => void;

export interface RepoConferenciaFirestore extends c.RepoConferencia {
  /** Quem mostra os avisos de erro (o toast da tela). */
  definirAviso(fn: Aviso): void;
}

/** Tira os campos undefined do topo, como o save() original. */
function paraGravar(e: c.Empresa): Record<string, unknown> {
  const d: Record<string, unknown> = { ...e, nome: e.nome };
  for (const k of Object.keys(d)) if (d[k] === undefined) delete d[k];
  return d;
}

export function criarRepoConferenciaFirestore(): RepoConferenciaFirestore {
  const app = initializeApp(CONFIG_CONFERENCIA, 'conferencia');
  // campo undefined dentro de nota/cadastro não derruba a gravação (o original perdia o save)
  const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  const colecao = collection(db, 'empresas');

  let dados: Record<string, c.Empresa> = {};
  let carregou = false;
  let ver = 0;
  let avisar: Aviso = () => {};
  const ouvintes = new Set<() => void>();
  const mudou = () => { ver++; for (const f of ouvintes) f(); };

  // o que já está nos pedaços de cada lista ('slug|lista'): o JSON (para não regravar o que não mudou) e onde está
  const nosPedacos = new Map<string, { json: string; versao: string; partes: number; qtd: number }>();
  // uma gravação de cada vez por empresa (a de agora espera a anterior)
  const filaDeGravar = new Map<string, Promise<void>>();

  // o andamento da gravação grande (a tela ouve à parte: não redesenha as notas a cada pedaço)
  let andamento: c.GravacaoNaNuvem | null = null;
  let pendentes = 0;
  const ouvintesDaGravacao = new Set<() => void>();
  const mudouGravacao = () => { for (const f of ouvintesDaGravacao) f(); };
  // fechar ou atualizar a página com gravação pendente perde o que não chegou: o navegador pergunta antes
  window.addEventListener('beforeunload', ev => { if (pendentes > 0) { ev.preventDefault(); ev.returnValue = ''; } });

  async function gravarAgora(e: c.Empresa) {
    const slug = formatos.slug(e.nome);
    const ref = doc(db, 'empresas', slug);
    if (!c.precisaDePartes(e)) {
      await setDoc(ref, paraGravar(e));
      if (c.LISTAS_GRANDES.some(l => nosPedacos.has(slug + '|' + l))) { for (const l of c.LISTAS_GRANDES) nosPedacos.delete(slug + '|' + l); await apagarPedacosVelhos(slug, {}); }
      return;
    }
    const emPartes: c.NotasEmPartes = {};
    // primeiro o que mudou (para saber de quantos pedaços é a gravação), depois a subida
    const novas: { lista: c.ListaGrande; json: string; versao: string; pedacos: unknown[][]; qtd: number }[] = [];
    for (const lista of c.LISTAS_GRANDES) {
      const itens = (e[lista] || []) as unknown[];
      if (!itens.length) continue;
      const json = JSON.stringify(itens);
      const antes = nosPedacos.get(slug + '|' + lista);
      if (antes && antes.json === json) { emPartes[lista] = { versao: antes.versao, partes: antes.partes, qtd: antes.qtd }; continue; }
      novas.push({ lista, json, versao: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), pedacos: c.dividirEmPartes(itens), qtd: itens.length });
    }
    // a janela do andamento: os pedaços novos + o documento principal
    const total = novas.reduce((s, n) => s + n.pedacos.length, 0);
    if (total) { andamento = { empresa: e.nome, notas: novas.reduce((s, n) => s + n.qtd, 0), feitos: 0, total: total + 1 }; mudouGravacao(); }
    const chegou = () => { if (andamento) { andamento = { ...andamento, feitos: andamento.feitos + 1 }; mudouGravacao(); } };
    try {
      for (const n of novas) {
        // os pedaços antes do documento principal: quem lê o principal novo já acha todos
        await Promise.all(n.pedacos.map((itensDoPedaco, i) => setDoc(doc(db, 'empresas', slug, 'notas', c.idDoPedaco(n.lista, n.versao, i)), { itens: itensDoPedaco }).then(chegou)));
        nosPedacos.set(slug + '|' + n.lista, { json: n.json, versao: n.versao, partes: n.pedacos.length, qtd: n.qtd });
        emPartes[n.lista] = { versao: n.versao, partes: n.pedacos.length, qtd: n.qtd };
      }
      const principal = paraGravar(e);
      for (const lista of Object.keys(emPartes)) principal[lista] = [];
      principal.notasEmPartes = emPartes;
      await setDoc(ref, principal);
      chegou();
      await apagarPedacosVelhos(slug, emPartes);
      if (total && andamento) { andamento = { ...andamento, feitos: andamento.total, pronto: true }; mudouGravacao(); }
    } catch (err) {
      // o erro vai para o aviso de sempre (gravar); a janela sai
      if (total) { andamento = null; mudouGravacao(); }
      throw err;
    }
  }

  /** apaga os pedaços que não são das versões de agora (os de antes de mudar as notas) */
  async function apagarPedacosVelhos(slug: string, emPartes: c.NotasEmPartes) {
    const valem = new Set(Object.entries(emPartes).flatMap(([lista, info]) => (info ? Array.from({ length: info.partes }, (_, n) => c.idDoPedaco(lista as c.ListaGrande, info.versao, n)) : [])));
    const s = await getDocs(collection(db, 'empresas', slug, 'notas'));
    await Promise.all(s.docs.filter(d => !valem.has(d.id)).map(d => deleteDoc(d.ref)));
  }

  function gravar(e: c.Empresa) {
    const slug = formatos.slug(e.nome);
    const anterior = filaDeGravar.get(slug) || Promise.resolve();
    pendentes++;
    const esta = anterior.then(() => gravarAgora(e))
      .catch(err => avisar('Não deu para salvar "' + e.nome + '" na nuvem: ' + (err?.message || err)))
      .finally(() => { pendentes--; });
    filaDeGravar.set(slug, esta);
  }

  /**
   * O documento lido com as listas que estão em pedaços (reaproveita as que esta aba já tem na mesma versão);
   * null = falta pedaço (o principal chegou antes deles): fica a versão que já estava na tela.
   */
  async function comAsNotas(id: string, bruto: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    const emPartes = bruto.notasEmPartes as c.NotasEmPartes | undefined;
    const resto: Record<string, unknown> = { ...bruto };
    delete resto.notasEmPartes;
    if (!emPartes || !Object.keys(emPartes).length) return resto;
    const nome = String(bruto.nome || id);
    const atual = dados[nome] as unknown as Record<string, unknown[]> | undefined;
    const faltam = (Object.keys(emPartes) as c.ListaGrande[]).filter(l => {
      const info = emPartes[l]!;
      const ja = nosPedacos.get(id + '|' + l);
      return !(ja && ja.versao === info.versao && atual && Array.isArray(atual[l]) && atual[l].length === info.qtd);
    });
    let docs: { id: string; itens: unknown[] }[] = [];
    if (faltam.length) docs = (await getDocs(collection(db, 'empresas', id, 'notas'))).docs.map(d => ({ id: d.id, itens: ((d.data() || {}).itens || []) as unknown[] }));
    const com: Record<string, unknown> = { ...resto };
    for (const lista of Object.keys(emPartes) as c.ListaGrande[]) {
      const info = emPartes[lista]!;
      if (!faltam.includes(lista)) { com[lista] = atual![lista]; continue; }
      const itens = c.juntarPartes(docs, lista, info);
      if (!itens) return null;
      com[lista] = itens;
      nosPedacos.set(id + '|' + lista, { json: JSON.stringify(itens), versao: info.versao, partes: info.partes, qtd: itens.length });
    }
    return com;
  }

  // os eventos do banco, um de cada vez (ler os pedaços é assíncrono: a ordem dos eventos fica)
  let filaDeLer = Promise.resolve();

  onSnapshot(colecao, snap => {
    const mudancas = snap.docChanges().map(ch => ({ tipo: ch.type, id: ch.doc.id, bruto: ch.doc.data() as Record<string, unknown>, pendente: ch.doc.metadata.hasPendingWrites }));
    filaDeLer = filaDeLer.then(() => aplicar(mudancas)).catch(err => avisar('Não consegui ler da nuvem: ' + (err?.message || err)));
  }, err => avisar('Não consegui conectar com a nuvem: ' + (err?.message || err)));

  async function aplicar(mudancas: { tipo: string; id: string; bruto: Record<string, unknown>; pendente: boolean }[]) {
    // só as empresas que mudaram (Vitor, 19/10/2026: "o nads está lerdo em outras máquinas"): antes, cada evento — até o
    // eco do próprio clique — recopiava e normalizava TODAS as empresas, com todas as notas; as outras ficam como estavam
    // (lendo os pedaços, a tela pode ter salvo outra coisa: no fim, só as que mudaram vão por cima do que está em `dados` agora)
    const atualizadas: Record<string, c.Empresa> = {};
    const removidas: string[] = [];
    let mexeu = !carregou;
    for (const m of mudancas) {
      const nome = String(m.bruto.nome || m.id);
      if (m.tipo === 'removed') { removidas.push(nome); mexeu = true; continue; }
      // o eco do que esta aba acabou de salvar: o salvar() já pôs a empresa em `dados`
      if (m.pendente && dados[nome]) continue;
      const bruto = await comAsNotas(m.id, m.bruto);
      if (!bruto) continue;
      atualizadas[nome] = c.normalizarEmpresa({ ...(bruto as Partial<c.Empresa>), nome });
      mexeu = true;
    }
    if (!mexeu) return;
    const novo: Record<string, c.Empresa> = { ...dados, ...atualizadas };
    for (const nome of removidas) delete novo[nome];
    dados = novo;
    if (!carregou) {
      carregou = true;
      for (const nome of Object.keys(c.SEED)) {
        if (dados[nome]) continue;
        const e = c.normalizarEmpresa({ ...structuredClone(c.SEED[nome]), nome });
        dados[nome] = e;
        gravar(e);
      }
    }
    mudou();
  }

  return {
    exemplos: false,
    pronto: () => carregou,
    listarEmpresas: () => c.montarListaEmpresas(c.CLIENTES, Object.keys(dados)),
    obter: nome => dados[nome] || null,
    empresaPelaRota: rota => c.empresaPelaRota(c.CLIENTES, Object.keys(dados), rota),
    salvar(e) {
      if (!carregou) return; // antes da primeira carga, nunca grava
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
    gravacao: {
      atual: () => andamento,
      pendente: () => pendentes > 0,
      assinar(fn) { ouvintesDaGravacao.add(fn); return () => { ouvintesDaGravacao.delete(fn); }; },
    },
  };
}
