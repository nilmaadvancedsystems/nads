// O balancete do SCI de volta no nads (23/11/2026, docs/sci item 1): no SCI o tratamento é só pelo balancete ("fornecedor
// devedor, nads importou a mais, exclui por lá"); aqui o nads lê o balancete exportado (Relatórios › Balancete › Exportar CSV
// com cabeçalho, FAQ 5378) e aponta onde olhar: as contas com o saldo contrário à natureza e a diferença entre o que o nads
// mandou e o movimento que está no SCI.
// O leitor procura sozinho a linha de títulos (classificação, código, descrição, saldo anterior, débito, crédito, saldo atual)
// e aceita o valor com D/C no fim ou com sinal. A CONFIRMAR com o arquivo real exportado do SCI.
import { lerPlanilhaDoPlano } from '../../empresas/cadastro/plano';
import type { LancamentoSci } from '../tipos';
import { classificacaoNormal } from './dePara';
import { semAcento, type PlanoSci } from './plano';

export interface ContaDoBalanceteSci {
  classificacao: string;
  codigo: string;
  nome: string;
  /** sem contas filhas no balancete */
  analitica: boolean;
  /** centavos; + = devedor, − = credor */
  anterior: number;
  debito: number;
  credito: number;
  atual: number;
}

export interface BalanceteSci {
  empresa: string;
  cnpj: string;
  contas: ContaDoBalanceteSci[];
}

export type LeituraDoBalanceteSci = { balancete: BalanceteSci; erro: null } | { balancete: null; erro: string };

type Coluna = 'classificacao' | 'codigo' | 'nome' | 'anterior' | 'debito' | 'credito' | 'atual';

const norm = (s: unknown) => semAcento(String(s ?? '')).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Qual coluna é qual, pelo título. null se a linha não for a de títulos. */
function colunasDoTitulo(linha: readonly string[]): Partial<Record<Coluna, number>> | null {
  const c: Partial<Record<Coluna, number>> = {};
  linha.forEach((t, i) => {
    const n = norm(t);
    if (!n) return;
    if (/classifica/.test(n) && c.classificacao == null) c.classificacao = i;
    else if (/^(codigo|cod|reduzido|conta reduzida|cod reduzido|codigo reduzido)$/.test(n) && c.codigo == null) c.codigo = i;
    else if (/(descricao|^nome|nome da conta|^conta$)/.test(n) && c.nome == null) c.nome = i;
    else if (/anterior/.test(n) && c.anterior == null) c.anterior = i;
    else if (/^(debito|debitos)/.test(n) && c.debito == null) c.debito = i;
    else if (/^(credito|creditos)/.test(n) && c.credito == null) c.credito = i;
    else if (/(atual|saldo final|^saldo$)/.test(n) && c.atual == null) c.atual = i;
  });
  return c.classificacao != null && c.debito != null && c.credito != null && c.atual != null ? c : null;
}

/**
 * O valor do balancete em centavos, com o sinal da natureza: "1.234,56D" ou "1.234,56 D" = devedor (+), "C" = credor (−),
 * "-1.234,56" = credor. Sem D/C e sem sinal, positivo. NaN se não for número.
 */
export function valorDoBalancete(v: unknown, dcAoLado = ''): number {
  if (typeof v === 'number') return Math.round(v * 100);
  let s = String(v ?? '').trim().toUpperCase();
  if (!s) return 0;
  let dc = /([DC])\s*$/.exec(s)?.[1] || dcAoLado.trim().toUpperCase().slice(0, 1);
  s = s.replace(/[DC]\s*$/, '').replace(/[R$\s]/g, '');
  const negativo = /^-|^\(.*\)$/.test(s);
  s = s.replace(/[-()]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  if (!isFinite(n)) return NaN;
  if (!dc) dc = negativo ? 'C' : 'D';
  return Math.round(n * 100) * (dc === 'C' ? -1 : 1);
}

/** Lê o balancete exportado do SCI (CSV ou planilha). */
export function lerBalanceteDoSci(bytes: Uint8Array, nome = 'balancete.csv'): LeituraDoBalanceteSci {
  const linhas = lerPlanilhaDoPlano(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, nome);
  const iTitulo = linhas.findIndex(l => colunasDoTitulo(l));
  if (iTitulo < 0) return { balancete: null, erro: 'Não achei a linha de títulos (Classificação, Débito, Crédito, Saldo atual). Exporte o balancete do SCI em CSV com cabeçalho.' };
  const col = colunasDoTitulo(linhas[iTitulo])!;
  const cabeca = linhas.slice(0, iTitulo).flat().map(s => String(s).trim()).filter(Boolean);
  const cnpj = cabeca.join(' ').match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/)?.[0] || '';
  const empresa = cabeca.find(s => /[a-z]/i.test(s) && !/\d{2}\/\d{2}\/\d{4}/.test(s) && !s.includes(cnpj || '§')) || '';
  // a coluna logo depois do saldo, quando o D/C vem separado
  const dcDe = (l: readonly string[], i: number | undefined) => (i != null && /^[DC]$/i.test(String(l[i + 1] ?? '').trim()) ? String(l[i + 1]) : '');
  const contas: ContaDoBalanceteSci[] = [];
  for (const l of linhas.slice(iTitulo + 1)) {
    const classificacao = String(l[col.classificacao!] ?? '').trim();
    if (!/^\d+([.-]\d+)*$/.test(classificacao)) continue;
    const pega = (k: Coluna) => (col[k] != null ? l[col[k]!] : '');
    const debito = Math.abs(valorDoBalancete(pega('debito')));
    const credito = Math.abs(valorDoBalancete(pega('credito')));
    const anterior = valorDoBalancete(pega('anterior'), dcDe(l, col.anterior));
    const atual = valorDoBalancete(pega('atual'), dcDe(l, col.atual));
    if ([debito, credito, anterior, atual].some(n => isNaN(n))) continue;
    contas.push({ classificacao, codigo: String(pega('codigo') ?? '').trim(), nome: String(pega('nome') ?? '').trim(), analitica: true, anterior, debito, credito, atual });
  }
  if (!contas.length) return { balancete: null, erro: 'Achei os títulos, mas nenhuma conta com valor.' };
  // sintética = tem alguma conta abaixo (o balancete pode pular níveis: todos os prefixos contam)
  const comFilhas = new Set<string>();
  for (const c of contas) {
    const p = classificacaoNormal(c.classificacao).split('.');
    for (let n = 1; n < p.length; n++) comFilhas.add(p.slice(0, n).join('.'));
  }
  for (const c of contas) c.analitica = !comFilhas.has(classificacaoNormal(c.classificacao));
  return { balancete: { empresa, cnpj, contas }, erro: null };
}

