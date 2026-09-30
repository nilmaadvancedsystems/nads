// Leitura do plano de contas (tudo no navegador, nada sai da máquina). Aceita:
// - o layout do Alterdata com "NOME [código]" numa célula (o mesmo do balancete "XLS Dados Arquivo"; o
//   recuo diz o nível: a conta seguida de uma mais recuada é sintética);
// - uma tabela com cabeçalho: Código (ou Reduzido), Descrição (ou Nome) e, se tiver, Classificação e
//   Tipo (S = sintética, A = analítica).
// Também monta o plano a partir do balancete que a Conferência guardou (empresas/{slug}).
import * as XLSX from 'xlsx';
import type { ContaDoPlano } from './tipos';

export type Linhas = string[][];

/**
 * Primeira aba da planilha como linhas de texto (xls, xlsx, ods). CSV e TXT são lidos aqui mesmo: o separador
 * (";", "," ou tabulação) e a codificação (UTF-8 ou a do Windows, a do Excel brasileiro) são descobertos.
 */
export function lerPlanilhaDoPlano(buf: ArrayBuffer, nome = ''): Linhas {
  if (/\.(csv|txt)$/i.test(nome)) return linhasDoTexto(textoDoArquivo(buf));
  const wb = XLSX.read(new Uint8Array(buf), { type: 'array', raw: false });
  return XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false, blankrows: false });
}

/** O texto do arquivo: UTF-8, ou Windows-1252 se não for UTF-8 válido. */
export function textoDoArquivo(buf: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

/** As linhas de um CSV (aspas respeitadas), com o separador que mais aparece nas primeiras linhas. */
export function linhasDoTexto(txt: string): Linhas {
  const amostra = txt.split(/\r?\n/).slice(0, 20).join('\n');
  const conta = (c: string) => amostra.split(c).length;
  const sep = [';', '\t', ','].sort((x, y) => conta(y) - conta(x))[0];
  const linhas: Linhas = [];
  let linha: string[] = [];
  let campo = '';
  let aspas = false;
  const fecharLinha = () => {
    linha.push(campo);
    campo = '';
    if (linha.some(c => c.trim())) linhas.push(linha);
    linha = [];
  };
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (aspas) {
      if (ch === '"' && txt[i + 1] === '"') { campo += '"'; i++; } else if (ch === '"') aspas = false; else campo += ch;
    } else if (ch === '"') aspas = true;
    else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n') fecharLinha();
    else if (ch !== '\r') campo += ch;
  }
  fecharLinha();
  return linhas;
}

const texto = (v: unknown) => (v == null ? '' : String(v).trim());
const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** O grupo pelo nome de uma conta de primeiro nível (o mesmo critério da Conferência). */
export function grupoPeloNome(nome: string): string | null {
  const n = semAcento(nome);
  if (n.includes('ativo')) return 'Ativo';
  if (n.includes('passivo') || n.includes('patrimonio')) return 'Passivo';
  if (n.includes('receita')) return 'Receita';
  if (n.includes('despesa') || n.includes('custo')) return 'Despesa';
  return null;
}

// ─── layout do Alterdata: "NOME [código]" ───────────────────────────────────

const COLCHETE = /\[\s*(\d+)\s*\]/;
const CLASSIFICACAO = /^\d+(\.\d+)+$/;

function lerAlterdata(rows: Linhas): ContaDoPlano[] {
  const lidas: (ContaDoPlano & { nivel: number })[] = [];
  let grupo: string | null = null;
  for (const r of rows) {
    const i = r.findIndex(c => COLCHETE.test(String(c)));
    if (i < 0) continue;
    const desc = String(r[i]);
    const m = desc.match(COLCHETE) as RegExpMatchArray;
    const codigo = m[1];
    if (lidas.some(c => c.codigo === codigo)) continue;
    const nome = (desc.slice(0, desc.indexOf(m[0])).replace(/[-–\s]+$/, '').trim() || codigo).slice(0, 80);
    const classificacao = r.map(texto).find(c => CLASSIFICACAO.test(c));
    const nivel = classificacao ? classificacao.split('.').length : (desc.match(/^ */) as RegExpMatchArray)[0].length;
    const topo = classificacao ? nivel === 1 : nivel <= 5;
    if (topo) grupo = grupoPeloNome(nome) || grupo;
    const c: ContaDoPlano & { nivel: number } = { codigo, nome, ordem: lidas.length, nivel };
    if (classificacao) c.classificacao = classificacao;
    if (grupo) c.grupo = grupo;
    lidas.push(c);
  }
  return lidas.map((c, i) => {
    const prox = lidas[i + 1];
    const { nivel, ...resto } = c;
    return prox && prox.nivel > nivel ? { ...resto, sintetica: true } : resto;
  });
}

