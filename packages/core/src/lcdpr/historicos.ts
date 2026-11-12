// Os históricos e as contas que o produtor já usa no Alterdata (11/11/2026: "falta bastante historico, vou mandar uma
// planilha com todos os historicos dos ultimos anos"). A planilha é o movimento do LCDPR exportado do Alterdata — uma linha
// por lançamento: Data, Contrapartida (a conta), Descrição (o nome dela), Valor, Histórico (o código), Descrição histórico
// (o texto já preenchido) e Saldo. Daqui saem: cada histórico padrão com o modelo do texto (o começo que se repete,
// mais o número e o fornecedor) e a conta em que ele costuma cair; e as contas usadas, com o nome. Guardado por empresa
// (lcdprEmpresas/{empresa}/cadastros/alterdata), vai para a lupa do histórico padrão e das contas da janela do lançamento.
import * as XLSX from 'xlsx';

/** As linhas da primeira aba da planilha (.xls, .xlsx ou .csv), em texto. O .csv é lido como texto (UTF-8, ou o do Windows). */
export function linhasDaPlanilhaDoMovimento(buf: ArrayBuffer): string[][] {
  const b = new Uint8Array(buf);
  const planilha = (b[0] === 0x50 && b[1] === 0x4b) || (b[0] === 0xd0 && b[1] === 0xcf); // .xlsx (zip) ou .xls (OLE)
  let wb: XLSX.WorkBook;
  if (planilha) wb = XLSX.read(b, { type: 'array', raw: false });
  else {
    let texto: string;
    try { texto = new TextDecoder('utf-8', { fatal: true }).decode(b).replace(/^\uFEFF/, ''); } catch { texto = new TextDecoder('windows-1252').decode(b); }
    wb = XLSX.read(texto, { type: 'string', raw: false });
  }
  const aba = wb.Sheets[wb.SheetNames[0]];
  return aba ? XLSX.utils.sheet_to_json<string[]>(aba, { header: 1, defval: '', raw: false, blankrows: false }) : [];
}

/** Um histórico padrão aprendido do movimento. */
export interface HistoricoAprendido {
  codigo: string;
  /** o texto com {{doc}} e {{fornecedor}} no lugar do que muda */
  modelo: string;
  /** a conta em que ele mais cai (a contrapartida) e o nome dela */
  conta: string;
  contaNome: string;
  usos: number;
}

/** Uma conta usada no movimento. */
export interface ContaAprendida { codigo: string; nome: string; usos: number }

/** O que se guarda da planilha. */
export interface CadastrosDoAlterdata {
  historicos: HistoricoAprendido[];
  contas: ContaAprendida[];
  arquivo: string;
  em: string;
  /** quantos lançamentos a planilha tinha e de quando a quando (aaaa-mm) */
  lancamentos: number;
  de: string;
  ate: string;
}

export const cadastrosVazios = (): CadastrosDoAlterdata => ({ historicos: [], contas: [], arquivo: '', em: '', lancamentos: 0, de: '', ate: '' });

const limpa = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const semAcento = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/**
 * O modelo de um histórico pelos textos dele: o começo que todos repetem (palavra a palavra), ou o texto mais comum até
 * o primeiro número (ou travessão) quando esse começo é curto, há um texto só, ou o mais comum é mais completo e aparece
 * em ao menos 40% dos textos. Quando o resto muda de um texto para
 * outro (o número da nota, o fornecedor, o mês), o modelo ganha " {{doc}} - {{fornecedor}}".
 */
export function modeloDoHistorico(textos: readonly string[]): string {
  const ts = textos.map(limpa).filter(Boolean);
  if (!ts.length) return '';
  const palavras = ts.map(t => t.split(' '));
  let i = 0;
  while (palavras.every(p => p[i] !== undefined && semAcento(p[i]) === semAcento(palavras[0][i]))) i++;
  let base = palavras[0].slice(0, i).join(' ');
  // o texto mais comum até o primeiro número ou travessão (o que vem depois é o número, o mês ou o nome de quem recebeu)
  const vezes = new Map<string, number>();
  for (const t of ts) {
    const antes = t.split(' ').filter((_, k, a) => !a.slice(0, k + 1).some(w => /\d/.test(w) || /^[-–]+$/.test(w))).join(' ');
    vezes.set(antes, (vezes.get(antes) || 0) + 1);
  }
  const [comum, quantas] = [...vezes].sort((a, b) => b[1] - a[1])[0];
  // ele vale no lugar do começo comum quando o começo é curto, quando há um texto só, ou quando é mais completo e aparece
  // em ao menos 40% dos textos (o "conf nota fiscal nº" que um texto escreve "conf NF" não corta o modelo no "conf")
  const melhor = comum.split(' ').length >= 2 && (i < 3 || ts.length === 1 || (comum.length > base.length && quantas >= ts.length * 0.4));
  if (melhor) base = comum;
  base = base.replace(/[\s\-–:]+$/, '');
  const sobra = ts.some(t => semAcento(t) !== semAcento(base));
  return sobra ? base + ' {{doc}} - {{fornecedor}}' : base;
}

