// O extrato do banco no Financeiro (23/10/2026: "a parte de conciliação não vai existir, ela vai se tornar um importador
// de extrato que vai trazer os dados e informações para o dashboard inicial"; guardado à parte do Caixa, para não
// duplicar o que já foi lançado nele). Os lançamentos lidos do extrato (pelo Extrator) viram linhas do banco com um id
// fixo (a conta bancária, a data, o valor, o histórico e a ordem entre os iguais): importar o mesmo extrato de novo não
// duplica. O saldo do banco é o do fim do último extrato de cada conta bancária. Puro: sem banco e sem tela.
// 30/10/2026: o id e o saldo eram pelo nome do banco, e a PJ e a PF no mesmo banco (as duas no Sicoob) colidiam — a linha
// igual da outra conta não gravava e os saldos das duas se juntavam. Agora são pela conta bancária do Cadastro; a linha
// gravada com o id de antes (pelo nome) continua reconhecida como "já estava" (separarJaImportadas), para não duplicar.
import type { TipoDeLancamento } from './index';

/** uma linha do extrato do banco (financeiroBanco/{id}) */
export interface LancamentoDoBanco {
  id: string;
  /** AAAA-MM-DD */
  data: string;
  historico: string;
  /** sempre positivo; quem diz se entra ou sai é o tipo */
  valor: number;
  tipo: TipoDeLancamento;
  /** o nome do banco ("Sicoob", "Efí"…) */
  banco: string;
  /** o id da importação que trouxe a linha */
  importacao: string;
  /** a conta bancária do Cadastro (Nilma Contabilidade › Contas bancárias) e a do plano de contas do financeiro */
  contaBancaria?: string;
  conta?: string;
  /** o id de antes de 30/10/2026 (pelo nome do banco): só para reconhecer a linha já gravada com ele; não se grava */
  idAntigo?: string;
}

/** uma importação de extrato (financeiroBancoImportacoes/{id}) */
export interface ImportacaoDeExtrato {
  id: string;
  banco: string;
  /** o logo do banco (a marca do Cadastro: 'sicoob', 'efi'…) */
  marca?: string;
  /** a conta bancária do Cadastro e a do plano de contas do financeiro */
  contaBancaria?: string;
  conta?: string;
  /** "Ag. 3144 · C/C 12345-6" */
  rotuloDaConta?: string;
  arquivo: string;
  /** o período do extrato (AAAA-MM-DD) */
  de: string;
  ate: string;
  quantos: number;
  entradas: number;
  saidas: number;
  /** o saldo no fim do extrato, quando ele traz (a coluna Saldo, a linha "SALDO ANTERIOR" ou o OFX) */
  saldoFinal?: number;
  importadoEm: string;
  importadoPor: string;
}

/** o que o Extrator lê (valor em centavos, + entra, − sai) */
export interface LinhaLida { data: string; valor: number; historico: string }

const emReais = (centavos: number) => Math.round(Math.abs(centavos)) / 100;

/** um hash curto e estável do texto (o id da linha) */
function hash(s: string): string {
  let h = 5381, g = 52711;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h = (h * 33) ^ c; g = (g * 31) ^ c; }
  return (h >>> 0).toString(36) + (g >>> 0).toString(36);
}

const chaveDoBanco = (banco: string) => banco.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'banco';

/**
 * As linhas do extrato prontas para guardar: o id é fixo (a conta bancária, data, valor, histórico e a ordem entre as
 * linhas iguais), então importar o mesmo extrato de novo regrava as mesmas linhas. Linha sem data ou com valor zero fica
 * de fora. Sem a conta bancária, o id é pelo nome do banco (o de antes); com ela, a linha leva também o id antigo.
 */
export function linhasDoExtrato(lidas: readonly LinhaLida[], banco: string, importacao: string, contaBancaria?: string): LancamentoDoBanco[] {
  const vistos = new Map<string, number>();
  const nome = banco.trim() || 'Banco';
  const daConta = contaBancaria?.trim() || '';
  const out: LancamentoDoBanco[] = [];
  for (const l of lidas) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(l.data) || !Math.round(l.valor)) continue;
    const historico = l.historico.replace(/\s+/g, ' ').trim();
    const resto = l.data + '|' + Math.round(l.valor) + '|' + historico.toUpperCase();
    const n = (vistos.get(resto) || 0) + 1;
    vistos.set(resto, n);
    const antigo = 'b_' + hash(chaveDoBanco(nome) + '|' + resto + '|' + n);
    out.push({
      id: daConta ? 'b_' + hash('conta:' + daConta + '|' + resto + '|' + n) : antigo, data: l.data, historico, valor: emReais(l.valor), tipo: l.valor < 0 ? 'S' : 'E',
      banco: nome, importacao, ...(daConta ? { contaBancaria: daConta, idAntigo: antigo } : {}),
    });
  }
  return out;
}

