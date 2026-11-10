// As escutas do banco que ninguém está usando se encerram sozinhas (Vitor, 10/11/2026: "pode cancelar"; a aba aberta há
// horas ficava mais lenta, com uma escuta por empresa e mês que já passou por ela). Cada repositório diz qual escuta abriu
// (guardar) e marca a leitura (usar), que acontece a cada desenho de quem mostra aquele dado. A tela aberta e parada não
// redesenha, então "sem leitura" não basta: antes de encerrar, as telas são avisadas e redesenham, e quem ainda lê fica.
// Encerrada, a próxima leitura abre de novo, igual à primeira vez.
export const SEM_USO_MS = 15 * 60 * 1000;
const OLHAR_A_CADA_MS = 60 * 1000;
const ESPERA_DAS_TELAS_MS = 5 * 1000;

export interface Escutas {
  /** A escuta `chave` abriu; `encerrar` para a escuta e esquece o que ela trouxe. */
  guardar(chave: string, encerrar: () => void): void;
  /** Alguém leu o dado de `chave` agora. */
  usar(chave: string): void;
}

/** avisarTelas: o "mudou" do repositório (todo mundo que assina redesenha e lê o que usa). */
export function criarEscutas(avisarTelas: () => void): Escutas {
  const abertas = new Map<string, { lida: number; encerrar: () => void }>();
  let relogio: ReturnType<typeof globalThis.setInterval> | null = null;
  let conferindo = false;
  const semUso = (lida: number) => Date.now() - lida >= SEM_USO_MS;

  function encerrarAsSemUso() {
    conferindo = false;
    for (const [chave, e] of abertas) {
      if (!semUso(e.lida)) continue;
      abertas.delete(chave);
      e.encerrar();
    }
    if (!abertas.size && relogio !== null) { globalThis.clearInterval(relogio); relogio = null; }
  }

  function olhar() {
    if (conferindo || ![...abertas.values()].some(e => semUso(e.lida))) return;
    conferindo = true;
    avisarTelas();
    globalThis.setTimeout(encerrarAsSemUso, ESPERA_DAS_TELAS_MS);
  }

  return {
    guardar(chave, encerrar) {
      abertas.set(chave, { lida: Date.now(), encerrar });
      if (relogio === null) relogio = globalThis.setInterval(olhar, OLHAR_A_CADA_MS);
    },
    usar(chave) {
      const e = abertas.get(chave);
      if (e) e.lida = Date.now();
    },
  };
}