const COLUNAS = { conta: 'contrapartida', nome: 'descricao', codigo: 'historico', texto: 'descricao historico', data: 'data' } as const;

/** Os cadastros a partir das linhas da planilha (a primeira linha com as colunas do movimento é o cabeçalho). */
export function cadastrosDoMovimento(linhas: readonly (readonly unknown[])[], arquivo: string, em: string): CadastrosDoAlterdata {
  const iCab = linhas.findIndex(l => {
    const cs = l.map(c => semAcento(limpa(c)));
    return cs.includes(COLUNAS.codigo) && cs.includes(COLUNAS.texto) && cs.includes(COLUNAS.conta);
  });
  if (iCab < 0) throw new Error('a planilha não é o movimento do LCDPR do Alterdata (faltam as colunas Contrapartida, Histórico e Descrição histórico)');
  const cab = linhas[iCab].map(c => semAcento(limpa(c)));
  const col = (n: string) => cab.indexOf(n);
  const [cConta, cNome, cCod, cTexto, cData] = [col(COLUNAS.conta), col(COLUNAS.nome), col(COLUNAS.codigo), col(COLUNAS.texto), col(COLUNAS.data)];
  const grupos = new Map<string, { textos: string[]; contas: Map<string, number> }>();
  const contas = new Map<string, ContaAprendida>();
  const meses: string[] = [];
  let lancamentos = 0;
  for (const l of linhas.slice(iCab + 1)) {
    const conta = limpa(l[cConta]);
    const texto = limpa(l[cTexto]);
    if (!conta && !texto) continue;
    lancamentos++;
    const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(limpa(cData >= 0 ? l[cData] : ''));
    if (m) meses.push(m[3] + '-' + m[2]);
    if (conta) {
      const c = contas.get(conta) || { codigo: conta, nome: limpa(l[cNome]), usos: 0 };
      c.usos++;
      contas.set(conta, c);
    }
    const codigo = limpa(l[cCod]);
    if (!codigo) continue;
    const g = grupos.get(codigo) || { textos: [], contas: new Map<string, number>() };
    if (texto) g.textos.push(texto);
    if (conta) g.contas.set(conta, (g.contas.get(conta) || 0) + 1);
    grupos.set(codigo, g);
  }
  const historicos = [...grupos].map(([codigo, g]) => {
    const conta = [...g.contas].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    return { codigo, modelo: modeloDoHistorico(g.textos), conta, contaNome: contas.get(conta)?.nome || '', usos: g.textos.length };
  }).filter(h => h.modelo).sort((a, b) => b.usos - a.usos || a.codigo.localeCompare(b.codigo));
  meses.sort();
  return {
    historicos, contas: [...contas.values()].sort((a, b) => b.usos - a.usos || a.codigo.localeCompare(b.codigo, undefined, { numeric: true })),
    arquivo, em, lancamentos, de: meses[0] || '', ate: meses[meses.length - 1] || '',
  };
}

/** Os cadastros lidos do banco (só o que tem a forma certa). */
export function cadastrosDoDocumento(d: unknown): CadastrosDoAlterdata {
  const o = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
  const texto = (v: unknown, max = 600) => (typeof v === 'string' ? v.slice(0, max) : '');
  const numero = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const lista = (v: unknown) => (Array.isArray(v) ? v : []).map(x => (x && typeof x === 'object' ? x : {}) as Record<string, unknown>);
  return {
    historicos: lista(o.historicos).map(h => ({ codigo: texto(h.codigo, 20), modelo: texto(h.modelo), conta: texto(h.conta, 20), contaNome: texto(h.contaNome, 200), usos: numero(h.usos) })).filter(h => h.codigo && h.modelo),
    contas: lista(o.contas).map(c => ({ codigo: texto(c.codigo, 20), nome: texto(c.nome, 200), usos: numero(c.usos) })).filter(c => c.codigo),
    arquivo: texto(o.arquivo, 200), em: texto(o.em, 40), lancamentos: numero(o.lancamentos), de: texto(o.de, 7), ate: texto(o.ate, 7),
  };
}