/** A natureza pelo grupo: 1 ativo e 4 custos/despesas são devedoras; 2 passivo/PL e 3 receitas, credoras. */
export function naturezaDaConta(classificacao: string): 'D' | 'C' | null {
  const g = classificacaoNormal(classificacao).split('.')[0];
  return g === '1' || g === '4' ? 'D' : g === '2' || g === '3' ? 'C' : null;
}

/** As redutoras (depreciação acumulada, "(-)", provisões para perdas) têm a natureza ao contrário de propósito. */
const ehRedutora = (nome: string) => /^\s*\(-\)|deprecia|amortiza|exaust|provisao para perda|(perdas|creditos) de liquidacao duvidosa/.test(semAcento(nome));

/** As analíticas com o saldo contrário à natureza (ex.: fornecedor devedor, cliente credor, caixa credor). */
export function saldosInvertidos(b: BalanceteSci): ContaDoBalanceteSci[] {
  return b.contas.filter(c => {
    if (!c.analitica || !c.atual || ehRedutora(c.nome)) return false;
    const n = naturezaDaConta(c.classificacao);
    return (n === 'D' && c.atual < 0) || (n === 'C' && c.atual > 0);
  });
}

export interface ConferenciaDaConta {
  classificacao: string;
  codigo: string;
  nome: string;
  /** centavos que o nads mandou para a conta */
  nadsDebito: number;
  nadsCredito: number;
  /** o movimento da conta no balancete do SCI */
  sciDebito: number;
  sciCredito: number;
  /** 'faltou' = o SCI tem menos que o nads mandou (não importou?); 'a mais' = o SCI tem mais (outra origem ou importado duas vezes) */
  situacao: 'bate' | 'faltou' | 'a mais' | 'fora do balancete';
}

/**
 * O que o nads mandou × o movimento no SCI, conta a conta (só as contas que o nads tocou). Casa a conta pelo código reduzido
 * do balancete; sem ele, pela classificação do plano padrão.
 */
export function conferirComOBalancete(lancamentos: readonly LancamentoSci[], b: BalanceteSci, plano?: PlanoSci | null): ConferenciaDaConta[] {
  const porCodigo = new Map(b.contas.filter(c => c.codigo).map(c => [c.codigo, c]));
  const porClassificacao = new Map(b.contas.map(c => [classificacaoNormal(c.classificacao), c]));
  const achar = (codigo: string) => {
    const pelo = porCodigo.get(codigo);
    if (pelo) return pelo;
    const daConta = plano?.porCodigo.get(codigo)?.classificacao ?? (codigo.includes('.') ? codigo : '');
    return daConta ? porClassificacao.get(classificacaoNormal(daConta)) : undefined;
  };
  const somas = new Map<string, { d: number; c: number }>();
  for (const l of lancamentos) {
    if (l.problemas.length) continue;
    for (const [conta, lado] of [[l.debito, 'd'], [l.credito, 'c']] as const) {
      const s = somas.get(conta) || { d: 0, c: 0 };
      s[lado] += l.valor;
      somas.set(conta, s);
    }
  }
  return [...somas].map(([codigo, s]) => {
    const c = achar(codigo);
    const base = { codigo, nadsDebito: s.d, nadsCredito: s.c };
    if (!c) return { ...base, classificacao: plano?.porCodigo.get(codigo)?.classificacao || '', nome: plano?.porCodigo.get(codigo)?.nome || '', sciDebito: 0, sciCredito: 0, situacao: 'fora do balancete' as const };
    const situacao = c.debito < s.d || c.credito < s.c ? 'faltou' as const : c.debito > s.d || c.credito > s.c ? 'a mais' as const : 'bate' as const;
    return { ...base, classificacao: c.classificacao, nome: c.nome, sciDebito: c.debito, sciCredito: c.credito, situacao };
  }).sort((a, b) => a.classificacao.localeCompare(b.classificacao));
}
