// O lote de boletos de honorários (10/11/2026): os PDFs prontos sobem na tela, o nads lê cada um (financeiro.lerBoleto), acha o
// cliente pelo CNPJ/CPF que está no PDF e diz, linha a linha, o que libera ou trava o disparo. O valor e o vencimento são os
// impressos no boleto: o dia cadastrado no contrato só serve para avisar quando os dois não batem (vale o PDF). Puro: sem tela.
import { competenciaBr, type ContratoDeHonorario, type RecebimentoDeHonorario } from './honorarios';

export type StatusDoEnvio = 'fila' | 'enviando' | 'enviado' | 'erro';

export interface EnvioDoBoleto {
  status: StatusDoEnvio;
  para: string[];
  /** ISO: quando foi pedido (na fila) ou quando terminou */
  em: string;
  por: string;
  erro?: string;
}

export interface BoletoDoLote {
  id: string;
  /** AAAA-MM */
  competencia: string;
  /** o nome do PDF */
  arquivo: string;
  /** '' = ainda sem cliente */
  contratoId: string;
  /** como o cliente foi achado: pelo documento, pelo nome, à mão; '' = não achou */
  achadoPor: 'documento' | 'nome' | 'mao' | '';
  /** a linha digitável, só os dígitos ('' = o PDF não foi lido) */
  linha: string;
  valor: number | null;
  /** AAAA-MM-DD */
  vencimento: string | null;
  /** para quem vai; começa com os e-mails do cadastro */
  destinatarios: string[];
  /** tirado do lote: fica à parte e não dispara */
  fora?: boolean;
  envio?: EnvioDoBoleto;
}

export type SituacaoDoBoleto = 'pronto' | 'conferir' | 'pendente' | 'fora' | 'fila' | 'enviando' | 'enviado' | 'erro';

export interface ConferenciaDoBoleto {
  situacao: SituacaoDoBoleto;
  /** o que trava o disparo */
  pendencias: string[];
  /** o que não trava, mas é bom olhar */
  avisos: string[];
  /** entra no disparo */
  podeDisparar: boolean;
}

export const ROTULO_DA_SITUACAO_DO_BOLETO: Record<SituacaoDoBoleto, string> = {
  pronto: 'Pronto', conferir: 'Conferir', pendente: 'Pendente', fora: 'Fora do lote', fila: 'Na fila', enviando: 'Enviando', enviado: 'Enviado', erro: 'Não deu',
};

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
export const emailValido = (e: string) => EMAIL.test(e.trim());

