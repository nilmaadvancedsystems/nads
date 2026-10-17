// A guia que entra na entrega (16/10/2026, a cópia fiel do Entregas): o que o entregas.html tira do texto do PDF (o
// cliente pelo CNPJ ou pelo nome, o tipo do documento, a competência, o vencimento impresso, o valor e o código para
// pagar — a linha digitável ou o PIX copia e cola, só quando o dígito/CRC confere), o vencimento automático (dia 20 do mês
// seguinte, com fim de semana e feriado nacional), o PIX do escritório (BR Code com o valor) e as guias que já estão na
// pasta do cliente no Drive (FGTS, DARF e DAS do mês da guia). Tudo puro: o PDF é lido pela tela (pdf.js), o texto vem aqui.
import { type ClienteDaRota, type CodigoPagamento, type ItemDaEntrega } from './documentos';
import type { ItemDoDrive } from './drive';

/** O texto sem acento e em caixa alta (normalizarTexto_). */
export const textoNormalizado = (s: string) => String(s || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Cada palavra-chave procurada no texto (DETECCAO_TIPO do Entregas): o primeiro que bater é o tipo. */
const DETECCAO_TIPO: readonly { chave: string; kws: string[] }[] = [
  { chave: 'das', kws: ['SIMPLES NACIONAL', 'DOCUMENTO DE ARRECADACAO DO SIMPLES'] },
  { chave: 'icms_antecipado', kws: ['ANTECIPACAO TRIBUTARIA', 'ICMS ANTECIPADO'] },
  { chave: 'icms_difal', kws: ['DIFERENCIAL DE ALIQUOTA', 'DIFAL'] },
  { chave: 'icms_st', kws: ['SUBSTITUICAO TRIBUTARIA'] },
  { chave: 'fgts', kws: ['FGTS', 'GUIA DE RECOLHIMENTO DO FGTS'] },
  { chave: 'darf', kws: ['DARF', 'DOCUMENTO DE ARRECADACAO DE RECEITAS FEDERAIS'] },
  { chave: 'dae', kws: [' DAE '] },
  { chave: 'honorario', kws: ['HONORARIO'] },
  { chave: 'ccir', kws: ['CCIR', 'CADASTRO DE IMOVEL RURAL'] },
  { chave: 'multa_rescisoria', kws: ['MULTA RESCISORIA', 'RESCISAO CONTRATUAL'] },
  { chave: 'ferias', kws: ['RECIBO DE FERIAS'] },
  { chave: 'folha_pagamento', kws: ['FOLHA DE PAGAMENTO', 'HOLERITE', 'RECIBO DE PAGAMENTO DE SALARIO'] },
  { chave: 'prolabore', kws: ['PROLABORE', 'PRO-LABORE', 'PRO LABORE'] },
  { chave: 'esocial', kws: ['ESOCIAL', 'E-SOCIAL'] },
  { chave: 'boleto', kws: ['BOLETO'] },
];

const MESES_BUSCA = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

interface DataAchada { idx: number; mes: number; ano: string }

function buscarDatas(trecho: string, base: number): DataAchada[] {
  const r: DataAchada[] = [];
  const reNum = /\b(0[1-9]|1[0-2])\/(\d{4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = reNum.exec(trecho))) r.push({ idx: base + m.index, mes: Number(m[1]), ano: m[2] });
  const reNome = /\b(janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\/(\d{4})\b/gi;
  while ((m = reNome.exec(trecho))) {
    const mi = MESES_BUSCA.indexOf(m[1].toLowerCase().replace('ç', 'c'));
    if (mi !== -1) r.push({ idx: base + m.index, mes: mi + 1, ano: m[2] });
  }
  return r.sort((a, b) => a.idx - b.idx);
}
const pareceVencimento = (t: string, idx: number) => /vencimento|pagar|at[ée]\s*$/i.test(t.slice(Math.max(0, idx - 30), idx));

/** A competência impressa ('AAAA-MM'): a data logo depois de "Competência"/"Período de apuração", sem as de vencimento. */
export function competenciaDoPdf(bruto: string): string | null {
  const kw = bruto.match(/compet[êe]ncia|per[íi]odo de apura[çc][ãa]o/i);
  let achada: DataAchada | undefined;
  if (kw && kw.index !== undefined) {
    achada = buscarDatas(bruto.slice(kw.index, kw.index + 250), kw.index).filter(c => !pareceVencimento(bruto, c.idx))[0];
  }
  if (!achada) achada = buscarDatas(bruto, 0).filter(c => !pareceVencimento(bruto, c.idx))[0];
  return achada ? achada.ano + '-' + String(achada.mes).padStart(2, '0') : null;
}

/** O vencimento impresso ('AAAA-MM-DD'): só o que está perto de um rótulo de vencimento (o primeiro). */
export function vencimentoDoPdf(bruto: string): string | null {
  const re = /\b(0?[1-9]|[12]\d|3[01])\/(0?[1-9]|1[0-2])\/(\d{4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bruto))) {
    const antes = bruto.slice(Math.max(0, m.index - 40), m.index);
    if (!/vencimento|pagar at[ée]|data limite|validade|vence em/i.test(antes)) continue;
    return m[3] + '-' + String(Number(m[2])).padStart(2, '0') + '-' + String(Number(m[1])).padStart(2, '0');
  }
  return null;
}

/** O tipo do documento pelas palavras-chave (a chave de TIPOS_DE_DOCUMENTO), ou null. */
export function tipoDoPdf(bruto: string): string | null {
  const t = textoNormalizado(bruto);
  return DETECCAO_TIPO.find(d => d.kws.some(kw => t.includes(kw)))?.chave || null;
}

/** O valor impresso (o texto do número, como a pessoa digitaria): "R$ …", "Valor a recolher …", "Total da guia …". */
export function valorDoPdf(bruto: string): string | null {
  const t = textoNormalizado(bruto);
  const m = bruto.match(/R\$\s*([\d.,]+)/) || t.match(/VALOR A RECOLHER\D{0,20}([\d.,]+)/) || t.match(/TOTAL DA GUIA\D{0,20}([\d.,]+)/)
    || t.match(/VALOR TOTAL\D{0,20}([\d.,]+)/) || t.match(/VALOR DO DOCUMENTO\D{0,20}([\d.,]+)/);
  return m ? m[1] : null;
}

/** O cliente citado no PDF: pelo CNPJ/CPF completo; senão, pelo nome (8 letras ou mais) escrito no texto. */
export function clienteDoPdf<C extends Pick<ClienteDaRota, 'documento' | 'nome'>>(bruto: string, clientes: readonly C[]): C | null {
  const t = textoNormalizado(bruto);
  const docs = t.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g) || [];
  for (const d of docs) {
    const dig = d.replace(/\D/g, '');
    if (dig.length < 11) continue;
    const c = clientes.find(x => (x.documento || '').replace(/\D/g, '') === dig);
    if (c) return c;
  }
  return clientes.find(c => { const n = textoNormalizado(c.nome || ''); return n.length >= 8 && t.includes(n); }) || null;
}

