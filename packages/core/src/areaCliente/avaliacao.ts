// A avaliação do atendimento na Área do Cliente (plano do Acessórias, 18/11/2026, ficha avaliacao-do-atendimento; frase
// do dono: "Seguir"). Na solicitação concluída o cliente dá uma nota de 1 a 5 e, se quiser, um comentário. O site manda
// pela caixa que o cliente já usa (areaClienteChamados) um pedido marcado (o título "AVALIACAO" e o texto
// "chamado:<id> nota:<n>" + o comentário na linha de baixo), sem regra nova; o robô do PC confere que o chamado é do
// link e está concluído e grava `avaliacao` no chamados/{id} interno (não vai para o espelho). Não vira conversa nem
// chamado novo; avaliar de novo substitui (a última vale). Robô antigo: o pedido vira um chamado "AVALIACAO" para a
// equipe (por isso o robô do PC tem de estar atualizado antes do site). Só a lógica.

export const TITULO_DO_PEDIDO_DE_AVALIACAO = 'AVALIACAO';
/** o comentário vai cortado em 500 caracteres */
export const MAIOR_COMENTARIO_DA_AVALIACAO = 500;
const ID_DO_CHAMADO = /^[A-Za-z0-9_-]{1,64}$/;
const DO_TEXTO = /^chamado:([A-Za-z0-9_-]{1,64}) nota:([1-5])(?:\n([\s\S]*))?$/;

export interface AvaliacaoDoChamado { chamadoId: string; nota: number; comentario: string }

/** O pedido que o site manda (sem o token e a hora); null se o id ou a nota forem tortos. */
export function pedidoDeAvaliacao(chamadoId: string, nota: number, comentario: string): { tipo: 'documento'; titulo: string; texto: string } | null {
  if (!ID_DO_CHAMADO.test(chamadoId) || !Number.isInteger(nota) || nota < 1 || nota > 5) return null;
  const c = String(comentario || '').trim().slice(0, MAIOR_COMENTARIO_DA_AVALIACAO);
  return { tipo: 'documento', titulo: TITULO_DO_PEDIDO_DE_AVALIACAO, texto: 'chamado:' + chamadoId + ' nota:' + nota + (c ? '\n' + c : '') };
}

/** A avaliação do pedido que chegou na caixa; null quando é um chamado comum ou outro pedido marcado. */
export function avaliacaoDoPedido(p: { tipo?: unknown; titulo?: unknown; texto?: unknown } | null | undefined): AvaliacaoDoChamado | null {
  if (!p || p.tipo !== 'documento' || p.titulo !== TITULO_DO_PEDIDO_DE_AVALIACAO || typeof p.texto !== 'string') return null;
  const m = DO_TEXTO.exec(p.texto.trim());
  if (!m) return null;
  return { chamadoId: m[1], nota: Number(m[2]), comentario: (m[3] || '').trim().slice(0, MAIOR_COMENTARIO_DA_AVALIACAO) };
}

/** O nome da nota, para o cliente e para a equipe. */
export const ROTULO_DA_NOTA: Readonly<Record<number, string>> = { 1: 'Ruim', 2: 'Fraco', 3: 'Bom', 4: 'Muito bom', 5: 'Ótimo' };

/** A média das notas do mês (aaaa-mm, pela data da avaliação), com uma casa; total 0 = sem avaliação no mês. */
export function mediaDasAvaliacoes(avaliacoes: readonly { nota: number; em: string }[], mes: string): { media: number; total: number } {
  const doMes = avaliacoes.filter(a => a.em.slice(0, 7) === mes && a.nota >= 1 && a.nota <= 5);
  if (!doMes.length) return { media: 0, total: 0 };
  return { media: Math.round((doMes.reduce((s, a) => s + a.nota, 0) / doMes.length) * 10) / 10, total: doMes.length };
}