/** Os e-mails digitados, separados por vírgula, ponto e vírgula ou espaço, sem repetir (minúsculos). */
export function separarEmails(texto: string): string[] {
  return [...new Set(texto.split(/[\s,;]+/).map(e => e.trim().toLowerCase()).filter(Boolean))];
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const soDigitos = (s: string) => s.replace(/\D/g, '');

/** O número aparece no texto como um documento inteiro, e não como pedaço de um número maior (a linha digitável). */
function temDocumento(texto: string, doc: string): boolean {
  let i = texto.indexOf(doc);
  while (i >= 0) {
    const antes = texto[i - 1] ?? '', depois = texto[i + doc.length] ?? '';
    if (!/\d/.test(antes) && !/\d/.test(depois)) return true;
    i = texto.indexOf(doc, i + 1);
  }
  return false;
}

/**
 * Os CNPJs e CPFs escritos no boleto (10/11/2026: "puxa pelo cnpj"), só os números, sem repetir: os que vêm depois de
 * "CNPJ" ou "CPF" (o "CNPJ/CPF:" do sacado), com ou sem a pontuação. O número inteiro, nunca um pedaço da linha digitável.
 */
/** a raiz do CNPJ da Nilma Contabilidade: o documento do beneficiário não é o do cliente */
export const CNPJ_RAIZ_DO_ESCRITORIO = '27872981';

export function documentosDoBoleto(texto: string): string[] {
  const achados = new Set<string>();
  // a palavra, até 12 caracteres que não são número ("/CPF: ", " Nº "), e o número com a pontuação
  const re = /(?:CNPJ|CPF)[^0-9]{0,12}([0-9][0-9./\s-]{9,22}[0-9])/gi;
  for (const m of (texto || '').matchAll(re)) {
    const d = soDigitos(m[1]);
    // o número seguido de outro (o CEP depois do CPF): fica o CNPJ ou o CPF da frente
    const cnpjNaFrente = /^\d{2}\.?\d{3}\.?\d{3}\s*\/\s*\d{4}/.test(m[1]);
    const doc = d.length === 14 || d.length === 11 ? d : d.length > 14 && cnpjNaFrente ? d.slice(0, 14) : d.length > 11 && !cnpjNaFrente ? d.slice(0, 11) : '';
    if (doc) achados.add(doc);
  }
  return [...achados];
}

/**
 * Acha de quem é o boleto entre os contratos ativos: primeiro o CNPJ/CPF do contrato no texto do PDF, depois o nome completo
 * do cliente no texto ou no nome do arquivo. Só vale se der um único cliente: dois candidatos ficam para a pessoa escolher.
 */
export function acharContratoDoBoleto(texto: string, arquivo: string, contratos: readonly ContratoDeHonorario[]): { contratoId: string; achadoPor: 'documento' | 'nome' } | null {
  const ativos = contratos.filter(c => c.ativo);
  // tira a pontuação só entre dígitos: 11.222.333/0001-81 vira 11222333000181, e o espaço continua separando os números
  const semPontuacao = (texto || '').replace(/(\d)[./-](?=\d)/g, '$1');
  const porDocumento = ativos.filter(c => { const d = soDigitos(c.cnpj); return d.length >= 11 && temDocumento(semPontuacao, d); });
  if (porDocumento.length === 1) return { contratoId: porDocumento[0].id, achadoPor: 'documento' };
  if (porDocumento.length > 1) return null;
  const onde = ` ${norm(texto || '')} ${norm(arquivo || '')} `;
  const porNome = ativos.filter(c => { const n = norm(c.nome); return n.length >= 5 && onde.includes(` ${n} `); });
  return porNome.length === 1 ? { contratoId: porNome[0].id, achadoPor: 'nome' } : null;
}

/** O vencimento que o cadastro espera: o dia do contrato no mês seguinte à competência (o último dia, se o mês for mais curto). */
export function vencimentoDoContrato(dia: number | undefined, competencia: string): string {
  if (!dia || dia < 1 || dia > 31 || !/^\d{4}-\d{2}$/.test(competencia)) return '';
  const a = Number(competencia.slice(0, 4)), m = Number(competencia.slice(5, 7));
  const ano = m === 12 ? a + 1 : a, mes = m === 12 ? 1 : m + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${ano}-${String(mes).padStart(2, '0')}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`;
}

const dataBr = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const reais = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export interface ContextoDoLote {
  contratos: readonly ContratoDeHonorario[];
  recebimentos: readonly RecebimentoDeHonorario[];
  /** todos os boletos guardados (para achar repetido, nesta e nas outras remessas da competência) */
  boletos: readonly BoletoDoLote[];
  /** AAAA-MM-DD */
  hoje: string;
}

/** O que libera, trava ou merece um olhar em uma linha do lote. O envio em andamento ou feito vale mais que a conferência. */
export function conferirBoleto(b: BoletoDoLote, ctx: ContextoDoLote): ConferenciaDoBoleto {
  if (b.envio?.status === 'fila' || b.envio?.status === 'enviando' || b.envio?.status === 'enviado') {
    return { situacao: b.envio.status, pendencias: [], avisos: [], podeDisparar: false };
  }
  if (b.fora) return { situacao: 'fora', pendencias: [], avisos: [], podeDisparar: false };

  const pendencias: string[] = [], avisos: string[] = [];
  const contrato = ctx.contratos.find(c => c.id === b.contratoId);
  if (!b.linha || b.valor == null || !b.vencimento) pendencias.push('Não consegui ler o valor e o vencimento neste PDF.');
  if (!contrato) pendencias.push('Falta escolher o cliente deste boleto.');
  if (!b.destinatarios.length) pendencias.push('O cliente não tem e-mail cadastrado.');
  const invalidos = b.destinatarios.filter(e => !emailValido(e));
  if (invalidos.length) pendencias.push(`E-mail inválido: ${invalidos.join(', ')}.`);
  if (b.vencimento && b.vencimento < ctx.hoje) pendencias.push(`O boleto já venceu em ${dataBr(b.vencimento)}.`);

  if (contrato) {
    if (ctx.recebimentos.some(r => r.contratoId === contrato.id && r.competencia === b.competencia)) {
      pendencias.push(`O honorário de ${competenciaBr(b.competencia)} já consta como recebido.`);
    }
    const iguais = ctx.boletos.filter(o => o.id !== b.id && !o.fora && o.contratoId === contrato.id && o.competencia === b.competencia);
    if (iguais.some(o => o.envio?.status === 'enviado')) pendencias.push(`Este cliente já recebeu o boleto de ${competenciaBr(b.competencia)}.`);
    else if (iguais.length) pendencias.push('Há outro boleto deste cliente no lote: deixe só um.');

    if (b.valor != null && contrato.valor > 0 && Math.round(b.valor * 100) !== Math.round(contrato.valor * 100)) {
      avisos.push(`O valor do boleto é ${reais(b.valor)} e o honorário cadastrado é ${reais(contrato.valor)}.`);
    }
    const esperado = vencimentoDoContrato(contrato.diaVencimento, b.competencia);
    if (b.vencimento && !esperado) avisos.push('O cliente ainda não tem dia de vencimento cadastrado.');
    if (b.vencimento && esperado && esperado !== b.vencimento) avisos.push(`O PDF vence em ${dataBr(b.vencimento)} e o dia cadastrado daria ${dataBr(esperado)}. Vale o do PDF.`);
  }

  const podeDisparar = !pendencias.length;
  if (b.envio?.status === 'erro') return { situacao: 'erro', pendencias, avisos, podeDisparar };
  return { situacao: pendencias.length ? 'pendente' : avisos.length ? 'conferir' : 'pronto', pendencias, avisos, podeDisparar };
}

export interface ResumoDoLote {
  total: number;
  prontos: number;
  pendentes: number;
  enviados: number;
  /** a soma dos boletos que ainda vão sair */
  aDisparar: number;
}

/** Os números do topo; o que foi tirado do lote não conta. */
export function resumoDoLote(linhas: readonly { boleto: BoletoDoLote; conferencia: ConferenciaDoBoleto }[]): ResumoDoLote {
  const r: ResumoDoLote = { total: 0, prontos: 0, pendentes: 0, enviados: 0, aDisparar: 0 };
  let centavos = 0;
  for (const { boleto: b, conferencia: c } of linhas) {
    if (c.situacao === 'fora') continue;
    r.total++;
    if (c.podeDisparar) { r.prontos++; centavos += Math.round((b.valor ?? 0) * 100); }
    if (c.situacao === 'pendente' || (c.situacao === 'erro' && !c.podeDisparar)) r.pendentes++;
    if (c.situacao === 'enviado') r.enviados++;
  }
  r.aDisparar = centavos / 100;
  return r;
}
