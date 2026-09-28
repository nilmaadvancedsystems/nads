// Leitura do relatório de liquidação do banco (passo 1 do fluxo): de planilha (.xls/.xlsx/.csv) ou
// de texto (o PDF lido no navegador, ou o texto copiado do PDF e colado). Extrai Sacado, Nosso
// Número, Seu Número (NF), Valor, Mora, Desconto, Dt. Liquidação e Vlr. Cobrado, os totais
// impressos de cada grupo e o total geral, e deixa de fora a seção "Baixa - Pedido Cedente".
// Foto não entra: ler imagem exige OCR. Nesse caso a pessoa digita os títulos na conferência.
import { normalizarTexto } from '../../formatos';
import { dataBR, dinheiro, ordemData, r2 } from '../regras/numeros';
import type { ColunaValor, Grupo, RelatorioBanco, Titulo, TotaisImpressos } from '../tipos';
import { linhasDaPlanilha, textoDaCelula, type Linha } from './planilha';

export type CampoBanco = 'sacado' | 'nosso' | 'seu' | 'vencimento' | 'valor' | 'mora' | 'desconto' | 'liquidacao' | 'cobrado';

export const EXTENSOES_BANCO: readonly string[] = ['.pdf', '.csv', '.xls', '.xlsx', '.txt'];

export const TOTAIS_VAZIOS: TotaisImpressos = { valor: null, mora: null, desconto: null, cobrado: null };

/** Qual campo é esta coluna do cabeçalho? ("Vlr. Desc. Acresc." → desconto, "Dt. Liquidação" → liquidacao) */
export function campoDoCabecalho(h: unknown): CampoBanco | null {
  const s = normalizarTexto(h);
  if (!s) return null;
  if (/nosso/.test(s)) return 'nosso';
  if (/seu n|^(n )?documento|^nf\b|nota fiscal/.test(s)) return 'seu';
  if (/sacado|pagador|cliente/.test(s)) return 'sacado';
  if (/venc/.test(s)) return 'vencimento';
  if (/mora|juros/.test(s)) return 'mora';
  if (/desc|abatim/.test(s)) return 'desconto';
  if (/cobrado|pago|recebido/.test(s)) return 'cobrado';
  if (/liquida|^(dt|data) (liq|pag|cred)/.test(s)) return 'liquidacao';
  if (/valor|vlr/.test(s)) return 'valor';
  return null;
}

const ehBaixa = (n: string) => /baixa/.test(n) && /(cedente|pedido)/.test(n);
const ehTotalGeral = (n: string) => /total/.test(n) && /(liquidados|geral)/.test(n);

interface Bloco { titulos: Titulo[]; impresso: TotaisImpressos }

/** Junta os blocos lidos. Sem nenhum total impresso, os grupos passam a ser os dias de liquidação. */
function montar(blocos: Bloco[], totalGeral: TotaisImpressos, ignorados: number, avisos: string[]): RelatorioBanco {
  let lista = blocos.filter(b => b.titulos.length);
  const algumTotal = lista.some(b => Object.values(b.impresso).some(v => v != null));
  if (!algumTotal) {
    const titulos = lista.flatMap(b => b.titulos);
    const datas = [...new Set(titulos.map(t => t.liquidacao))].sort((a, b) => ordemData(a) - ordemData(b));
    lista = datas.map(d => ({ titulos: titulos.filter(t => t.liquidacao === d), impresso: { ...TOTAIS_VAZIOS } }));
    if (titulos.length) avisos.push('O relatório não trouxe "Total de Valores do grupo": separei os grupos por dia de liquidação. Digite o total impresso de cada dia na conferência.');
  }
  const grupos: Grupo[] = lista.map((b, i) => ({ id: i + 1, titulos: b.titulos, impresso: b.impresso }));
  const semData = grupos.flatMap(g => g.titulos).filter(t => !t.liquidacao).length;
  if (semData) avisos.push(semData + ' título(s) sem data de liquidação: preencha na conferência.');
  return { grupos, totalGeral, ignorados, avisos };
}

// ─── planilha ────────────────────────────────────────────────────────────────

function mapaDoCabecalho(linha: Linha): Partial<Record<CampoBanco, number>> | null {
  const mapa: Partial<Record<CampoBanco, number>> = {};
  linha.forEach((c, i) => { const k = campoDoCabecalho(c); if (k && mapa[k] == null) mapa[k] = i; });
  return mapa.seu != null && mapa.valor != null && Object.keys(mapa).length >= 3 ? mapa : null;
}

