// A planilha aberta no navegador (Vitor, 09/11/2026: "quero um visualizador de planilhas online"): o arquivo vira o que a
// tela desenha, só para ver. O SheetJS lê os valores (já formatados), as mesclas e as medidas, inclusive do .xls antigo; o
// ExcelJS, carregado só aqui, lê as cores, o negrito e as bordas do .xlsx (o SheetJS gratuito não traz). Se ele não
// entender o arquivo, a planilha abre do mesmo jeito, sem a formatação.
import * as XLSX from 'xlsx';

export interface EstiloDaCelula {
  negrito?: boolean; italico?: boolean; sublinhado?: boolean; riscado?: boolean; cor?: string; fundo?: string; tamanho?: number;
  horizontal?: 'left' | 'center' | 'right'; vertical?: 'top' | 'middle' | 'bottom'; quebra?: boolean; recuo?: number;
  bordas?: { top?: string; right?: string; bottom?: string; left?: string };
}
export interface CelulaDaPlanilha { coluna: number; texto: string; numero: boolean; colunas: number; linhas: number; estilo?: EstiloDaCelula }
export interface LinhaDaPlanilha { numero: number; altura: number; celulas: CelulaDaPlanilha[] }
export interface AbaDaPlanilha {
  nome: string;
  /** só as colunas visíveis: a letra e a largura em px */
  colunas: { letra: string; largura: number }[];
  linhas: LinhaDaPlanilha[];
  /** quantas linhas a aba tem, contando as que ficaram de fora do LIMITE_DE_LINHAS */
  totalDeLinhas: number;
}
export interface PlanilhaNoNavegador { abas: AbaDaPlanilha[]; comFormatacao: boolean }

/** Até onde a tela desenha uma aba: mais que isso trava o navegador; o resto, só baixando. */
export const LIMITE_DE_LINHAS = 3000;
/** O maior arquivo que o robô entrega para a tela ler (LER_MAX em robo/abrir-do-drive.js). */
export const MAIOR_PLANILHA_BYTES = 4 * 1024 * 1024;

const LARGURA_PADRAO = 64;
const ALTURA_PADRAO = 20;

export function ehPlanilha(nome: string): boolean {
  return /\.(xlsx|xlsm|xls|xlsb|ods|csv)$/i.test(nome);
}

/**
 * O texto como o Excel em português mostra: o SheetJS formata sempre no padrão americano (1,234.56 e m/d/yy). A máscara
 * com ponto ou vírgula fixos (o CNPJ: 00\.000\.000) fica como está.
 */
export function textoEmPortugues(c: Pick<XLSX.CellObject, 't' | 'v' | 'w' | 'z'>): string {
  const w = c.w ?? String(c.v ?? '');
  if (c.t !== 'n') return w;
  const z = String(c.z ?? 'General');
  if (XLSX.SSF.is_date(z)) {
    const data = XLSX.SSF.parse_date_code(Number(c.v));
    const so = z.replace(/\[[^\]]*\]/g, '').replace(/;@$/, '').toLowerCase();
    // o formato "data curta" do sistema, que no Brasil é dia/mês/ano
    if (data && (so === 'm/d/yy' || so === 'mm-dd-yy')) return [data.d, data.m].map(n => String(n).padStart(2, '0')).join('/') + '/' + data.y;
    return w;
  }
  if (/\\[.,]/.test(z) || [...z.matchAll(/"([^"]*)"/g)].some(m => /[.,]/.test(m[1]))) return w;
  return w.replace(/[.,]/g, s => (s === '.' ? ',' : '.'));
}