/**
 * As linhas que já estão gravadas (repetidas) e as que faltam (novas). Já está: o mesmo id, ou o id antigo (pelo nome do
 * banco, de antes de 30/10/2026) gravado na mesma conta bancária — ou numa linha de antes de guardar a conta. O id antigo
 * gravado na outra conta do mesmo banco não conta: era a colisão da PJ com a PF.
 */
export function separarJaImportadas(linhas: readonly LancamentoDoBanco[], gravadas: readonly Pick<LancamentoDoBanco, 'id' | 'contaBancaria'>[]): { novas: LancamentoDoBanco[]; repetidas: LancamentoDoBanco[] } {
  const porId = new Map(gravadas.map(g => [g.id, g]));
  const novas: LancamentoDoBanco[] = [], repetidas: LancamentoDoBanco[] = [];
  for (const l of linhas) {
    const antiga = l.idAntigo ? porId.get(l.idAntigo) : undefined;
    const ja = porId.has(l.id) || (!!antiga && (!antiga.contaBancaria || antiga.contaBancaria === l.contaBancaria));
    (ja ? repetidas : novas).push(l);
  }
  return { novas, repetidas };
}

/** o saldo no fim do extrato: o último saldo do dia impresso, ou o saldo anterior mais o movimento; sem nada, undefined */
export function saldoFinalDoExtrato(lidas: readonly LinhaLida[], saldoAnterior?: number, saldosDoDia?: readonly { data: string; saldo: number }[]): number | undefined {
  if (saldosDoDia?.length) {
    const ultimo = [...saldosDoDia].sort((a, b) => a.data.localeCompare(b.data)).at(-1)!;
    return Math.round(ultimo.saldo) / 100;
  }
  if (saldoAnterior == null) return undefined;
  return Math.round(saldoAnterior + lidas.reduce((s, l) => s + Math.round(l.valor), 0)) / 100;
}

/** o resumo de uma importação (o período, quantas, entradas e saídas) */
export function resumoDoExtrato(linhas: readonly LancamentoDoBanco[]): { de: string; ate: string; quantos: number; entradas: number; saidas: number } {
  const datas = linhas.map(l => l.data).sort();
  const soma = (t: TipoDeLancamento) => Math.round(linhas.filter(l => l.tipo === t).reduce((s, l) => s + Math.round(l.valor * 100), 0)) / 100;
  return { de: datas[0] || '', ate: datas.at(-1) || '', quantos: linhas.length, entradas: soma('E'), saidas: soma('S') };
}

/** o saldo de uma conta bancária no painel; chave = a conta bancária do Cadastro (ou o nome do banco, nas de antes) */
export interface SaldoNoBanco { chave: string; banco: string; conta?: string; marca?: string; saldo: number; ate: string }

/**
 * O saldo de cada conta bancária: o do extrato que vai mais longe (com saldo). Pela conta bancária (a PJ e a PF no mesmo
 * banco ficam separadas); a importação de antes de guardar a conta vai pelo nome do banco. Em ordem de banco e de conta.
 */
export function saldosNoBanco(importacoes: readonly ImportacaoDeExtrato[]): SaldoNoBanco[] {
  const porConta = new Map<string, ImportacaoDeExtrato>();
  const chave = (i: ImportacaoDeExtrato) => i.contaBancaria || 'banco:' + i.banco;
  for (const i of importacoes) {
    if (i.saldoFinal == null) continue;
    const atual = porConta.get(chave(i));
    if (!atual || i.ate > atual.ate || (i.ate === atual.ate && i.importadoEm > atual.importadoEm)) porConta.set(chave(i), i);
  }
  return [...porConta.values()]
    .map((i): SaldoNoBanco => ({ chave: chave(i), banco: i.banco, ...(i.rotuloDaConta ? { conta: i.rotuloDaConta } : {}), ...(i.marca ? { marca: i.marca } : {}), saldo: i.saldoFinal!, ate: i.ate }))
    .sort((a, b) => a.banco.localeCompare(b.banco, 'pt-BR') || (a.conta || '').localeCompare(b.conta || '', 'pt-BR'));
}

// ─── de quem é o extrato (23/10/2026: "quero que ele identifique o banco que foi importado pelo pdf/conta, caso não seja da
// nilma contabilidade (pj) ou nilma dias (pf) não importe, se possível um cadastro de conta bancária no cadastro de
// empresas") ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** a empresa do escritório no Cadastro (as contas bancárias de lá valem para o financeiro, a PJ e a PF da Nilma) */
export const EMPRESA_DO_ESCRITORIO = { codigo: 284, nome: 'NILMA CONTABILIDADE LTDA' } as const;
/** o CNPJ do escritório, só os números */
const CNPJ_DO_ESCRITORIO = '27872981';

/** os nomes no texto do extrato que mostram cada banco (o nome, o antigo e o número do banco no cabeçalho) */
const MARCAS_NO_TEXTO: { marca: string; padrao: RegExp }[] = [
  { marca: 'sicoob', padrao: /\bSICOOB\b|\bBANCOOB\b|\bSISTEMA\s+DE\s+COOPERATIVAS\s+DE\s+CR[EÉ]DITO\b/i },
  { marca: 'efi', padrao: /\bEF[IÍ]\s*(S\.?\s*A|PAY|BANK)?\b|\bGERENCIANET\b/i },
];

