// Repositório do Extrator no banco: o MESMO Firestore da Conferência (projeto conferencia-nilma),
// coleção nova `extrator` (as regras desse banco são abertas; nenhuma regra foi mudada).
//   extrator/{slug(nome)}                → { nome, auditoria, atualizadoEm }
//   extrator/{slug(nome)}/arquivos/{id}  → um arquivo importado com os lançamentos lidos (o PDF ou a
//                                           planilha em si nunca vão para o banco)
// Cuidados, os mesmos da Conferência:
// - carrega só a empresa aberta (não a coleção inteira), para gastar poucas leituras;
// - nada é gravado antes de a empresa chegar do banco;
// - grava só o que mudou (o arquivo novo, o apagado, a auditoria), num lote só;
// - se falhar, avisa 'Não deu para salvar "…" na nuvem: …'.
// Este, o creditor.firestore.ts (ao lado) e os dados/*.firestore.ts dos outros aplicativos são os únicos arquivos do nads que falam com o Firebase.
import { extrator as x, formatos, type empresas } from '@nads/core';
import { getApps, initializeApp } from 'firebase/app';
import { collection, doc, getFirestore, initializeFirestore, onSnapshot, writeBatch as writeBatchBruto, type Firestore } from 'firebase/firestore';
import { guardarLote } from '../../../comum/modoDesenvolvedor';

// a trava do modo desenvolvedor (comum/modoDesenvolvedor.ts): com o modo ligado, só ver — nada é gravado
const writeBatch = ((...a: Parameters<typeof writeBatchBruto>) => guardarLote(writeBatchBruto(...a))) as typeof writeBatchBruto;

/** Configuração web pública do projeto conferencia-nilma (a mesma da Conferência). */
const CONFIG_CONFERENCIA = {
  apiKey: 'AIzaSyAkYvoKljQFKJDiYvkpYHwFmjc2cpEl9Go',
  authDomain: 'conferencia-nilma.firebaseapp.com',
  projectId: 'conferencia-nilma',
  storageBucket: 'conferencia-nilma.firebasestorage.app',
  messagingSenderId: '1037380082378',
  appId: '1:1037380082378:web:c21407e582534572953233',
};

const COLECAO = 'extrator';

type Aviso = (mensagem: string) => void;

export interface RepoExtratorFirestore extends x.RepoExtrator {
  /** Quem mostra os avisos de erro (o toast da tela). */
  definirAviso(fn: Aviso): void;
}

/** O banco da Conferência (se a Conferência já abriu nesta página, usa a mesma conexão). */
export function bancoDaConferencia(): Firestore {
  const app = getApps().find(a => a.name === 'conferencia') ?? initializeApp(CONFIG_CONFERENCIA, 'conferencia');
  try {
    return initializeFirestore(app, { ignoreUndefinedProperties: true });
  } catch {
    return getFirestore(app);
  }
}

interface Carga {
  doc: x.DocEmpresaExtrator | null;
  docChegou: boolean;
  arquivos: x.ArquivoImportado[];
  arquivosChegaram: boolean;
  /** a empresa remontada (null = nada no banco ainda) */
  empresa: x.EmpresaExtrator | null;
}

