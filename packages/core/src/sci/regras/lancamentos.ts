// Os lançamentos do ShadersCI (23/11/2026: "Quero fazer uma aba de lançamento mais clean, a do meu sistema SCI é horrivel"):
// o lançamento como o SCI recebe — a data, o débito e o crédito pelo código reduzido do plano, o valor, o histórico só em
// número (o histórico padrão do SCI), o complemento (o texto do histórico), o documento e o participante a débito
// (o fornecedor) e a crédito (o cliente), pelo código dele no SCI. Sem lote ("lote nao tem, pode deixar vazio"). Sai na
// planilha do gerador do SCI (planilhaDoSci). O copiar e colar é em texto com tabulação, o mesmo do Excel.
import { cnpjValido, cpfValido } from '../../empresas/cadastro/receita';
import type { LancamentoSci } from '../tipos';
import { documentoComMascara, limparComplemento } from './planilha';
import { diaSemLancamento } from './dias';
import { historicoDoSci } from './historicos';
import { contaDoPlano, type ContaDoPlanoSci, type PlanoSci, type TipoDeParticipante } from './plano';

export interface LancamentoDoShader {
  id: string;
  /** aaaa-mm-dd ('' = sem data) */
  data: string;
  /** o código reduzido da conta */
  debito: string;
  credito: string;
  /** em centavos */
  valor: number;
  /** o número do histórico padrão do SCI */
  historico: string;
  complemento: string;
  documento: string;
  /** o código do participante no SCI (o fornecedor no débito, o cliente no crédito) */
  participanteD: string;
  participanteC: string;
  /**
   * O lançamento múltiplo a que a partida pertence (24/11/2026: "uma funcao chamada lançamento multiplo, onde debito e credito tem
   * que bater com partidas simples"): as partidas do mesmo múltiplo têm o mesmo id aqui, ficam juntas na lista e cada uma tem um
   * lado só (débito ou crédito), como a transação do SCI. Sem = o lançamento simples, com débito e crédito.
   */
  multiplo?: string;
}

export type CamposDoLancamento = Omit<LancamentoDoShader, 'id'>;

export const LANCAMENTO_VAZIO: CamposDoLancamento = { data: '', debito: '', credito: '', valor: 0, historico: '', complemento: '', documento: '', participanteD: '', participanteC: '' };

/** O valor digitado em centavos: "1.234,56", "1234.56", "1234" (NaN = não é valor). */
export function valorDoTexto(texto: string): number {
  let t = texto.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
  if (!t) return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return NaN;
  return Math.round(Number(t) * 100);
}

/** Os centavos para a tela: 1.234,56. */
export const valorParaTexto = (centavos: number) => (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * A data digitada em aaaa-mm-dd: "05/11/2026", "5/11/26", "05112026", "5/11" (no ano de referência) ou "2026-11-05". '' se não
 * for data válida.
 */
export function dataDoTexto(texto: string, anoPadrao: number): string {
  const t = texto.trim();
  let d: number, m: number, a: number;
  let x = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (x) { a = +x[1]; m = +x[2]; d = +x[3]; }
  else if ((x = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/))) { d = +x[1]; m = +x[2]; a = x[3] ? (x[3].length === 2 ? 2000 + +x[3] : +x[3]) : anoPadrao; }
  else if ((x = t.match(/^(\d{2})(\d{2})(\d{4})$/))) { d = +x[1]; m = +x[2]; a = +x[3]; }
  else return '';
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCFullYear() !== a || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return '';
  return a + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

/** aaaa-mm-dd → dd/mm/aaaa. */
export const dataParaTexto = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : iso);

const QUEM: Record<TipoDeParticipante, string> = { cliente: 'o cliente', fornecedor: 'o fornecedor' };

export type LadoDoLancamento = 'debito' | 'credito';
const NOME_DO_LADO: Record<LadoDoLancamento, string> = { debito: 'débito', credito: 'crédito' };
const apelidoDe = (conta: ContaDoPlanoSci) => conta.apelido.trim().toUpperCase();