/** O PDF cita um CNPJ/CPF de algum destes clientes? (senão, a tela busca a base inteira antes de ler) */
export function pdfCitaAlgum(bruto: string, clientes: readonly Pick<ClienteDaRota, 'documento'>[]): boolean {
  const docs = String(bruto).match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g) || [];
  return docs.some(d => { const dig = d.replace(/\D/g, ''); return clientes.some(c => (c.documento || '').replace(/\D/g, '') === dig); });
}

// ---------------------------------------------------------------------------------------------------------------------
// o código para pagar (só o que confere: o CRC do PIX, os dígitos do boleto e da guia de arrecadação)
// ---------------------------------------------------------------------------------------------------------------------
export function dvMod10(numeros: string): number {
  let soma = 0, peso = 2;
  for (let i = numeros.length - 1; i >= 0; i--) {
    const p = Number(numeros.charAt(i)) * peso;
    soma += p > 9 ? p - 9 : p;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}
export function dvMod11(numeros: string): number {
  let soma = 0, peso = 2;
  for (let i = numeros.length - 1; i >= 0; i--) {
    soma += Number(numeros.charAt(i)) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  if (resto === 0 || resto === 1) return 0;
  if (resto === 10) return 1;
  return 11 - resto;
}
export function crc16Pix(t: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < t.length; i++) {
    crc ^= t.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
  }
  return ('0000' + crc.toString(16).toUpperCase()).slice(-4);
}
export function pixValido(codigo: string): boolean {
  const m = codigo.match(/^(000201[\s\S]*6304)([0-9A-Fa-f]{4})$/);
  return !!m && crc16Pix(m[1]) === m[2].toUpperCase();
}

/** O código para pagar lido do texto do PDF (extrairCodigoPagamento_). */
export function codigoDePagamentoDoPdf(bruto: string): CodigoPagamento | null {
  const t = String(bruto || '');
  for (const p of t.match(/000201[\s\S]{40,600}?6304[0-9A-Fa-f]{4}/g) || []) {
    for (const c of [p, p.replace(/\s+/g, '')]) if (pixValido(c)) return { tipo: 'pix', codigo: c };
  }
  const arr = /(8\d{10})[\s.-]?(\d)[\s.]+(\d{11})[\s.-]?(\d)[\s.]+(\d{11})[\s.-]?(\d)[\s.]+(\d{11})[\s.-]?(\d)(?!\d)/g;
  let m: RegExpExecArray | null;
  let reserva: CodigoPagamento | null = null;
  while ((m = arr.exec(t))) {
    const g = m;
    // o 3º dígito diz qual conta vale: 6 e 7 = módulo 10; 8 e 9 = módulo 11
    const dv = g[1].charAt(2) === '6' || g[1].charAt(2) === '7' ? dvMod10 : dvMod11;
    const confere = [1, 3, 5, 7].every(k => dv(g[k]) === Number(g[k + 1]));
    const achado: CodigoPagamento = { tipo: 'boleto', codigo: [g[1] + g[2], g[3] + g[4], g[5] + g[6], g[7] + g[8]].join(' ') };
    if (confere) return achado;
    // formato inconfundível, mas a conta não fechou: guarda como reserva (o texto vem do PDF, os dígitos são exatos)
    if (!reserva) reserva = achado;
  }
  if (reserva) return reserva;
  const bol = /(\d{5})[.\s]?(\d{4})(\d)\s+(\d{5})[.\s]?(\d{5})(\d)\s+(\d{5})[.\s]?(\d{5})(\d)\s+(\d)\s+(\d{14})(?!\d)/g;
  while ((m = bol.exec(t))) {
    if (m[1].charAt(0) === '8') continue;
    const ok = dvMod10(m[1] + m[2]) === Number(m[3]) && dvMod10(m[4] + m[5]) === Number(m[6]) && dvMod10(m[7] + m[8]) === Number(m[9]);
    if (ok) return { tipo: 'boleto', codigo: m[1] + '.' + m[2] + m[3] + ' ' + m[4] + '.' + m[5] + m[6] + ' ' + m[7] + '.' + m[8] + m[9] + ' ' + m[10] + ' ' + m[11] };
  }
  return null;
}

/** As barras (44 dígitos) da linha digitável guardada (47 ou 48): é o que a câmera lê na guia de papel. */
export function barrasDaLinha(linha: string): string {
  const d = String(linha || '').replace(/\D/g, '');
  if (d.length === 48) return d.slice(0, 11) + d.slice(12, 23) + d.slice(24, 35) + d.slice(36, 47);
  if (d.length === 47) return d.slice(0, 4) + d.slice(32, 33) + d.slice(33, 47) + d.slice(4, 9) + d.slice(10, 20) + d.slice(21, 31);
  return '';
}
/** A parada da rota cujo código para pagar é o que a câmera leu (o QR do PIX ou as barras). */
export function paradaDoCodigo<E extends { codigoPagamento: CodigoPagamento | null }>(lido: string, pendentes: readonly E[]): E | null {
  const bruto = String(lido || '').trim();
  const digitos = bruto.replace(/\D/g, '');
  return pendentes.find(e => {
    const c = e.codigoPagamento?.codigo;
    if (!c) return false;
    if (/^000201/.test(c)) return c === bruto;
    return digitos.length >= 44 && (barrasDaLinha(c) === digitos || c.replace(/\D/g, '') === digitos);
  }) || null;
}

// ---------------------------------------------------------------------------------------------------------------------
// o PIX do escritório (BR Code estático; com o valor, o app do banco já abre com o total)
// ---------------------------------------------------------------------------------------------------------------------
/** A chave do jeito que o Banco Central pede: CPF/CNPJ só dígitos, telefone com +55, e-mail e aleatória em minúscula. */
export function chavePixNormalizada(chave: string): string {
  const t = String(chave || '').trim();
  if (!t) return '';
  if (t.includes('@')) return t.toLowerCase();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return t.toLowerCase();
  const digitos = t.replace(/\D/g, '');
  if (!digitos) return t;
  if (t.charAt(0) === '+' || /\(\s*\d{2}\s*\)/.test(t)) return '+55' + digitos.replace(/^55/, '');
  if (digitos.length === 11 || digitos.length === 14) return digitos;
  return t;
}
export function pixCopiaECola(chave: string, nome: string, cidade: string, valor?: number | null): string {
  const k = chavePixNormalizada(chave);
  if (!k) return '';
  const limpa = (s: string, n: number) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim().slice(0, n) || 'NA';
  const campo = (id: string, v: string) => id + String(v.length).padStart(2, '0') + v;
  const conta = campo('00', 'BR.GOV.BCB.PIX') + campo('01', k.trim());
  const comValor = typeof valor === 'number' && isFinite(valor) && valor > 0 ? campo('54', valor.toFixed(2)) : '';
  const payload = campo('00', '01') + campo('26', conta) + campo('52', '0000') + campo('53', '986') + comValor + campo('58', 'BR')
    + campo('59', limpa(nome, 25)) + campo('60', limpa(cidade, 15)) + campo('62', campo('05', '***')) + '6304';
  return payload + crc16Pix(payload);
}

// ---------------------------------------------------------------------------------------------------------------------
// o vencimento automático (dia 20 do mês seguinte; FGTS, DARF e eSocial antecipam, o DAS adia; pula fim de semana e feriado)
// ---------------------------------------------------------------------------------------------------------------------
const iso = (d: Date) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}
/**
 * Os feriados nacionais do ano, os mesmos da lista pública da BrasilAPI que o Entregas usa (/api/feriados/v1/{ano}):
 * Confraternização, Carnaval, Sexta-feira Santa, Páscoa, Tiradentes, Trabalho, Corpus Christi, Independência, Aparecida,
 * Finados, Proclamação da República, Consciência Negra e Natal. Calculados aqui (a Páscoa pelo cômputo), sem rede.
 */
