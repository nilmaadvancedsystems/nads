// Repositório da Conferência ligado ao MESMO banco da conferencia-nilma.web.app.
// Faz exatamente o que o original faz (conferencia.html):
// - lê a coleção inteira `empresas` ao vivo (onSnapshot, ~L4757), cada documento pelo norm();
// - na primeira carga, cria as empresas do SEED que ainda não existem (~L4764);
// - salva a empresa inteira em empresas/{slug(nome)} com set(), sem os campos undefined
//   (save(), ~L1494); se falhar, avisa 'Não deu para salvar "…" na nuvem: …';
// - a lista da entrada é CLIENTES + as empresas do banco (candidatosBusca, ~L1620).
// A mais que o original: nada é gravado antes da primeira carga chegar (senão uma empresa aberta
// cedo demais seria regravada vazia).
// Este é o ÚNICO arquivo do nads que fala com o Firebase (a trava scripts/conexoes.mjs garante).
import { conferencia as c, formatos } from '@nads/core';
import { initializeApp } from 'firebase/app';
import { collection, doc, initializeFirestore, onSnapshot, setDoc as setDocBruto } from 'firebase/firestore';
import { guardar } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const setDoc = guardar(setDocBruto) as typeof setDocBruto;

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

  function gravar(e: c.Empresa) {
    setDoc(doc(db, 'empresas', formatos.slug(e.nome)), paraGravar(e))
      .catch(err => avisar('Não deu para salvar "' + e.nome + '" na nuvem: ' + (err?.message || err)));
  }

  onSnapshot(colecao, snap => {
    // só as empresas que mudaram (Vitor, 19/10/2026: "o nads está lerdo em outras máquinas"): antes, cada evento — até o
    // eco do próprio clique — recopiava e normalizava TODAS as empresas, com todas as notas; as outras ficam como estavam
    const novo: Record<string, c.Empresa> = { ...dados };
    let mexeu = !carregou;
    for (const ch of snap.docChanges()) {
      const bruto = ch.doc.data() as Partial<c.Empresa>;
      const nome = bruto.nome || ch.doc.id;
      if (ch.type === 'removed') { delete novo[nome]; mexeu = true; continue; }
      // o eco do que esta aba acabou de salvar: o salvar() já pôs a empresa em `dados`
      if (ch.doc.metadata.hasPendingWrites && dados[nome]) continue;
      novo[nome] = c.normalizarEmpresa({ ...bruto, nome });
      mexeu = true;
    }
    if (!mexeu) return;
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
  }, err => avisar('Não consegui conectar com a nuvem: ' + (err?.message || err)));

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
  };
}
