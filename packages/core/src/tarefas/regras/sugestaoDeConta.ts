// A sugestão de conta para o que o banco pagou e foi lançado no caixa (Vitor, 23/10/2026: "Boletos no caixa, podia dar uma
// sugestão de conta se tiver, igual esses que estão especificados"): o nome que vem no histórico do banco ("DÉB.TIT.COMPE
// EFETIVADO Freiopeças NF 377579 1a3") procurado nas contas do balancete dinâmico ("FREIOPECAS LTDA - FILIAL 02").
// Só sugere: quem decide é a pessoa.
import { nomeNorm } from '../../formatos';

export interface ContaParaSugestao { codigo: string; descricao: string }
export interface ContaSugerida { codigo: string; nome: string }

/** As palavras que não dizem quem é (o banco, o tipo da empresa, a nota e a parcela). */
const VAZIAS = new Set([
  'deb', 'tit', 'compe', 'efetivado', 'efetiv', 'cob', 'cobranca', 'pagamento', 'pagto', 'boleto', 'de', 'da', 'do', 'dos', 'das',
  'e', 'nf', 'nfe', 'ltda', 'me', 'epp', 'eireli', 'sa', 's', 'a', 'filial', 'cia', 'conv', 'orgaos', 'gov', 'pix', 'emitido',
  'outra', 'if', 'ref', 'doc', 'parcela', 'mei',
]);

/** As palavras do nome: sem número, sem as vazias, com 3 letras ou mais. */
export function palavrasDoNome(texto: string): string[] {
  return nomeNorm(texto).split(' ').filter(p => p.length >= 3 && !/\d/.test(p) && !VAZIAS.has(p));
}

/** "parafs" é abreviação de "parafusos": as letras na ordem, a primeira igual. */
function abrevia(curta: string, longa: string): boolean {
  if (curta[0] !== longa[0] || curta.length > longa.length) return false;
  let i = 0;
  for (const c of longa) if (c === curta[i]) i++;
  return i === curta.length;
}

/** A palavra bate com a outra: igual, o começo dela (4 letras ou mais) ou abreviada (5 ou mais). */
export const casa = (w: string, a: string) => a === w || (w.length >= 4 && a.startsWith(w)) || (w.length >= 5 && abrevia(w, a));

export interface IndiceDeContas { contas: { conta: ContaSugerida; palavras: string[] }[] }

/** As contas com as palavras do nome (uma vez por dinâmico). */
export function indiceDeContas(contas: readonly ContaParaSugestao[]): IndiceDeContas {
  return { contas: contas.map(c => ({ conta: { codigo: c.codigo, nome: c.descricao.trim() }, palavras: palavrasDoNome(c.descricao) })).filter(c => c.palavras.length) };
}

/**
 * As contas cujo nome bate com o do histórico: a primeira palavra do nome tem que bater (é quem recebeu), e ganha a que
 * bate mais palavras. Empate (as filiais do mesmo fornecedor): todas, até `max`; `total` diz quantas eram.
 */
export function sugestaoDeConta(historico: string, indice: IndiceDeContas, max = 3): { contas: ContaSugerida[]; total: number } {
  const ws = palavrasDoNome(historico);
  if (!ws.length) return { contas: [], total: 0 };
  let melhor = 0;
  let achadas: ContaSugerida[] = [];
  for (const c of indice.contas) {
    if (!c.palavras.some(a => casa(ws[0], a))) continue;
    const pontos = ws.filter(w => c.palavras.some(a => casa(w, a))).length;
    if (pontos > melhor) { melhor = pontos; achadas = [c.conta]; }
    else if (pontos === melhor) achadas.push(c.conta);
  }
  return { contas: achadas.slice(0, max), total: achadas.length };
}

/** "50163 — Casa dos Parafusos LTDA", "50251 — FREIOPECAS LTDA - FILIAL 02 (+6)". */
export function rotuloDaSugestao(s: { contas: ContaSugerida[]; total: number }): string {
  if (!s.contas.length) return '';
  const a = s.contas[0];
  return a.codigo + ' — ' + a.nome + (s.total > 1 ? ' (+' + (s.total - 1) + ')' : '');
}
