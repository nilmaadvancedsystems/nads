// O .xls do conversor, no layout do escritório (o "BANCO BRASIL 08.2026.xls" que o Vitor mandou em 06/10/2026):
// Excel 97-2003 de verdade (BIFF8), uma aba com o nome do banco e 4 colunas — Data Lançamento (texto dd/mm/aaaa),
// Valor Lançamento (contábil "R$", azul #0070C0 quando entra e vermelho quando sai), Descrição Histórico e
// Finalidade de operação (vazia, a pessoa preenche) —, tudo em Arial 10, sem negrito, com o filtro no cabeçalho.
// O SheetJS da comunidade não grava fonte nem cor, por isso os registros são escritos aqui; o SheetJS só monta o
// contêiner (CFB) em volta.
import * as XLSX from 'xlsx';
import type { LinhaConvertida } from '../tipos';

export const CABECALHO = ['Data Lançamento', 'Valor Lançamento', 'Descrição Histórico', 'Finalidade de operação'] as const;

/** Larguras das colunas do modelo (em 1/256 de caractere): 15,29 · 15,57 · 86 · 29,57. */
const LARGURAS = [3913, 3986, 22016, 7570];

/** O formato contábil do modelo (Excel guarda em inglês; aparece "R$ 1.234,56"). */
const FORMATO_REAIS = '_-[$R$-416]\\ * #,##0.00_-;\\-[$R$-416]\\ * #,##0.00_-;_-[$R$-416]\\ * "-"??_-;_-@_-';
const IFMT_REAIS = 164;

// cores da paleta: 10 = vermelho (FF0000) da paleta padrão; 30 vira o azul 0070C0 (a paleta do arquivo muda só ele)
const COR_VERMELHA = 10;
const COR_AZUL = 30;
const AZUL: [number, number, number] = [0x00, 0x70, 0xC0];

// XF das células: 15 = normal; 16 = valor que entra (azul); 17 = valor que sai (vermelho)
const XF_NORMAL = 15;
const XF_ENTRA = 16;
const XF_SAI = 17;

/** A paleta padrão do Excel 97-2003 (índices 8 a 63). */
const PALETA_PADRAO = [
  0x000000, 0xFFFFFF, 0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF, 0x800000, 0x008000, 0x000080, 0x808000,
  0x800080, 0x008080, 0xC0C0C0, 0x808080, 0x9999FF, 0x993366, 0xFFFFCC, 0xCCFFFF, 0x660066, 0xFF8080, 0x0066CC, 0xCCCCFF,
  0x000080, 0xFF00FF, 0xFFFF00, 0x00FFFF, 0x800080, 0x800000, 0x008080, 0x0000FF, 0x00CCFF, 0xCCFFFF, 0xCCFFCC, 0xFFFF99,
  0x99CCFF, 0xFF99CC, 0xCC99FF, 0xFFCC99, 0x3366FF, 0x33CCCC, 0x99CC00, 0xFFCC00, 0xFF9900, 0xFF6600, 0x666699, 0x969696,
  0x003366, 0x339966, 0x003300, 0x333300, 0x993300, 0x993366, 0x333399, 0x333333,
];

/** Bytes em sequência (little-endian). */
class Bytes {
  readonly b: number[] = [];
  u8(n: number) { this.b.push(n & 0xFF); return this; }
  u16(n: number) { return this.u8(n).u8(n >>> 8); }
  u32(n: number) { return this.u16(n & 0xFFFF).u16(n >>> 16); }
  f64(n: number) {
    const v = new DataView(new ArrayBuffer(8));
    v.setFloat64(0, n, true);
    for (let i = 0; i < 8; i++) this.u8(v.getUint8(i));
    return this;
  }
  todos(x: ArrayLike<number>) { for (let i = 0; i < x.length; i++) this.b.push(x[i]); return this; }
  /** os caracteres, em 1 byte (latin-1) quando cabe, senão em UTF-16; antes, o byte de opções */
  letras(s: string) {
    const largo = [...s].some(c => c.charCodeAt(0) > 0xFF);
    this.u8(largo ? 1 : 0);
    for (let i = 0; i < s.length; i++) { if (largo) this.u16(s.charCodeAt(i)); else this.u8(s.charCodeAt(i)); }
    return this;
  }
  /** XLUnicodeString: tamanho em 2 bytes */
  texto(s: string) { return this.u16(s.length).letras(s); }
  /** ShortXLUnicodeString: tamanho em 1 byte */
  textoCurto(s: string) { return this.u8(s.length).letras(s); }
}

function registro(saida: Bytes, tipo: number, dados: Bytes | number[] = []) {
  const d = Array.isArray(dados) ? dados : dados.b;
  saida.u16(tipo).u16(d.length).todos(d);
}

const novo = () => new Bytes();

