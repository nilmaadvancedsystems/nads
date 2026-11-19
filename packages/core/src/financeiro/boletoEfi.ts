// O boleto dos honorários pelo Efí (19/11/2026, fase 2 das APIs dos bancos): boleto com o QR do Pix (o "bolix"), emitido
// pelo robô da nuvem (robo/boletos-efi.js) quando alguém aperta Emitir na tela de Honorários. Decisões do dono: o vencimento
// é um dia por cliente (no contrato; sem dia, o padrão), a multa e os juros são configuráveis (config/boletoEfi), a emissão é
// só por botão, e o boleto emitido vai para Financeiro › Boletos, de onde o robô manda por e-mail.
//
// O pedido e o resultado ficam no próprio contrato (financeiroHonorarios/{id}.boletosEfi.{AAAA-MM}): a tela grava o pedido,
// o robô troca o status (emitindo, emitido ou erro) e junta a linha digitável, o Pix e o link. Puro: sem banco e sem tela.
// A baixa (fase 3, decisão do dono: "consulta a cada hora", sem webhook): o robô pergunta ao Efí pelos boletos emitidos;
// o pago vira 'pago' e, em produção, o recebimento do honorário (financeiroRecebimentos) com a forma e o dia do pagamento;
// o cancelado no Efí vira 'cancelado' (pode pedir outro).
import type { ContratoDeHonorario, RecebimentoDeHonorario } from './honorarios';
import { competenciaBr, competenciaValida } from './honorarios';

export type StatusDoBoletoEfi = 'pedido' | 'emitindo' | 'emitido' | 'erro' | 'pago' | 'cancelado';

/** o boleto de uma competência do contrato (financeiroHonorarios/{id}.boletosEfi.{AAAA-MM}) */
export interface BoletoEfiDoMes {
  status: StatusDoBoletoEfi;
  valor: number;
  /** AAAA-MM-DD */
  vencimento: string;
  /** os e-mails do cliente quando foi pedido (o boleto em Financeiro › Boletos sai com eles) */
  destinatarios: string[];
  pedidoEm: string;
  pedidoPor: string;
  /** o que o robô gravou */
  ambiente?: 'homologacao' | 'producao';
  chargeId?: number;
  /** a linha digitável, só os dígitos */
  linha?: string;
  /** o Pix copia e cola */
  pix?: string;
  /** a página do boleto no Efí */
  link?: string;
  /** o boleto em Financeiro › Boletos (financeiroBoletos/{id}) */
  boletoId?: string;
  emitidoEm?: string;
  erro?: string;
  pagoEm?: string;
}

/** a configuração do boleto (config/boletoEfi): multa em % (2 = 2%), juros em % ao mês, o dia de vencimento padrão */
export interface ConfigDoBoletoEfi { multa: number; jurosAoMes: number; diaPadrao: number }
export const CONFIG_PADRAO_DO_BOLETO: ConfigDoBoletoEfi = { multa: 0, jurosAoMes: 0, diaPadrao: 10 };

/** o dia de vencimento serve (1 a 31; o mês curto vence no último dia) */
export const diaDeVencimentoValido = (d: unknown): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 1 && d <= 31;

/** o que está errado na configuração ([] = serve). O Efí aceita multa de até 10% e juros de até 10% ao mês. */
export function conferirConfigDoBoleto(c: ConfigDoBoletoEfi): string[] {
  const erros: string[] = [];
  if (!(Number.isFinite(c.multa) && c.multa >= 0 && c.multa <= 10)) erros.push('A multa vai de 0 a 10%.');
  if (!(Number.isFinite(c.jurosAoMes) && c.jurosAoMes >= 0 && c.jurosAoMes <= 10)) erros.push('Os juros vão de 0 a 10% ao mês.');
  if (!diaDeVencimentoValido(c.diaPadrao)) erros.push('O dia de vencimento padrão vai de 1 a 31.');
  return erros;
}

/** a configuração lida do banco, com o padrão no que faltar ou não servir */
export function configDoBoletoDoBanco(d: unknown): ConfigDoBoletoEfi {
  const o = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
  const percentual = (v: unknown, padrao: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10 ? v : padrao);
  return {
    multa: percentual(o.multa, CONFIG_PADRAO_DO_BOLETO.multa), jurosAoMes: percentual(o.jurosAoMes, CONFIG_PADRAO_DO_BOLETO.jurosAoMes),
    diaPadrao: diaDeVencimentoValido(o.diaPadrao) ? o.diaPadrao : CONFIG_PADRAO_DO_BOLETO.diaPadrao,
  };
}

const somarDias = (iso: string, dias: number) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };

