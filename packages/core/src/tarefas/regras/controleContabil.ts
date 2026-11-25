// O Controle contábil (23/11/2026: a planilha "CONTROLE CONTÁBIL 2026" do Fernando, do Contábil, virou módulo do nads): uma
// linha por empresa no ano, com o último mês que já tem a contabilidade feita ("Meses" na planilha: OUT = feita até outubro;
// "-" = nenhum), a observação (a pendência) e a marca de não acompanhar (a empresa arrendada, a que saiu: a linha cinza da
// planilha). O código, o nome, o regime e o responsável vêm do Cadastro; a situação (em dia, atrasada, não iniciada) é
// calculada pelo mês esperado. A rotina concluída no executor vira sugestão do mês. Os dados de antes entram pela tela,
// com o .xlsx da planilha (lerPlanilhaDoControleContabil + planoDaImportacaoContabil): nada da planilha mora no código.
import * as XLSX from 'xlsx';

/**
 * Quem usa o Controle (o Controle Forestry), pelo primeiro nome, e mais ninguém: nem os diretores e os donos (23/11/2026:
 * "Fernando primeiro"; 25/11/2026: "O unico contabil que vai ter acesso a esse controle vai ser o usuario fernando";
 * "Controle forestry somente para fernando, depois peco para liberar para algum usuario"). Para liberar, o nome entra aqui.
 */
export const CONTROLE_CONTABIL_LIBERADO_PARA: readonly string[] = ['fernando'];

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function controleContabilLiberadoPara(nome: string | null | undefined): boolean {
  const primeiro = semAcento(String(nome || '')).split(/[\s.]+/)[0] || '';
  return CONTROLE_CONTABIL_LIBERADO_PARA.includes(primeiro);
}

/** Uma linha guardada (controleContabil/{ano}_{código}) */
export interface LinhaDoControleContabil {
  ano: number;
  codigo: number;
  /** o último mês do ano com a contabilidade feita: 1 a 12; 0 = nenhum */
  feitaAte: number;
  /** a pendência da empresa (a coluna OBSERVAÇÕES) */
  observacao: string;
  /** não acompanhar no ano (arrendada, encerrada, foi para outro contador): o motivo; '' = acompanha */
  pausada: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

export const MAX_OBSERVACAO_CONTABIL = 500;
export const MAX_MOTIVO_PAUSA = 120;

export const idDaLinhaContabil = (ano: number, codigo: number) => ano + '_' + codigo;
export const linhaContabilEmBranco = (ano: number, codigo: number): LinhaDoControleContabil => ({ ano, codigo, feitaAte: 0, observacao: '', pausada: '' });
/** a linha não diz nada (pode não ser gravada) */
export const linhaContabilVazia = (l: LinhaDoControleContabil) => !l.feitaAte && !l.observacao.trim() && !l.pausada.trim();

/** os meses como na planilha (a lista suspensa da coluna Meses) */
export const MESES_DO_CONTROLE = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'] as const;
const MESES_POR_EXTENSO = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "OUT" (ou "—" para nenhum) */
export const rotuloDoMesFeito = (mes: number) => (mes >= 1 && mes <= 12 ? MESES_DO_CONTROLE[mes - 1] : '—');

/**
 * O mês de um texto da coluna Meses: "OUT", "out", "Outubro", "10", "10/2026" ou "2026-10" → 10; "-", "—", "nenhum" → 0;
 * vazio → null (não diz nada); o que não dá para entender → undefined.
 */
export function mesDoTexto(v: unknown): number | null | undefined {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= 12 ? v : undefined;
  const s = semAcento(String(v ?? '')).replace(/\.$/, '');
  if (!s) return null;
  if (/^[-–—]+$/.test(s) || s === 'nenhum' || s === 'nenhuma') return 0;
  const curto = MESES_DO_CONTROLE.findIndex(m => m.toLowerCase() === s.slice(0, 3));
  if (curto >= 0 && (s.length === 3 || MESES_POR_EXTENSO[curto] === s)) return curto + 1;
  const m = /^(\d{1,2})(?:\/\d{4})?$/.exec(s) || /^\d{4}-(\d{2})$/.exec(s);
  if (m) { const n = Number(m[1]); return n >= 1 && n <= 12 ? n : undefined; }
  return undefined;
}

/**
 * O mês que já devia estar feito no ano: o mês anterior ao de hoje (a competência de trabalho do Contábil). Num ano que
 * já passou, dezembro; num ano que ainda não chegou na competência, nenhum.
 */
export function mesEsperadoContabil(ano: number, hoje: Date): number {
  const ref = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  if (ano < ref.getFullYear()) return 12;
  if (ano > ref.getFullYear()) return 0;
  return ref.getMonth() + 1;
}

/** O ano em que a tela abre: o da competência de trabalho (em janeiro, ainda o ano anterior). */
export const anoDeTrabalhoContabil = (hoje: Date) => new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1).getFullYear();