// ---------- as cores do ExcelJS ----------
const TEMA_DO_OFFICE = ['FFFFFF', '000000', 'E7E6E6', '44546A', '4472C4', 'ED7D31', 'A5A5A5', 'FFC000', '5B9BD5', '70AD47'];
// a paleta "indexed" do Excel (0 a 63)
const INDEXADAS = ('000000 FFFFFF FF0000 00FF00 0000FF FFFF00 FF00FF 00FFFF 000000 FFFFFF FF0000 00FF00 0000FF FFFF00 FF00FF 00FFFF '
  + '800000 008000 000080 808000 800080 008080 C0C0C0 808080 9999FF 993366 FFFFCC CCFFFF 660066 FF8080 0066CC CCCCFF '
  + '000080 FF00FF FFFF00 00FFFF 800080 800000 008080 0000FF 00CCFF CCFFFF CCFFCC FFFF99 99CCFF FF99CC CC99FF FFCC99 '
  + '3366FF 33CCCC 99CC00 FFCC00 FF9900 FF6600 666699 969696 003366 339966 003300 333300 993300 993366 333399 333333').split(' ');

interface CorDoExcel { argb?: string; theme?: number; tint?: number; indexed?: number }

function temaDoArquivo(xml: string | undefined): string[] {
  if (!xml) return TEMA_DO_OFFICE;
  const achou: Record<string, string> = {};
  for (const m of xml.matchAll(/<a:(dk1|lt1|dk2|lt2|accent[1-6])>[\s\S]*?(?:lastClr|srgbClr val)="([0-9A-Fa-f]{6})"/g)) achou[m[1]] = m[2];
  return ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'].map((k, i) => achou[k] || TEMA_DO_OFFICE[i]);
}

function comTom(hex: string, tint: number): string {
  const canal = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16);
    return Math.round(tint < 0 ? c * (1 + tint) : c + (255 - c) * tint).toString(16).padStart(2, '0');
  };
  return canal(0) + canal(2) + canal(4);
}

export function corDoExcel(c: CorDoExcel | undefined, tema: readonly string[] = TEMA_DO_OFFICE): string | undefined {
  if (!c) return undefined;
  let hex: string | undefined;
  if (c.argb) hex = c.argb.slice(-6);
  else if (c.theme != null) hex = tema[c.theme];
  else if (c.indexed != null) hex = INDEXADAS[c.indexed];
  if (!hex) return undefined;
  return '#' + (c.tint ? comTom(hex, c.tint) : hex).toLowerCase();
}

const BORDA: Record<string, string> = {
  hair: '1px dotted', dotted: '1px dotted', dashed: '1px dashed', dashDot: '1px dashed', dashDotDot: '1px dashed', thin: '1px solid', medium: '2px solid',
  mediumDashed: '2px dashed', mediumDashDot: '2px dashed', mediumDashDotDot: '2px dashed', slantDashDot: '2px dashed', thick: '3px solid', double: '3px double',
};

interface EstiloDoExcelJs {
  font?: { bold?: boolean; italic?: boolean; underline?: unknown; strike?: boolean; size?: number; color?: CorDoExcel };
  fill?: { type?: string; pattern?: string; fgColor?: CorDoExcel };
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean; indent?: number };
  border?: Record<string, { style?: string; color?: CorDoExcel } | undefined>;
}

function estiloDaCelula(s: EstiloDoExcelJs, tema: readonly string[]): EstiloDaCelula | undefined {
  const e: EstiloDaCelula = {};
  const f = s.font;
  if (f?.bold) e.negrito = true;
  if (f?.italic) e.italico = true;
  if (f?.underline) e.sublinhado = true;
  if (f?.strike) e.riscado = true;
  if (f?.size) e.tamanho = f.size;
  const cor = corDoExcel(f?.color, tema);
  if (cor) e.cor = cor;
  if (s.fill?.type === 'pattern' && s.fill.pattern && s.fill.pattern !== 'none') {
    const fundo = corDoExcel(s.fill.fgColor, tema);
    if (fundo) e.fundo = fundo;
  }
  const a = s.alignment;
  if (a?.horizontal === 'left' || a?.horizontal === 'center' || a?.horizontal === 'right') e.horizontal = a.horizontal;
  else if (a?.horizontal === 'centerContinuous') e.horizontal = 'center';
  if (a?.vertical === 'top' || a?.vertical === 'bottom' || a?.vertical === 'middle') e.vertical = a.vertical;
  if (a?.wrapText) e.quebra = true;
  if (a?.indent) e.recuo = a.indent;
  for (const lado of ['top', 'right', 'bottom', 'left'] as const) {
    const b = s.border?.[lado];
    if (b?.style && BORDA[b.style]) (e.bordas ??= {})[lado] = BORDA[b.style] + ' ' + (corDoExcel(b.color, tema) || '#000');
  }
  return Object.keys(e).length ? e : undefined;
}

