// Os feedbacks sobre a empresa (Vitor, 19/10/2026: "quero que coloque uma opção onde os sênior possam ver e mexer no
// cadastro das empresas e enviar feedbacks", com "prioridade"). É o recado para a equipe na ficha da empresa ("cliente
// atrasa o extrato"): o texto, a prioridade (Baixa, Média, Alta), quem escreveu e quando, e se já foi resolvido.
// Quem escreve: o sênior, o diretor e o admin; a equipe do nads lê. Marcar como resolvido (ou reabrir) e apagar: o autor,
// o diretor ou o admin. As mesmas travas estão nas regras do banco (feedbacksEmpresa no firestore.rules do Entregas).
// só o tipo do usuário: importar as regras dele daqui reordena o pacote do robô (robo/gerado/danfse.js), que leva o core
import type { Nivel } from '../usuarios/tipos';

export type Prioridade = 'baixa' | 'media' | 'alta';

/** Da mais alta para a mais baixa (a ordem da lista e do seletor). */
export const PRIORIDADES: readonly { id: Prioridade; rotulo: string }[] = [
  { id: 'alta', rotulo: 'Alta' },
  { id: 'media', rotulo: 'Média' },
  { id: 'baixa', rotulo: 'Baixa' },
];

/** O tamanho máximo do texto (o mesmo das regras do banco). */
export const TEXTO_MAXIMO = 1000;

export interface FeedbackDaEmpresa {
  id: string;
  /** a empresa, pelo id do cadastro (o nome em slug) */
  empresa: string;
  codigo: number | null;
  texto: string;
  prioridade: Prioridade;
  autorUid: string;
  autorNome: string;
  /** ISO */
  criadoEm: string;
  resolvido: boolean;
  /** quem marcou como resolvido ('' enquanto aberto) */
  resolvidoPor: string;
  /** ISO ('' enquanto aberto) */
  resolvidoEm: string;
}

/** Quem está mexendo: o uid (no banco; nos exemplos, o nome), o nível e se é admin. */
export interface QuemMexe { uid: string; nivel: Nivel | null; admin: boolean }

export const rotuloDaPrioridade = (p: Prioridade) => PRIORIDADES.find(x => x.id === p)?.rotulo || p;

export const ehPrioridade = (v: unknown): v is Prioridade => PRIORIDADES.some(p => p.id === v);

/** Os níveis que escrevem feedback (do sênior para cima). */
const ESCREVEM: readonly Nivel[] = ['diretor', 'senior'];

/** Escreve feedback: o admin, o diretor e o sênior. */
export function podeEscrever(q: Pick<QuemMexe, 'nivel' | 'admin'> | null): boolean {
  return !!q && (q.admin || (!!q.nivel && ESCREVEM.includes(q.nivel)));
}

/** Marca como resolvido, reabre e apaga: o autor, o diretor ou o admin. */
export function podeResolver(f: Pick<FeedbackDaEmpresa, 'autorUid'>, q: QuemMexe | null): boolean {
  return !!q && (q.admin || q.nivel === 'diretor' || (!!q.uid && f.autorUid === q.uid));
}

/** O texto como vai para o banco: sem os espaços das pontas. */
export const textoDoFeedback = (t: string) => t.trim();

/** O que impede gravar (null = pode gravar). */
export function erroDoFeedback(texto: string, prioridade: unknown): string | null {
  const t = textoDoFeedback(texto);
  if (!t) return 'Escreva o feedback.';
  if (t.length > TEXTO_MAXIMO) return 'O feedback passa de ' + TEXTO_MAXIMO + ' caracteres (tem ' + t.length + ').';
  if (!ehPrioridade(prioridade)) return 'Escolha a prioridade.';
  return null;
}

const PESO: Record<Prioridade, number> = { alta: 0, media: 1, baixa: 2 };

/**
 * A ordem da lista: os abertos primeiro (da prioridade mais alta para a mais baixa e, na mesma prioridade, o mais
 * recente em cima); depois os resolvidos, o resolvido por último em cima.
 */
export function ordenarFeedbacks<T extends FeedbackDaEmpresa>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => {
    if (a.resolvido !== b.resolvido) return a.resolvido ? 1 : -1;
    if (!a.resolvido) return PESO[a.prioridade] - PESO[b.prioridade] || b.criadoEm.localeCompare(a.criadoEm);
    return (b.resolvidoEm || b.criadoEm).localeCompare(a.resolvidoEm || a.criadoEm);
  });
}

/** Os abertos de cada empresa (pelo id do cadastro): quantos e quantos de prioridade alta. */
export interface AbertosDaEmpresa { abertos: number; altas: number }

export function abertosPorEmpresa(lista: readonly FeedbackDaEmpresa[]): Map<string, AbertosDaEmpresa> {
  const m = new Map<string, AbertosDaEmpresa>();
  for (const f of lista) {
    if (f.resolvido) continue;
    const r = m.get(f.empresa) || { abertos: 0, altas: 0 };
    m.set(f.empresa, { abertos: r.abertos + 1, altas: r.altas + (f.prioridade === 'alta' ? 1 : 0) });
  }
  return m;
}
