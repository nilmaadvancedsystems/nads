// A baixa das vendas no caixa (26/11/2026: "Quero fazer a baixa no caixa conta 5 e contra partida 16 / 5 devedora / 16 credora /
// Historico numero 477 / Complemento: [numero da nota] - [Nome do cliente]"; "The user import the file and you give me the output to
// import in SCI"): a "Impressão de campos da consulta" do SCI entra, e cada venda a prazo (o débito na conta de Clientes, com o
// cliente a débito) vira o recebimento ao contrário: D Caixa × C a mesma conta de Clientes, com o cliente a crédito, o mesmo
// valor, a mesma data e a mesma nota. A venda que já tem a baixa na consulta não entra de novo.
import type { LancamentoDaConsulta } from './consulta';
import { nomesDosParticipantes } from './consulta';
import type { CamposDoLancamento } from './lancamentos';
import { limparComplemento } from './planilha';
import { contaDoPlano, type PlanoSci } from './plano';

/** A conta do caixa e o histórico da baixa (o padrão: a conta de apelido CX do plano e o 477, Recebimento de clientes). */
export interface OpcoesDaBaixa { caixa: string; historico: string }

export const HISTORICO_DA_BAIXA = '477';

/** O padrão da baixa no plano: a conta CX (5 no 90113, 51 no 90011) e o histórico 477. */
export function baixaPadrao(plano: PlanoSci): OpcoesDaBaixa {
  return { caixa: contaDoPlano(plano, 'CX')?.codigo || '', historico: HISTORICO_DA_BAIXA };
}

export interface BaixasDaConsulta {
  /** as baixas, na ordem das vendas na consulta */
  baixas: CamposDoLancamento[];
  /** as vendas que já têm a baixa na consulta (ficam fora) */
  jaBaixadas: number;
  /** as linhas que não são venda a prazo (outro débito, sem cliente, sem valor) */
  outras: number;
}

/** A venda a prazo: o débito numa conta de Clientes do plano, com o cliente a débito, o crédito e o valor. */
const ehVenda = (l: LancamentoDaConsulta, plano: PlanoSci) =>
  !!l.credito && l.valor > 0 && !!l.participanteD && contaDoPlano(plano, l.debito)?.participante === 'cliente';

/** A chave que casa a venda com a baixa dela: a conta de Clientes, o cliente, a nota e o valor. */
const chave = (conta: string, cliente: string, documento: string, valor: number) => [conta, cliente, documento.trim(), valor].join('|');

/**
 * As baixas das vendas da consulta. O complemento é "<nota> - <nome do cliente>" (o nome vem do complemento do lançamento
 * on-line do fiscal, como no Visualizar lançamentos); sem a nota ou o nome, fica o complemento da venda.
 */
export function baixasDaConsulta(ls: readonly LancamentoDaConsulta[], plano: PlanoSci, op: OpcoesDaBaixa): BaixasDaConsulta {
  const nomes = nomesDosParticipantes(ls);
  // as baixas que já estão na consulta: o crédito na conta de Clientes, com o cliente a crédito
  const feitas = new Map<string, number>();
  for (const l of ls) {
    if (!l.participanteC || contaDoPlano(plano, l.credito)?.participante !== 'cliente') continue;
    const k = chave(l.credito, l.participanteC, l.documento, l.valor);
    feitas.set(k, (feitas.get(k) || 0) + 1);
  }
  const baixas: CamposDoLancamento[] = [];
  let jaBaixadas = 0, outras = 0;
  for (const l of ls) {
    if (!ehVenda(l, plano)) { if (!(contaDoPlano(plano, l.credito)?.participante === 'cliente' && l.participanteC)) outras++; continue; }
    const k = chave(l.debito, l.participanteD, l.documento, l.valor);
    const n = feitas.get(k) || 0;
    if (n > 0) { feitas.set(k, n - 1); jaBaixadas++; continue; }
    const nome = nomes.get(l.participanteD) || '';
    const documento = l.documento.trim();
    baixas.push({
      data: l.data, debito: op.caixa.trim(), credito: l.debito, valor: l.valor, historico: op.historico.trim(),
      complemento: documento && nome ? documento + ' - ' + nome : limparComplemento(l.complemento),
      documento, participanteD: '', participanteC: l.participanteD,
    });
  }
  return { baixas, jaBaixadas, outras };
}
