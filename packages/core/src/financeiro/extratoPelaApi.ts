// O extrato do banco pela API (19/11/2026: "ligar o Financeiro às APIs do Sicoob e do Efí, para ele puxar o extrato
// sozinho"). Quem chama o banco é o robô da nuvem (robo/extrato-pela-api.js): as duas APIs pedem o certificado da conta
// (mTLS), que não pode ir para o navegador. Aqui fica só a regra, pura: ler a resposta de cada banco, emendar com o extrato
// que já foi importado à mão e montar as importações do jeito que a tela de Importar extrato já mostra e desfaz.
//
// Uma importação por conta bancária e por mês (id api_<conta>_<AAAA-MM>): o robô puxa o mês todo dia e regrava a mesma,
// então a lista de importações não cresce um item por dia. As linhas usam o mesmo id fixo do extrato por arquivo
// (linhasDoExtrato), então puxar de novo não duplica.
//
// A emenda com o extrato manual: o histórico da API não é o do PDF ("PIX RECEB.OUTRA IF" × "PIX RECEBIDO - OUTRA IF"),
// então a mesma linha teria outro id. Por isso a API só vale a partir do último dia que o extrato manual da conta cobriu:
// antes dele, nada; no próprio dia, só o que não bate (valor e tipo) com uma linha manual daquele dia.
import { linhasDoExtrato, resumoDoExtrato, type ImportacaoDeExtrato, type LancamentoDoBanco, type LinhaLida } from './banco';

export type BancoPelaApi = 'sicoob' | 'efi';
export const NOME_DO_BANCO_PELA_API: Record<BancoPelaApi, string> = { sicoob: 'Sicoob', efi: 'Efí' };

/** o saldo que o banco informou: em centavos (negativo = devedor), e o dia a que ele vale (AAAA-MM-DD) */
export interface SaldoDaApi { valor: number; data: string }

// ─── leitura ─────────────────────────────────────────────────────────────────────────────────────────────────────────

/** "2026-11-03T00:00:00-03:00", "2026-11-03" ou "03/11/2026" → "2026-11-03"; o resto, '' */
function dataIso(v: unknown): string {
  const s = String(v ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? m[3] + '-' + m[2] + '-' + m[1] : '';
}

/** 1234.5, "1234.50", "1.234,50", "-12,00" → centavos; o que não é número, undefined */
function centavos(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v * 100) : undefined;
  let s = String(v ?? '').trim().replace(/\s|R\$/g, '');
  if (!s) return undefined;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : undefined;
}

const texto = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : '').replace(/\s+/g, ' ').trim();

/**
 * A resposta do extrato da API Conta Corrente do Sicoob ({ resultado: { saldoAnterior, saldoAtual, transacoes: [{ tipo,
 * valor, data, descricao, descInfComplementar }] } }). Tolerante de propósito (o campo sem o "resultado" em volta, o valor
 * em texto ou em número, o tipo CREDITO/DEBITO ou C/D, o valor já com sinal), até conferir com a resposta real da
 * homologação. As linhas de saldo que alguns extratos misturam aos lançamentos ficam de fora.
 */
export function lidasDoSicoob(resposta: unknown): { lidas: LinhaLida[]; saldoAnterior?: number; saldoAtual?: number } {
  const r = (resposta && typeof resposta === 'object' ? resposta : {}) as Record<string, unknown>;
  const raiz = (r.resultado && typeof r.resultado === 'object' ? r.resultado : r) as Record<string, unknown>;
  const transacoes = Array.isArray(raiz.transacoes) ? raiz.transacoes : [];
  const lidas: LinhaLida[] = [];
  for (const t of transacoes as Record<string, unknown>[]) {
    if (!t || typeof t !== 'object') continue;
    const data = dataIso(t.data ?? t.dataLancamento ?? t.dataTransacao);
    const bruto = centavos(t.valor);
    if (!data || bruto == null || !bruto) continue;
    const tipo = texto(t.tipo).toUpperCase();
    const valor = /^D/.test(tipo) ? -Math.abs(bruto) : /^C/.test(tipo) ? Math.abs(bruto) : bruto;
    const historico = [texto(t.descricao ?? t.historico), texto(t.descInfComplementar ?? t.complemento)].filter(Boolean).join(' - ');
    if (/^SALDO\b/i.test(historico)) continue;
    lidas.push({ data, valor, historico });
  }
  const saldoAnterior = centavos(raiz.saldoAnterior);
  const saldoAtual = centavos(raiz.saldoAtual);
  return { lidas, ...(saldoAnterior != null ? { saldoAnterior } : {}), ...(saldoAtual != null ? { saldoAtual } : {}) };
}

