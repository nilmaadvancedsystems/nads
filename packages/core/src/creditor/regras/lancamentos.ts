// Lançamentos do layout de 8 colunas (seção 2 do fluxo) e o fechamento da conta banco por dia
// (passo 6: Débitos − Créditos da conta banco contra o que o banco creditou no dia).
import type { ContasCreditor, Grupo, Lancamento, Titulo } from '../tipos';
import { conferirGrupo, datasDoGrupo } from './conferencia';
import { decisaoValida, type Cruzamento, type Decisao } from './cruzamento';
import { chaveNf, igual, liquidoDoTitulo, ordemData, r2, somar } from './numeros';

/** "Recebimento de clientes NF 4521 - X" → "NF 4521 - X" (tira o prefixo, com ou sem separador). */
export function historicoSemPrefixo(h: string): string {
  return String(h || '').replace(/^\s*recebimentos?\s+de\s+clientes?\b\s*[-–:.]?\s*/i, '').trim();
}

/** "[NF] - [Nome do Cliente]" dos lançamentos de mora e de desconto. */
export function historicoNfCliente(t: Titulo): string {
  return (chaveNf(t.nf) || t.nf) + ' - ' + t.sacado.trim();
}

/** Contrapartida e histórico do título, ou null quando ele fica fora do arquivo. */
function origemDoTitulo(c: Cruzamento, d: Decisao | undefined): { contrapartida: string; historico: string } | null {
  if (d?.tipo === 'excluir') return null;
  if (d?.tipo === 'manual' && decisaoValida(c, d)) return { contrapartida: d.contrapartida.trim(), historico: d.historico.trim() };
  if (c.situacao === 'ok' || c.situacao === 'dividido' || (d?.tipo === 'confirmar' && c.linha)) {
    return c.linha ? { contrapartida: c.linha.contrapartida, historico: historicoSemPrefixo(c.linha.historico) } : null;
  }
  return null;
}

/** Títulos que ficaram fora do arquivo (excluídos ou ainda sem decisão). */
export function titulosFora(titulos: Titulo[], cruzamentos: Cruzamento[], decisoes: Record<number, Decisao>): Titulo[] {
  const porId = new Map(cruzamentos.map(c => [c.tituloId, c]));
  return titulos.filter(t => { const c = porId.get(t.id); return !c || !origemDoTitulo(c, decisoes[t.id]); });
}

/**
 * A) principal: D banco, C contrapartida, valor cheio da NF (sem tirar mora/desconto);
 * B) mora + outros acréscimos (se houver): D banco, C juros;  C) desconto (se houver): D desconto, C banco.
 * Em ordem de data de liquidação, e dentro do dia na ordem do relatório.
 */
export function gerarLancamentos(titulos: Titulo[], cruzamentos: Cruzamento[], decisoes: Record<number, Decisao>, contas: ContasCreditor): Lancamento[] {
  const porId = new Map(cruzamentos.map(c => [c.tituloId, c]));
  const ordem = titulos.map((t, i) => ({ t, i })).sort((a, b) => ordemData(a.t.liquidacao) - ordemData(b.t.liquidacao) || a.i - b.i);
  const saida: Lancamento[] = [];
  for (const { t } of ordem) {
    const c = porId.get(t.id);
    const o = c && origemDoTitulo(c, decisoes[t.id]);
    if (!o) continue;
    const doc = chaveNf(t.nf);
    const comum = { automatico: '', data: t.liquidacao, documento: doc, tituloId: t.id };
    saida.push({ ...comum, tipo: 'principal', debito: contas.banco, credito: o.contrapartida, codHistorico: contas.histPrincipal, historico: o.historico || historicoNfCliente(t), valor: r2(t.valor) });
    // "Vlr. Outros Acresc." é acréscimo recebido junto: entra com a mora
    const acrescimos = r2(t.mora + t.outros);
    if (acrescimos > 0) saida.push({ ...comum, tipo: 'mora', debito: contas.banco, credito: contas.juros, codHistorico: contas.histJuros, historico: historicoNfCliente(t), valor: acrescimos });
    if (t.desconto > 0) saida.push({ ...comum, tipo: 'desconto', debito: contas.desconto, credito: contas.banco, codHistorico: contas.histDesconto, historico: historicoNfCliente(t), valor: r2(t.desconto) });
  }
  return saida;
}

export type SituacaoDia = 'ok' | 'explicada' | 'diverge';

export interface FechamentoDia {
  data: string;
  debitos: number;
  creditos: number;
  /** Débitos − Créditos da conta banco no arquivo */
  liquido: number;
  /** o que o banco creditou no dia: total impresso do grupo (quando o grupo é só daquele dia) ou a soma conferida */
  esperado: number;
  fonte: 'impresso' | 'extraido';
  /** líquido dos títulos que ficaram fora do arquivo */
  fora: number;
  diferenca: number;
  situacao: SituacaoDia;
}

/** Última checagem antes de entregar: a conta banco, dia a dia, contra o relatório. */
export function fecharPorDia(grupos: Grupo[], lancamentos: Lancamento[], foraDoArquivo: Titulo[], contas: ContasCreditor): FechamentoDia[] {
  const titulos = grupos.flatMap(g => g.titulos);
  const datas = [...new Set(titulos.map(t => t.liquidacao))].sort((a, b) => ordemData(a) - ordemData(b));
  return datas.map(data => {
    const doDia = lancamentos.filter(l => l.data === data);
    const debitos = somar(doDia.filter(l => l.debito === contas.banco).map(l => l.valor));
    const creditos = somar(doDia.filter(l => l.credito === contas.banco).map(l => l.valor));
    const liquido = r2(debitos - creditos);
    // grupos só deste dia, com o total cobrado impresso e conferido
    const gruposDoDia = grupos.filter(g => g.titulos.some(t => t.liquidacao === data));
    const soDoDia = gruposDoDia.every(g => datasDoGrupo(g).length === 1 && g.impresso.cobrado != null && conferirGrupo(g).situacao === 'ok');
    const esperado = soDoDia ? somar(gruposDoDia.map(g => g.impresso.cobrado as number)) : somar(titulos.filter(t => t.liquidacao === data).map(liquidoDoTitulo));
    const fora = somar(foraDoArquivo.filter(t => t.liquidacao === data).map(liquidoDoTitulo));
    const diferenca = r2(liquido - esperado);
    const situacao: SituacaoDia = igual(diferenca, 0) ? 'ok' : fora > 0 && igual(diferenca, -fora) ? 'explicada' : 'diverge';
    return { data, debitos, creditos, liquido, esperado, fonte: soDoDia ? 'impresso' : 'extraido', fora, diferenca, situacao };
  });
}
