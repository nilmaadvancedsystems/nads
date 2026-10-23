// As despesas do mês pelo balancete dinâmico do Contábil (22/10/2026, no faturamento detalhado do Fiscal: "quero mais
// detalhes de faturamento, puxando do drive/nads, fgts, água, dentre outros, já que no contábil é importado o balancete
// com muitos desses dados"). O dinâmico traz o saldo de cada conta no fim de cada mês; a despesa do mês é o saldo do mês
// menos o do mês anterior (no primeiro mês, menos o saldo anterior; em janeiro, se o saldo caiu, o ano zerou e vale o
// saldo do mês). Entram só as contas analíticas (sem conta debaixo) dos grupos de custos e despesas (o nível de cima com
// "CUSTO" ou "DESPESA" no nome). As mais comuns ganham um rótulo (água, energia, aluguel, FGTS…), para a tela destacar.
import type { BalanceteDinamico } from '../../extratudo/clientes';

export interface DespesaDoMes { codigo: string; classificacao: string; descricao: string; valor: number; rotulo: string | null }
export interface DespesasDoMes { competencia: string; total: number; contas: DespesaDoMes[]; destaques: { rotulo: string; valor: number }[] }

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/** os rótulos dos destaques, pelo nome da conta (a ordem é a da tela) */
const DESTAQUES: readonly { rotulo: string; teste: RegExp }[] = [
  { rotulo: 'Salários', teste: /\bSALARIO|ORDENADO/ },
  { rotulo: 'Pró-labore', teste: /PRO.?LABORE/ },
  { rotulo: 'FGTS', teste: /\bFGTS\b/ },
  { rotulo: 'INSS', teste: /\bINSS\b|PREVIDENCIA/ },
  { rotulo: 'Água', teste: /\bAGUA\b|SANEAMENTO|ESGOTO/ },
  { rotulo: 'Energia', teste: /ENERGIA|LUZ\b/ },
  { rotulo: 'Aluguel', teste: /ALUGU/ },
  { rotulo: 'Telefone e internet', teste: /TELEFON|INTERNET|CELULAR/ },
  { rotulo: 'Honorários', teste: /HONORARIO/ },
  { rotulo: 'Combustível', teste: /COMBUSTIV/ },
];

export function rotuloDaDespesa(descricao: string): string | null {
  const n = semAcento(descricao);
  return DESTAQUES.find(d => d.teste.test(n))?.rotulo ?? null;
}

const centavos = (v: number) => Math.round(v * 100) / 100;

/** as despesas do mês do balancete dinâmico (null = o mês não está no dinâmico) */
export function despesasDoMes(d: BalanceteDinamico | null | undefined, competencia: string): DespesasDoMes | null {
  if (!d || !d.meses.includes(competencia)) return null;
  const i = d.meses.indexOf(competencia);
  const anterior = i > 0 ? d.meses[i - 1] : null;
  // os grupos de despesa: a classificação do nível de cima (um número só) com custo ou despesa no nome
  const grupos = d.linhas.filter(l => l.classificacao && !l.classificacao.includes('.') && /CUSTO|DESPESA/.test(semAcento(l.descricao))).map(l => l.classificacao);
  if (!grupos.length) return { competencia, total: 0, contas: [], destaques: [] };
  const doGrupo = d.linhas.filter(l => grupos.some(g => l.classificacao === g || l.classificacao.startsWith(g + '.')));
  // analítica: nenhuma outra classificação começa com a dela e um ponto
  const ordenadas = [...new Set(doGrupo.map(l => l.classificacao))].sort();
  const sintetica = new Set(ordenadas.filter((c, k) => ordenadas[k + 1]?.startsWith(c + '.')));
  const contas: DespesaDoMes[] = [];
  for (const l of doGrupo) {
    if (sintetica.has(l.classificacao)) continue;
    const agora = Number(l.saldos[competencia]) || 0;
    const antes = anterior ? Number(l.saldos[anterior]) || 0 : Number(l.saldoAnterior) || 0;
    let valor = agora - antes;
    if (competencia.endsWith('-01') && valor < 0) valor = agora;
    valor = centavos(valor);
    if (Math.abs(valor) < 0.005) continue;
    contas.push({ codigo: l.codigo, classificacao: l.classificacao, descricao: l.descricao, valor, rotulo: rotuloDaDespesa(l.descricao) });
  }
  contas.sort((a, b) => b.valor - a.valor);
  const destaques = DESTAQUES.map(x => ({ rotulo: x.rotulo, valor: centavos(contas.filter(c => c.rotulo === x.rotulo).reduce((s, c) => s + c.valor, 0)) }))
    .filter(x => Math.abs(x.valor) >= 0.005);
  return { competencia, total: centavos(contas.reduce((s, c) => s + c.valor, 0)), contas, destaques };
}