/** um lote do arquivo CNAB 240 de extrato (uma conta) */
export interface LoteDoCnab { agencia: string; conta: string; lidas: LinhaLida[]; saldoInicial?: SaldoDaApi; saldoFinal?: SaldoDaApi }

/** "03112026" → "2026-11-03" */
const dataDoCnab = (s: string) => (/^\d{8}$/.test(s) && s !== '00000000' ? s.slice(4, 8) + '-' + s.slice(2, 4) + '-' + s.slice(0, 2) : '');

/** o saldo do header (inicial) ou do trailer (final) do lote: data 143-150, valor 151-168 (2 casas), D/C 169 */
function saldoDoCnab(l: string): SaldoDaApi | undefined {
  const data = dataDoCnab(l.slice(142, 150));
  const n = l.slice(150, 168);
  if (!data || !/^\d{18}$/.test(n)) return undefined;
  const v = Number(n);
  return { valor: l[168] === 'D' ? -v : v, data };
}

/**
 * O arquivo de extrato no CNAB 240 da FEBRABAN ("Extrato para Conciliação Bancária", o que a API Extratos do Efí entrega):
 * por lote (cada conta), o saldo inicial (header do lote), os lançamentos (segmento E: data 143-150, valor 151-168, D/C
 * 169, histórico 177-201, complemento 114-133) e o saldo final (trailer do lote). Linha curta (sem os brancos do fim) vale.
 */
export function lotesDoCnab240(arquivo: string): LoteDoCnab[] {
  const lotes: LoteDoCnab[] = [];
  let atual: LoteDoCnab | null = null;
  for (const bruta of arquivo.split(/\r?\n/)) {
    if (bruta.length < 14) continue;
    const l = bruta.padEnd(240, ' ');
    const registro = l[7];
    if (registro === '1') {
      atual = { agencia: l.slice(52, 57).replace(/^0+/, ''), conta: l.slice(58, 70).replace(/^0+/, '') + (l[70].trim() ? '-' + l[70] : ''), lidas: [] };
      const s = saldoDoCnab(l);
      if (s) atual.saldoInicial = s;
      lotes.push(atual);
    } else if (registro === '3' && l[13] === 'E' && atual) {
      const data = dataDoCnab(l.slice(142, 150));
      const n = l.slice(150, 168);
      if (!data || !/^\d{18}$/.test(n) || !Number(n)) continue;
      const historico = [texto(l.slice(176, 201)), texto(l.slice(113, 133))].filter(Boolean).join(' - ');
      atual.lidas.push({ data, valor: l[168] === 'D' ? -Number(n) : Number(n), historico });
    } else if (registro === '5' && atual) {
      const s = saldoDoCnab(l);
      if (s) atual.saldoFinal = s;
      atual = null;
    }
  }
  return lotes;
}

/** o número da conta sem o dígito e sem os zeros da frente (para casar a conta do Cadastro com a do arquivo) */
function nucleo(conta: string): string {
  const d = conta.replace(/\D+/g, '');
  const semDv = /[-.\s][0-9xX]$/.test(conta.trim()) && d.length > 1 ? d.slice(0, -1) : d;
  return semDv.replace(/^0+/, '');
}

/** o lote da conta (pelo número, com ou sem o dígito); com um lote só no arquivo, ele */
export function loteDaConta(lotes: readonly LoteDoCnab[], conta: string | undefined): LoteDoCnab | null {
  if (conta) {
    const alvo = nucleo(conta), inteiro = conta.replace(/\D+/g, '').replace(/^0+/, '');
    const achado = lotes.find(l => { const d = l.conta.replace(/\D+/g, '').replace(/^0+/, ''); return d === inteiro || d === alvo || nucleo(l.conta) === alvo; });
    if (achado) return achado;
  }
  return lotes.length === 1 ? lotes[0] : null;
}