// ─── tabela com cabeçalho ───────────────────────────────────────────────────

function acharColuna(cab: string[], ...nomes: string[]): number {
  for (const t of nomes) { const e = cab.indexOf(t); if (e >= 0) return e; }
  for (const t of nomes) { const j = cab.findIndex(c => c.includes(t)); if (j >= 0) return j; }
  return -1;
}

function lerTabela(rows: Linhas): ContaDoPlano[] | null {
  for (let h = 0; h < Math.min(rows.length, 40); h++) {
    const cab = rows[h].map(c => semAcento(texto(c)));
    const colCod = acharColuna(cab, 'reduzido', 'cod. reduzido', 'codigo reduzido', 'codigo', 'cod.', 'cod', 'conta');
    const colNome = acharColuna(cab, 'descricao', 'nome da conta', 'nome', 'titulo');
    if (colCod < 0 || colNome < 0 || colCod === colNome) continue;
    const colClass = acharColuna(cab, 'classificacao', 'estrutura', 'mascara');
    const colTipo = acharColuna(cab, 'tipo', 'a/s', 's/a', 'sintetica', 'analitica');
    const lidas: ContaDoPlano[] = [];
    let grupo: string | null = null;
    for (const r of rows.slice(h + 1)) {
      const codigo = texto(r[colCod]).replace(/\D+/g, '');
      const nome = texto(r[colNome]).slice(0, 80);
      if (!codigo || !nome || lidas.some(c => c.codigo === codigo)) continue;
      const classificacao = colClass >= 0 && colClass !== colCod ? texto(r[colClass]) : '';
      if (classificacao && !classificacao.includes('.')) grupo = grupoPeloNome(nome) || grupo;
      const c: ContaDoPlano = { codigo, nome, ordem: lidas.length };
      if (classificacao) c.classificacao = classificacao;
      if (grupo) c.grupo = grupo;
      const tipo = colTipo >= 0 ? semAcento(texto(r[colTipo])) : '';
      if (tipo.startsWith('s')) c.sintetica = true;
      lidas.push(c);
    }
    // sem a coluna Tipo, a classificação diz: a conta que tem filhas é sintética
    if (colTipo < 0) {
      lidas.forEach((c, i) => {
        const prox = lidas[i + 1];
        if (c.classificacao && prox?.classificacao?.startsWith(c.classificacao + '.')) c.sintetica = true;
      });
    }
    if (lidas.length) return lidas;
  }
  return null;
}

export type LeituraDoPlano = { contas: ContaDoPlano[]; formato: 'alterdata' | 'tabela'; erro: null } | { contas: []; formato: null; erro: string };

/** O plano de contas de uma planilha (qualquer um dos dois jeitos). */
export function lerPlanoDeContas(rows: Linhas): LeituraDoPlano {
  const alterdata = lerAlterdata(rows);
  if (alterdata.length >= 2) return { contas: alterdata, formato: 'alterdata', erro: null };
  const tabela = lerTabela(rows);
  if (tabela?.length) return { contas: tabela, formato: 'tabela', erro: null };
  return { contas: [], formato: null, erro: 'Não achei contas nesta planilha. Use o plano de contas (ou o balancete) exportado do Alterdata em Excel.' };
}

/**
 * O plano a partir do documento da empresa na Conferência (empresas/{slug}): as contas do balancete, ou,
 * se ele foi apagado ao sair, a impressão digital dele (código → nome). Só lê; a Conferência é a dona.
 * O balancete só traz as contas com saldo: o plano completo vem do arquivo do plano.
 */
export function planoDoBalancete(doc: Record<string, unknown> | null | undefined): ContaDoPlano[] {
  if (!doc) return [];
  if (Array.isArray(doc.contas) && doc.contas.length) {
    return (doc.contas as Record<string, unknown>[])
      .map((c, i) => {
        const x: ContaDoPlano = { codigo: texto(c?.codigo), nome: texto(c?.nome), ordem: typeof c?.ordem === 'number' ? c.ordem : i };
        if (texto(c?.grupo) && c.grupo !== 'Outros') x.grupo = texto(c.grupo);
        if (c?.sintetica === true) x.sintetica = true;
        return x;
      })
      .filter(c => c.codigo)
      .sort((a, b) => a.ordem - b.ordem)
      .map((c, i) => ({ ...c, ordem: i }));
  }
  const plano = doc.balanceteAssinatura;
  if (plano && typeof plano === 'object') {
    return Object.entries(plano as Record<string, unknown>)
      .map(([codigo, nome], i) => ({ codigo: texto(codigo), nome: texto(nome).toUpperCase(), ordem: i }))
      .filter(c => c.codigo);
  }
  return [];
}
