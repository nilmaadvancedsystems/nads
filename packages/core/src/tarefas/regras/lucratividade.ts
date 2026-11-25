// A lucratividade por cliente, versão mínima (plano do Acessórias, ficha E23; o dono, 25/11/2026: "tudo"). O Diretor vê, por
// cliente, o honorário do período ao lado do tempo que a equipe registrou nas tarefas delegadas daquele cliente (o
// cronômetro: Iniciou/Retomou até Pausou/Concluiu, só no expediente) e o custo desse tempo por um valor por minuto que ele
// informa. É um retrato PARCIAL: o trabalho das rotinas não tem cronômetro, e a tela diz isso. A tarefa com vários clientes
// divide o tempo por igual. Só a lógica.
import { minutosDeExpediente, trechosEmAndamento, type TarefaDelegada } from './delegadas';

export interface TempoDoCliente { codigo: number; nome: string; minutos: number; tarefas: number }

/** O tempo trabalhado por cliente entre desde e ate (ms), das tarefas não canceladas com cliente. */
export function tempoPorCliente(lista: readonly Pick<TarefaDelegada, 'status' | 'historico' | 'criadaEm' | 'clientes'>[], desde: number, ate: number, agora: Date | string): TempoDoCliente[] {
  const porCodigo = new Map<number, TempoDoCliente>();
  for (const t of lista) {
    if (t.status === 'cancelada') continue;
    const clientes = t.clientes.filter(c => c.codigo != null);
    if (!clientes.length) continue;
    const minutos = trechosEmAndamento(t, agora).reduce((s, x) => s + minutosDeExpediente(Math.max(x.de, desde), Math.min(x.ate, ate)), 0);
    if (minutos <= 0) continue;
    const parte = minutos / clientes.length;
    for (const c of clientes) {
      const codigo = Number(c.codigo);
      const atual = porCodigo.get(codigo) ?? { codigo, nome: c.nome, minutos: 0, tarefas: 0 };
      atual.minutos += parte;
      atual.tarefas += 1;
      porCodigo.set(codigo, atual);
    }
  }
  return [...porCodigo.values()].map(x => ({ ...x, minutos: Math.round(x.minutos) }));
}

export interface LinhaDaLucratividade {
  codigo: number;
  nome: string;
  /** o honorário do período (o mensal × os meses); null = o cliente não tem contrato ativo */
  honorario: number | null;
  minutos: number;
  tarefas: number;
  /** o custo do tempo (minutos × custo por minuto) */
  custo: number;
  /** honorário − custo; null sem honorário */
  sobra: number | null;
}

/**
 * Uma linha por cliente que teve tempo registrado ou tem contrato ativo. meses: quantos meses o período tem (o honorário
 * mensal × meses). Os que sobram menos (ou ficam no vermelho) primeiro; os sem honorário no fim.
 */
export function lucratividade(
  tempos: readonly TempoDoCliente[],
  contratos: readonly { codigo: string | number; nome: string; valor: number; ativo: boolean }[],
  custoPorMinuto: number,
  meses: number,
): LinhaDaLucratividade[] {
  const custo = Number.isFinite(custoPorMinuto) && custoPorMinuto > 0 ? custoPorMinuto : 0;
  const ativos = new Map<number, { nome: string; valor: number }>();
  for (const c of contratos) {
    const codigo = Number(String(c.codigo).trim());
    if (!c.ativo || !Number.isInteger(codigo) || !(c.valor > 0)) continue;
    ativos.set(codigo, { nome: c.nome, valor: c.valor });
  }
  const linhas = new Map<number, LinhaDaLucratividade>();
  const redondo = (n: number) => Math.round(n * 100) / 100;
  for (const t of tempos) {
    const h = ativos.get(t.codigo);
    const honorario = h ? redondo(h.valor * meses) : null;
    const c = redondo(t.minutos * custo);
    linhas.set(t.codigo, { codigo: t.codigo, nome: h?.nome || t.nome, honorario, minutos: t.minutos, tarefas: t.tarefas, custo: c, sobra: honorario == null ? null : redondo(honorario - c) });
  }
  for (const [codigo, h] of ativos) {
    if (linhas.has(codigo)) continue;
    const honorario = redondo(h.valor * meses);
    linhas.set(codigo, { codigo, nome: h.nome, honorario, minutos: 0, tarefas: 0, custo: 0, sobra: honorario });
  }
  return [...linhas.values()].sort((a, b) => (a.sobra == null ? 1 : 0) - (b.sobra == null ? 1 : 0) || (a.sobra ?? 0) - (b.sobra ?? 0) || b.minutos - a.minutos);
}