/**
 * A conta não entra naquele lado (24/11/2026: "CD apenas em crédito e FD apenas em débito, para segurança, nem deixa aparecer para
 * o usuario essas contas dependendo do input que ele está"): os Clientes nacionais (apelido CD, nos dois planos) só a crédito e os
 * Fornecedores (FD) só a débito.
 */
export function contaForaDoLado(conta: ContaDoPlanoSci, lado: LadoDoLancamento): boolean {
  const a = apelidoDe(conta);
  return (a === 'CD' && lado === 'debito') || (a === 'FD' && lado === 'credito');
}

/**
 * O participante que a conta pede naquele lado (24/11/2026: "Participante a credito, só fica disponivel se tiver a conta 'Clientes
 * Nacionais' selecionado apelido (CD em todos os planos)"; o mesmo com os Fornecedores, FD, no débito): o cliente no crédito da CD e o
 * fornecedor no débito da FD. As outras contas não levam participante.
 */
export function participanteDoLado(conta: ContaDoPlanoSci | null, lado: LadoDoLancamento): TipoDeParticipante | null {
  if (!conta) return null;
  const a = apelidoDe(conta);
  if (a === 'CD' && lado === 'credito') return 'cliente';
  if (a === 'FD' && lado === 'debito') return 'fornecedor';
  return null;
}

function problemasDaConta(lado: LadoDoLancamento, codigo: string, conta: ContaDoPlanoSci | null, participante: string): string[] {
  const nome = NOME_DO_LADO[lado];
  if (!codigo) return ['sem conta de ' + nome];
  if (!conta) return ['a conta ' + codigo + ' não está no plano'];
  const p: string[] = [];
  if (!conta.analitica) p.push('a conta ' + codigo + ' é sintética (só a analítica recebe lançamento)');
  if (contaForaDoLado(conta, lado)) p.push('a conta ' + codigo + ' (' + conta.nome + ') só entra a ' + NOME_DO_LADO[lado === 'debito' ? 'credito' : 'debito']);
  const pede = participanteDoLado(conta, lado);
  if (pede && !participante.trim()) p.push('falta ' + QUEM[pede] + ' (participante) no ' + nome);
  if (!pede && participante.trim()) p.push('a conta ' + codigo + ' não leva participante no ' + nome);
  return p;
}

/**
 * O que impede o lançamento de ir para o SCI (vazio = pronto). Obrigatórios (24/11/2026: "Data, Valor, debito, crédito, numero do
 * historico, complemento, documento e participantes se caso a pessoa selecionar"); o complemento deixou de ser (24/11/2026: "o
 * complemento nao e obrigatorio"). Nem sábado nem feriado nacional.
 */
export function problemasDoLancamento(l: CamposDoLancamento, plano: PlanoSci): string[] {
  const p: string[] = [];
  p.push(...problemasDaData(l.data));
  p.push(...problemasDaConta('debito', l.debito, contaDoPlano(plano, l.debito), l.participanteD));
  p.push(...problemasDaConta('credito', l.credito, contaDoPlano(plano, l.credito), l.participanteC));
  if (l.debito && l.debito === l.credito) p.push('débito e crédito na mesma conta');
  p.push(...problemasDoValorEDoTexto(l));
  if (l.participanteD.trim() && l.participanteD.trim() === l.participanteC.trim()) p.push('o participante do débito e o do crédito são o mesmo');
  return p;
}

function problemasDaData(data: string): string[] {
  if (!data) return ['sem data'];
  const fora = diaSemLancamento(data);
  return fora ? [dataParaTexto(data) + ' é ' + fora + ': não se lança'] : [];
}

