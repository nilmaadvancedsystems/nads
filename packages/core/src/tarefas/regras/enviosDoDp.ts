// As regras do DP › Envios e do Lote que não olham a tela nem o banco (30/10/2026): quando o cliente está enviado (todos os
// arquivos do mês já foram por e-mail, não só o último pedido), quando o envio ainda marca a Entrega do mês (quem desfez
// depois do envio decide) e quais valores de um lote disparado vão para a execução do DP (só o mais novo do cliente/mês).
import { estadoDa } from './execucao';
import type { Execucao } from '../tipos';

/** um pedido de envio do DP como a regra precisa: a situação e os arquivos pedidos (os ids da lista do mês) */
export interface PedidoDeEnvioDoDp { status: string; arquivos: readonly string[] }

/**
 * Quantos dos arquivos do mês (os ids da lista que o robô achou na pasta) já foram num e-mail enviado, somando todos os
 * pedidos do mês ("Enviar só este" manda um; o resto pode ir depois). O pedido sem arquivos escolhidos levou todos (é o
 * que o robô faz: robo/envios-do-dp.js escolhidos). completo: todos os do mês já foram.
 */
export function arquivosJaEnviados(arquivos: readonly string[], pedidos: readonly PedidoDeEnvioDoDp[]): { enviados: number; total: number; completo: boolean } {
  const enviados = pedidos.filter(p => p.status === 'enviado');
  const foram = new Set(enviados.flatMap(p => p.arquivos));
  const todosDeUmaVez = enviados.some(p => !p.arquivos.length);
  const n = todosDeUmaVez ? arquivos.length : arquivos.filter(a => foram.has(a)).length;
  return { enviados: n, total: arquivos.length, completo: n === arquivos.length };
}

/**
 * O envio (enviadoEm, ISO) ainda marca a etapa? Não quando ela foi mexida depois dele: marcada, dispensada ou desfeita
 * (reabertas) por alguém depois do envio, vale a decisão da pessoa.
 */
export function envioMarcaAEtapa(ex: Execucao | null, etapa: string, enviadoEm: string): boolean {
  if (!enviadoEm) return false;
  const est = estadoDa(ex, etapa);
  if (est && est.em >= enviadoEm) return false;
  const desfeita = ex?.reabertas?.[etapa];
  return !(desfeita && desfeita >= enviadoEm);
}

/** o resultado de um cliente num lote disparado, como a regra precisa */
export interface ResultadoComValores { codigo: number; competencia: string; status: string; enviadoEm: string; valores: Record<string, number> }

/**
 * Os valores do resultado de um lote que vão para a execução do DP do mês (30/10/2026: abrir um lote antigo regravava o
 * FGTS e a DARF). Cada um vai quando a execução ainda não tem o valor; quando tem, só se o envio do lote é mais novo do que
 * o valor que está lá (valoresEm: o envio do lote de onde veio, ou a hora de quem digitou). O valor de antes dessa marca
 * vale só para o lote mais novo do cliente/mês com aquele valor. O que já está igual não vai.
 */
export function valoresDoLoteQueVao(r: ResultadoComValores, todos: readonly ResultadoComValores[], ex: Pick<Execucao, 'valores' | 'valoresEm'> | null): Record<string, number> {
  const vao: Record<string, number> = {};
  for (const [chave, valor] of Object.entries(r.valores)) {
    const atual = ex?.valores?.[chave];
    if (atual === valor) continue;
    const marca = ex?.valoresEm?.[chave];
    const vale = atual == null ? true
      : marca ? !!r.enviadoEm && r.enviadoEm > marca
        : !todos.some(o => o !== r && o.status === 'enviado' && o.codigo === r.codigo && o.competencia === r.competencia && chave in o.valores && o.enviadoEm > r.enviadoEm);
    if (vale) vao[chave] = valor;
  }
  return vao;
}