export function feriadosNacionais(ano: number): Record<string, string> {
  const p = pascoa(ano);
  const mais = (dias: number) => { const d = new Date(p); d.setDate(d.getDate() + dias); return iso(d); };
  return {
    [ano + '-01-01']: 'Confraternização mundial', [mais(-47)]: 'Carnaval', [mais(-2)]: 'Sexta-feira Santa', [iso(p)]: 'Páscoa',
    [ano + '-04-21']: 'Tiradentes', [ano + '-05-01']: 'Dia do trabalho', [mais(60)]: 'Corpus Christi', [ano + '-09-07']: 'Independência do Brasil',
    [ano + '-10-12']: 'Nossa Senhora Aparecida', [ano + '-11-02']: 'Finados', [ano + '-11-15']: 'Proclamação da República',
    [ano + '-11-20']: 'Dia da consciência negra', [ano + '-12-25']: 'Natal',
  };
}
const feriadosGuardados = new Map<number, Record<string, string>>();
export function ehFeriado(d: Date): boolean {
  const ano = d.getFullYear();
  let f = feriadosGuardados.get(ano);
  if (!f) { f = feriadosNacionais(ano); feriadosGuardados.set(ano, f); }
  return !!f[iso(d)];
}
/** O dia útil antes (antecipa) ou depois (posterga), pulando sábado, domingo e feriado nacional. */
export function ajustarDiaUtil(data: Date, ajuste: 'antecipa' | 'posterga'): Date {
  const d = new Date(data.getTime());
  const passo = ajuste === 'antecipa' ? -1 : 1;
  while (d.getDay() === 0 || d.getDay() === 6 || ehFeriado(d)) d.setDate(d.getDate() + passo);
  return d;
}