/** O valor, o histórico e o documento: os mesmos no lançamento simples e na partida do múltiplo (o complemento é opcional). */
function problemasDoValorEDoTexto(l: CamposDoLancamento): string[] {
  const p: string[] = [];
  if (!(l.valor > 0)) p.push('sem valor');
  const historico = l.historico ? historicoDoSci(l.historico) : null;
  if (!l.historico) p.push('sem histórico');
  else if (!/^\d+$/.test(l.historico)) p.push('o histórico é só o número do histórico padrão');
  else if (!historico) p.push('o histórico ' + l.historico + ' não está no plano de históricos');
  if (!l.documento.trim()) p.push('sem documento');
  return p;
}

// ------------------------------------------------------------------------------------------------ o lançamento múltiplo
/** O lado da partida do múltiplo: o que tem conta (null = sem conta ou com as duas). */
export function ladoDaPartida(l: CamposDoLancamento): LadoDoLancamento | null {
  const d = !!l.debito.trim(), c = !!l.credito.trim();
  return d && !c ? 'debito' : c && !d ? 'credito' : null;
}

/**
 * O que impede a partida do múltiplo (sem olhar o resto do múltiplo): um lado só, a conta e o participante daquele lado, o valor,
 * o histórico, o complemento, o documento, sem sábado nem feriado.
 */
export function problemasDaPartida(l: CamposDoLancamento, plano: PlanoSci): string[] {
  const p: string[] = [...problemasDaData(l.data)];
  const lado = ladoDaPartida(l);
  if (!lado) p.push(l.debito.trim() ? 'a partida tem débito e crédito (no múltiplo, cada partida tem um lado só)' : 'a partida está sem conta');
  else if (lado === 'debito') p.push(...problemasDaConta('debito', l.debito, contaDoPlano(plano, l.debito), l.participanteD));
  else p.push(...problemasDaConta('credito', l.credito, contaDoPlano(plano, l.credito), l.participanteC));
  if (lado === 'debito' && l.participanteC.trim()) p.push('a partida de débito não leva participante a crédito');
  if (lado === 'credito' && l.participanteD.trim()) p.push('a partida de crédito não leva participante a débito');
  p.push(...problemasDoValorEDoTexto(l));
  return p;
}

export interface TotaisDoMultiplo { debito: number; credito: number; diferenca: number }

/** Os totais das partidas (centavos): a diferença é débito − crédito. */
export function totaisDoMultiplo(partidas: readonly CamposDoLancamento[]): TotaisDoMultiplo {
  let debito = 0, credito = 0;
  for (const l of partidas) {
    const lado = ladoDaPartida(l);
    if (lado === 'debito') debito += l.valor || 0;
    else if (lado === 'credito') credito += l.valor || 0;
  }
  return { debito, credito, diferenca: debito - credito };
}

/** O que impede o múltiplo inteiro: pelo menos um débito e um crédito, a mesma data, e o total dos débitos igual ao dos créditos. */
export function problemasDoMultiplo(partidas: readonly CamposDoLancamento[]): string[] {
  const p: string[] = [];
  const lados = partidas.map(ladoDaPartida);
  if (!lados.includes('debito') || !lados.includes('credito')) p.push('o múltiplo precisa de pelo menos um débito e um crédito');
  if (new Set(partidas.map(l => l.data)).size > 1) p.push('as partidas do múltiplo estão em datas diferentes');
  const t = totaisDoMultiplo(partidas);
  if (t.diferenca !== 0) p.push('o múltiplo não bate: débitos ' + valorParaTexto(t.debito) + ' × créditos ' + valorParaTexto(t.credito));
  return p;
}

/**
 * Os problemas de cada lançamento da lista, na ordem dela: o simples pelas regras dele; a partida pelas dela e pelas do múltiplo
 * inteiro (o múltiplo que não bate deixa todas as partidas com problema, e nenhuma vai sozinha para o SCI).
 */
