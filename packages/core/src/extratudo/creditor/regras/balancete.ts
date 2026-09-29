// As contas do Creditor a partir do balancete da empresa (o mesmo que a Conferência guarda no banco).
// Pedido do Vitor (2026-09-29): cada empresa já vem com a conta banco, a de juros e a de descontos
// sugeridas pelo balancete; a pessoa confirma ou troca, e isso fica salvo na empresa. Quando o
// balancete é atualizado, os nomes (e as sugestões) acompanham, e o que foi salvo é conferido contra ele.
import { nomeNorm } from '../../../formatos';
import { CONTAS_PADRAO, type ContasCreditor } from '../tipos';

/** As três contas do layout que vêm do balancete (os históricos não estão nele). */
export type ContaDoLayout = 'banco' | 'juros' | 'desconto';
export const CONTAS_DO_LAYOUT: readonly ContaDoLayout[] = ['banco', 'juros', 'desconto'];

/** Uma conta do plano da empresa, do jeito que o Creditor precisa. */
export interface ContaDoBalancete {
  codigo: string;
  nome: string;
  /** Ativo, Passivo, Despesa, Receita… (não vem quando só sobrou o plano) */
  grupo?: string;
  sintetica?: boolean;
}

/**
 * O balancete como o Creditor o vê:
 * - "balancete": importado na Conferência e ainda guardado;
 * - "plano": o balancete foi apagado ao sair da Conferência, mas a impressão digital dele (código e
 *   nome de cada conta) fica guardada, e basta para achar as contas;
 * - "nenhum": a empresa nunca teve balancete importado.
 */
export interface BalanceteDaEmpresa {
  origem: 'balancete' | 'plano' | 'nenhum';
  contas: ContaDoBalancete[];
  /** quando o balancete foi importado (ISO), se o banco souber */
  em?: string;
}

export const SEM_BALANCETE: BalanceteDaEmpresa = { origem: 'nenhum', contas: [] };

const texto = (v: unknown) => (v == null ? '' : String(v).trim());

/**
 * Lê o documento da empresa na Conferência (empresas/{slug}). Só usa `contas`, `balanceteAssinatura`
 * e `balanceteAssinaturaTs`; o resto do documento não interessa ao Creditor (e nunca é gravado por ele).
 */
export function balanceteDoDocumento(doc: Record<string, unknown> | null | undefined): BalanceteDaEmpresa {
  if (!doc) return SEM_BALANCETE;
  const em = texto(doc.balanceteAssinaturaTs) || undefined;
  if (Array.isArray(doc.contas) && doc.contas.length) {
    const contas = (doc.contas as Record<string, unknown>[])
      .map(c => ({ codigo: texto(c?.codigo), nome: texto(c?.nome), grupo: texto(c?.grupo) || undefined, sintetica: c?.sintetica === true }))
      .filter(c => c.codigo);
    if (contas.length) return { origem: 'balancete', contas, em };
  }
  const plano = doc.balanceteAssinatura;
  if (plano && typeof plano === 'object') {
    const contas = Object.entries(plano as Record<string, unknown>)
      .map(([codigo, nome]) => ({ codigo: texto(codigo), nome: texto(nome).toUpperCase() }))
      .filter(c => c.codigo);
    if (contas.length) return { origem: 'plano', contas, em };
  }
  return SEM_BALANCETE;
}

/** O que fica salvo da empresa no Creditor: o que a pessoa confirmou ou trocou. */
export interface ConfigCreditor {
  contas: Partial<ContasCreditor>;
  /** o nome da conta no balancete quando foi escolhida (para avisar se mudar) */
  nomes: Partial<Record<ContaDoLayout, string>>;
  atualizadoEm?: string;
}

export const CONFIG_VAZIA: ConfigCreditor = { contas: {}, nomes: {} };

