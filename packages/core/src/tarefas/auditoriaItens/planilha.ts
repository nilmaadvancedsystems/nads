// A planilha da auditoria dos itens: lê a planilha de itens/produtos (xlsx, xls, ods ou csv; o cabeçalho é a linha com o
// NCM, nas 20 primeiras) e grava a auditada, com todas as colunas originais mais as 8 da auditoria, no visual pedido
// (cabeçalho azul-escuro, zebrado, bordas finas, as cores do SIM/NÃO e do diagnóstico, o painel congelado em C2 e as
// larguras pelo conteúdo). O SheetJS da comunidade não grava estilo: o xlsx sai montado aqui, com o zip dele (CFB).
import * as XLSX from 'xlsx';
import { auditarItem, ncmLimpo, type Auditoria, type ItemParaAuditar } from './regras';

export type Valor = string | number | boolean | Date | null;

export interface PlanilhaDeItens {
  cabecalho: string[];
  linhas: Valor[][];
  /** o índice de cada coluna achada (-1 = não veio) */
  colunas: { ncm: number; descricao: number; cfop: number; cst: number; csosn: number; cest: number };
  aba: string;
}

export interface LinhaAuditada {
  valores: Valor[];
  item: ItemParaAuditar;
  /** null = linha sem NCM (total, subtítulo) */
  auditoria: Auditoria | null;
}

const normal = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** as colunas pelo cabeçalho */
export function colunasDoCabecalho(cab: string[]): PlanilhaDeItens['colunas'] {
  const h = cab.map(normal);
  const achar = (ok: (s: string) => boolean) => h.findIndex(ok);
  const fiscal = (s: string) => /pis|cofins|ipi/.test(s);
  const ncm = achar(s => /\bncm\b|^ncm|ncm\/sh|classif.*fiscal/.test(s));
  let descricao = achar(s => s.includes('descri') && !s.includes('ncm') && !s.includes('cfop'));
  if (descricao < 0) descricao = achar(s => /produto|mercadoria|^item$/.test(s) && !/cod|codigo|ref|\bid\b/.test(s));
  return {
    ncm,
    descricao,
    cfop: achar(s => s.includes('cfop')),
    csosn: achar(s => s.includes('csosn')),
    cst: achar(s => (/\bcst\b|sit.*trib/.test(s)) && !fiscal(s) && !s.includes('csosn')),
    cest: achar(s => /\bcest\b/.test(s)),
  };
}

/** Lê a primeira aba que tem a coluna NCM. Erro (Error) se nenhuma tiver. */
export function lerPlanilhaDeItens(bytes: Uint8Array): PlanilhaDeItens {
  const livro = XLSX.read(bytes, { type: 'array', cellDates: true });
  for (const aba of livro.SheetNames) {
    const linhas = XLSX.utils.sheet_to_json<Valor[]>(livro.Sheets[aba], { header: 1, raw: true, defval: null, blankrows: false });
    for (let i = 0; i < Math.min(20, linhas.length); i++) {
      const cab = (linhas[i] || []).map(v => (v == null ? '' : String(v).trim()));
      const colunas = colunasDoCabecalho(cab);
      if (colunas.ncm < 0) continue;
      const largura = Math.max(cab.length, ...linhas.slice(i + 1).map(l => l.length));
      const cabecalho = Array.from({ length: largura }, (_, k) => cab[k] || 'Coluna ' + (k + 1));
      const dados = linhas.slice(i + 1)
        .map(l => Array.from({ length: largura }, (_, k) => (l[k] === undefined ? null : l[k])))
        .filter(l => l.some(v => v != null && String(v).trim() !== ''));
      return { cabecalho, linhas: dados, colunas, aba };
    }
  }
  throw new Error('Não achei a coluna NCM nas primeiras linhas da planilha.');
}

const texto = (v: Valor) => (v == null ? '' : v instanceof Date ? '' : String(v).trim());

/** Audita cada linha. */
export function auditarPlanilha(p: PlanilhaDeItens): LinhaAuditada[] {
  const c = p.colunas;
  const de = (l: Valor[], k: number) => (k < 0 ? '' : texto(l[k]));
  return p.linhas.map(valores => {
    const item: ItemParaAuditar = { ncm: de(valores, c.ncm), descricao: de(valores, c.descricao), cfop: de(valores, c.cfop), cst: de(valores, c.cst), csosn: de(valores, c.csosn), cest: de(valores, c.cest) };
    return { valores, item, auditoria: ncmLimpo(item.ncm) ? auditarItem(item) : null };
  });
}

export const COLUNAS_DA_AUDITORIA = [
  'Monofásico (PIS/COFINS)', 'ICMS-ST (MG)', 'Diagnóstico Combinado', 'PIS/COFINS Regime', 'PIS/COFINS CST Saída Sugerido',
  'PIS/COFINS Embasamento Legal', 'ICMS-ST Segmento / Capítulo', 'ICMS-ST Embasamento (RICMS/MG)',
] as const;

export const simNao = (b: boolean) => (b ? 'SIM' : 'NÃO');

/** os 8 valores da auditoria, na ordem das colunas */
export function valoresDaAuditoria(a: Auditoria | null): string[] {
  if (!a) return COLUNAS_DA_AUDITORIA.map(() => '');
  return [simNao(a.monofasico), simNao(a.st), a.diagnostico, a.regime, a.cstPisCofins, a.basePisCofins, a.segmentoSt, a.baseSt];
}

// ---------------------------------------------------------------- o xlsx com estilo

// eslint-disable-next-line no-control-regex -- o XML não aceita os caracteres de controle: saem antes
const esc = (s: string) => s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A1 de (linha, coluna), os dois a partir de 0 */
function ref(l: number, c: number): string {
  let s = '';
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s + (l + 1);
}