export function criarRepoExtratorFirestore(lista: readonly empresas.EmpresaDoEscritorio[]): RepoExtratorFirestore {
  const db = bancoDaConferencia();
  const cargas = new Map<string, Carga>();
  let ver = 0;
  const ouvintes = new Set<() => void>();
  let avisar: Aviso = m => console.warn(m);
  const avisarTodos = () => { ver++; for (const f of ouvintes) f(); };

  function remontar(nome: string, c: Carga) {
    if (!c.docChegou || !c.arquivosChegaram) return;
    c.empresa = c.doc || c.arquivos.length ? x.empresaDoBanco(nome, c.doc, c.arquivos) : null;
    avisarTodos();
  }

  /** Começa a ouvir a empresa no banco (uma vez só por empresa). */
  function carregar(nome: string): Carga {
    const pronta = cargas.get(nome);
    if (pronta) return pronta;
    const c: Carga = { doc: null, docChegou: false, arquivos: [], arquivosChegaram: false, empresa: null };
    cargas.set(nome, c);
    const id = formatos.slug(nome);
    const falhou = (err: Error) => avisar('Não consegui ler "' + nome + '" na nuvem: ' + err.message);
    // (Vitor, 19/10/2026: "o nads está lerdo em outras máquinas") o eco do que esta aba gravou não remonta a empresa (o
    // salvar() já pôs a nova na tela), e o arquivo que não mudou continua o mesmo objeto: a próxima gravação compara
    // pela referência, sem transformar todos os lançamentos em texto
    onSnapshot(doc(db, COLECAO, id), s => {
      c.doc = s.exists() ? (s.data() as x.DocEmpresaExtrator) : null;
      const eco = s.metadata.hasPendingWrites && c.docChegou;
      c.docChegou = true;
      if (!eco) remontar(nome, c);
    }, falhou);
    onSnapshot(collection(db, COLECAO, id, 'arquivos'), s => {
      const porId = new Map(c.arquivos.map(a => [a.id, a]));
      const mudancas = s.docChanges();
      for (const ch of mudancas) {
        if (ch.type === 'removed') porId.delete(ch.doc.id);
        else porId.set(ch.doc.id, ch.doc.data() as x.ArquivoImportado);
      }
      c.arquivos = [...porId.values()];
      const eco = c.arquivosChegaram && mudancas.length > 0 && mudancas.every(ch => ch.doc.metadata.hasPendingWrites);
      c.arquivosChegaram = true;
      if (!eco) remontar(nome, c);
    }, falhou);
    return c;
  }

  const carregada = (c: Carga) => c.docChegou && c.arquivosChegaram;

  return {
    exemplos: false,
    listarEmpresas: () => lista,
    obter: nome => carregar(nome).empresa,
    carregada: nome => carregada(carregar(nome)),
    salvar(e) {
      const c = carregar(e.nome);
      if (!carregada(c)) return; // antes de a empresa chegar do banco, nunca grava
      const g = x.gravacao(c.empresa, e);
      if (x.semMudanca(g)) return;
      c.empresa = e; // a tela já vê a mudança; o banco confirma pelo onSnapshot
      avisarTodos();
      const id = formatos.slug(e.nome);
      // em lotes que o banco aceita (30/10/2026: o lote único falhava inteiro com um arquivo grande demais); o arquivo
      // maior que um documento não vai, e o aviso diz qual
      const { lotes, naoCabem } = x.lotesDaGravacao(g);
      if (naoCabem.length) {
        avisar('Não coube no banco ' + (naoCabem.length === 1 ? 'o arquivo ' : 'os arquivos ') + naoCabem.map(a => '"' + a.nome + '" (' + (x.bytesNoBanco(a) / 1_048_576).toFixed(1).replace('.', ',') + ' MB)').join(', ')
          + ' de "' + e.nome + '": mais de 1 MB num documento. Ele aparece agora, mas some ao recarregar; divida o arquivo (um mês por vez) e importe de novo.');
      }
      void (async () => {
        for (const l of lotes) {
          const lote = writeBatch(db);
          if (l.empresa) lote.set(doc(db, COLECAO, id), { ...l.empresa, atualizadoEm: new Date().toISOString() });
          for (const a of l.arquivos) lote.set(doc(db, COLECAO, id, 'arquivos', a.id), a);
          for (const a of l.apagar) lote.delete(doc(db, COLECAO, id, 'arquivos', a));
          // um lote que falha para os seguintes (a empresa e os apagados vão no último)
          try { await lote.commit(); } catch (err) { avisar('Não deu para salvar "' + e.nome + '" na nuvem: ' + (err instanceof Error ? err.message : String(err))); return; }
        }
      })();
    },
    assinar(f) {
      ouvintes.add(f);
      return () => { ouvintes.delete(f); };
    },
    versao: () => ver,
    restaurarExemplos() { /* só no modo exemplos */ },
    definirAviso(fn) { avisar = fn; },
  };
}