/** uma conta bancária do Cadastro, só o que a identificação usa */
export interface ContaParaIdentificar { id: string; marca: string; nome: string; agencia?: string; conta?: string; apelido?: string }

export interface ExtratoIdentificado {
  /** o banco que o texto mostra (null = não deu para saber) */
  marca: string | null;
  /** o texto fala da Nilma (o nome ou o CNPJ do escritório); null = sem texto para conferir (planilha, foto) */
  daNilma: boolean | null;
  /** a conta do Cadastro cujo número aparece no texto */
  conta: ContaParaIdentificar | null;
}

const soDigitos = (s: string) => s.replace(/\D+/g, '');
/** o número da conta sem o dígito e sem os zeros da frente (o extrato às vezes mostra 12345-6, às vezes 0012345) */
function nucleoDaConta(conta: string): string {
  const d = soDigitos(conta);
  const semDv = /[-.\s]\s*[0-9xX]$/.test(conta.trim()) && d.length > 1 ? d.slice(0, -1) : d;
  return semDv.replace(/^0+/, '');
}

/**
 * De quem é o extrato, pelo texto dele (o do PDF ou do OFX): o banco (pelo nome), se é da Nilma (o nome NILMA ou o CNPJ do
 * escritório) e qual conta do Cadastro (o número da conta, sem o dígito, aparece no texto; entre as do mesmo banco quando
 * o banco aparece). Sem texto (planilha, foto), tudo null: a tela pede para escolher a conta.
 */
export function identificarExtrato(texto: string, contas: readonly ContaParaIdentificar[]): ExtratoIdentificado {
  const t = texto.replace(/\s+/g, ' ');
  if (!t.trim()) return { marca: null, daNilma: null, conta: null };
  const marca = MARCAS_NO_TEXTO.find(m => m.padrao.test(t))?.marca ?? null;
  const digitos = soDigitos(t);
  const daNilma = /\bNILMA\b/i.test(t) || digitos.includes(CNPJ_DO_ESCRITORIO);
  // os números do texto (cada grupo de dígitos, com ponto, traço ou barra no meio, sem os zeros da frente); os valores
  // em reais (o grupo seguido de vírgula e centavos, 12.345,60) ficam de fora, para não passarem pelo número da conta
  const numeros = new Set((t.match(/\d[\d.\-/]*\d(?![\d.\-/]*,\d)|\d(?!,\d)/g) || []).map(n => soDigitos(n).replace(/^0+/, '')).filter(Boolean));
  const candidatas = contas.filter(c => c.conta && (!marca || c.marca === marca));
  const conta = candidatas.find(c => {
    const n = nucleoDaConta(c.conta!);
    if (n.length < 4) return false;
    const inteiro = soDigitos(c.conta!).replace(/^0+/, '');
    // a conta inteira (com o dígito), só o número (sem o dígito) ou o número com o dígito colado
    return [...numeros].some(x => x === inteiro || x === n);
  }) ?? null;
  return { marca: marca ?? conta?.marca ?? null, daNilma, conta };
}

/**
 * A conta do plano do financeiro para a conta bancária: a que já tem a mesma descrição, ou uma nova no Ativo Circulante
 * (1.1), no próximo código livre (1.1.03, 1.1.04…), sem mexer na 1.1.02 "Bancos Conta Movimento" que já recebe lançamentos.
 * Devolve a que existe (com id) ou a nova (sem id), com o pai.
 */
export function contaDoPlanoParaOBanco(plano: readonly { id: string; codigo: string; descricao: string; tipo: string; nivel: number; pai: string | null; ativo: boolean; movimentavel: boolean }[], descricao: string):
  { existe: true; id: string; codigo: string } | { existe: false; codigo: string; descricao: string; pai: string | null; nivel: number } {
  const igual = plano.find(c => c.descricao.trim().toLowerCase() === descricao.trim().toLowerCase());
  if (igual) return { existe: true, id: igual.id, codigo: igual.codigo };
  const grupo = plano.find(c => c.codigo === '1.1');
  const filhos = plano.filter(c => /^1\.1\.\d+$/.test(c.codigo)).map(c => Number(c.codigo.split('.')[2]));
  const proximo = String((filhos.length ? Math.max(...filhos) : 0) + 1).padStart(2, '0');
  return { existe: false, codigo: '1.1.' + proximo, descricao, pai: grupo?.id ?? null, nivel: 3 };
}

/** "Sicoob C/C 12345-6" (a descrição da conta do plano e o nome na tela) */
export function descricaoDaContaBancaria(c: { nome: string; agencia?: string; conta?: string; apelido?: string }): string {
  return [c.nome, c.conta ? 'C/C ' + c.conta : '', c.apelido ? '(' + c.apelido + ')' : ''].filter(Boolean).join(' ');
}