// os estilos (cellXfs): 0 padrão; 1 cabeçalho; 2/3 texto (liso/zebra); 4/5 número com decimais; 6/7 data;
// 8 verde (ST SIM, Ambos); 9 azul (Monofásico SIM, Somente Monofásico); 10 amarelo (Somente ST, Alíquota Zero); 11 cinza (NÃO)
const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="6">
<font><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FF276A3C"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FF1F4E79"/><name val="Calibri"/><family val="2"/></font>
<font><b/><sz val="11"/><color rgb="FF7F6000"/><name val="Calibri"/><family val="2"/></font>
<font><sz val="11"/><color rgb="FF595959"/><name val="Calibri"/><family val="2"/></font>
</fonts>
<fills count="8">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF1F4E79"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF9FAFB"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE2EFDA"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFDDEBF7"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFD9D9D9"/></left><right style="thin"><color rgb="FFD9D9D9"/></right><top style="thin"><color rgb="FFD9D9D9"/></top><bottom style="thin"><color rgb="FFD9D9D9"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="12">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="165" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="3" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="4" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
<xf numFmtId="0" fontId="5" fillId="7" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

const VERDE = 8, AZUL = 9, AMARELO = 10, CINZA = 11;

/** o destaque de uma célula da auditoria (k = a coluna da auditoria, 0…7), ou null */
function destaque(k: number, v: string): number | null {
  if (k === 0) return v === 'SIM' ? AZUL : v === 'NÃO' ? CINZA : null;
  if (k === 1) return v === 'SIM' ? VERDE : v === 'NÃO' ? CINZA : null;
  if (k === 2) return v === 'Ambos' ? VERDE : v === 'Somente Monofásico' ? AZUL : v === 'Somente ST' ? AMARELO : v === 'Não' ? CINZA : null;
  if (k === 3) return v === 'Alíquota Zero' ? AMARELO : null;
  return null;
}

const diaDoExcel = (d: Date) => (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 864e5;

/** A planilha auditada (.xlsx), em bytes. */
export function planilhaAuditada(p: PlanilhaDeItens, linhas: LinhaAuditada[], nomeDaAba = 'Auditoria'): Uint8Array {
  const cab = [...p.cabecalho, ...COLUNAS_DA_AUDITORIA];
  const nOrig = p.cabecalho.length;
  const larg = cab.map(h => h.length);
  const celula = (l: number, c: number, v: Valor, zebra: boolean, estilo?: number): string => {
    const r = ref(l, c);
    if (v == null || v === '') return `<c r="${r}" s="${estilo ?? (zebra ? 3 : 2)}"/>`;
    if (v instanceof Date) {
      larg[c] = Math.max(larg[c], 10);
      return `<c r="${r}" s="${zebra ? 7 : 6}"><v>${diaDoExcel(v)}</v></c>`;
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      const dec = !Number.isInteger(v);
      larg[c] = Math.max(larg[c], String(dec ? v.toFixed(2) : v).length + (dec ? 2 : 0));
      return `<c r="${r}" s="${dec ? (zebra ? 5 : 4) : (zebra ? 3 : 2)}"><v>${v}</v></c>`;
    }
    if (typeof v === 'boolean') return `<c r="${r}" s="${zebra ? 3 : 2}" t="b"><v>${v ? 1 : 0}</v></c>`;
    const s = String(v);
    larg[c] = Math.max(larg[c], s.length);
    return `<c r="${r}" s="${estilo ?? (zebra ? 3 : 2)}" t="inlineStr"><is><t xml:space="preserve">${esc(s)}</t></is></c>`;
  };
  const linhasXml: string[] = [];
  linhasXml.push(`<row r="1">${cab.map((h, c) => `<c r="${ref(0, c)}" s="1" t="inlineStr"><is><t>${esc(h)}</t></is></c>`).join('')}</row>`);
  linhas.forEach((la, i) => {
    const l = i + 1;
    const zebra = i % 2 === 1;
    const orig = la.valores.map((v, c) => celula(l, c, v, zebra));
    const aud = valoresDaAuditoria(la.auditoria).map((v, k) => celula(l, nOrig + k, v, zebra, (v ? destaque(k, v) : null) ?? undefined));
    linhasXml.push(`<row r="${l + 1}">${orig.join('')}${aud.join('')}</row>`);
  });
  const cols = larg.map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${Math.min(60, Math.max(8, w + 2))}" customWidth="1"/>`).join('');
  const ultima = ref(linhas.length, cab.length - 1);
  const folha = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="A1:${ultima}"/>
<sheetViews><sheetView workbookViewId="0" showGridLines="1"><pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/><selection pane="topRight"/><selection pane="bottomLeft"/><selection pane="bottomRight" activeCell="C2" sqref="C2"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${linhasXml.join('')}</sheetData>
<autoFilter ref="A1:${ultima}"/>
<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>
</worksheet>`;
  const aba = esc(nomeDaAba.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  const arquivos: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${aba}" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${aba.replace(/'/g, "''")}'!$A$1:$${ultima.replace(/\d+$/, '')}$${linhas.length + 1}</definedName></definedNames></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': ESTILOS,
    'xl/worksheets/sheet1.xml': folha,
  };
  const enc = new TextEncoder();
  const zip = XLSX.CFB.utils.cfb_new();
  for (const [caminho, conteudo] of Object.entries(arquivos)) XLSX.CFB.utils.cfb_add(zip, caminho, enc.encode(conteudo));
  const saida = XLSX.CFB.write(zip, { fileType: 'zip', type: 'array', compression: true }) as ArrayLike<number> | ArrayBuffer;
  return saida instanceof Uint8Array ? saida : new Uint8Array(saida as ArrayBuffer);
}
