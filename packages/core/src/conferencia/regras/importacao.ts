// Importação: validar o arquivo, mesclar ("Importar apenas novas" / "Sobrepor o movimento")
// e conferir se o balancete é mesmo desta empresa.
// Origem: conferencia.html importar/aplicar (~L2856-2926), importarServ/aplicar (~L4311-4371),
// verificarBalancete/assinaturaBalancete (~L2570-2604), btPlano concluir (~L2539-2555).
import { dataOrdem, docLimpo, nomeNorm } from '../../formatos';
import type { Conta, Empresa, Nota, NotaServico, TipoCfop, TipoNotaFiscal } from '../tipos';
import { chaveNota, tipoDoCfop } from './cfop';
import { contasDaNatureza } from './empresa';
import { chaveServ } from './servicos';

export type ModoImportacao = 'novas' | 'sobrepor';

// ---------- notas fiscais ----------
export interface SeparacaoPorTipo { validas: Nota[]; foraDoTipo: Nota[]; todasForaDoTipo: boolean }

/** O arquivo de Entradas só aceita CFOP de entrada (1, 2, 3) e o de Saídas só de saída (5, 6, 7). */
export function separarPorTipo(novas: Nota[], tipo: TipoNotaFiscal): SeparacaoPorTipo {
  const esperado: TipoCfop = tipo === 'entradas' ? 'Entrada' : 'Saída';
  const foraDoTipo = novas.filter(n => { const t = tipoDoCfop(n.cfop); return !!t && t !== esperado; });
  return {
    validas: foraDoTipo.length ? novas.filter(n => foraDoTipo.indexOf(n) < 0) : novas,
    foraDoTipo,
    todasForaDoTipo: novas.length > 0 && foraDoTipo.length === novas.length,
  };
}

/**
 * Só as notas do período da Tarefa (Vitor, 19/10/2026: "se eu colocar o período até 31/08, só importe até aquelas
 * datas"): pela competência da nota; sem período (a Conferência sozinha), todas. A nota sem data fica; a de data com mês que não
 * existe ("05/13/2026", sem competência desde 10/11/2026) continua de fora, com o aviso: não é do período e sumiria da conferência calada.
 */
export function soDoPeriodo<N extends { comp: string; data?: string }>(notas: readonly N[], meses?: readonly string[]): { dentro: N[]; fora: N[] } {
  if (!meses?.length) return { dentro: [...notas], fora: [] };
  const r = { dentro: [] as N[], fora: [] as N[] };
  const mesQueNaoExiste = (n: N) => { const m = /\d{1,2}[/-](\d{1,2})[/-]\d{2,4}/.exec(n.data || ''); return !!m && (+m[1] < 1 || +m[1] > 12); };
  for (const n of notas) ((!n.comp && !mesQueNaoExiste(n)) || meses.includes(n.comp) ? r.dentro : r.fora).push(n);
  return r;
}

/**
 * Os meses do período da Tarefa sem nenhuma nota (Vitor, 04/11/2026: "tá importado só até o 08, sendo que falei que ia fazer em
 * lote do 01 a 09"): o arquivo do Alterdata pode ter saído com o período curto.
 */
export function mesesSemNotas(notas: readonly { comp: string }[], meses?: readonly string[]): string[] {
  if (!meses?.length) return [];
  const tem = new Set(notas.map(n => n.comp));
  return meses.filter(m => !tem.has(m));
}

export interface ResultadoMescla<N> { notas: N[]; adicionadas: number; atualizadas: number; semMudanca: number }

/** O mesmo documento (com ou sem máscara), ou um dos dois sem documento: não dá para dizer que são participantes diferentes. */
function docsCompativeis(a: Pick<Nota, 'doc'>, b: Pick<Nota, 'doc'>): boolean {
  const x = docLimpo(a.doc), y = docLimpo(b.doc);
  return !x || !y || x === y;
}

/**
 * Mescla notas fiscais. Não muda as listas de entrada.
 * A chave da nota (cfop, número, data e valor) não tem o participante: dois fornecedores com o mesmo número, data e valor viravam
 * uma nota só e a outra se perdia (09/11/2026). No arquivo, documentos diferentes são duas notas; contra o que já está guardado,
 * a linha do arquivo procura primeiro a nota com o mesmo documento, e a que sobrar sem dono recebe o documento novo (a correção).
 */