/** O documento guardado no banco, conferido (campo estranho ou vazio fica de fora). */
export function configDoDocumento(doc: Record<string, unknown> | null | undefined): ConfigCreditor {
  if (!doc) return CONFIG_VAZIA;
  const contas: Partial<ContasCreditor> = {};
  const nomes: Partial<Record<ContaDoLayout, string>> = {};
  const c = (doc.contas || {}) as Record<string, unknown>;
  const n = (doc.nomes || {}) as Record<string, unknown>;
  for (const k of Object.keys(CONTAS_PADRAO) as (keyof ContasCreditor)[]) if (texto(c[k])) contas[k] = texto(c[k]);
  for (const k of CONTAS_DO_LAYOUT) if (texto(n[k])) nomes[k] = texto(n[k]);
  return { contas, nomes, atualizadoEm: texto(doc.atualizadoEm) || undefined };
}

// ─── sugestão pelo nome ─────────────────────────────────────────────────────

interface Regra {
  /** em ordem de preferência: a primeira que achar conta vale */
  quer: RegExp[];
  evita: RegExp;
  /** o grupo da conta, quando o balancete diz */
  grupo: string;
}

const REGRAS: Record<ContaDoLayout, Regra> = {
  // o relatório de liquidação é do Sicoob
  banco: { quer: [/\bsicoob\b/], evita: /\b(aplicac|capital|cotas?|emprestimo|financiamento|tarifas?|juros|consorcio)/, grupo: 'Ativo' },
  juros: { quer: [/\bjuros (recebidos|ativos|auferidos|s recebimento)/, /\bjuros\b/], evita: /\b(pagos|passivos|incorridos|a pagar|a apropriar|a transcorrer|sobre emprestimo)/, grupo: 'Receita' },
  desconto: { quer: [/\bdescontos? (financeiros? )?concedidos?\b/, /\bdescontos?\b/], evita: /\b(obtidos?|a apropriar|duplicatas descontadas|incondicionais)/, grupo: 'Despesa' },
};

/** A conta do balancete que parece ser a pedida (null = nenhuma). Conta sintética nunca entra. */
export function sugerirConta(campo: ContaDoLayout, contas: readonly ContaDoBalancete[]): ContaDoBalancete | null {
  const r = REGRAS[campo];
  const candidatas = contas.filter(c => !c.sintetica && (!c.grupo || c.grupo === r.grupo) && !r.evita.test(nomeNorm(c.nome)));
  for (const q of r.quer) {
    const achou = candidatas.find(c => q.test(nomeNorm(c.nome)));
    if (achou) return achou;
  }
  return null;
}

// ─── as contas que valem ────────────────────────────────────────────────────

/** De onde veio a conta: salva na empresa, sugerida pelo balancete, o padrão do prompt, ou falta escolher. */
export type OrigemConta = 'salva' | 'sugerida' | 'padrao' | 'falta';

export interface ContaResolvida {
  codigo: string;
  /** o nome no balancete (null = não está nele, ou não há balancete) */
  nome: string | null;
  origem: OrigemConta;
  /** o que a pessoa precisa saber (mudou de nome, sumiu do balancete…) */
  aviso?: string;
  /** true = não dá para gerar o arquivo com ela */
  bloqueia: boolean;
}

export interface ContasResolvidas {
  contas: ContasCreditor;
  detalhe: Record<ContaDoLayout, ContaResolvida>;
}

const ROTULO: Record<ContaDoLayout, string> = { banco: 'conta banco', juros: 'conta de juros', desconto: 'conta de descontos' };

