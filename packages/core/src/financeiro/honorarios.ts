// Os honorários dos clientes (19/10/2026, fase 2 do Financeiro): cada cliente que "controla honorário" tem um contrato com o
// valor mensal (digitado no nads) e, por competência, está pago ou em aberto. Não há vencimento: não existe "atrasado". O
// recebimento é marcado à mão (depois virá do extrato do banco). Puro: sem banco e sem tela.
// O banco é financeiroHonorarios/{id} e financeiroRecebimentos/{contratoId}_{AAAA-MM} (dados/honorarios.firestore.ts).
import { brl } from '../formatos';
import { dataValida } from './index';
import { xlsxDeLinhas, type CelulaDoDemonstrativo } from './demonstrativo';

export interface ContratoDeHonorario {
  id: string;
  /** o id do cliente no Entregas (pode ser vazio) */
  clienteId: string;
  /** o código do ERP */
  codigo: string;
  nome: string;
  /** só os dígitos */
  cnpj: string;
  /** o honorário mensal; 0 = ainda não definido */
  valor: number;
  ativo: boolean;
  observacoes?: string;
  /** as cobranças já mandadas, por competência AAAA-MM (21/10/2026): quando e quem */
  cobrancas?: Record<string, { em: string; por: string }>;
  criadoEm: string;
  criadoPor: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

export type FormaDeRecebimento = 'dinheiro' | 'pix' | 'boleto' | 'deposito' | 'outro';
export const FORMAS_DE_RECEBIMENTO: { valor: FormaDeRecebimento; rotulo: string }[] = [
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'pix', rotulo: 'PIX' },
  { valor: 'boleto', rotulo: 'Boleto' },
  { valor: 'deposito', rotulo: 'Depósito' },
  { valor: 'outro', rotulo: 'Outro' },
];
export const rotuloDaForma = (f: FormaDeRecebimento) => FORMAS_DE_RECEBIMENTO.find(x => x.valor === f)?.rotulo ?? f;

export interface RecebimentoDeHonorario {
  /** contratoId_AAAA-MM */
  id: string;
  contratoId: string;
  /** AAAA-MM */
  competencia: string;
  valor: number;
  /** AAAA-MM-DD */
  recebidoEm: string;
  forma: FormaDeRecebimento;
  /** o lançamento do Caixa que o recebimento em dinheiro criou */
  lancamentoId?: string;
  observacoes?: string;
  por: string;
  em: string;
}

/** O id do recebimento: um por contrato e competência (receber de novo no mesmo mês troca o anterior). */
export const idDoRecebimento = (contratoId: string, competencia: string) => `${contratoId}_${competencia}`;