export function mesclarNotas(existentes: Nota[], novas: Nota[], modo: ModoImportacao): ResultadoMescla<Nota> {
  let atuais: Nota[];
  let add = 0;
  let atualizadas = 0;
  if (modo === 'sobrepor') {
    const vistos = new Map<string, Nota[]>();
    atuais = [];
    for (const n of novas) {
      const k = chaveNota(n);
      const iguais = vistos.get(k) || [];
      if (iguais.some(x => docsCompativeis(x, n))) continue;
      vistos.set(k, [...iguais, n]);
      atuais.push({ ...n });
    }
    add = atuais.length;
  } else {
    atuais = existentes.map(n => ({ ...n }));
    const porChave = new Map<string, Nota[]>();
    for (const n of atuais) porChave.set(chaveNota(n), [...(porChave.get(chaveNota(n)) || []), n]);
    const mesmoDoc = (n: Nota) => { const d = docLimpo(n.doc); return d ? (porChave.get(chaveNota(n)) || []).find(x => docLimpo(x.doc) === d) : undefined; };
    const comDono = new Set<Nota>();
    for (const n of novas) { const ex = mesmoDoc(n); if (ex) comDono.add(ex); }
    for (const n of novas) {
      const k = chaveNota(n);
      const iguais = porChave.get(k) || [];
      const ex = mesmoDoc(n) || iguais.find(x => !comDono.has(x)) || iguais.find(x => docsCompativeis(x, n));
      if (!ex) { const c = { ...n }; atuais.push(c); porChave.set(k, [...iguais, c]); comDono.add(c); add++; continue; }
      comDono.add(ex);
      if (n.doc && ex.doc !== n.doc) ex.doc = n.doc;
      if (n.exportado && ex.exportado !== n.exportado) ex.exportado = n.exportado;
      // a conta contábil do cliente (o Creditor acha a conta pela NF): reimportar o mesmo relatório já traz ela
      if (n.conta && ex.conta !== n.conta) ex.conta = n.conta;
      // o NCM, o CST e o CEST do item também (a verificação do Fiscal lê da nota guardada)
      if (n.ncm && ex.ncm !== n.ncm) ex.ncm = n.ncm;
      if (n.cst && ex.cst !== n.cst) ex.cst = n.cst;
      if (n.cest && ex.cest !== n.cest) ex.cest = n.cest;
      if (ex.lanc !== n.lanc || ex.nome !== n.nome || ex.desc !== n.desc) { ex.lanc = n.lanc; ex.nome = n.nome; ex.desc = n.desc; atualizadas++; }
    }
  }
  atuais.sort((a, b) => dataOrdem(a.data) - dataOrdem(b.data));
  return { notas: atuais, adicionadas: add, atualizadas, semMudanca: novas.length - add - atualizadas };
}

// ---------- serviços ----------
export function mesclarServicos(existentes: NotaServico[], novas: NotaServico[], modo: ModoImportacao): ResultadoMescla<NotaServico> {
  let atuais: NotaServico[];
  let add = 0;
  let atualizadas = 0;
  if (modo === 'sobrepor') {
    const vistos: Record<string, 1> = {};
    atuais = [];
    for (const n of novas) { const k = chaveServ(n); if (!vistos[k]) { vistos[k] = 1; atuais.push({ ...n }); } }
    add = atuais.length;
  } else {
    atuais = existentes.map(n => ({ ...n }));
    const por: Record<string, NotaServico> = {};
    for (const n of atuais) por[chaveServ(n)] = n;
    for (const n of novas) {
      const k = chaveServ(n);
      const ex = por[k];
      if (!ex) { const c = { ...n }; atuais.push(c); por[k] = c; add++; continue; }
      if (n.conta && ex.conta !== n.conta) ex.conta = n.conta;
      // o ISS como as retenções abaixo: o relatório sem a coluna não apaga o guardado (10/11/2026)
      const iss = n.iss ?? ex.iss;
      if (ex.lanc !== n.lanc || ex.codPart !== n.codPart || ex.iss !== iss) { ex.lanc = n.lanc; ex.codPart = n.codPart; ex.iss = iss; atualizadas++; }
      // as retenções entram quando o relatório traz a coluna (a corrigida sem mudar o lançamento ficava com o valor velho)
      for (const r of ['issRet', 'irrf', 'inss', 'pis', 'cofins', 'csll'] as const) { const v = n[r]; if (v != null) ex[r] = v; }
      if (n.exportado && ex.exportado !== n.exportado) ex.exportado = n.exportado;
    }
  }
  atuais.sort((a, b) => dataOrdem(a.data) - dataOrdem(b.data));
  return { notas: atuais, adicionadas: add, atualizadas, semMudanca: novas.length - add - atualizadas };
}