export type SituacaoContabil = 'em-dia' | 'atrasada' | 'nao-iniciada' | 'pausada';
export const SITUACOES_CONTABEIS: readonly { valor: SituacaoContabil; rotulo: string }[] = [
  { valor: 'em-dia', rotulo: 'Em dia' },
  { valor: 'atrasada', rotulo: 'Atrasada' },
  { valor: 'nao-iniciada', rotulo: 'Não iniciada' },
  { valor: 'pausada', rotulo: 'Não acompanhar' },
];

export interface SituacaoDaLinhaContabil {
  situacao: SituacaoContabil;
  /** quantos meses faltam até o esperado (0 em dia ou pausada) */
  atraso: number;
  rotulo: string;
}

const meses = (n: number) => n + (n === 1 ? ' mês' : ' meses');

/** A situação da empresa no ano: não acompanhar, em dia (feita até o esperado), não iniciada (nenhum mês) ou atrasada. */
export function situacaoContabil(l: Pick<LinhaDoControleContabil, 'feitaAte' | 'pausada'>, esperado: number): SituacaoDaLinhaContabil {
  if (l.pausada.trim()) return { situacao: 'pausada', atraso: 0, rotulo: 'Não acompanhar' };
  const atraso = Math.max(0, esperado - l.feitaAte);
  if (!atraso) return { situacao: 'em-dia', atraso: 0, rotulo: 'Em dia' };
  if (!l.feitaAte) return { situacao: 'nao-iniciada', atraso, rotulo: 'Não iniciada' };
  return { situacao: 'atrasada', atraso, rotulo: 'Atrasada ' + meses(atraso) };
}

/**
 * A sugestão do executor: o maior mês, depois do feito, até onde a rotina do Contábil ficou concluída mês a mês sem
 * buraco (feita até agosto; setembro e outubro concluídos → outubro). null = nada a sugerir.
 * concluidas: as competências do ano (AAAA-MM) com a rotina concluída.
 */
export function sugestaoDoExecutor(ano: number, feitaAte: number, concluidas: Iterable<string>): number | null {
  const doAno = new Set([...concluidas].filter(c => c.slice(0, 4) === String(ano)).map(c => Number(c.slice(5, 7))));
  let m = feitaAte;
  while (m < 12 && doAno.has(m + 1)) m++;
  return m > feitaAte ? m : null;
}

// ── a planilha (os dados de antes) ──────────────────────────────────────────

/** Uma empresa lida da planilha */
export interface LinhaDaPlanilhaContabil {
  codigo: number;
  nome: string;
  /** o mês feito (0 = "-"); null = a célula em branco */
  feitaAte: number | null;
  /** o regime como está na planilha ("Simples Nacional", "Presumido"...) */
  regime: string;
  observacao: string;
}

export interface LeituraDaPlanilhaContabil {
  linhas: LinhaDaPlanilhaContabil[];
  /** as linhas com nome e sem código, ou com o mês que não deu para entender */
  ignoradas: { linha: number; motivo: string }[];
  erro?: string;
}

const norm = (v: unknown) => semAcento(String(v ?? '')).replace(/[º°]/g, 'o').replace(/\s+/g, ' ');
const texto = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();

/**
 * Lê as linhas da primeira aba (já como matriz): acha o cabeçalho (a linha com EMPRESAS e Meses), a coluna do código (Nº,
 * Cód.), o regime e as observações. comentarios: o comentário de cada linha (o índice da matriz), que vai junto da observação.
 */