/**
 * Vários arquivos de extrato da mesma conta, que podem se sobrepor (o do dia e o do mês): cada dia vem de um arquivo só, o
 * gerado por último entre os que têm lançamento naquele dia — senão a mesma linha nos dois viraria duas (o id conta a ordem
 * entre as iguais). O saldo é o final mais adiante (no empate, o do arquivo mais novo).
 */
export function juntarArquivosDoExtrato(arquivos: readonly { geradoEm: string; lote: LoteDoCnab }[]): { lidas: LinhaLida[]; saldo?: SaldoDaApi } {
  const ordem = [...arquivos].sort((a, b) => b.geradoEm.localeCompare(a.geradoEm));
  const donoDoDia = new Map<string, LoteDoCnab>();
  for (const a of ordem) for (const l of a.lote.lidas) if (!donoDoDia.has(l.data)) donoDoDia.set(l.data, a.lote);
  const lidas: LinhaLida[] = [];
  for (const a of [...ordem].reverse()) for (const l of a.lote.lidas) if (donoDoDia.get(l.data) === a.lote) lidas.push(l);
  lidas.sort((a, b) => a.data.localeCompare(b.data));
  let saldo: SaldoDaApi | undefined;
  for (const a of ordem) if (a.lote.saldoFinal && (!saldo || a.lote.saldoFinal.data > saldo.data)) saldo = a.lote.saldoFinal;
  return { lidas, ...(saldo ? { saldo } : {}) };
}

// ─── o período e a emenda com o extrato manual ───────────────────────────────────────────────────────────────────────

/** os meses que o robô busca hoje: o atual e, nos primeiros dias do mês, também o anterior (o fim dele chega atrasado) */
export function mesesParaBuscar(hoje: string, diasDoMesAnterior = 5): string[] {
  const mes = hoje.slice(0, 7);
  if (Number(hoje.slice(8, 10)) > diasDoMesAnterior) return [mes];
  const [a, m] = mes.split('-').map(Number);
  const anterior = m === 1 ? (a - 1) + '-12' : a + '-' + String(m - 1).padStart(2, '0');
  return [anterior, mes];
}

/** o último dia do mês "AAAA-MM" */
export function ultimoDiaDoMes(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  return mes + '-' + String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, '0');
}

export const idDaImportacaoPelaApi = (contaBancaria: string, mes: string) => 'api_' + contaBancaria + '_' + mes;
export const ehImportacaoPelaApi = (id: string) => id.startsWith('api_');

/** o último dia que o extrato importado à mão (arquivo) cobriu nesta conta; sem nenhum, null */
export function ultimoDiaManual(importacoes: readonly Pick<ImportacaoDeExtrato, 'id' | 'ate' | 'contaBancaria'>[], contaBancaria: string): string | null {
  let ultimo: string | null = null;
  for (const i of importacoes) if (i.contaBancaria === contaBancaria && !ehImportacaoPelaApi(i.id) && i.ate && (!ultimo || i.ate > ultimo)) ultimo = i.ate;
  return ultimo;
}

/**
 * O que a API traz que o extrato manual não cobriu: depois do último dia manual, tudo; antes, nada; no próprio dia, só o
 * que não bate (o mesmo valor e o mesmo sentido, uma vez cada) com as linhas manuais daquele dia.
 */
export function emendarComOManual(lidas: readonly LinhaLida[], ultimoDia: string | null, manuaisDoDia: readonly Pick<LancamentoDoBanco, 'valor' | 'tipo'>[]): LinhaLida[] {
  if (!ultimoDia) return [...lidas];
  const sobra = new Map<string, number>();
  for (const m of manuaisDoDia) { const k = (m.tipo === 'S' ? -1 : 1) * Math.round(m.valor * 100) + ''; sobra.set(k, (sobra.get(k) || 0) + 1); }
  const out: LinhaLida[] = [];
  for (const l of lidas) {
    if (l.data < ultimoDia) continue;
    if (l.data === ultimoDia) {
      const k = Math.round(l.valor) + '';
      const n = sobra.get(k) || 0;
      if (n) { sobra.set(k, n - 1); continue; }
    }
    out.push(l);
  }
  return out;
}

// ─── as importações ──────────────────────────────────────────────────────────────────────────────────────────────────

/** a conta bancária do Cadastro, só o que a importação usa */
export interface ContaDaApi { id: string; marca: string; nome: string; agencia?: string; conta?: string; apelido?: string }