export function lerRelatorioPlanilha(buf: ArrayBuffer, nome: string): RelatorioBanco {
  const linhas = linhasDaPlanilha(buf, nome);
  let mapa: Partial<Record<CampoBanco, number>> | null = null;
  const blocos: Bloco[] = [];
  let bloco: Bloco = { titulos: [], impresso: { ...TOTAIS_VAZIOS } };
  let totalGeral: TotaisImpressos = { ...TOTAIS_VAZIOS };
  let ignorando = false, ignorados = 0, id = 1;
  const cel = (l: Linha, k: CampoBanco) => (mapa && mapa[k] != null ? l[mapa[k] as number] : null);
  const totais = (l: Linha): TotaisImpressos => ({ valor: dinheiro(cel(l, 'valor')), mora: dinheiro(cel(l, 'mora')), desconto: dinheiro(cel(l, 'desconto')), cobrado: dinheiro(cel(l, 'cobrado')) });

  for (const l of linhas) {
    const n = normalizarTexto(l.map(textoDaCelula).join(' '));
    if (!n) continue;
    const cab = mapaDoCabecalho(l);
    if (cab) { mapa = cab; continue; }
    if (ehBaixa(n)) { ignorando = true; continue; }
    if (!mapa) continue;
    if (/total/.test(n)) {
      // o total geral fecha o relatório, mesmo depois da seção de baixas
      if (ehTotalGeral(n)) { totalGeral = totais(l); ignorando = false; continue; }
      if (ignorando) continue;
      bloco.impresso = totais(l); blocos.push(bloco); bloco = { titulos: [], impresso: { ...TOTAIS_VAZIOS } };
      continue;
    }
    const seu = textoDaCelula(cel(l, 'seu'));
    const valor = dinheiro(cel(l, 'valor'));
    if (!seu || valor == null) {
      if (/liquida/.test(n)) ignorando = false; // título de seção "Liquidação"
      continue;
    }
    if (ignorando) { ignorados++; continue; }
    bloco.titulos.push({
      id: id++, sacado: textoDaCelula(cel(l, 'sacado')), nossoNumero: textoDaCelula(cel(l, 'nosso')), nf: seu, valor,
      mora: dinheiro(cel(l, 'mora')) || 0, desconto: dinheiro(cel(l, 'desconto')) || 0,
      liquidacao: dataBR(cel(l, 'liquidacao')), cobrado: dinheiro(cel(l, 'cobrado')),
    });
  }
  blocos.push(bloco);
  if (!mapa) throw new Error('Não achei o cabeçalho do relatório (colunas como Sacado, Seu Número e Valor).');
  return montar(blocos, totalGeral, ignorados, []);
}

// ─── texto (PDF lido ou texto colado) ────────────────────────────────────────

const RE_DATA = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;
const RE_DINHEIRO = /(?<![\d.,])-?\d{1,3}(?:\.\d{3})*,\d{2}(?![\d,])/g;
const RE_INTEIRO = /(?<![\w,])\d[\d\-/.]*\d(?![\w,])|(?<![\w,.])\d(?![\w,.])/g;

interface Ordem { dinheiro: ColunaValor[]; datas: ('vencimento' | 'liquidacao')[]; inteiros: ('nosso' | 'seu')[] }

const PADROES_CABECALHO: [CampoBanco, RegExp][] = [
  ['sacado', /sacado|pagador/], ['nosso', /nosso/], ['seu', /seu n/], ['vencimento', /venc/],
  ['valor', /\bvalor\b(?! cobrado| pago| liquid)|vlr (titulo|nominal)/], ['mora', /mora|juros/], ['desconto', /desc|abatim/],
  ['liquidacao', /liquida/], ['cobrado', /cobrado|pago|recebido/],
];

/** Linha de cabeçalho → em que ordem vêm os valores, as datas e os números. null se não é cabeçalho. */
export function ordemDoCabecalho(linha: string): Ordem | null {
  const n = normalizarTexto(linha);
  if (!/(sacado|pagador)/.test(n) || !/(valor|vlr)/.test(n)) return null;
  const pos: Partial<Record<CampoBanco, number>> = {};
  for (const [k, re] of PADROES_CABECALHO) { const m = n.match(re); if (m && m.index != null) pos[k] = m.index; }
  const ord = <T extends CampoBanco>(ks: T[]) => ks.filter(k => pos[k] != null).sort((a, b) => (pos[a] as number) - (pos[b] as number));
  return { dinheiro: ord(['valor', 'mora', 'desconto', 'cobrado']), datas: ord(['vencimento', 'liquidacao']), inteiros: ord(['nosso', 'seu']) };
}

