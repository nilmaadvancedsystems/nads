// As guias da Área do Cliente (Vitor, 16/10/2026): o que o cliente vê de cada guia pronta. O robô grava no espelho
// (areasCliente/{token}/guias/{id}) SÓ o que sai daqui: lista branca de campos, nunca o pedido inteiro do robô.
// Guia pronta aparece sozinha; a que tem aviso (filial na guia da matriz, débito antigo, emitida depois do vencimento…)
// espera o "Liberar" no escritório.

// a DARF e o DAM do ISS (plano do Acessórias, 17/11/2026, ficha todas-as-guias; frase do dono: "Todas as guias (robô)"): as guias do lote do Fiscal e a DARF do lote do DP
// HON: o boleto dos honorários do escritório (24/11/2026, ficha 50 honorarios; o dono: "Só o boleto, sem 'pago'"). Vem no
// mesmo lugar do espelho (guias/hon-{AAAA-MM}-{cód}), mas o site o separa das guias de imposto (não entra em total, nem em
// vencida, nem no sino): fica num quadro próprio, sem situação.
export type TipoDeGuia = 'FGTS' | 'DAS' | 'DAE' | 'DARF' | 'DAM' | 'HON' | 'outra';
export type SituacaoDaGuia = 'a vencer' | 'vence hoje' | 'vencida';

/** O nome da guia para o cliente, sem sigla solta. */
export const ROTULO_DA_GUIA: Record<TipoDeGuia, string> = { FGTS: 'FGTS', DAS: 'DAS (Simples Nacional)', DAE: 'DAE (imposto estadual)', DARF: 'DARF', DAM: 'DAM (ISS)', HON: 'Honorários do escritório', outra: 'Guia' };

/** O nome da guia para o cliente: a DARF com o tributo ("DARF INSS"); as outras, o ROTULO_DA_GUIA. */
export function rotuloDaGuia(g: Pick<GuiaDoCliente, 'tipo' | 'tributo'>): string {
  return g.tipo === 'DARF' && g.tributo ? 'DARF ' + g.tributo : ROTULO_DA_GUIA[g.tipo];
}

/** O tributo no id: "INSS" -> "inss", "PIS/COFINS" -> "pis-cofins". */
const tributoNoId = (t: string | undefined) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * O id da guia no espelho: "das-2026-10-58", "darf-inss-2026-10-58". Sem tributo, igual ao do envio pelo nads
 * (robo/envios-do-nads.js, idDaGuiaDoCliente): o DAS do lote e o do envio caem no mesmo id. O tributo no id deixa duas
 * DARFs do mesmo mês (INSS e IRRF) uma ao lado da outra, sem uma apagar a outra.
 */
export function idDaGuiaNoEspelho(g: { tipo: string; tributo?: string; competencia: string; codigo: number | string }): string {
  return [g.tipo.toLowerCase(), tributoNoId(g.tributo)].filter(Boolean).join('-') + '-' + g.competencia + '-' + g.codigo;
}
export const ROTULO_DA_SITUACAO_DA_GUIA: Record<SituacaoDaGuia, string> = { 'a vencer': 'A vencer', 'vence hoje': 'Vence hoje', vencida: 'Vencida' };

export interface GuiaDoCliente {
  id: string;
  tipo: TipoDeGuia;
  /** 'aaaa-mm' */
  competencia: string;
  /** 'dd/mm/aaaa' */
  vencimento: string;
  /** em reais */
  valor: number;
  /** o número da guia (quando tem) */
  numero?: string;
  /** o tributo da DARF ('INSS', 'IRRF', 'PIS'…); sem = a guia tem um tributo só (DAS, FGTS, DAE, DAM) */
  tributo?: string;
  /** calculada pela data de hoje; quem mostra recalcula com situacaoDaGuia */
  situacao: SituacaoDaGuia;
  /** o PDF está no espelho (guias/{id}/pdf/{n}) */
  temPdf: boolean;
  /** 'dd/mm/aaaa': a saída do extrato que pagou a guia (o robô grava; sem = a pagar) (plano do Acessórias, 18/11/2026, ficha guia-paga-confirmada; frase do dono: "Seguir") */
  pagoEm?: string;
  /** a linha digitável do boleto (só no HON), para copiar */
  linha?: string;
  /** o Pix copia e cola do boleto (só no HON emitido pelo Efí, o "bolix") (24/11/2026: "se possivel poder gerar um codigo pix") */
  pix?: string;
}

/** O Pix copia e cola que vale: o payload EMV (começa com 000201), só caracteres comuns, até 512. */
export function pixValido(t: unknown): string {
  const s = String(t ?? '').trim();
  return /^000201[\x20-\x7E]{20,506}$/.test(s) ? s : '';
}

/**
 * O boleto de honorários como o Financeiro grava (financeiroBoletos/{id}); aqui só o que a projeção olha. O contrato
 * (financeiroHonorarios/{contratoId}) dá o código da empresa.
 */
export interface BoletoDeHonorarioInterno {
  id: string;
  /** 'aaaa-mm' */
  competencia: string;
  /** 'aaaa-mm-dd' */
  vencimento: string;
  valor: number;
  linha?: string;
  contratoId?: string;
  /** tirado do lote */
  fora?: boolean;
  /** quantos pedaços do PDF (financeiroBoletos/{id}/partes/{n}) */
  partes?: number;
  envio?: { status?: string; enviadoEm?: string };
}

/**
 * O boleto de honorários que o cliente vê: só depois de ENVIADO por e-mail ao cliente (o rascunho, o tirado do lote e o
 * que deu erro não saem). Sem 'pago' (o dono, 24/11/2026: o recebimento é marcado à mão; um atraso faria o cliente se
 * sentir cobrado depois de pagar). Lista branca: só os campos da GuiaDoCliente.
 */