/**
 * O vencimento do honorário da competência: o dia do cliente no mês seguinte (o de outubro vence em novembro; o mês curto
 * vence no último dia). Se esse dia já passou (ou é hoje), vence daqui a 3 dias e `ajustado` avisa.
 */
export function vencimentoDoHonorario(competencia: string, dia: number, hoje: string): { vencimento: string; ajustado: boolean } {
  const [a, m] = competencia.split('-').map(Number);
  const ano = m === 12 ? a + 1 : a, mes = m === 12 ? 1 : m + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const v = ano + '-' + String(mes).padStart(2, '0') + '-' + String(Math.min(dia, ultimo)).padStart(2, '0');
  return v > hoje ? { vencimento: v, ajustado: false } : { vencimento: somarDias(hoje, 3), ajustado: true };
}

/** o dia de vencimento do contrato (o dele ou o padrão) */
export const diaDoContrato = (c: Pick<ContratoDeHonorario, 'diaVencimento'>, cfg: ConfigDoBoletoEfi) => (diaDeVencimentoValido(c.diaVencimento) ? c.diaVencimento : cfg.diaPadrao);

/** o boleto da competência que ainda vale (pedido, sendo emitido, emitido ou pago); o com erro ou cancelado não conta */
export function boletoQueVale(c: Pick<ContratoDeHonorario, 'boletosEfi'>, competencia: string): BoletoEfiDoMes | null {
  const b = c.boletosEfi?.[competencia];
  return b && b.status !== 'erro' && b.status !== 'cancelado' ? b : null;
}

/** por que o boleto do contrato nesta competência não pode ser pedido ('' = pode) */
export function porQueNaoEmitir(c: ContratoDeHonorario, competencia: string, recebimento: RecebimentoDeHonorario | null | undefined): string {
  if (!competenciaValida(competencia)) return 'Escolha uma competência.';
  if (!c.ativo) return 'O honorário deste cliente está parado.';
  if (!(c.valor > 0)) return 'Defina o valor do honorário primeiro.';
  if (recebimento) return 'Este honorário já está pago.';
  if (!/^(\d{11}|\d{14})$/.test(c.cnpj)) return 'O cliente está sem CNPJ/CPF no contrato.';
  const b = boletoQueVale(c, competencia);
  if (b) return b.status === 'pago' ? 'Este boleto já foi pago.' : 'O boleto deste mês já foi pedido.';
  return '';
}

/** o pedido que a tela grava (o robô emite) */
export function pedidoDeBoleto(c: ContratoDeHonorario, competencia: string, cfg: ConfigDoBoletoEfi, hoje: string, destinatarios: readonly string[], quem: string, agora: string): BoletoEfiDoMes {
  return {
    status: 'pedido', valor: Math.round(c.valor * 100) / 100, vencimento: vencimentoDoHonorario(competencia, diaDoContrato(c, cfg), hoje).vencimento,
    destinatarios: [...new Set(destinatarios.map(e => e.trim().toLowerCase()).filter(Boolean))].slice(0, 10), pedidoEm: agora, pedidoPor: quem,
  };
}

/**
 * O corpo do "boleto em um passo" do Efí (POST /v1/charge/one-step), com o Pix junto. A multa vai em centésimos de % (2% =
 * 200) e os juros ao dia em milésimos de % (1% ao mês ≈ 0,033% ao dia = 33). O custom_id é o contrato e a competência.
 */
export function corpoDoBolix(c: Pick<ContratoDeHonorario, 'id' | 'nome' | 'cnpj'>, competencia: string, b: Pick<BoletoEfiDoMes, 'valor' | 'vencimento' | 'destinatarios'>, cfg: ConfigDoBoletoEfi): Record<string, unknown> {
  const nome = c.nome.replace(/\s+/g, ' ').trim().slice(0, 255);
  const email = b.destinatarios[0];
  const cliente = c.cnpj.length === 14
    ? { juridical_person: { corporate_name: nome, cnpj: c.cnpj }, ...(email ? { email } : {}) }
    : { name: nome, cpf: c.cnpj, ...(email ? { email } : {}) };
  const configuracoes = {
    ...(cfg.multa > 0 ? { fine: Math.round(cfg.multa * 100) } : {}),
    ...(cfg.jurosAoMes > 0 ? { interest: Math.max(1, Math.round((cfg.jurosAoMes / 30) * 1000)) } : {}),
  };
  return {
    items: [{ name: 'Honorários contábeis ' + competenciaBr(competencia), value: Math.round(b.valor * 100), amount: 1 }],
    metadata: { custom_id: c.id + '_' + competencia },
    payment: {
      banking_billet: {
        expire_at: b.vencimento, customer: cliente,
        ...(Object.keys(configuracoes).length ? { configurations: configuracoes } : {}),
        message: 'Honorários contábeis de ' + competenciaBr(competencia) + ' · Nilma Contabilidade',
      },
    },
  };
}