function bof(dt: number) {
  return novo().u16(0x0600).u16(dt).u16(0x0DBB).u16(0x07CC).u32(0x000000C1).u32(0x00000006);
}

function fonte(cor: number) {
  return novo().u16(200).u16(0).u16(cor).u16(400).u16(0).u8(0).u8(2).u8(0).u8(0).textoCurto('Arial');
}

/** XF (20 bytes): fonte, formato, se é estilo, e o que ele muda em relação ao estilo (bits 2–7 do byte "usados"). */
function xf(ifnt: number, ifmt: number, estilo: boolean, usados: number) {
  return novo().u16(ifnt).u16(ifmt).u16(estilo ? 0xFFF5 : 0x0001)
    .u8(0x20) // alinhamento geral, embaixo
    .u8(0).u8(0).u8(usados)
    .u32(0).u32(0) // sem bordas
    .u16(0x20C0); // sem preenchimento (cores automáticas 64/65)
}

/** Nome da aba como o Excel aceita (sem : \ / ? * [ ], até 31 letras). */
export function nomeDaAba(nome: string): string {
  const limpo = nome.replace(/[:\\/?*[\]]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31);
  return limpo || 'Extrato';
}

/** 'aaaa-mm-dd' → 'dd/mm/aaaa' (o modelo guarda a data como texto). */
function dataDoModelo(data: string): string {
  const p = data.split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : data;
}