// ---------- balancete ----------
/** Plano de contas: menos que isso de semelhança com o último balancete = parece outra empresa. */
export const BAL_SIMILARIDADE_MIN = 60;
/** Os códigos em comum que a semelhança pede (ou todos os do plano menor, se ele tiver menos): menos que isso pesa contra. */
export const BAL_COMUNS_MIN = 10;

/** Impressão digital do plano: código → nome normalizado. */
export function assinaturaBalancete(lista: Pick<Conta, 'codigo' | 'nome'>[]): Record<string, string> {
  const a: Record<string, string> = {};
  for (const c of lista) a[c.codigo] = nomeNorm(c.nome);
  return a;
}

export interface VerificacaoBalancete {
  /** frases com <b> — a View mostra como HTML controlado */
  problemas: string[];
  similaridade: number | null;
}

/**
 * Esse balancete é mesmo desta empresa? O arquivo não traz nome nem CNPJ, e o plano padrão
 * repete códigos entre empresas — então compara código + nome:
 * 1) as contas vinculadas no Cadastro que vieram no arquivo precisam ter o mesmo nome do último balancete;
 * 2) o plano precisa ser parecido com o do último balancete desta empresa: entre os códigos que estão nos dois, a % com
 *    o mesmo nome. A conta que só um dos dois tem não pesa: o Alterdata não lista a conta sem saldo no mês, e ela some de
 *    um balancete para o outro (30/10/2026: dividir pela união dos dois planos derrubava a % por falta de saldo). Com
 *    menos de BAL_COMUNS_MIN códigos em comum (ou todos os do plano menor), a conta é sobre esse mínimo: pouco em comum
 *    também é plano pouco parecido.
 * A conta vinculada que não veio no arquivo, sozinha, é só a conta sem saldo no mês, não outra empresa: não avisa — nem
 * sem balancete anterior (30/10/2026) nem com o plano parecido (29/10/2026, a 289: a 96081 da bonificação faltava e o
 * plano era o mesmo). Ela entra na lista só junto com o plano pouco parecido. O nome trocado avisa sempre.
 */
export function verificarBalancete(e: Empresa, lista: Conta[]): VerificacaoBalancete {
  const nova = assinaturaBalancete(lista);
  const nomeNovo: Record<string, string> = {};
  for (const c of lista) nomeNovo[c.codigo] = c.nome;
  const ref = e.balanceteAssinatura || null;
  const prob: string[] = [];
  const vinc: Record<string, 1> = {};
  for (const k of Object.keys(e.naturezaConta || {})) for (const c of contasDaNatureza(e, k)) vinc[c] = 1;
  for (const l of e.dp || []) if (l.travado && l.conta) vinc[l.conta] = 1;
  const codsV = Object.keys(vinc);
  let sim: number | null = null;
  if (ref) {
    const comuns = Object.keys(ref).filter(k => k in nova);
    const iguais = comuns.filter(k => nova[k] === ref[k]).length;
    const minimo = Math.min(BAL_COMUNS_MIN, Object.keys(ref).length, Object.keys(nova).length);
    sim = Math.round(iguais / Math.max(1, comuns.length, minimo) * 100);
  }
  const planoDiferente = sim !== null && sim < BAL_SIMILARIDADE_MIN;
  const ruins: string[] = [];
  for (const c of codsV) {
    if (!(c in nova)) { if (planoDiferente) ruins.push(c + ' não existe neste arquivo'); }
    else if (ref && ref[c] && ref[c] !== nova[c]) ruins.push(c + ' era "' + ref[c] + '" e aqui é "' + nomeNovo[c] + '"');
  }
  if (ruins.length) prob.push('<b>' + ruins.length + ' de ' + codsV.length + '</b> conta(s) vinculada(s) no Cadastro não batem: ' + escapar(ruins.slice(0, 3).join('; ')) + (ruins.length > 3 ? '…' : '') + '.');
  if (planoDiferente) prob.push('Só <b>' + sim + '%</b> das contas batem com o último balancete importado desta empresa' +
    (e.balanceteAssinaturaTs ? ' (em ' + new Date(e.balanceteAssinaturaTs).toLocaleDateString('pt-BR') + ')' : '') + '.');
  return { problemas: prob, similaridade: sim };
}

function escapar(s: string): string {
  return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

/** Lista do balancete lido, em ordem de nome (como o original grava). */
export function ordenarBalancete(m: Record<string, Conta>): Conta[] {
  return Object.keys(m).map(k => m[k]).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map(a => ({ codigo: a.codigo, nome: a.nome, dc: a.dc, grupo: a.grupo, sintetica: a.sintetica, valor: a.valor, ordem: a.ordem }));
}