/** o que o Efí devolveu do boleto emitido; sem o charge_id ou a linha, um erro com o motivo */
export function lerBolixEmitido(resposta: unknown): { chargeId: number; linha: string; pix: string; link: string; pdf: string } {
  const r = (resposta && typeof resposta === 'object' ? resposta : {}) as Record<string, unknown>;
  const d = (r.data && typeof r.data === 'object' ? r.data : r) as Record<string, unknown>;
  const pix = (d.pix && typeof d.pix === 'object' ? d.pix : {}) as Record<string, unknown>;
  const pdf = (d.pdf && typeof d.pdf === 'object' ? d.pdf : {}) as Record<string, unknown>;
  const chargeId = Number(d.charge_id);
  const linha = String(d.barcode ?? '').replace(/\D/g, '');
  if (!Number.isInteger(chargeId) || chargeId <= 0) throw new Error('o Efí não devolveu o número da cobrança');
  if (!/^\d{47}$/.test(linha)) throw new Error('o Efí não devolveu a linha digitável');
  return { chargeId, linha, pix: String(pix.qrcode ?? ''), link: String(d.billet_link ?? d.link ?? ''), pdf: String(pdf.charge ?? '') };
}

/** como a tela mostra o boleto da competência (null = nenhum) */
export function seloDoBoletoEfi(b: BoletoEfiDoMes | null | undefined): { rotulo: string; tom: 'ok' | 'info' | 'aviso' | 'bad'; dica?: string } | null {
  if (!b) return null;
  const dia = b.vencimento.slice(8, 10) + '/' + b.vencimento.slice(5, 7);
  if (b.status === 'pedido') return { rotulo: 'Boleto pedido', tom: 'info', dica: 'O robô emite no Efí em instantes.' };
  if (b.status === 'emitindo') return { rotulo: 'Emitindo boleto', tom: 'info' };
  if (b.status === 'erro') return { rotulo: 'Boleto com erro', tom: 'bad', dica: b.erro };
  if (b.status === 'pago') return { rotulo: 'Boleto pago' + (b.pagoEm ? ' em ' + b.pagoEm.slice(8, 10) + '/' + b.pagoEm.slice(5, 7) : ''), tom: 'ok' };
  if (b.status === 'cancelado') return { rotulo: 'Boleto cancelado', tom: 'aviso', dica: 'Cancelado no Efí: dá para pedir outro.' };
  return b.ambiente === 'homologacao'
    ? { rotulo: 'Boleto de teste · ' + dia, tom: 'aviso', dica: 'Emitido na homologação do Efí: não vale como cobrança.' }
    : { rotulo: 'Boleto até ' + dia, tom: 'info' };
}

/** os boletos lidos do banco (o que não fecha fica de fora) */
export function boletosEfiDoBanco(v: unknown): Record<string, BoletoEfiDoMes> | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const STATUS: StatusDoBoletoEfi[] = ['pedido', 'emitindo', 'emitido', 'erro', 'pago', 'cancelado'];
  const t = (x: unknown) => (x == null ? '' : String(x));
  const out: Record<string, BoletoEfiDoMes> = {};
  for (const [comp, x] of Object.entries(v as Record<string, unknown>)) {
    const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
    if (!competenciaValida(comp) || !STATUS.includes(o.status as StatusDoBoletoEfi)) continue;
    out[comp] = {
      status: o.status as StatusDoBoletoEfi, valor: Number(o.valor) || 0, vencimento: t(o.vencimento),
      destinatarios: Array.isArray(o.destinatarios) ? o.destinatarios.map(t).filter(Boolean) : [], pedidoEm: t(o.pedidoEm), pedidoPor: t(o.pedidoPor),
      ...(o.ambiente === 'homologacao' || o.ambiente === 'producao' ? { ambiente: o.ambiente } : {}),
      ...(Number.isInteger(o.chargeId) ? { chargeId: o.chargeId as number } : {}),
      ...(o.linha ? { linha: t(o.linha) } : {}), ...(o.pix ? { pix: t(o.pix) } : {}), ...(o.link ? { link: t(o.link) } : {}),
      ...(o.boletoId ? { boletoId: t(o.boletoId) } : {}), ...(o.emitidoEm ? { emitidoEm: t(o.emitidoEm) } : {}),
      ...(o.erro ? { erro: t(o.erro) } : {}), ...(o.pagoEm ? { pagoEm: t(o.pagoEm) } : {}),
    };
  }
  return Object.keys(out).length ? out : undefined;
}