/** Os registros do workbook (globais + a aba). */
export function fluxoDoLivro(aba: string, linhas: readonly LinhaConvertida[]): Uint8Array {
  const ultimaLinha = linhas.length; // 0 = cabeçalho

  // ── a aba ──
  const planilha = novo();
  registro(planilha, 0x0809, bof(0x0010));
  registro(planilha, 0x000D, novo().u16(1)); // CALCMODE automático
  registro(planilha, 0x000C, novo().u16(100)); // CALCCOUNT
  registro(planilha, 0x000F, novo().u16(1)); // REFMODE A1
  registro(planilha, 0x0011, novo().u16(0)); // ITERATION
  registro(planilha, 0x0010, novo().f64(0.001)); // DELTA
  registro(planilha, 0x005F, novo().u16(1)); // SAVERECALC
  registro(planilha, 0x002A, novo().u16(0)); // PRINTHEADERS
  registro(planilha, 0x002B, novo().u16(0)); // PRINTGRIDLINES
  registro(planilha, 0x0082, novo().u16(1)); // GRIDSET
  registro(planilha, 0x0080, novo().u32(0).u32(0)); // GUTS
  registro(planilha, 0x0225, novo().u16(0).u16(255)); // DEFAULTROWHEIGHT 12,75
  registro(planilha, 0x0081, novo().u16(0x04C1)); // WSBOOL
  registro(planilha, 0x0055, novo().u16(8)); // DEFCOLWIDTH
  LARGURAS.forEach((w, c) => registro(planilha, 0x007D, novo().u16(c).u16(c).u16(w).u16(XF_NORMAL).u16(0x0002).u16(0))); // COLINFO
  registro(planilha, 0x009D, novo().u16(CABECALHO.length)); // AUTOFILTERINFO
  registro(planilha, 0x0200, novo().u32(0).u32(ultimaLinha + 1).u16(0).u16(CABECALHO.length).u16(0)); // DIMENSIONS

  const rotulo = (r: number, c: number, s: string, ixfe = XF_NORMAL) => registro(planilha, 0x0204, novo().u16(r).u16(c).u16(ixfe).texto(s.slice(0, 255)));
  CABECALHO.forEach((t, c) => rotulo(0, c, t));
  linhas.forEach((l, i) => {
    const r = i + 1;
    rotulo(r, 0, dataDoModelo(l.data));
    registro(planilha, 0x0203, novo().u16(r).u16(1).u16(l.valor < 0 ? XF_SAI : XF_ENTRA).f64(l.valor / 100));
    rotulo(r, 2, l.historico);
    rotulo(r, 3, '');
  });
  registro(planilha, 0x023E, novo().u16(0x06B6).u16(0).u16(0).u16(64).u16(0).u16(0).u16(0).u32(0)); // WINDOW2
  registro(planilha, 0x001D, novo().u8(3).u16(0).u16(0).u16(0).u16(1).u16(0).u16(0).u8(0).u8(0)); // SELECTION em A1
  registro(planilha, 0x000A); // EOF

  // ── globais (duas passadas: a posição da aba entra no BOUNDSHEET) ──
  const globais = (posicaoDaAba: number) => {
    const g = novo();
    registro(g, 0x0809, bof(0x0005));
    registro(g, 0x00E1, novo().u16(0x04B0)); // INTERFACEHDR
    registro(g, 0x00C1, novo().u16(0)); // MMS
    registro(g, 0x00E2); // INTERFACEEND
    const quem = novo().texto('user');
    while (quem.b.length < 112) quem.u8(0x20);
    registro(g, 0x005C, quem); // WRITEACCESS
    registro(g, 0x0042, novo().u16(0x04B0)); // CODEPAGE (UTF-16)
    registro(g, 0x0161, novo().u16(0)); // DSF
    registro(g, 0x0019, novo().u16(0)); // WINDOWPROTECT
    registro(g, 0x0012, novo().u16(0)); // PROTECT
    registro(g, 0x0013, novo().u16(0)); // PASSWORD
    registro(g, 0x01AF, novo().u16(0)); // PROT4REV
    registro(g, 0x01BC, novo().u16(0)); // PROT4REVPASS
    registro(g, 0x003D, novo().u16(360).u16(270).u16(14940).u16(9150).u16(0x0038).u16(0).u16(0).u16(1).u16(600)); // WINDOW1
    registro(g, 0x0040, novo().u16(0)); // BACKUP
    registro(g, 0x008D, novo().u16(0)); // HIDEOBJ
    registro(g, 0x0022, novo().u16(0)); // DATEMODE 1900
    registro(g, 0x000E, novo().u16(1)); // PRECISION
    registro(g, 0x01B7, novo().u16(0)); // REFRESHALL
    registro(g, 0x00DA, novo().u16(0)); // BOOKBOOL
    // fontes 0–3 (a 4 não existe no formato), 5 = azul, 6 = vermelha; todas Arial 10
    for (let i = 0; i < 4; i++) registro(g, 0x0031, fonte(0x7FFF));
    registro(g, 0x0031, fonte(COR_AZUL));
    registro(g, 0x0031, fonte(COR_VERMELHA));
    registro(g, 0x041E, novo().u16(IFMT_REAIS).texto(FORMATO_REAIS)); // FORMAT
    // XF de estilo 0–14 (o Normal e os de sistema) e o 15, da célula comum
    registro(g, 0x00E0, xf(0, 0, true, 0x00));
    for (let i = 1; i < 15; i++) registro(g, 0x00E0, xf(i < 3 ? 1 : i < 5 ? 2 : 0, 0, true, 0xF4));
    registro(g, 0x00E0, xf(0, 0, false, 0x00));
    registro(g, 0x00E0, xf(5, IFMT_REAIS, false, 0x0C));
    registro(g, 0x00E0, xf(6, IFMT_REAIS, false, 0x0C));
    registro(g, 0x0293, novo().u16(0x8000).u8(0).u8(0xFF)); // STYLE Normal
    const paleta = novo().u16(56);
    PALETA_PADRAO.forEach((rgb, i) => {
      const [r, gr, b] = i + 8 === COR_AZUL ? AZUL : [rgb >> 16 & 0xFF, rgb >> 8 & 0xFF, rgb & 0xFF];
      paleta.u8(r).u8(gr).u8(b).u8(0);
    });
    registro(g, 0x0092, paleta); // PALETTE
    registro(g, 0x0160, novo().u16(1)); // USESELFS
    registro(g, 0x0085, novo().u32(posicaoDaAba).u8(0).u8(0).textoCurto(aba)); // BOUNDSHEET
    registro(g, 0x008C, novo().u16(55).u16(55)); // COUNTRY Brasil
    registro(g, 0x01AE, novo().u16(1).u16(0x0401)); // SUPBOOK (este arquivo)
    registro(g, 0x0017, novo().u16(1).u16(0).u16(0).u16(0)); // EXTERNSHEET
    // NAME _FilterDatabase (o filtro do cabeçalho): A1:D<última>
    registro(g, 0x0018, novo().u16(0x0021).u8(0).u8(1).u16(11).u16(0).u16(1).u8(0).u8(0).u8(0).u8(0)
      .u8(0).u8(0x0D)
      .u8(0x3B).u16(0).u16(0).u16(ultimaLinha).u16(0).u16(CABECALHO.length - 1));
    registro(g, 0x000A); // EOF
    return g;
  };
  const tamanho = globais(0).b.length;
  const livro = globais(tamanho);
  livro.todos(planilha.b);
  return new Uint8Array(livro.b);
}

/** Os bytes do .xls (Excel 97-2003). */
export function planilhaDoExtrato(aba: string, linhas: readonly LinhaConvertida[]): Uint8Array {
  const cfb = XLSX.CFB.utils.cfb_new();
  XLSX.CFB.utils.cfb_add(cfb, 'Workbook', fluxoDoLivro(nomeDaAba(aba), linhas));
  const saida = XLSX.CFB.write(cfb, { type: 'array', fileType: 'cfb' }) as ArrayLike<number>;
  return saida instanceof Uint8Array ? saida : new Uint8Array(Array.from(saida));
}

export const TIPO_XLS = 'application/vnd.ms-excel';