export function guiaDoHonorario(b: BoletoDeHonorarioInterno, codigo: number | string, hoje: Date, pixDoContrato?: string): GuiaDoCliente | null {
  if (!b || b.fora === true || b.envio?.status !== 'enviado') return null;
  const v = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(b.vencimento ?? ''));
  const vencimento = v ? v[3] + '/' + v[2] + '/' + v[1] : '';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(b.competencia ?? '')) || !dataDoVencimento(vencimento) || typeof b.valor !== 'number' || !Number.isFinite(b.valor) || b.valor <= 0) return null;
  const linha = String(b.linha ?? '').replace(/[^\d. ]/g, '').trim().slice(0, 60);
  // o Pix do contrato (financeiroHonorarios.boletosEfi.{AAAA-MM}.pix), quando o boleto saiu pelo Efí
  const pix = pixValido(pixDoContrato);
  return {
    id: 'hon-' + b.competencia + '-' + codigo,
    tipo: 'HON',
    competencia: b.competencia,
    vencimento,
    valor: Math.round(b.valor * 100) / 100,
    ...(linha ? { linha } : {}),
    ...(pix ? { pix } : {}),
    situacao: situacaoDaGuia(vencimento, hoje),
    temPdf: typeof b.partes === 'number' && b.partes > 0,
  };
}

/**
 * O pedido do FGTS Digital (pedidosFgts) como o robô o grava. Aqui só o que a projeção olha: o resto (passos, erro,
 * quem pediu…) é interno e não sai.
 */
export interface PedidoFgtsInterno {
  id: string;
  competencia: string;
  /** 'pronto' = a guia saiu */
  status: string;
  /** 'emitir' emite a guia; 'ensaio' só entra no perfil */
  modo: string;
  vencimento: string;
  /** ex.: "917,42" ou "1.917,42" */
  valor: string;
  numeroGuia: string;
  /** o que o DP precisa saber da guia: com aviso, espera a liberação do escritório */
  aviso: string;
  pdfNome?: string;
}

/** "1.917,42" ou "917,42" → 1917.42; NaN quando não é um valor. */
export function valorEmReais(texto: string): number {
  const limpo = String(texto ?? '').replace(/[^\d,.-]/g, '');
  if (!limpo) return NaN;
  return Number(limpo.replace(/\./g, '').replace(',', '.'));
}

/** 'dd/mm/aaaa' → Date (meia-noite local); null se não for uma data. */
export function dataDoVencimento(vencimento: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(vencimento);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return d.getFullYear() === Number(m[3]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[1]) ? d : null;
}

/** A situação pela data: antes do vencimento "a vencer", no dia "vence hoje", depois "vencida". */
export function situacaoDaGuia(vencimento: string, hoje: Date): SituacaoDaGuia {
  const v = dataDoVencimento(vencimento);
  if (!v) return 'a vencer';
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  return v.getTime() > h ? 'a vencer' : v.getTime() === h ? 'vence hoje' : 'vencida';
}

/** A guia do FGTS pronta tem aviso: espera o "Liberar" do escritório antes de aparecer para o cliente. */
export function guiaPrecisaLiberar(p: Pick<PedidoFgtsInterno, 'status' | 'modo' | 'aviso'>): boolean {
  return p.status === 'pronto' && p.modo === 'emitir' && !!String(p.aviso ?? '').trim();
}

/**
 * A guia do FGTS que o cliente vê: de um pedido pronto e de emitir (o ensaio nunca sai). Com aviso, só depois do
 * "Liberar" (liberada = true); sem a liberação devolve null. Lista branca: só os campos da GuiaDoCliente.
 */
export function guiaDoFgts(pedido: PedidoFgtsInterno, hoje: Date, liberada = false): GuiaDoCliente | null {
  if (pedido.status !== 'pronto' || pedido.modo !== 'emitir') return null;
  if (guiaPrecisaLiberar(pedido) && !liberada) return null;
  const valor = valorEmReais(pedido.valor);
  if (!Number.isFinite(valor) || !dataDoVencimento(pedido.vencimento) || !/^\d{4}-\d{2}$/.test(pedido.competencia)) return null;
  const numero = String(pedido.numeroGuia ?? '').trim();
  return {
    id: pedido.id,
    tipo: 'FGTS',
    competencia: pedido.competencia,
    vencimento: pedido.vencimento,
    valor,
    ...(numero ? { numero } : {}),
    situacao: situacaoDaGuia(pedido.vencimento, hoje),
    temPdf: !!String(pedido.pdfNome ?? '').trim(),
  };
}

/** As guias do cliente com a situação recalculada para hoje, as mais urgentes primeiro (vencimento, depois tipo). */
export function guiasDeHoje(guias: GuiaDoCliente[], hoje: Date): GuiaDoCliente[] {
  const chave = (g: GuiaDoCliente) => (dataDoVencimento(g.vencimento)?.getTime() ?? 0);
  return guias.map(g => ({ ...g, situacao: situacaoDaGuia(g.vencimento, hoje) })).sort((a, b) => chave(a) - chave(b) || a.tipo.localeCompare(b.tipo));
}

/** As guias agrupadas por competência, a mais nova primeiro. */
export function guiasPorCompetencia(guias: GuiaDoCliente[]): { competencia: string; guias: GuiaDoCliente[] }[] {
  const mapa = new Map<string, GuiaDoCliente[]>();
  for (const g of guias) mapa.set(g.competencia, [...(mapa.get(g.competencia) ?? []), g]);
  return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([competencia, lista]) => ({ competencia, guias: lista }));
}