type Estilos = Map<string, Map<string, EstiloDaCelula>>;

/** Os estilos de cada aba ("linha:coluna", de 0), ou null quando o ExcelJS não entende o arquivo. */
async function lerEstilos(bytes: Uint8Array): Promise<Estilos | null> {
  try {
    const m = await import('exceljs');
    const livro = new (m.default ?? m).Workbook();
    await livro.xlsx.load(bytes.slice().buffer);
    const tema = temaDoArquivo((livro as unknown as { _themes?: Record<string, string> })._themes?.theme1);
    const out: Estilos = new Map();
    livro.eachSheet(ws => {
      const daAba = new Map<string, EstiloDaCelula>();
      ws.eachRow({ includeEmpty: false }, (linha, r) => {
        if (r > LIMITE_DE_LINHAS) return;
        linha.eachCell({ includeEmpty: true }, (c, col) => {
          const e = estiloDaCelula(c.style as EstiloDoExcelJs, tema);
          if (e) daAba.set((r - 1) + ':' + (col - 1), e);
        });
      });
      out.set(ws.name, daAba);
    });
    return out;
  } catch { return null; }
}

// ---------- a aba ----------
const transborda = (e: EstiloDaCelula | undefined) => !e?.quebra && (e?.horizontal ?? 'left') === 'left';
/** A largura aproximada do texto na fonte da célula, em px. */
const larguraDoTexto = (texto: string, e: EstiloDaCelula | undefined) => texto.length * ((e?.tamanho ?? 11) * 0.62) + 8;

