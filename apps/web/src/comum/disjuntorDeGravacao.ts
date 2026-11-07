// O disjuntor de gravação (07/11/2026). Em 04-05/11/2026 a tela da Tarefa entrou em ciclo: o banco negava a gravação, a
// execução voltava sem a mudança e um efeito gravava de novo, sem parar — 2,6 milhões de eventos na Dornas Havana,
// ~220 mil gravações por hora durante um dia, 3,5 GB no banco. Em 25/09/2026, duas abas regravavam o mesmo link da rota
// uma por cima da outra. Cada caso foi corrigido no lugar; este disjuntor é a rede de baixo, para o próximo.
//
// Fica no ponto de gravação do app: as travas do modo desenvolvedor (guardar, guardarPedido e guardarLote, em
// modoDesenvolvedor.ts), que quase todo repositório usa, passam por aqui (e os poucos que gravam sem elas usam
// travar/travarPedido direto). Por aba, numa janela deslizante, conta as gravações:
// - de cada documento: mais de 60 no mesmo documento em 1 min, ou de 400 em 15 min, e ele para;
// - de cada coleção, nos documentos novos (addDoc, ou doc(collection(...)) com o id automático): mais de 60 em 1 min;
// - da aba inteira (cada setDoc, updateDoc, deleteDoc, addDoc ou lote conta 1): mais de 600 em 1 min, e a aba toda para.
// Os tetos ficam acima do que uma pessoa faz clicando (até um clique por segundo no mesmo documento por um minuto) e
// muito abaixo de um ciclo (dezenas por segundo). Parado, aquele alvo não grava por 5 min (a aba toda, 2 min): a
// gravação é recusada com um erro (depois de 1 s, para um "tenta de novo" no catch não virar um laço apertado), o
// console diz o caminho e vai UM aviso para a auditoria do banco do Entregas (no máximo um a cada 10 min por aba; a
// coleção que o admin vê no Entregas › Saúde do sistema). Nada é lançado na hora: a tela nunca cai por causa dele.
//
// A recusa acontece antes do SDK do Firestore: não há mudança local nem reversão, e o snapshot não volta a disparar o
// efeito que estava em ciclo.

export interface Teto { max: number; janelaMs: number }
export interface LimitesDoDisjuntor {
  porDocumento: readonly Teto[];
  porColecao: readonly Teto[];
  total: readonly Teto[];
  pausaMs: number;
  pausaTotalMs: number;
}

export const LIMITES: LimitesDoDisjuntor = {
  porDocumento: [{ max: 60, janelaMs: 60_000 }, { max: 400, janelaMs: 15 * 60_000 }],
  porColecao: [{ max: 60, janelaMs: 60_000 }],
  total: [{ max: 600, janelaMs: 60_000 }],
  pausaMs: 5 * 60_000,
  pausaTotalMs: 2 * 60_000,
};

/** O alvo da aba inteira. Os outros: 'doc:<caminho>' e 'col:<caminho da coleção>'. */
export const TODA_A_ABA = '*';

export interface Disparo {
  alvo: string;
  /** quantas gravações já havia na janela quando parou (0 se já estava parado) */
  vezes: number;
  janelaMs: number;
  /** parado até (ms) */
  ate: number;
  /** true só na gravação que fez o disjuntor desarmar (as seguintes, já paradas, vêm com false) */
  novo: boolean;
}

export interface Disjuntor {
  /** Confere e, se pode, conta uma gravação nestes alvos. null = pode gravar; senão, o que parou. */
  passar(alvos: readonly string[]): Disparo | null;
}