/** "Conta movimento · Ag. 3144 · C/C 12345-6" (o mesmo rótulo da tela de Importar extrato) */
export const rotuloDaContaBancaria = (c: { agencia?: string; conta?: string; apelido?: string }) =>
  [c.apelido, c.agencia ? 'Ag. ' + c.agencia : '', c.conta ? 'C/C ' + c.conta : ''].filter(Boolean).join(' · ');

/** uma importação do mês pronta para conferir com o banco: o documento (sem o resumo e o carimbo) e todas as linhas */
export interface ImportacaoPelaApi {
  importacao: Omit<ImportacaoDeExtrato, 'quantos' | 'entradas' | 'saidas' | 'importadoEm' | 'importadoPor'>;
  linhas: LancamentoDoBanco[];
}

/**
 * As importações do mês (uma por mês que a API trouxe): as linhas (já emendadas) com o id fixo e a conta, o período (do
 * primeiro lançamento — ou do dia 1 — até o último dia coberto: hoje no mês corrente, o último dia nos outros) e o saldo no
 * mês do dia do saldo. Saldo de antes do último dia manual não entra (o manual já mostra aquele).
 */
export function importacoesPelaApi(p: {
  banco: BancoPelaApi; conta: ContaDaApi; contaDoPlano?: string; lidas: readonly LinhaLida[]; saldo?: SaldoDaApi; hoje: string; ultimoDiaManual?: string | null;
}): ImportacaoPelaApi[] {
  const nome = NOME_DO_BANCO_PELA_API[p.banco];
  const porMes = new Map<string, LinhaLida[]>();
  for (const l of p.lidas) porMes.set(l.data.slice(0, 7), [...(porMes.get(l.data.slice(0, 7)) ?? []), l]);
  const saldo = p.saldo && (!p.ultimoDiaManual || p.saldo.data >= p.ultimoDiaManual) ? p.saldo : undefined;
  if (saldo && !porMes.has(saldo.data.slice(0, 7))) porMes.set(saldo.data.slice(0, 7), []);
  const out: ImportacaoPelaApi[] = [];
  for (const mes of [...porMes.keys()].sort()) {
    const id = idDaImportacaoPelaApi(p.conta.id, mes);
    const linhas = linhasDoExtrato(porMes.get(mes)!, nome, id, p.conta.id).map(l => ({ ...l, ...(p.contaDoPlano ? { conta: p.contaDoPlano } : {}) }));
    const datas = linhas.map(l => l.data).sort();
    const fim = p.hoje.slice(0, 7) === mes ? p.hoje : ultimoDiaDoMes(mes);
    const doSaldo = saldo && saldo.data.slice(0, 7) === mes ? saldo : undefined;
    const ate = [datas.at(-1) ?? '', doSaldo?.data ?? '', fim].sort().at(-1)!;
    out.push({
      importacao: {
        id, banco: nome, marca: p.conta.marca, contaBancaria: p.conta.id, ...(p.contaDoPlano ? { conta: p.contaDoPlano } : {}),
        rotuloDaConta: rotuloDaContaBancaria(p.conta), arquivo: 'API do ' + nome + ' · ' + mes.slice(5) + '/' + mes.slice(0, 4),
        de: datas[0] ?? mes + '-01', ate, ...(doSaldo ? { saldoFinal: Math.round(doSaldo.valor) / 100 } : {}),
      },
      linhas,
    });
  }
  return out;
}

/**
 * Depois de ver quais linhas já estão no banco (o mesmo id): as novas para gravar e o resumo da importação — as linhas que
 * ela gravou (as novas e as que já eram dela), como na importação por arquivo, em que as de outra importação não contam.
 */
export function fecharImportacao(imp: ImportacaoPelaApi, jaGravadas: readonly Pick<LancamentoDoBanco, 'id' | 'importacao'>[]):
  { novas: LancamentoDoBanco[]; resumo: { quantos: number; entradas: number; saidas: number } } {
  const porId = new Map(jaGravadas.map(g => [g.id, g.importacao]));
  const novas = imp.linhas.filter(l => !porId.has(l.id));
  const dela = imp.linhas.filter(l => !porId.has(l.id) || porId.get(l.id) === imp.importacao.id);
  const { quantos, entradas, saidas } = resumoDoExtrato(dela);
  return { novas, resumo: { quantos, entradas, saidas } };
}