export function linhasDaPlanilhaContabil(matriz: readonly (readonly unknown[])[], comentarios: ReadonlyMap<number, string> = new Map()): LeituraDaPlanilhaContabil {
  const cab = matriz.findIndex(r => r.some(v => /^empresas?$/.test(norm(v))) && r.some(v => /^(meses|mes|feita ate)$/.test(norm(v))));
  if (cab < 0) return { linhas: [], ignoradas: [], erro: 'Não achei as colunas EMPRESAS e Meses na planilha.' };
  const h = matriz[cab].map(norm);
  const col = (re: RegExp) => h.findIndex(x => re.test(x));
  const c = { codigo: col(/^(no|n|num|numero|cod|codigo|cod\.)$/), nome: col(/^empresas?$/), mes: col(/^(meses|mes|feita ate)$/), regime: col(/^regime/), obs: col(/^observac/) };
  // sem o título do código: a coluna logo antes do nome (na planilha, o Nº fica na A)
  if (c.codigo < 0 && c.nome > 0) c.codigo = c.nome - 1;
  const linhas: LinhaDaPlanilhaContabil[] = [];
  const ignoradas: LeituraDaPlanilhaContabil['ignoradas'] = [];
  const vistos = new Set<number>();
  for (let i = cab + 1; i < matriz.length; i++) {
    const r = matriz[i];
    const nome = texto(r[c.nome]);
    const cod = texto(r[c.codigo]).replace(/\.0+$/, '');
    if (!nome && !cod) continue;
    const codigo = /^\d+$/.test(cod) ? Number(cod) : NaN;
    if (!Number.isFinite(codigo) || codigo <= 0) { ignoradas.push({ linha: i + 1, motivo: (nome || 'Linha') + ': sem o código da empresa' }); continue; }
    if (vistos.has(codigo)) { ignoradas.push({ linha: i + 1, motivo: 'O código ' + codigo + ' aparece de novo' }); continue; }
    const mes = mesDoTexto(r[c.mes]);
    if (mes === undefined) { ignoradas.push({ linha: i + 1, motivo: nome + ': não entendi o mês "' + texto(r[c.mes]) + '"' }); continue; }
    vistos.add(codigo);
    const obs = [c.obs >= 0 ? texto(r[c.obs]) : '', comentarios.get(i) || ''].filter(Boolean).join(' — ');
    linhas.push({ codigo, nome, feitaAte: mes, regime: c.regime >= 0 ? texto(r[c.regime]) : '', observacao: obs.slice(0, MAX_OBSERVACAO_CONTABIL) });
  }
  return { linhas, ignoradas };
}

/** O texto do comentário do Excel sem o aviso do comentário encadeado ("[Threaded comment] … Comment:"). */
export function textoDoComentario(t: string): string {
  const s = String(t || '');
  const i = s.indexOf('Comment:');
  return (s.includes('[Threaded comment]') && i >= 0 ? s.slice(i + 'Comment:'.length) : s).replace(/\s+/g, ' ').trim();
}

/** Lê o arquivo (.xlsx, .xls ou .csv): a primeira aba, com os comentários das células. */
export function lerPlanilhaDoControleContabil(buf: ArrayBuffer): LeituraDaPlanilhaContabil {
  let wb: XLSX.WorkBook;
  try { wb = XLSX.read(new Uint8Array(buf), { type: 'array' }); } catch { return { linhas: [], ignoradas: [], erro: 'Não consegui abrir o arquivo: mande o .xlsx da planilha.' }; }
  const aba = wb.Sheets[wb.SheetNames[0]];
  if (!aba || !aba['!ref']) return { linhas: [], ignoradas: [], erro: 'A planilha está vazia.' };
  const area = XLSX.utils.decode_range(aba['!ref']);
  // a matriz começa na primeira linha da área usada: o índice dela é o da linha menos o começo
  const matriz = XLSX.utils.sheet_to_json(aba, { header: 1, defval: '', blankrows: true, raw: true }) as unknown[][];
  const comentarios = new Map<number, string>();
  for (const [ref, cel] of Object.entries(aba)) {
    if (ref.startsWith('!')) continue;
    const cs = (cel as XLSX.CellObject).c;
    if (!cs?.length) continue;
    const txt = cs.map(x => textoDoComentario(x.t || '')).filter(Boolean);
    const unicos = [...new Set(txt)].join(' ');
    if (!unicos) continue;
    const i = XLSX.utils.decode_cell(ref).r - area.s.r;
    comentarios.set(i, [comentarios.get(i), unicos].filter(Boolean).join(' '));
  }
  return linhasDaPlanilhaContabil(matriz, comentarios);
}