function montarAba(nome: string, ws: XLSX.WorkSheet, estilos: Map<string, EstiloDaCelula> | undefined): AbaDaPlanilha {
  const celulas = new Map<string, XLSX.CellObject>();
  let ultimaLinha = -1;
  let ultimaColuna = -1;
  const estende = (r: number, c: number) => { ultimaLinha = Math.max(ultimaLinha, r); ultimaColuna = Math.max(ultimaColuna, c); };
  for (const k of Object.keys(ws)) {
    if (k[0] === '!') continue;
    const cel = ws[k] as XLSX.CellObject;
    if (cel.v == null || cel.v === '') continue;
    const { r, c } = XLSX.utils.decode_cell(k);
    celulas.set(r + ':' + c, cel);
    estende(r, c);
  }
  // célula vazia com fundo ou borda também aparece (o quadro de um relatório); só fonte ou alinhamento, não
  const desenhada = (k: string) => { const e = estilos?.get(k); return !!e && (!!e.fundo || !!e.bordas); };
  for (const k of estilos?.keys() ?? []) {
    if (!desenhada(k)) continue;
    const [r, c] = k.split(':').map(Number);
    estende(r, c);
  }
  const mesclas = (ws['!merges'] ?? []).filter(m => m.s.r <= ultimaLinha && m.s.c <= ultimaColuna);
  for (const m of mesclas) estende(m.e.r, m.e.c);

  const infoCol = ws['!cols'] ?? [];
  const infoLin = ws['!rows'] ?? [];
  const larguraDe = (c: number) => {
    const i = infoCol[c];
    return Math.max(8, Math.round(i?.wpx ?? (i?.wch != null ? i.wch * 7 + 5 : i?.width != null ? i.width * 7 + 5 : LARGURA_PADRAO)));
  };
  // o texto da última coluna também precisa de onde transbordar: a folha ganha as colunas vazias que faltam
  for (const [k, cel] of celulas) {
    const estilo = estilos?.get(k);
    if (cel.t === 'n' || !transborda(estilo)) continue;
    const c = Number(k.split(':')[1]);
    const precisa = larguraDoTexto(textoEmPortugues(cel), estilo);
    let fim = c;
    for (let tem = larguraDe(c); tem < precisa && fim < c + 40; tem += larguraDe(++fim));
    ultimaColuna = Math.max(ultimaColuna, fim);
  }
  const visiveis: number[] = [];
  for (let c = 0; c <= ultimaColuna; c++) if (!infoCol[c]?.hidden) visiveis.push(c);
  const larguras = new Map(visiveis.map(c => [c, larguraDe(c)]));

  const corte = Math.min(ultimaLinha, LIMITE_DE_LINHAS - 1);
  const cobertas = new Set<string>();
  const mesclaEm = new Map<string, XLSX.Range>();
  for (const m of mesclas) {
    mesclaEm.set(m.s.r + ':' + m.s.c, m);
    for (let r = m.s.r; r <= m.e.r; r++) for (let c = m.s.c; c <= m.e.c; c++) if (r !== m.s.r || c !== m.s.c) cobertas.add(r + ':' + c);
  }
  const vazia = (k: string) => !celulas.has(k) && !cobertas.has(k) && !mesclaEm.has(k) && !desenhada(k);

  const linhas: LinhaDaPlanilha[] = [];
  for (let r = 0; r <= corte; r++) {
    if (infoLin[r]?.hidden) continue;
    const saida: CelulaDaPlanilha[] = [];
    for (let i = 0; i < visiveis.length; i++) {
      const c = visiveis[i];
      const k = r + ':' + c;
      if (cobertas.has(k)) continue;
      const cel = celulas.get(k);
      const m = mesclaEm.get(k);
      const estilo = estilos?.get(k);
      const texto = cel ? textoEmPortugues(cel) : '';
      const numero = cel?.t === 'n';
      let colunas = 1;
      let lins = 1;
      if (m) {
        colunas = visiveis.filter(x => x >= m.s.c && x <= m.e.c).length;
        lins = 0;
        for (let x = m.s.r; x <= Math.min(m.e.r, corte); x++) if (!infoLin[x]?.hidden) lins++;
      } else if (texto && !numero && transborda(estilo)) {
        // como no Excel: o texto comprido ocupa as células vazias à direita
        const precisa = larguraDoTexto(texto, estilo);
        let tem = larguras.get(c)!;
        while (tem < precisa && i + colunas < visiveis.length && vazia(r + ':' + visiveis[i + colunas])) tem += larguras.get(visiveis[i + colunas++])!;
        i += colunas - 1;
      }
      saida.push({ coluna: c, texto, numero, colunas, linhas: lins, ...(estilo ? { estilo } : {}) });
    }
    linhas.push({ numero: r + 1, altura: Math.round(infoLin[r]?.hpx ?? (infoLin[r]?.hpt != null ? infoLin[r].hpt! * 4 / 3 : ALTURA_PADRAO)), celulas: saida });
  }
  return { nome, colunas: visiveis.map(c => ({ letra: XLSX.utils.encode_col(c), largura: larguras.get(c)! })), linhas, totalDeLinhas: ultimaLinha + 1 };
}

/** Lê o arquivo (xlsx, xlsm, xls, xlsb, ods, csv). As abas ocultas ficam de fora. */
export async function lerPlanilhaNoNavegador(nome: string, bytes: Uint8Array): Promise<PlanilhaNoNavegador> {
  const livro = XLSX.read(bytes, { type: 'array', cellNF: true, cellStyles: true });
  const estilos = /\.(xlsx|xlsm)$/i.test(nome) ? await lerEstilos(bytes) : null;
  const visiveis = livro.SheetNames.filter((_, i) => !livro.Workbook?.Sheets?.[i]?.Hidden);
  return { abas: visiveis.map(n => montarAba(n, livro.Sheets[n], estilos?.get(n))), comFormatacao: !!estilos };
}
