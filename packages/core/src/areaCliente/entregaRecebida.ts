// O cliente confirma pela Área do Cliente que recebeu a entrega (plano do Acessórias, 18/11/2026, ficha confirmar-entrega;
// frase do dono: "Seguir"). Só a entrega que espera no link (status 'link', a que vai sem assinatura na rua) tem o
// "Confirmar que recebi"; a de rota é assinada pelo office boy. O site manda pela caixa que o cliente já usa
// (areaClienteChamados) um pedido marcado (o título "RECEBI" e o texto "recebi:<id>"), sem regra nova; o robô do PC
// confere que a entrega é do cliente do link e ainda espera no link, e confirma como o link antigo do Entregas
// (robo/entrega-pelo-link.js). Conferir o status antes de gravar impede a confirmação em dobro (pela Área e pelo link
// antigo). Robô antigo: o pedido vira um chamado "RECEBI" para a equipe. Só a lógica.

export const TITULO_DO_PEDIDO_DE_RECEBIDO = 'RECEBI';
const PREFIXO = 'recebi:';
const ID_DA_ENTREGA = /^[A-Za-z0-9_-]{6,40}$/;

/** O pedido que o site manda (sem o token e a hora); null se o id for torto. */
export function pedidoDeRecebido(entregaId: string): { tipo: 'documento'; titulo: string; texto: string } | null {
  return ID_DA_ENTREGA.test(entregaId) ? { tipo: 'documento', titulo: TITULO_DO_PEDIDO_DE_RECEBIDO, texto: PREFIXO + entregaId } : null;
}

/** O id da entrega do pedido "recebi" que chegou na caixa; '' quando é um chamado comum ou outro pedido marcado. */
export function entregaDoPedidoDeRecebido(p: { tipo?: unknown; titulo?: unknown; texto?: unknown } | null | undefined): string {
  if (!p || p.tipo !== 'documento' || p.titulo !== TITULO_DO_PEDIDO_DE_RECEBIDO || typeof p.texto !== 'string') return '';
  const t = p.texto.trim();
  const id = t.startsWith(PREFIXO) ? t.slice(PREFIXO.length) : '';
  return ID_DA_ENTREGA.test(id) ? id : '';
}

/** O que vai para o espelho (resumo/entregas): só as que esperam a confirmação do cliente, sem quem levou nem valores. */
export interface EntregaParaConfirmar { id: string; titulo: string; competencia: string }

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** As entregas do cliente que esperam no link, com um título curto ("Guias e documentos de outubro"). */
export function entregasParaConfirmar(entregas: readonly { id: string; status?: unknown; competencia?: unknown; itens?: unknown }[]): EntregaParaConfirmar[] {
  return entregas
    .filter(e => e && e.status === 'link' && ID_DA_ENTREGA.test(e.id))
    .map(e => {
      const comp = typeof e.competencia === 'string' && /^\d{4}-\d{2}$/.test(e.competencia) ? e.competencia : '';
      const tipos = (Array.isArray(e.itens) ? e.itens : []).map(i => (i && typeof i === 'object' ? String((i as { tipo?: unknown }).tipo || '') : '')).filter(Boolean);
      const oque = tipos.length === 1 ? tipos[0] : 'Documentos';
      return { id: e.id, titulo: oque + (comp ? ' de ' + MESES[Number(comp.slice(5, 7)) - 1] : ''), competencia: comp };
    })
    .slice(0, 20);
}