/** O regime da planilha no nome do Cadastro ("Simples Nacional" → "Simples"); '' quando não diz. */
export function regimeDaPlanilhaContabil(r: string): string {
  const s = norm(r);
  if (!s) return '';
  if (s.startsWith('simples')) return 'Simples';
  if (s.startsWith('presumido') || s.includes('lucro presumido')) return 'Presumido';
  if (s.startsWith('real') || s.includes('lucro real')) return 'Real';
  if (s.startsWith('isent') || s.startsWith('imune')) return 'Isentas';
  if (s === 'mei') return 'MEI';
  return texto(r);
}

export interface EmpresaDoControleContabil { codigo: number; nome: string; regime: string }

export interface PlanoDaImportacaoContabil {
  /** as linhas que mudam (já juntadas com o que está no nads) */
  gravar: LinhaDoControleContabil[];
  /** casaram com o Cadastro e não mudam nada */
  iguais: number;
  /** o código não está no Cadastro */
  naoAchadas: LinhaDaPlanilhaContabil[];
  /** o nads já tinha um mês mais à frente: fica o do nads */
  mantidas: { codigo: number; nome: string; noNads: number; naPlanilha: number }[];
  /** o regime da planilha não é o do Cadastro (só o aviso: o Cadastro não muda) */
  regimeDiferente: { codigo: number; nome: string; naPlanilha: string; noCadastro: string }[];
}

/**
 * O que a importação faz, antes de gravar: casa pelo código com o Cadastro; o mês nunca volta para trás (o nads mais à frente
 * fica); a célula do mês em branco e a observação em branco não apagam o que o nads já tem; o regime só avisa.
 */
export function planoDaImportacaoContabil(p: {
  ano: number;
  lidas: readonly LinhaDaPlanilhaContabil[];
  empresas: readonly EmpresaDoControleContabil[];
  existentes: ReadonlyMap<number, LinhaDoControleContabil>;
}): PlanoDaImportacaoContabil {
  const porCodigo = new Map(p.empresas.map(e => [e.codigo, e]));
  const r: PlanoDaImportacaoContabil = { gravar: [], iguais: 0, naoAchadas: [], mantidas: [], regimeDiferente: [] };
  for (const l of p.lidas) {
    const e = porCodigo.get(l.codigo);
    if (!e) { r.naoAchadas.push(l); continue; }
    const regime = regimeDaPlanilhaContabil(l.regime);
    if (regime && e.regime && regime !== e.regime) r.regimeDiferente.push({ codigo: e.codigo, nome: e.nome, naPlanilha: l.regime, noCadastro: e.regime });
    const antes = p.existentes.get(l.codigo) || linhaContabilEmBranco(p.ano, l.codigo);
    let feitaAte = antes.feitaAte;
    if (l.feitaAte != null) {
      if (l.feitaAte < antes.feitaAte) r.mantidas.push({ codigo: e.codigo, nome: e.nome, noNads: antes.feitaAte, naPlanilha: l.feitaAte });
      feitaAte = Math.max(antes.feitaAte, l.feitaAte);
    }
    const observacao = l.observacao.trim() ? l.observacao.trim().slice(0, MAX_OBSERVACAO_CONTABIL) : antes.observacao;
    if (feitaAte === antes.feitaAte && observacao === antes.observacao) { r.iguais++; continue; }
    r.gravar.push({ ano: p.ano, codigo: l.codigo, feitaAte, observacao, pausada: antes.pausada });
  }
  return r;
}

/**
 * As linhas dos dados de exemplo (o nads sem o banco): as empresas dadas, com meses variados até o esperado, umas sem
 * nenhum mês, uma com pendência e uma que não se acompanha. Sempre as mesmas para os mesmos códigos.
 */
export function linhasDeExemploContabil(ano: number, codigos: readonly number[], esperado: number): LinhaDoControleContabil[] {
  const PENDENCIAS = ['Falta o extrato de setembro', 'Falta a provisão do imposto', 'Falta nota de serviço; passado ao Fiscal'];
  return codigos.map((codigo, i) => {
    const l = linhaContabilEmBranco(ano, codigo);
    const k = i % 6;
    l.feitaAte = k === 0 || k === 3 ? esperado : k === 1 ? Math.max(0, esperado - 2) : k === 2 ? 0 : k === 4 ? Math.max(0, esperado - 1) : Math.max(0, esperado - 4);
    if (k === 1 || k === 4) l.observacao = PENDENCIAS[i % PENDENCIAS.length];
    if (i === 5) { l.pausada = 'Arrendada'; l.observacao = 'Contabilidade feita até ' + rotuloDoMesFeito(l.feitaAte) + '; balancete enviado ao novo contador'; }
    return l;
  });
}