/** A competência (AAAA-MM) é um mês que existe. */
export const competenciaValida = (c: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(c);

/** O mês antes de hoje (AAAA-MM-DD): o padrão da tela, porque o honorário de setembro se paga em outubro. */
export function competenciaAnterior(hoje: string): string {
  const a = Number(hoje.slice(0, 4)), m = Number(hoje.slice(5, 7));
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

/** AAAA-MM → MM/AAAA */
export const competenciaBr = (c: string) => (competenciaValida(c) ? `${c.slice(5)}/${c.slice(0, 4)}` : c);

/** A descrição do lançamento no Caixa: "HC NOME 09/2026". */
export const descricaoDoRecebimento = (nome: string, competencia: string) => `HC ${nome.trim().toUpperCase()} ${competenciaBr(competencia)}`;

export type FiltroDeHonorarios = 'todos' | 'abertos' | 'pagos';

export interface LinhaDeHonorario { contrato: ContratoDeHonorario; recebimento: RecebimentoDeHonorario | null }
export interface SituacaoDaCompetencia {
  /** as linhas que passam pelo filtro e pela busca, por código (número) e depois nome */
  linhas: LinhaDeHonorario[];
  /** os números são de todos os contratos ativos, sem filtro e sem busca */
  previsto: number;
  recebido: number;
  emAberto: number;
  pagos: number;
  total: number;
}

const centavos = (v: number) => Math.round(v * 100);
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** O mês de cada contrato ativo: pago (com o recebimento) ou em aberto, e os totais. */
export function situacaoDaCompetencia(contratos: ContratoDeHonorario[], recebimentos: RecebimentoDeHonorario[], competencia: string, filtro: FiltroDeHonorarios = 'todos', busca = ''): SituacaoDaCompetencia {
  const doMes = new Map(recebimentos.filter(r => r.competencia === competencia).map(r => [r.contratoId, r]));
  const todas: LinhaDeHonorario[] = contratos.filter(c => c.ativo).map(c => ({ contrato: c, recebimento: doMes.get(c.id) ?? null }))
    .sort((a, b) => (a.contrato.codigo || '').localeCompare(b.contrato.codigo || '', 'pt-BR', { numeric: true }) || a.contrato.nome.localeCompare(b.contrato.nome, 'pt-BR'));
  let previsto = 0, recebido = 0, emAberto = 0, pagos = 0;
  for (const l of todas) {
    previsto += centavos(l.contrato.valor);
    if (l.recebimento) { recebido += centavos(l.recebimento.valor); pagos++; } else emAberto += centavos(l.contrato.valor);
  }
  const q = norm(busca.trim());
  const linhas = todas.filter(l => (filtro === 'todos' || (filtro === 'pagos') === !!l.recebimento)
    && (!q || norm(l.contrato.nome + ' ' + l.contrato.codigo + ' ' + l.contrato.cnpj).includes(q)));
  return { linhas, previsto: previsto / 100, recebido: recebido / 100, emAberto: emAberto / 100, pagos, total: todas.length };
}

/** O que está errado no recebimento (vazio = pode gravar). */
export function conferirRecebimento(r: Pick<RecebimentoDeHonorario, 'valor' | 'recebidoEm' | 'forma' | 'competencia'>): string[] {
  const erros: string[] = [];
  if (!competenciaValida(r.competencia)) erros.push('A competência não é um mês válido.');
  if (!Number.isFinite(r.valor) || r.valor <= 0) erros.push('O valor precisa ser maior que zero.');
  if (!dataValida(r.recebidoEm)) erros.push('Informe uma data válida.');
  if (!FORMAS_DE_RECEBIMENTO.some(f => f.valor === r.forma)) erros.push('Escolha a forma de pagamento.');
  return erros;
}

/** O valor do honorário digitado: zero ou mais (0 = ainda não definido). */
export const valorDeHonorarioValido = (v: number) => Number.isFinite(v) && v >= 0;

export const CABECALHO_DOS_HONORARIOS = ['Cód.', 'Cliente', 'Valor', 'Situação', 'Recebido em', 'Forma'] as const;

const dataBr = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? `${m[3]}/${m[2]}/${m[1]}` : iso; };

/** As linhas da planilha do mês, do que está na tela: Cód., Cliente, Valor, Situação, Recebido em, Forma. */
export function linhasDosHonorarios(competencia: string, linhas: LinhaDeHonorario[]): CelulaDoDemonstrativo[][] {
  return [
    [`Honorários — ${competenciaBr(competencia)}`],
    [],
    [...CABECALHO_DOS_HONORARIOS],
    ...linhas.map(({ contrato: c, recebimento: r }): CelulaDoDemonstrativo[] => [
      c.codigo, c.nome, r ? r.valor : c.valor, r ? 'Pago' : 'Em aberto', r ? dataBr(r.recebidoEm) : '', r ? rotuloDaForma(r.forma) : '',
    ]),
  ];
}

export const nomeDaPlanilhaDeHonorarios = (competencia: string) => `Honorários ${competencia}.xlsx`;

/** O .xlsx do mês (aba "Honorários"), com os valores em R$. */
export function planilhaDosHonorarios(competencia: string, linhas: LinhaDeHonorario[]): Uint8Array {
  return xlsxDeLinhas(linhasDosHonorarios(competencia, linhas), 'Honorários', [8, 44, 16, 14, 14, 12]);
}

// ---------------------------------------------------------------------------------------------------------------------
// a nota fiscal do honorário e a cobrança (21/10/2026)
// ---------------------------------------------------------------------------------------------------------------------

/** O que interessa de uma NFS-e para o selo da linha (a NotaFiscal do nfse serve). */
export interface NotaResumida { status: string; numeroNfse: string; tomador: { documento: string }; servico: { competencia: string } }

/**
 * O selo da NFS-e do honorário na linha: a nota do cliente (pelo CNPJ) com o serviço dentro da competência. A autorizada vale
 * mais ("NFS-e 123"), depois a que está andando ("NFS-e pedida"), depois a recusada; a cancelada não conta. null = sem nota.
 */
export function seloDaNfse(notas: readonly NotaResumida[], cnpj: string, competencia: string): { rotulo: string; tom: 'ok' | 'info' | 'bad' } | null {
  const doc = cnpj.replace(/\D/g, '');
  if (!doc) return null;
  const dele = notas.filter(n => n.tomador.documento.replace(/\D/g, '') === doc && n.servico.competencia.startsWith(competencia) && n.status !== 'cancelada');
  const autorizada = dele.find(n => n.status === 'autorizada' || n.status === 'cancelamento-pedido' || n.status === 'erro-cancelamento');
  if (autorizada) return { rotulo: autorizada.numeroNfse ? `NFS-e ${autorizada.numeroNfse}` : 'NFS-e emitida', tom: 'ok' };
  const andando = dele.find(n => n.status !== 'erro');
  if (andando) return { rotulo: 'NFS-e pedida', tom: 'info' };
  return dele.length ? { rotulo: 'NFS-e recusada', tom: 'bad' } : null;
}

/** O modelo da mensagem de cobrança; {pix} e a frase da chave saem quando o escritório não tem chave. */
export const MODELO_DE_COBRANCA = 'Olá, {nome}! Passando para lembrar do honorário contábil de {competencia}, no valor de R$ {valor}. Chave PIX: {pix}. Qualquer dúvida, estamos à disposição. — Nilma Contabilidade';

export function mensagemDeCobranca(d: { nome: string; competencia: string; valor: number; pix: string }, modelo = MODELO_DE_COBRANCA): string {
  const semPix = d.pix.trim() ? modelo : modelo.replace(/\s*Chave PIX: \{pix\}\./, '');
  return semPix.replace('{nome}', d.nome.trim()).replace('{competencia}', competenciaBr(d.competencia)).replace('{valor}', brl(d.valor)).replace('{pix}', d.pix.trim());
}

/** O telefone para o WhatsApp: só dígitos com o 55 na frente ('' quando não parece um telefone do Brasil). */
export function telefoneParaWhatsapp(fone: string): string {
  const d = fone.replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) return '55' + d;
  return (d.length === 12 || d.length === 13) && d.startsWith('55') ? d : '';
}

/** O link do WhatsApp com a mensagem pronta ('' sem telefone válido). */
export function linkDoWhatsapp(fone: string, texto: string): string {
  const f = telefoneParaWhatsapp(fone);
  return f ? `https://wa.me/${f}?text=${encodeURIComponent(texto)}` : '';
}
