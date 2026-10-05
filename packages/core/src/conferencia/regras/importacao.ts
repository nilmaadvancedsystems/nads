// Importação: validar o arquivo, mesclar ("Importar apenas novas" / "Sobrepor o movimento")
// e conferir se o balancete é mesmo desta empresa.
// Origem: conferencia.html importar/aplicar (~L2856-2926), importarServ/aplicar (~L4311-4371),
// verificarBalancete/assinaturaBalancete (~L2570-2604), btPlano concluir (~L2539-2555).
import { dataOrdem, nomeNorm } from '../../formatos';
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

export interface ResultadoMescla<N> { notas: N[]; adicionadas: number; atualizadas: number; semMudanca: number }

/** Mescla notas fiscais. Não muda as listas de entrada. */
export function mesclarNotas(existentes: Nota[], novas: Nota[], modo: ModoImportacao): ResultadoMescla<Nota> {
  let atuais: Nota[];
  let add = 0;
  let atualizadas = 0;
  if (modo === 'sobrepor') {
    const vistos: Record<string, 1> = {};
    atuais = [];
    for (const n of novas) { const k = chaveNota(n); if (!vistos[k]) { vistos[k] = 1; atuais.push({ ...n }); } }
    add = atuais.length;
  } else {
    atuais = existentes.map(n => ({ ...n }));
    const porChave: Record<string, Nota> = {};
    for (const n of atuais) porChave[chaveNota(n)] = n;
    for (const n of novas) {
      const k = chaveNota(n);
      const ex = porChave[k];
      if (!ex) { const c = { ...n }; atuais.push(c); porChave[k] = c; add++; continue; }
      if (n.doc && ex.doc !== n.doc) ex.doc = n.doc;
      if (n.exportado && ex.exportado !== n.exportado) ex.exportado = n.exportado;
      // a conta contábil do cliente (o Creditor acha a conta pela NF): reimportar o mesmo relatório já traz ela
      if (n.conta && ex.conta !== n.conta) ex.conta = n.conta;
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
      if (ex.lanc !== n.lanc || ex.codPart !== n.codPart || ex.iss !== n.iss) { ex.lanc = n.lanc; ex.codPart = n.codPart; ex.iss = n.iss; ex.issRet = n.issRet; atualizadas++; }
      if (n.exportado && ex.exportado !== n.exportado) ex.exportado = n.exportado;
    }
  }
  atuais.sort((a, b) => dataOrdem(a.data) - dataOrdem(b.data));
  return { notas: atuais, adicionadas: add, atualizadas, semMudanca: novas.length - add - atualizadas };
}

// ---------- balancete ----------
/** Plano de contas: menos que isso de semelhança com o último balancete = parece outra empresa. */
export const BAL_SIMILARIDADE_MIN = 60;

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
 * 1) as contas vinculadas no Cadastro precisam existir no arquivo (e com o mesmo nome);
 * 2) o plano precisa ser parecido com o do último balancete desta empresa.
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
  const ruins: string[] = [];
  for (const c of codsV) {
    if (!(c in nova)) ruins.push(c + ' não existe neste arquivo');
    else if (ref && ref[c] && ref[c] !== nova[c]) ruins.push(c + ' era "' + ref[c] + '" e aqui é "' + nomeNovo[c] + '"');
  }
  if (ruins.length) prob.push('<b>' + ruins.length + ' de ' + codsV.length + '</b> conta(s) vinculada(s) no Cadastro não batem: ' + escapar(ruins.slice(0, 3).join('; ')) + (ruins.length > 3 ? '…' : '') + '.');
  let sim: number | null = null;
  if (ref) {
    const uniao: Record<string, 1> = {};
    let iguais = 0;
    for (const k of Object.keys(ref)) { uniao[k] = 1; if (nova[k] === ref[k]) iguais++; }
    for (const k of Object.keys(nova)) uniao[k] = 1;
    sim = Math.round(iguais / Math.max(1, Object.keys(uniao).length) * 100);
    if (sim < BAL_SIMILARIDADE_MIN) prob.push('Só <b>' + sim + '%</b> das contas batem com o último balancete importado desta empresa' +
      (e.balanceteAssinaturaTs ? ' (em ' + new Date(e.balanceteAssinaturaTs).toLocaleDateString('pt-BR') + ')' : '') + '.');
  }
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