export function problemasDosLancamentos(ls: readonly CamposDoLancamento[], plano: PlanoSci): string[][] {
  const doMultiplo = new Map<string, string[]>();
  for (const id of new Set(ls.map(l => l.multiplo).filter((x): x is string => !!x))) {
    doMultiplo.set(id, problemasDoMultiplo(ls.filter(l => l.multiplo === id)));
  }
  const proprios = ls.map(l => (l.multiplo ? problemasDaPartida(l, plano) : problemasDoLancamento(l, plano)));
  // a partida boa de um múltiplo em que outra partida tem problema também não vai
  const outraComProblema = new Set(ls.map((l, i) => (l.multiplo && proprios[i].length ? l.multiplo : '')).filter(Boolean));
  return ls.map((l, i) => {
    if (!l.multiplo) return proprios[i];
    const p = [...proprios[i], ...(doMultiplo.get(l.multiplo) || [])];
    if (!p.length && outraComProblema.has(l.multiplo)) p.push('outra partida deste múltiplo tem problema');
    return p;
  });
}

/**
 * O lançamento digitado do jeito que vai: a conta pelo código reduzido e o histórico pelo número (o apelido vira código), sem
 * espaço sobrando.
 */
export function lancamentoLimpo<T extends CamposDoLancamento>(l: T, plano: PlanoSci): T {
  const codigo = (c: string) => contaDoPlano(plano, c)?.codigo || c.trim();
  return {
    ...l, debito: codigo(l.debito), credito: codigo(l.credito), historico: historicoDoSci(l.historico)?.codigo || l.historico.trim(), complemento: limparComplemento(l.complemento),
    documento: l.documento.trim(), participanteD: l.participanteD.trim(), participanteC: l.participanteC.trim(),
  };
}

/** Débito ↔ crédito (e os participantes junto). */
export const invertido = <T extends CamposDoLancamento>(l: T): T => ({ ...l, debito: l.credito, credito: l.debito, participanteD: l.participanteC, participanteC: l.participanteD });

export interface ResumoDosLancamentos { quantos: number; prontos: number; comProblema: number; total: number; totalPronto: number }

export function resumoDosLancamentos(ls: readonly CamposDoLancamento[], plano: PlanoSci): ResumoDosLancamentos {
  let prontos = 0, total = 0, totalPronto = 0;
  const problemas = problemasDosLancamentos(ls, plano);
  ls.forEach((l, i) => {
    total += l.valor || 0;
    if (!problemas[i].length) { prontos++; totalPronto += l.valor; }
  });
  return { quantos: ls.length, prontos, comProblema: ls.length - prontos, total, totalPronto };
}

/** Os lançamentos na planilha do gerador do SCI (planilhaDoSci): os prontos vão para Importar, os outros para Conferir. */
export function lancamentosDoShaderParaOSci(ls: readonly CamposDoLancamento[], plano: PlanoSci, cnpjEmpresa: string): LancamentoSci[] {
  const cnpjOk = cnpjValido(cnpjEmpresa) || cpfValido(cnpjEmpresa);
  const todos = problemasDosLancamentos(ls, plano);
  // a partida do múltiplo vai com um lado só (como a exportação do SCI): as partidas seguidas, na mesma data
  return ls.map((l, i) => {
    const problemas = todos[i];
    if (!cnpjOk) problemas.push('CNPJ da empresa inválido');
    return {
      data: l.data, debito: l.debito, credito: l.credito, valor: l.valor, historico: l.historico, complemento: limparComplemento(l.complemento),
      documento: l.documento, lote: '', cnpjEmpresa: documentoComMascara(cnpjEmpresa), participanteD: l.participanteD, participanteC: l.participanteC,
      nomeD: contaDoPlano(plano, l.debito)?.nome || '', nomeC: contaDoPlano(plano, l.credito)?.nome || '', origem: 'minimum', problemas,
    };
  });
}

// ------------------------------------------------------------------------------------------------ copiar e colar
/** As colunas do copiar e colar (a ordem da tabela da tela). */
export const COLUNAS_DO_COPIAR = ['Data', 'Débito', 'Crédito', 'Valor', 'Histórico', 'Complemento', 'Documento', 'Participante D', 'Participante C'] as const;

const celula = (s: string) => s.replace(/[\t\r\n]+/g, ' ');