/** Distribui os valores de dinheiro da linha nas colunas (pela ordem do cabeçalho, ou adivinhando). */
function distribuir(valores: number[], ordem: Ordem | null): { t: TotaisImpressos; adivinhado: boolean } {
  const t: TotaisImpressos = { ...TOTAIS_VAZIOS };
  if (ordem && ordem.dinheiro.length === valores.length) {
    ordem.dinheiro.forEach((c, i) => { t[c] = valores[i]; });
    return { t, adivinhado: false };
  }
  if (!valores.length) return { t, adivinhado: false };
  t.valor = valores[0];
  if (valores.length >= 4) { t.mora = valores[1]; t.desconto = valores[2]; t.cobrado = valores[valores.length - 1]; }
  else if (valores.length >= 2) {
    t.cobrado = valores[valores.length - 1];
    const meio = valores.length === 3 ? valores[1] : Math.abs(r2(t.cobrado - t.valor));
    if (t.cobrado > t.valor) t.mora = meio; else if (t.cobrado < t.valor) t.desconto = meio;
  }
  return { t, adivinhado: valores.length > 1 };
}

function dinheiros(linha: string): number[] {
  return (linha.match(RE_DINHEIRO) || []).map(s => dinheiro(s) as number);
}

/** Uma linha de título: Sacado, números, valores e datas, na ordem do cabeçalho quando há. */
export function tituloDaLinha(linha: string, ordem: Ordem | null, id: number): Titulo | null {
  const datas = linha.match(RE_DATA) || [];
  const valores = dinheiros(linha);
  if (!datas.length || !valores.length) return null;
  const resto = linha.replace(RE_DATA, ' ').replace(RE_DINHEIRO, ' ');
  const inteiros = resto.match(RE_INTEIRO) || [];
  const { t, adivinhado } = distribuir(valores, ordem);

  let liquidacao = datas[datas.length - 1];
  if (ordem && ordem.datas.length === datas.length) liquidacao = datas[ordem.datas.indexOf('liquidacao')] ?? liquidacao;

  // número no meio do nome ("MERCADO 2 IRMÃOS") vem antes: com cabeçalho, valem os últimos números
  let nosso = '', seu = '', usados: string[];
  if (ordem && ordem.inteiros.length && inteiros.length >= ordem.inteiros.length) {
    usados = inteiros.slice(-ordem.inteiros.length);
    ordem.inteiros.forEach((k, i) => { if (k === 'nosso') nosso = usados[i]; else seu = usados[i]; });
  } else if (inteiros.length >= 2) {
    // sem cabeçalho: o Nosso Número é o mais comprido; o Seu Número, o primeiro dos outros
    nosso = [...inteiros].sort((a, b) => b.length - a.length)[0];
    seu = inteiros.find(x => x !== nosso) || '';
    usados = [nosso, seu];
  } else { seu = inteiros[0] || ''; usados = [seu]; }
  if (!seu) return null;
  let semNumeros = resto;
  for (const u of usados) semNumeros = semNumeros.replace(u, ' ');
  const sacado = semNumeros.replace(/R\$/g, ' ').replace(/\s+/g, ' ').trim();

  return {
    id, sacado, nossoNumero: nosso, nf: seu, valor: t.valor as number, mora: t.mora || 0, desconto: t.desconto || 0,
    liquidacao: dataBR(liquidacao), cobrado: t.cobrado,
    aviso: adivinhado ? 'Colunas de valor sem cabeçalho: confira valor, mora, desconto e cobrado.' : undefined,
  };
}

/** Relatório a partir do texto (uma linha do relatório por linha de texto). */
export function lerRelatorioTexto(texto: string): RelatorioBanco {
  const blocos: Bloco[] = [];
  let bloco: Bloco = { titulos: [], impresso: { ...TOTAIS_VAZIOS } };
  let totalGeral: TotaisImpressos = { ...TOTAIS_VAZIOS };
  let ordem: Ordem | null = null;
  let ignorando = false, ignorados = 0, id = 1;
  const avisos: string[] = [];

  for (const linha of texto.split(/\r?\n/)) {
    const n = normalizarTexto(linha);
    if (!n) continue;
    const cab = ordemDoCabecalho(linha);
    if (cab) { if (!ignorando) ordem = cab; continue; }
    if (ehBaixa(n)) { ignorando = true; continue; }
    if (/total/.test(n)) {
      const t = distribuir(dinheiros(linha), ordem).t;
      // o total geral fecha o relatório, mesmo depois da seção de baixas
      if (ehTotalGeral(n)) { totalGeral = t; ignorando = false; continue; }
      if (ignorando) continue;
      bloco.impresso = t; blocos.push(bloco); bloco = { titulos: [], impresso: { ...TOTAIS_VAZIOS } };
      continue;
    }
    const titulo = tituloDaLinha(linha, ordem, id);
    if (!titulo) {
      if (/liquida/.test(n) && !dinheiros(linha).length) ignorando = false; // título de seção "Liquidação"
      continue;
    }
    if (ignorando) { ignorados++; continue; }
    id++;
    bloco.titulos.push(titulo);
  }
  blocos.push(bloco);
  if (!ordem) avisos.push('Não achei a linha de cabeçalho (Sacado, Valor…): as colunas foram adivinhadas. Confira linha a linha.');
  return montar(blocos, totalGeral, ignorados, avisos);
}
