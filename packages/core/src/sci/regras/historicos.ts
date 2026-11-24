// O plano de históricos do SCI no minimum (24/11/2026: "Te mandei o plano de historicos que eu queria que voce colocasse
// tambem"): o histórico vai no lançamento pelo número; aqui se acha pelo número ou pelo apelido (PGTO, RECEB...) e se busca
// pelo nome, como a conta na lupa. O que pula o complemento já diz tudo sozinho: o complemento fica opcional nele.
import { HISTORICOS_DO_SCI } from '../planos/historicos';
import { semAcento } from './plano';

export interface HistoricoDoSci {
  /** o número, o que vai no lançamento */
  codigo: string;
  apelido: string;
  nome: string;
  /** o histórico que já diz tudo: não pede o complemento */
  pulaComplemento: boolean;
}

let lista: HistoricoDoSci[] | null = null;
let porCodigo: Map<string, HistoricoDoSci> | null = null;

/** Os históricos do plano padrão (montados uma vez). */
export function historicosDoSci(): readonly HistoricoDoSci[] {
  if (!lista) {
    lista = HISTORICOS_DO_SCI.map(([codigo, apelido, nome, pulaComplemento]) => ({ codigo, apelido, nome, pulaComplemento }));
    porCodigo = new Map(lista.map(h => [h.codigo, h]));
  }
  return lista;
}

/** O histórico pelo que foi digitado: o número ou o apelido. */
export function historicoDoSci(texto: string): HistoricoDoSci | null {
  const t = texto.trim();
  if (!t) return null;
  historicosDoSci();
  const pelo = porCodigo!.get(t);
  if (pelo) return pelo;
  const a = semAcento(t);
  return lista!.find(h => h.apelido && semAcento(h.apelido) === a) || null;
}

/** A busca nos históricos: número procura o código pelo começo; texto procura o nome e o apelido. Os mais parecidos primeiro. */
export function buscarHistoricos(q: string, limite = 80): HistoricoDoSci[] {
  const t = semAcento(q.trim());
  const todos = historicosDoSci();
  if (!t) return todos.slice(0, limite);
  const nota = (h: HistoricoDoSci): number => {
    if (h.codigo === t || semAcento(h.apelido) === t) return 0;
    if (h.codigo.startsWith(t)) return 1;
    const nome = semAcento(h.nome);
    if (nome.startsWith(t)) return 2;
    if (nome.includes(t) || semAcento(h.apelido).includes(t)) return 3;
    return 9;
  };
  return todos.map(h => ({ h, n: nota(h) })).filter(x => x.n < 9).sort((a, b) => a.n - b.n || Number(a.h.codigo) - Number(b.h.codigo)).slice(0, limite).map(x => x.h);
}