// ─── a baixa (fase 3) ────────────────────────────────────────────────────────────────────────────────────────────────

/** quantos dias depois de emitido o robô ainda pergunta ao Efí (o boleto esquecido não fica sendo consultado para sempre) */
export const DIAS_DE_CONSULTA = 120;

/** os boletos emitidos que o robô consulta (os que têm o número da cobrança, emitidos há até DIAS_DE_CONSULTA dias) */
export function boletosParaConsultar(contratos: readonly Pick<ContratoDeHonorario, 'id' | 'boletosEfi'>[], hoje: string, dias = DIAS_DE_CONSULTA):
  { contratoId: string; competencia: string; boleto: BoletoEfiDoMes }[] {
  const limite = somarDias(hoje, -dias);
  const out: { contratoId: string; competencia: string; boleto: BoletoEfiDoMes }[] = [];
  for (const c of contratos) {
    for (const [competencia, b] of Object.entries(c.boletosEfi ?? {})) {
      if (b.status === 'emitido' && b.chargeId && (b.emitidoEm || '').slice(0, 10) >= limite) out.push({ contratoId: c.id, competencia, boleto: b });
    }
  }
  return out;
}

/** o que o Efí diz da cobrança (GET /v1/charge/:id): pago (com o valor, o dia e a forma), em aberto ou cancelado */
export type CobrancaNoEfi =
  | { situacao: 'pago'; valor: number | null; pagoEm: string | null; forma: 'boleto' | 'pix' }
  | { situacao: 'aberto' }
  | { situacao: 'cancelado' };

/**
 * A resposta da cobrança do Efí. paid (pago) e settled (marcado como pago no Efí) são pagos; canceled, cancelado; o resto
 * (waiting, unpaid, link…), em aberto — o boleto vencido ainda pode ser pago. O valor pago (centavos) e o dia vêm de onde o
 * Efí puser (paid_value / total, paid_at / payment.paid_at / o histórico); o pagamento pelo QR do bolix conta como Pix.
 */
export function lerCobrancaDoEfi(resposta: unknown): CobrancaNoEfi {
  const r = (resposta && typeof resposta === 'object' ? resposta : {}) as Record<string, unknown>;
  const d = (r.data && typeof r.data === 'object' ? r.data : r) as Record<string, unknown>;
  const status = String(d.status ?? '').toLowerCase();
  if (status === 'canceled' || status === 'cancelled') return { situacao: 'cancelado' };
  if (status !== 'paid' && status !== 'settled') return { situacao: 'aberto' };
  const pagamento = (d.payment && typeof d.payment === 'object' ? d.payment : {}) as Record<string, unknown>;
  const historico = Array.isArray(d.history) ? (d.history as Record<string, unknown>[]) : [];
  const dia = (v: unknown) => { const m = String(v ?? '').match(/^(\d{4}-\d{2}-\d{2})/); return m ? m[1] : null; };
  const doHistorico = [...historico].reverse().find(h => /pag|paid|pix/i.test(String(h?.message ?? '')));
  const pagoEm = dia(d.paid_at) ?? dia(pagamento.paid_at) ?? dia(doHistorico?.created_at);
  const centavos = [d.paid_value, pagamento.paid_value, d.total].map(Number).find(n => Number.isFinite(n) && n > 0);
  const pix = String(pagamento.method ?? '').toLowerCase() === 'pix' || historico.some(h => /\bpix\b/i.test(String(h?.message ?? '')));
  return { situacao: 'pago', valor: centavos == null ? null : Math.round(centavos) / 100, pagoEm, forma: pix ? 'pix' : 'boleto' };
}

/** o recebimento do honorário que a baixa grava (financeiroRecebimentos/{contratoId}_{AAAA-MM}), sem o id */
export function recebimentoDaBaixa(contratoId: string, competencia: string, b: Pick<BoletoEfiDoMes, 'valor' | 'chargeId'>,
  pago: { valor: number | null; pagoEm: string | null; forma: 'boleto' | 'pix' }, hoje: string, quem: string, agora: string): Omit<RecebimentoDeHonorario, 'id'> {
  return {
    contratoId, competencia, valor: pago.valor ?? b.valor, recebidoEm: pago.pagoEm ?? hoje, forma: pago.forma,
    observacoes: 'Baixa automática pelo Efí (cobrança ' + b.chargeId + ')', por: quem, em: agora,
  };
}