/** Os lançamentos em texto com tabulação (cola no Excel, num editor ou de volta aqui), com a linha dos títulos. */
export function textoDosLancamentos(ls: readonly CamposDoLancamento[]): string {
  return [COLUNAS_DO_COPIAR.join('\t'), ...ls.map(l => [
    dataParaTexto(l.data), l.debito, l.credito, l.valor ? valorParaTexto(l.valor) : '', l.historico, l.complemento, l.documento, l.participanteD, l.participanteC,
  ].map(celula).join('\t'))].join('\r\n');
}

/**
 * O texto colado em lançamentos: uma linha por lançamento, as colunas na ordem da tabela (Data, Débito, Crédito, Valor,
 * Histórico, Complemento, Documento, Participante D, Participante C), separadas por tabulação (do Excel) ou por ";". A linha
 * dos títulos e as linhas vazias ficam de fora. O que não der para ler fica vazio (e aparece como problema na tabela).
 */
export function lancamentosDoTexto(texto: string, anoPadrao: number): CamposDoLancamento[] {
  const linhas = texto.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim());
  const sep = linhas.some(l => l.includes('\t')) ? '\t' : ';';
  return linhas
    .map(l => l.split(sep).map(c => c.trim()))
    .filter(c => !/^data$/i.test(c[0] || ''))
    .map(c => {
      const valor = valorDoTexto(c[3] || '');
      return {
        data: dataDoTexto(c[0] || '', anoPadrao), debito: c[1] || '', credito: c[2] || '', valor: isNaN(valor) ? 0 : Math.abs(valor),
        historico: c[4] || '', complemento: c[5] || '', documento: c[6] || '',
        participanteD: c[7] || '', participanteC: c[8] || '',
      };
    });
}

// ------------------------------------------------------------------------------------------- do Extratudo para os Lançamentos
/**
 * Uma linha do extrato conciliada no Extratudo (o Lançatudo dentro do minimum; 25/11/2026: "tudo que puder deixar integrado entre
 * o tarefas e o minimum"): o que basta para virar lançamento do SCI. O valor em centavos, + entrou, − saiu.
 */
export interface LinhaDoExtratoConciliada {
  chave: string;
  /** aaaa-mm-dd */
  data: string;
  valor: number;
  historico: string;
  /** o número do histórico padrão escolhido na linha (no minimum, o do SCI) */
  codHistorico?: string;
  documento: string;
  /** a contrapartida (null = sem conta: não vai) */
  conta: string | null;
  contaDoBanco: string;
}

/** O id do lançamento que veio de uma linha do extrato: o mesmo a cada envio, para a linha não entrar duas vezes. */
export const idDoExtrato = (banco: string, chave: string) => 'extrato|' + banco + '|' + chave;

/**
 * As linhas conciliadas do extrato viram lançamentos simples do SCI: o que entrou debita o banco e credita a contrapartida; o
 * que saiu, ao contrário. O histórico do SCI é o número do histórico padrão escolhido na linha; o texto do banco vai no
 * complemento. Devolve só as novas: as que já estão entre os lançamentos (pelo id) não voltam. Quem chama confere a norma.
 */
export function lancamentosDoExtrato(banco: string, linhas: readonly LinhaDoExtratoConciliada[], existentes: readonly LancamentoDoShader[]): LancamentoDoShader[] {
  const ja = new Set(existentes.map(l => l.id));
  const novos: LancamentoDoShader[] = [];
  for (const l of linhas) {
    if (!l.conta || !l.contaDoBanco.trim() || !l.valor) continue;
    const id = idDoExtrato(banco, l.chave);
    if (ja.has(id)) continue;
    ja.add(id);
    const entrou = l.valor > 0;
    novos.push({
      id, data: l.data, debito: entrou ? l.contaDoBanco : l.conta, credito: entrou ? l.conta : l.contaDoBanco, valor: Math.abs(l.valor),
      historico: (l.codHistorico || '').trim(), complemento: l.historico.trim(), documento: l.documento || '', participanteD: '', participanteC: '',
    });
  }
  return novos;
}