function resolverUma(campo: ContaDoLayout, bal: BalanceteDaEmpresa, cfg: ConfigCreditor): ContaResolvida {
  const salva = cfg.contas[campo];
  const noBalancete = (codigo: string) => bal.contas.find(c => c.codigo === codigo) || null;
  if (salva) {
    if (bal.origem === 'nenhum') return { codigo: salva, nome: cfg.nomes[campo] || null, origem: 'salva', bloqueia: false };
    const c = noBalancete(salva);
    if (!c) {
      return {
        codigo: salva, nome: null, origem: 'salva', bloqueia: true,
        aviso: 'A ' + ROTULO[campo] + ' salva (' + salva + (cfg.nomes[campo] ? ' – ' + cfg.nomes[campo] : '') + ') não está no balancete atual. Escolha outra.',
      };
    }
    const antes = cfg.nomes[campo];
    const aviso = antes && nomeNorm(antes) !== nomeNorm(c.nome) ? 'Mudou de nome no balancete: era "' + antes + '".' : undefined;
    return { codigo: salva, nome: c.nome, origem: 'salva', aviso, bloqueia: false };
  }
  if (bal.origem === 'nenhum') return { codigo: CONTAS_PADRAO[campo], nome: null, origem: 'padrao', bloqueia: false };
  const s = sugerirConta(campo, bal.contas);
  if (s) return { codigo: s.codigo, nome: s.nome, origem: 'sugerida', bloqueia: false };
  return { codigo: '', nome: null, origem: 'falta', bloqueia: true, aviso: 'Não achei a ' + ROTULO[campo] + ' no balancete. Escolha na lista.' };
}

/**
 * As contas que valem para a empresa: a salva (conferida contra o balancete atual), senão a sugerida
 * pelo balancete, senão (sem balancete nenhum) o padrão do prompt. Os históricos: o salvo ou o padrão.
 */
export function resolverContas(bal: BalanceteDaEmpresa, cfg: ConfigCreditor): ContasResolvidas {
  const detalhe = {
    banco: resolverUma('banco', bal, cfg),
    juros: resolverUma('juros', bal, cfg),
    desconto: resolverUma('desconto', bal, cfg),
  };
  const contas: ContasCreditor = {
    banco: detalhe.banco.codigo, juros: detalhe.juros.codigo, desconto: detalhe.desconto.codigo,
    histPrincipal: cfg.contas.histPrincipal || CONTAS_PADRAO.histPrincipal,
    histJuros: cfg.contas.histJuros || CONTAS_PADRAO.histJuros,
    histDesconto: cfg.contas.histDesconto || CONTAS_PADRAO.histDesconto,
  };
  return { contas, detalhe };
}

/** Grava uma conta (ou histórico) escolhida pela pessoa: guarda o código e, se for do balancete, o nome dele. */
export function escolherConta(cfg: ConfigCreditor, campo: keyof ContasCreditor, codigo: string, bal: BalanceteDaEmpresa): ConfigCreditor {
  const v = codigo.trim();
  const contas = { ...cfg.contas };
  const nomes = { ...cfg.nomes };
  if (v) contas[campo] = v; else delete contas[campo];
  if ((CONTAS_DO_LAYOUT as readonly string[]).includes(campo)) {
    const k = campo as ContaDoLayout;
    const c = v ? bal.contas.find(x => x.codigo === v) : null;
    if (c) nomes[k] = c.nome; else delete nomes[k];
  }
  return { ...cfg, contas, nomes };
}

/** Confirma tudo o que está valendo (as sugeridas passam a ser salvas). Usado quando o arquivo é baixado. */
export function confirmarContas(cfg: ConfigCreditor, r: ContasResolvidas): ConfigCreditor {
  const contas: Partial<ContasCreditor> = { ...cfg.contas };
  const nomes = { ...cfg.nomes };
  for (const k of CONTAS_DO_LAYOUT) {
    const d = r.detalhe[k];
    if (d.origem === 'sugerida') contas[k] = d.codigo;
    // nome novo no balancete: baixar o arquivo com ela é a confirmação, e o aviso some
    if ((d.origem === 'sugerida' || d.origem === 'salva') && d.nome) nomes[k] = d.nome;
  }
  return { ...cfg, contas, nomes };
}

/** A configuração mudou? (para não gravar à toa) */
export function mesmaConfig(a: ConfigCreditor, b: ConfigCreditor): boolean {
  const igual = (x: object, y: object) => {
    const [a1, b1] = [x as Record<string, string | undefined>, y as Record<string, string | undefined>];
    return [...new Set([...Object.keys(a1), ...Object.keys(b1)])].every(k => (a1[k] || '') === (b1[k] || ''));
  };
  return igual(a.contas, b.contas) && igual(a.nomes, b.nomes);
}