const VENCIMENTO_AUTOMATICO: Record<string, { dia: number; ajuste: 'antecipa' | 'posterga' }> = {
  DAS: { dia: 20, ajuste: 'posterga' }, FGTS: { dia: 20, ajuste: 'antecipa' }, DARF: { dia: 20, ajuste: 'antecipa' }, eSocial: { dia: 20, ajuste: 'antecipa' },
};
function vencimentoDoTipo(competencia: string, tipo: string): string | null {
  const regra = VENCIMENTO_AUTOMATICO[tipo];
  const m = /^(\d{4})-(\d{2})$/.exec(competencia);
  if (!regra || !m) return null;
  // vence no mês seguinte ao da competência
  return iso(ajustarDiaUtil(new Date(Number(m[1]), Number(m[2]), regra.dia), regra.ajuste));
}
/**
 * O vencimento que o Entregas preenche sozinho: quando os documentos com regra (DAS, FGTS, DARF, eSocial) dão todos a mesma
 * data. Dois tipos com regras diferentes juntos: em branco (melhor que a data errada). null = não dá para sugerir.
 */
export function vencimentoAutomatico(competencia: string, itens: readonly Pick<ItemDaEntrega, 'tipo'>[]): string | null {
  const datas = new Set(itens.map(i => vencimentoDoTipo(competencia, i.tipo)).filter((x): x is string => !!x));
  return datas.size === 1 ? [...datas][0] : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// as guias que já estão na pasta do cliente no Drive (13/10/2026, no Entregas: "puxe as guias de FGTS e DARF da pasta")
// ---------------------------------------------------------------------------------------------------------------------
export interface GuiaDaPasta { tipo: 'fgts' | 'darf' | 'das'; nome: string; casa: (caminho: readonly string[]) => boolean }
export const GUIAS_DA_PASTA: readonly GuiaDaPasta[] = [
  { tipo: 'fgts', nome: 'FGTS', casa: p => { const t = p.join(' / '); return t.includes('FGTS') && !t.includes('CERTID'); } },
  { tipo: 'darf', nome: 'DARF', casa: p => p.join(' / ').includes('DARF') },
  // a pasta "01. DAS" (ou "DAS") ou o arquivo que começa com "DAS" — não qualquer nome com "das" no meio
  { tipo: 'das', nome: 'DAS', casa: p => p.slice(0, -1).some(s => /^(\d+\.\s*)?DAS$/.test(s)) || /^DAS[\s._-]/.test(p[p.length - 1] || '') },
];
const MESES_POR_EXTENSO = ['JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
/** O mês da guia: o anterior ao da entrega (a guia de setembro é entregue em outubro). */
export function mesDaGuia(competencia: string, hoje = new Date()): { mm: string; aaaa: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia || '');
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  d.setMonth(d.getMonth() - 1);
  return { mm: String(d.getMonth() + 1).padStart(2, '0'), aaaa: String(d.getFullYear()) };
}
/** O caminho (já normalizado) é do mês da guia? pela pasta "09" ou pelo nome ("09-2026", "06.2026", "SETEMBRO 2026"). */
export function doMesDaGuia(p: readonly string[], g: { mm: string; aaaa: string }): boolean {
  const nome = p[p.length - 1] || '';
  if (p.slice(0, -1).includes(g.mm)) return true;
  if (new RegExp('(^|\\D)' + g.mm + '[\\s._/-]?' + g.aaaa + '(\\D|$)').test(nome)) return true;
  const extenso = MESES_POR_EXTENSO[Number(g.mm) - 1];
  return nome.includes(extenso) && nome.includes(g.aaaa);
}
/** As guias do mês na pasta do cliente: a mais nova de cada tipo (FGTS, DARF, DAS), só PDF. */
export function guiasNaPasta(itens: readonly ItemDoDrive[], g: { mm: string; aaaa: string }): { guia: GuiaDaPasta; arquivo: ItemDoDrive }[] {
  const porId = new Map(itens.map(it => [it.i, it]));
  const caminho = (it: ItemDoDrive) => {
    const p: string[] = [];
    let x: ItemDoDrive | undefined = it;
    let n = 0;
    while (x && n++ < 20) { p.unshift(textoNormalizado(x.n)); x = porId.get(x.p); }
    return p;
  };
  const achadas: Record<string, { guia: GuiaDaPasta; arquivo: ItemDoDrive }> = {};
  for (const it of itens) {
    if (it.t !== 'f' || !/\.pdf$/i.test(it.n)) continue;
    const p = caminho(it);
    if (!doMesDaGuia(p, g)) continue;
    for (const gp of GUIAS_DA_PASTA) {
      if (!gp.casa(p)) continue;
      const atual = achadas[gp.tipo];
      if (!atual || String(it.m || '') > String(atual.arquivo.m || '')) achadas[gp.tipo] = { guia: gp, arquivo: it };
    }
  }
  return GUIAS_DA_PASTA.map(gp => achadas[gp.tipo]).filter(Boolean);
}
/** O PDF anexado à entrega cabe no documento do banco? (o documento aceita ~1 MB e o Base64 cresce 1/3) */
export const LIMITE_PDF_ANEXO = 700000;

/** O que a leitura do PDF achou (aplicarDadosDoPdf_): a tela aplica no formulário e diz "Detectado automaticamente: …". */
export interface DadosDoPdf {
  cliente: ClienteDaRota | null;
  tipo: string | null;
  competencia: string | null;
  vencimento: string | null;
  codigo: CodigoPagamento | null;
  valor: string | null;
}
/** Lê tudo de uma vez. Com `tipo` (a guia veio da pasta do cliente), o cliente e a competência não são procurados. */
export function dadosDoPdf(bruto: string, clientes: readonly ClienteDaRota[], tipo?: string): DadosDoPdf {
  const daPasta = !!tipo;
  const t = tipo || tipoDoPdf(bruto);
  return {
    cliente: daPasta ? null : clienteDoPdf(bruto, clientes),
    tipo: t,
    competencia: daPasta ? null : competenciaDoPdf(bruto),
    vencimento: vencimentoDoPdf(bruto),
    codigo: codigoDePagamentoDoPdf(bruto),
    valor: t ? valorDoPdf(bruto) : null,
  };
}
