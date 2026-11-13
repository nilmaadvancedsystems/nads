// As novidades em teste (Vitor, 13/11/2026: "Em toda aplicação, voce vai mandar para desenvolvedor, aprovando, vc
// disponibiliza para todos"). O que é novo aparece primeiro só para quem está com o modo desenvolvedor ligado. Os outros
// continuam no de antes, sem mudança nenhuma. Só o Vitor aprova: aprovada, a novidade passa a `aprovada: true` e vale para
// todos. Depois, numa limpeza, o código de antes sai junto com a entrada daqui.
import { modoDesenvolvedor, useModoDesenvolvedor } from './modoDesenvolvedor';

export const NOVIDADES = {
  /** o Início repaginado (13/11/2026: só no modo desenvolvedor "até eu testar tudo") */
  'inicio-novo': { desde: '13/11/2026', aprovada: false },
  /** o Administrativo, só para o Diretor e o Dono (13/11/2026: a entrada de clientes no escritório, "desenvolve o prototipo") */
  administrativo: { desde: '13/11/2026', aprovada: false },
} satisfies Record<string, { desde: string; aprovada: boolean }>;

export type IdNovidade = keyof typeof NOVIDADES;

/** A pessoa vê a novidade? (aprovada, todos; ainda em teste, só com o modo desenvolvedor ligado) */
export function novidadeLigada(id: IdNovidade, dev = modoDesenvolvedor()): boolean {
  const n: { aprovada: boolean } = NOVIDADES[id];
  return n.aprovada || dev;
}

/** O mesmo, numa tela (acompanha o modo desenvolvedor) */
export function useNovidade(id: IdNovidade): boolean {
  const [dev] = useModoDesenvolvedor();
  return novidadeLigada(id, dev);
}
