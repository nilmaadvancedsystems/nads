// As regras (sem banco) de quando o site pode reaproveitar um pedido do razão em vez de criar outro (07/11/2026: 38 pedidos
// iguais da empresa 571, um por minuto; o robô passou a juntar os iguais, e o site passa a não mandar o que já existe).

/** Quanto tempo um pedido pronto ainda vale como resposta (o razão só muda se mexerem no Alterdata). */
export const PRONTO_VALE_MS = 30 * 60 * 1000;

export interface PedidoParaAproveitar { id: string; status: string; criadoEm: string; fimEm?: string; razaoLido?: boolean }

/** O pedido que já atende o mês: o pendente/trabalhando mais antigo (o robô atende na ordem); sem ele, o pronto e lido há menos
 *  de 30 min. `aceitaPronto` falso (o usuário pediu de novo de propósito) só reaproveita o que ainda está andando. */
export function pedidoAproveitavel(lista: readonly PedidoParaAproveitar[], agoraMs: number, aceitaPronto = true): string | null {
  const andando = lista.filter(p => p.status === 'pendente' || p.status === 'trabalhando').sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  if (andando.length) return andando[0].id;
  if (!aceitaPronto) return null;
  const pronto = lista
    .filter(p => p.status === 'pronto' && p.razaoLido !== false && agoraMs - Date.parse(p.fimEm || p.criadoEm) < PRONTO_VALE_MS)
    .sort((a, b) => (b.fimEm || b.criadoEm).localeCompare(a.fimEm || a.criadoEm));
  return pronto.length ? pronto[0].id : null;
}

const RE_AMBIENTE = /n[ãa]o abriu|not responding|n[ãa]o respond|SendInput|no active desktop|sem sess[ãa]o de tela|esperando o Cont[áa]bil/i;
/** O erro é do ambiente do robô (Contábil fora, sem tela), não do pedido: pedir de novo sozinho só repete o erro. */
export const erroDeAmbiente = (msg: string) => RE_AMBIENTE.test(msg || '');

/** O teto dos pedidos que o site faz sozinho, por navegador (abrir a rotina de várias empresas seguidas não enche a fila do robô). */
export const PEDIDOS_SOZINHO_POR_HORA = 6;
export const JANELA_DOS_PEDIDOS_MS = 60 * 60 * 1000;

/** Quantos pedidos automáticos ainda cabem agora, dados os instantes (ms) dos que este navegador já criou. */
export function vagasDePedidoSozinho(criadosEm: readonly number[], agoraMs: number, teto = PEDIDOS_SOZINHO_POR_HORA, janelaMs = JANELA_DOS_PEDIDOS_MS): number {
  const naJanela = criadosEm.filter(t => agoraMs - t < janelaMs).length;
  return Math.max(0, teto - naJanela);
}
