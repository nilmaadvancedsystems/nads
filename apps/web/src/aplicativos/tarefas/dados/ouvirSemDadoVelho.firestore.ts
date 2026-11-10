// O cache local só para não pagar a mesma leitura duas vezes (09/11/2026). O banco do Entregas guarda os documentos no
// navegador: ao recarregar, o Firebase pede só o que mudou. Mas ele entregaria primeiro o que tem guardado, e aí a tela
// mostraria dado velho (e os efeitos que gravam sozinhos agiriam em cima dele). Este módulo entra no lugar de
// 'firebase/firestore' (alias no vite.config.ts), segura o que veio só do cache até o servidor confirmar e a tela continua
// esperando o banco, como antes. Sem rede (ou 10 s sem resposta), entrega o guardado.
//
// A aba escondida não ouve os sinais dos robôs (10/11/2026, consumo do banco). Os documentos de robo/*, config/* e
// driveIndice/* são gravados de minuto em minuto (o ponto de cada robô, o andamento da leitura do Gmail, o mapa do Drive)
// e cada gravação é uma leitura em cada navegador que ouve, inclusive com o nads escondido atrás do Alterdata a tarde toda.
// Escondida por mais de 3 min, a aba para de ouvir esses documentos; ao voltar, ouve de novo (1 leitura cada) e a tela
// recebe o que mudou. As consultas (listas) continuam ouvindo: voltar depois de 30 min pagaria a lista inteira de novo.
//
// O getDocs também passa pelo cache (10/11/2026, consumo do banco). O getDocs do Firebase paga a consulta inteira toda vez
// (os ~400 clientes a cada página carregada, todos os itens do "onde parou" a cada empresa aberta), mesmo com os documentos
// guardados no navegador. Aqui, no banco do Entregas, ele vira um ouvinte que se desliga na primeira foto do servidor: o
// ouvinte manda ao banco "até onde eu já tenho" e, com a mesma consulta lida há menos de 30 min (nesta aba, em outra, antes
// de recarregar), o banco cobra só o que mudou. Mais de 30 min: a consulta inteira, como antes.
/* eslint-disable @typescript-eslint/no-explicit-any -- embrulho genérico das assinaturas de onSnapshot */
export * from '@firebase/firestore';
import { getDocs as getDocsBruto, onSnapshot as onSnapshotBruto } from '@firebase/firestore';

const ESPERA_SEM_SERVIDOR_MS = 10 * 1000;
const PAUSA_DA_ABA_ESCONDIDA_MS = 3 * 60 * 1000;
/** Os documentos que param de ser ouvidos com a aba escondida: os sinais dos robôs e as configurações. */
const PAUSA_NA_ABA_ESCONDIDA = /^(robo|config|driveIndice)\/[^/]+$/;

interface OpcoesDaPausa {
  pausaMs: number;
  escondida: () => boolean;
  agendar: (f: () => void, ms: number) => unknown;
  cancelar: (t: unknown) => void;
}

/**
 * Liga o ouvinte já e o desliga depois de pausaMs com a aba escondida; a aba que aparece religa. aoMudar() vem do
 * visibilitychange; parar() desliga de vez.
 */
export function criarPausaDaAbaEscondida(ligar: () => () => void, o: OpcoesDaPausa) {
  let desligar: (() => void) | null = ligar();
  let relogio: unknown = null;
  let parado = false;
  const pararRelogio = () => { if (relogio !== null) { o.cancelar(relogio); relogio = null; } };
  return {
    aoMudar() {
      if (parado) return;
      if (o.escondida()) {
        if (desligar && relogio === null) {
          relogio = o.agendar(() => { relogio = null; if (desligar) { desligar(); desligar = null; } }, o.pausaMs);
        }
        return;
      }
      pararRelogio();
      if (!desligar) desligar = ligar();
    },
    ligado: () => !!desligar,
    parar() {
      parado = true;
      pararRelogio();
      if (desligar) { desligar(); desligar = null; }
    },
  };
}

type Foto = {
  metadata: { fromCache: boolean };
  docChanges?: () => unknown[];
  exists?: () => boolean;
  data?: () => unknown;
};

interface OpcoesDoFiltro {
  esperaMs: number;
  agendar: (f: () => void, ms: number) => unknown;
  cancelar: (t: unknown) => void;
  online: () => boolean;
}

const conteudoDoDocumento = (s: Foto) => JSON.stringify(s.exists?.() ? s.data?.() : null);

