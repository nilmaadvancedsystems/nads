// O cache local só para não pagar a mesma leitura duas vezes (09/11/2026). O banco do Entregas guarda os documentos no
// navegador: ao recarregar, o Firebase pede só o que mudou. Mas ele entregaria primeiro o que tem guardado, e aí a tela
// mostraria dado velho (e os efeitos que gravam sozinhos agiriam em cima dele). Este módulo entra no lugar de
// 'firebase/firestore' (alias no vite.config.ts), segura o que veio só do cache até o servidor confirmar e a tela continua
// esperando o banco, como antes. Sem rede (ou 10 s sem resposta), entrega o guardado.
/* eslint-disable @typescript-eslint/no-explicit-any -- embrulho genérico das assinaturas de onSnapshot */
export * from '@firebase/firestore';
import { onSnapshot as onSnapshotBruto } from '@firebase/firestore';

const ESPERA_SEM_SERVIDOR_MS = 10 * 1000;

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
  const parar = bruto(ref, { ...opcoes, includeMetadataChanges: true }, {
    next: (s: Foto) => filtro.chegou(s),
    error: (e: unknown) => { filtro.parar(); observador.error?.(e); },
    complete: () => observador.complete?.(),
  });
  return () => { filtro.parar(); parar(); };
}

export const onSnapshot = ouvir as unknown as typeof onSnapshotBruto;