export function criarDisjuntor(lim: LimitesDoDisjuntor = LIMITES, agora: () => number = Date.now): Disjuntor {
  const marcas = new Map<string, number[]>();
  const pausados = new Map<string, number>();
  const tetosDe = (alvo: string) => (alvo === TODA_A_ABA ? lim.total : alvo.startsWith('col:') ? lim.porColecao : lim.porDocumento);
  const maiorJanela = Math.max(...[...lim.porDocumento, ...lim.porColecao, ...lim.total].map(t => t.janelaMs));
  const podar = (l: number[], t: number) => { while (l.length && t - l[0] >= maiorJanela) l.shift(); };
  let contadas = 0;
  function limpar(t: number) {
    for (const [a, l] of marcas) { podar(l, t); if (!l.length) marcas.delete(a); }
    for (const [a, ate] of pausados) if (ate <= t) pausados.delete(a);
  }
  return {
    passar(alvos) {
      const t = agora();
      const todos = [TODA_A_ABA, ...new Set(alvos)];
      for (const a of todos) {
        const ate = pausados.get(a);
        if (ate === undefined) continue;
        if (ate > t) return { alvo: a, vezes: 0, janelaMs: 0, ate, novo: false };
        pausados.delete(a);
      }
      for (const a of todos) {
        const l = marcas.get(a);
        if (!l) continue;
        podar(l, t);
        for (const teto of tetosDe(a)) {
          let n = 0;
          for (let i = l.length - 1; i >= 0 && t - l[i] < teto.janelaMs; i--) n++;
          if (n < teto.max) continue;
          const ate = t + (a === TODA_A_ABA ? lim.pausaTotalMs : lim.pausaMs);
          pausados.set(a, ate);
          marcas.delete(a);
          return { alvo: a, vezes: n, janelaMs: teto.janelaMs, ate, novo: true };
        }
      }
      for (const a of todos) {
        const l = marcas.get(a);
        if (l) l.push(t); else marcas.set(a, [t]);
      }
      if (++contadas % 1000 === 0) limpar(t);
      return null;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// a ligação com o Firestore: os alvos de cada gravação, a recusa e o aviso
// ---------------------------------------------------------------------------------------------------------------------

const caminhoDe = (ref: unknown) => (ref && typeof ref === 'object' && 'path' in ref ? String((ref as { path: unknown }).path) : '');
/** o id que o Firestore gera sozinho (addDoc, doc(collection(...))): 20 letras e números */
const ID_AUTOMATICO = /^[A-Za-z0-9]{20}$/;

/** Os alvos da gravação de um documento: ele e, se o id é automático (um documento novo), a coleção. */
export function alvosDoDocumento(caminho: string): string[] {
  const i = caminho.lastIndexOf('/');
  const id = caminho.slice(i + 1);
  return i > 0 && ID_AUTOMATICO.test(id) ? ['doc:' + caminho, 'col:' + caminho.slice(0, i)] : ['doc:' + caminho];
}

const minutos = (ms: number) => Math.max(1, Math.round(ms / 60_000));

export function mensagemDoDisparo(d: Disparo, caminho: string): string {
  const onde = d.alvo === TODA_A_ABA ? 'esta aba' : '"' + d.alvo.replace(/^(doc|col):/, '') + '"';
  const quanto = d.novo ? ': ' + d.vezes + ' gravações em ' + minutos(d.janelaMs) + ' min' : '';
  return 'Gravação pausada por segurança (possível ciclo) em ' + onde + quanto + '. Nada foi gravado em "' + caminho
    + '"; tente de novo em ' + minutos(d.ate - Date.now()) + ' min. Se repetir, avise o suporte.';
}

export interface OpcoesDaTrava {
  disjuntor: Disjuntor;
  /** o aviso de que o disjuntor desarmou (uma vez por desarme; a trava não limita, quem avisa limita) */
  avisar: (d: Disparo, caminho: string) => void;
  /** a recusa espera antes de chegar ao catch de quem gravou (um "tenta de novo" no catch não vira laço apertado) */
  atrasoDaRecusaMs: number;
}

export interface TravaDeGravacao {
  /** setDoc / updateDoc / deleteDoc (o primeiro argumento é o documento) */
  travar<A extends unknown[], R>(gravar: (...a: A) => Promise<R>): (...a: A) => Promise<R>;
  /** addDoc (o primeiro argumento é a coleção) */
  travarPedido<A extends unknown[], R>(gravar: (...a: A) => Promise<R>): (...a: A) => Promise<R>;
  /** o lote (writeBatch): set, update e delete anotam o documento; o commit confere todos de uma vez */
  travarLote<L extends { commit: () => Promise<void> }>(lote: L): L;
}

export function criarTravaDeGravacao(o: OpcoesDaTrava): TravaDeGravacao {
  const recusar = (d: Disparo, caminho: string): Promise<never> => {
    const err = new Error(mensagemDoDisparo(d, caminho));
    err.name = 'DisjuntorDeGravacao';
    return new Promise((_, rejeitar) => setTimeout(() => rejeitar(err), o.atrasoDaRecusaMs));
  };
  const conferir = (alvos: string[], caminho: string): Disparo | null => {
    let d: Disparo | null;
    try { d = o.disjuntor.passar(alvos); } catch { return null; } // o disjuntor nunca impede uma gravação por erro dele
    if (d?.novo) {
      try {
        console.error('Disjuntor de gravação: ' + (d.alvo === TODA_A_ABA ? 'a aba inteira' : d.alvo) + ' com ' + d.vezes + ' gravações em '
          + minutos(d.janelaMs) + ' min; parado até ' + new Date(d.ate).toLocaleTimeString('pt-BR') + '. Gravação recusada: ' + caminho);
        o.avisar(d, caminho);
      } catch { /* o aviso nunca derruba a gravação nem a tela */ }
    }
    return d;
  };
  return {
    travar(gravar) {
      return (...a) => {
        const caminho = caminhoDe(a[0]);
        const d = caminho ? conferir(alvosDoDocumento(caminho), caminho) : null;
        return d ? recusar(d, caminho) : gravar(...a);
      };
    },
    travarPedido(gravar) {
      return (...a) => {
        const caminho = caminhoDe(a[0]);
        const d = caminho ? conferir(['col:' + caminho], caminho) : null;
        return d ? recusar(d, caminho) : gravar(...a);
      };
    },
    travarLote(lote) {
      const caminhos: string[] = [];
      const l = lote as unknown as Record<'set' | 'update' | 'delete', (...a: unknown[]) => unknown>;
      for (const m of ['set', 'update', 'delete'] as const) {
        const original = l[m];
        if (typeof original !== 'function') continue;
        l[m] = function (this: unknown, ...a: unknown[]) {
          const c = caminhoDe(a[0]);
          if (c) caminhos.push(c);
          const r = original.apply(lote, a);
          return r === lote ? lote : r; // o encadeamento (lote.set(...).set(...)) continua no lote travado
        };
      }
      const commit = lote.commit.bind(lote);
      lote.commit = () => {
        if (!caminhos.length) return commit();
        const d = conferir(caminhos.flatMap(alvosDoDocumento), caminhos[0]);
        return d ? recusar(d, caminhos[0]) : commit();
      };
      return lote;
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// a trava desta aba
// ---------------------------------------------------------------------------------------------------------------------

const AVISO_A_CADA_MS = 10 * 60_000;
let ultimoAviso = -Infinity;

/** O aviso na auditoria do banco do Entregas (a que o admin vê no Entregas › Saúde do sistema), um a cada 10 min por aba. */
function avisarNaAuditoria(d: Disparo, caminho: string) {
  const t = Date.now();
  if (t - ultimoAviso < AVISO_A_CADA_MS) return;
  ultimoAviso = t;
  const detalhe = (d.alvo === TODA_A_ABA ? 'a aba inteira' : d.alvo) + ': ' + d.vezes + ' gravações em ' + minutos(d.janelaMs) + ' min; parado '
    + minutos(d.ate - t) + ' min. Recusada: ' + caminho + (typeof location !== 'undefined' ? ' · tela ' + location.pathname : '');
  // à parte e sem a trava (o aviso não pode cair no próprio disjuntor); o login e o banco só se carregam se ele desarmar
  void Promise.all([import('firebase/firestore'), import('../aplicativos/tarefas/dados/entregas.firestore')])
    .then(([fs, entregas]) => {
      const conta = entregas.contaDoEntregas();
      if (!conta) return;
      return fs.addDoc(fs.collection(entregas.bancoDoEntregas(), 'auditoria'), {
        acao: 'disjuntor_gravacao', detalhe: detalhe.slice(0, 1000), feitoPor: conta.email, feitoPorNome: conta.email, quando: new Date().toISOString(),
      });
    })
    .catch(err => console.warn('Disjuntor de gravação: o aviso não foi para a auditoria', err));
}

export const travaDaAba: TravaDeGravacao = criarTravaDeGravacao({ disjuntor: criarDisjuntor(), avisar: avisarNaAuditoria, atrasoDaRecusaMs: 1000 });
export const { travar, travarPedido, travarLote } = travaDaAba;