/** Decide o que chega na tela: nada só do cache enquanto há servidor, e depois só mudança de dados (sem as de metadados). */
export function criarFiltroDeFotos<F extends Foto>(entregar: (s: F) => void, o: OpcoesDoFiltro) {
  let liberado = false;
  let guardada: F | null = null;
  let relogio: unknown = null;
  let ultimoConteudo: string | null = null;

  const pararRelogio = () => { if (relogio !== null) { o.cancelar(relogio); relogio = null; } };
  const passar = (s: F) => {
    if (!s.docChanges) ultimoConteudo = conteudoDoDocumento(s);
    entregar(s);
  };
  return {
    chegou(s: F) {
      if (!liberado) {
        if (s.metadata.fromCache && o.online()) {
          guardada = s;
          if (relogio === null) {
            relogio = o.agendar(() => {
              relogio = null;
              if (liberado || !guardada) return;
              liberado = true;
              passar(guardada);
            }, o.esperaMs);
          }
          return;
        }
        liberado = true;
        pararRelogio();
        passar(s);
        return;
      }
      if (s.docChanges ? s.docChanges().length > 0 : conteudoDoDocumento(s) !== ultimoConteudo) passar(s);
    },
    parar: pararRelogio,
  };
}

function ouvir(ref: any, ...args: any[]): () => void {
  const bruto = onSnapshotBruto as (...a: any[]) => () => void;
  if (ref?.firestore?.app?.name !== 'entregas') return bruto(ref, ...args);
  const temOpcoes = !!args[0] && typeof args[0] === 'object' && !('next' in args[0]);
  const opcoes = temOpcoes ? args[0] : {};
  if (opcoes.includeMetadataChanges) return bruto(ref, ...args);
  const alvo = args[temOpcoes ? 1 : 0];
  const observador = typeof alvo === 'function'
    ? { next: alvo, error: args[temOpcoes ? 2 : 1], complete: args[temOpcoes ? 3 : 2] }
    : alvo;
  const filtro = criarFiltroDeFotos<Foto>(s => observador.next?.(s), {
    esperaMs: ESPERA_SEM_SERVIDOR_MS,
    agendar: (f, ms) => setTimeout(f, ms),
    cancelar: t => clearTimeout(t as ReturnType<typeof setTimeout>),
    online: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  });
  const ligar = () => bruto(ref, { ...opcoes, includeMetadataChanges: true }, {
    next: (s: Foto) => filtro.chegou(s),
    error: (e: unknown) => { filtro.parar(); observador.error?.(e); },
    complete: () => observador.complete?.(),
  });
  if (ref?.type !== 'document' || !PAUSA_NA_ABA_ESCONDIDA.test(String(ref.path)) || typeof document === 'undefined') {
    const parar = ligar();
    return () => { filtro.parar(); parar(); };
  }
  // o mesmo filtro nas religações: a foto do cache, igual à última entregue, não volta à tela
  const pausa = criarPausaDaAbaEscondida(ligar, {
    pausaMs: PAUSA_DA_ABA_ESCONDIDA_MS,
    escondida: () => document.visibilityState === 'hidden',
    agendar: (f, ms) => setTimeout(f, ms),
    cancelar: t => clearTimeout(t as ReturnType<typeof setTimeout>),
  });
  const aoMudar = () => pausa.aoMudar();
  document.addEventListener('visibilitychange', aoMudar);
  pausa.aoMudar();
  return () => { document.removeEventListener('visibilitychange', aoMudar); filtro.parar(); pausa.parar(); };
}

export const onSnapshot = ouvir as unknown as typeof onSnapshotBruto;

/** Uma foto da consulta por um ouvinte que se desliga na primeira resposta (a primeira que o filtro de ouvir() deixa passar). */
export function umaFotoPeloOuvinte<T>(ouvirUmaVez: (chegou: (s: T) => void, falhou: (e: unknown) => void) => () => void): Promise<T> {
  return new Promise((pronto, falhou) => {
    let parar: (() => void) | null = null;
    let chegou = false;
    parar = ouvirUmaVez(s => {
      if (chegou) return;
      chegou = true;
      pronto(s);
      if (parar) parar(); else queueMicrotask(() => parar?.());
    }, falhou);
  });
}

function lerConsulta(q: any): Promise<any> {
  if (q?.firestore?.app?.name !== 'entregas') return getDocsBruto(q);
  return umaFotoPeloOuvinte((chegou, falhou) => ouvir(q, chegou, falhou));
}

export const getDocs = lerConsulta as unknown as typeof getDocsBruto;
