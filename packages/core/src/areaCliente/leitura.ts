// O registro de abertura da guia na Área do Cliente (plano do Acessórias, 17/11/2026, ficha comprovante-de-leitura;
// frase do dono: "vamos continuar"). Quando o cliente baixa uma guia, o site manda pela caixa que ele já usa
// (areaClienteChamados) um pedido marcado (o título "LEITURA" e o texto "guia:<id>"), sem regra nova; o robô do PC
// reconhece a marca e, em vez de abrir um chamado, anota em areaClienteLeituras/{token}_{guia} a primeira e a última
// abertura e quantas vezes (pela hora do servidor). A equipe vê "aberta em dd/mm hh:mm" no Tarefas.
// Robô antigo: o pedido vira um chamado "LEITURA" para a equipe (por isso o robô do PC tem de estar atualizado antes do
// site). O registro não tem o IP (não há função no servidor): vale como sinal, não como prova. Só a lógica.

export const TITULO_DO_PEDIDO_DE_LEITURA = 'LEITURA';
const PREFIXO = 'guia:';
const ID_DA_GUIA = /^[A-Za-z0-9_-]{1,128}$/;

/** O pedido que o site manda quando o cliente baixa a guia (sem o token e a hora); null se o id for torto. */
export function pedidoDeLeitura(guiaId: string): { tipo: 'documento'; titulo: string; texto: string } | null {
  return ID_DA_GUIA.test(guiaId) ? { tipo: 'documento', titulo: TITULO_DO_PEDIDO_DE_LEITURA, texto: PREFIXO + guiaId } : null;
}

/** O id da guia do pedido de leitura que chegou na caixa; '' quando é um chamado comum (ou outro pedido marcado). */
export function guiaDoPedidoDeLeitura(p: { tipo?: unknown; titulo?: unknown; texto?: unknown } | null | undefined): string {
  if (!p || p.tipo !== 'documento' || p.titulo !== TITULO_DO_PEDIDO_DE_LEITURA || typeof p.texto !== 'string') return '';
  const t = p.texto.trim();
  const id = t.startsWith(PREFIXO) ? t.slice(PREFIXO.length) : '';
  return ID_DA_GUIA.test(id) ? id : '';
}

/** O id do registro interno: areaClienteLeituras/{token}_{guia}. */
export const idDaLeitura = (token: string, guiaId: string) => token + '_' + guiaId;

/** Já mandou o pedido desta guia hoje neste aparelho? (uma gravação por guia, por aparelho, por dia) */
export function jaRegistrouHoje(registros: Readonly<Record<string, string>>, chave: string, hoje: string): boolean {
  return registros[chave] === hoje;
}
