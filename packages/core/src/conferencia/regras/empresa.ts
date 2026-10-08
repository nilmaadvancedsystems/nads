// A empresa: normalização do documento, contas, vínculos e o que já foi importado.
// Origem: conferencia.html norm/limparNomeConta (~L1507-1513), contasDaNatureza e
// vizinhas (~L2266-2343), importacoesOk/telaInicialEmpresa (~L1711-1722),
// impJaImportado (~L2463), empresaNuncaAberta (~L2429), ordemPlano (~L2349).
import { compararNumerico } from '../../formatos';
import { ehServ, SV } from '../tabelas/servicos';
import type { Conta, Empresa, Grupo, Nota, NotaServico, TipoMovimento, TipoServico } from '../tipos';
import { agruparTotaisPorNatureza, comTipo } from './cfop';

export const GRUPOS_ORDEM: readonly Grupo[] = ['Ativo', 'Passivo', 'Despesa', 'Receita', 'Outros'];

/** Tira valor que vazou pra frente do nome da conta ("1.234,56 D Caixa" → "Caixa"). */
export function limparNomeConta(nome: unknown): string {
  let s = String(nome || '');
  const reValorNaFrente = /^-?\(?\d{1,3}(\.\d{3})*,\d{2}\)?\s*[DC]?\s+/i;
  while (reValorNaFrente.test(s)) s = s.replace(reValorNaFrente, '');
  return s;
}

/** Empresa recém-aberta (entrar() do original). */
export function empresaNova(nome: string): Empresa {
  return normalizarEmpresa({ nome });
}

/** Documento como veio (pode ter campos antigos: semPrestados, servPart, lancConfig…). */
type EmpresaBruta = Partial<Empresa> & { nome: string };
type Legado = { semPrestados?: boolean; servPart?: unknown; lancConfig?: unknown; lancAuto?: unknown };

/** O norm() do original: preenche o que falta e migra campos antigos. Não muda o que já está certo. */
export function normalizarEmpresa(bruta: EmpresaBruta): Empresa {
  const e = structuredClone(bruta) as EmpresaBruta & Legado;
  e.contas = (e.contas || []).map(c => { if (c && c.nome) c.nome = limparNomeConta(c.nome); return c; });
  e.dp = e.dp || [];
  e.entradas = e.entradas || [];
  e.saidas = e.saidas || [];
  e.divResolvidos = e.divResolvidos || [];
  e.confMarcados = e.confMarcados || [];
  e.confHistorico = e.confHistorico || [];
  e.naturezaConta = e.naturezaConta || {};
  e.confAutoMarcados = e.confAutoMarcados || [];
  e.confAutoRecusados = e.confAutoRecusados || [];
  e.importHistorico = e.importHistorico || [];
  e.servPrestados = e.servPrestados || [];
  e.servTomados = e.servTomados || [];
  e.servCat = e.servCat || {};
  // conta que ficava dentro da categoria do participante migra pro vínculo da categoria
  for (const t of Object.keys(e.servCat) as TipoServico[]) {
    const m = (e.servCat[t] || {}) as Record<string, { cat: string; nome: string; conta?: string }>;
    for (const k of Object.keys(m)) {
      const x = m[k];
      if (x && x.conta) {
        const ck = 'serv|' + t + '|' + (x.cat === 'geral' ? '*' : 'cat:' + x.cat);
        if (!e.naturezaConta[ck]) e.naturezaConta[ck] = [x.conta];
        delete x.conta;
      }
    }
  }
  e.verifConta = e.verifConta || {};
  if (e.semPrestados === true && e.prestaServico === undefined) e.prestaServico = false;
  delete e.semPrestados;
  if (e.prestaServico === undefined) delete e.prestaServico;
  e.naoContabil = e.naoContabil || {};
  e.vendaVista = e.vendaVista || { ativo: false, lancs: {} };
  if (!e.vendaVista.lancs) e.vendaVista.lancs = {};
  delete (e.vendaVista as unknown as Record<string, unknown>).lanc;
  delete e.servPart; delete e.lancConfig; delete e.lancAuto;
  for (const k of Object.keys(e.naturezaConta)) {
    if (/^serv\|(tomados|prestados)\|/.test(k) && !/\|(\*|cat:[a-z]+)$/.test(k)) delete e.naturezaConta[k];
  }
  if (e.autoLimparBalancete === undefined) e.autoLimparBalancete = true;
  if (e.avisoBalPendente === undefined) delete e.avisoBalPendente;
  if (e.balanceteAssinatura === undefined) { delete e.balanceteAssinatura; delete e.balanceteAssinaturaTs; }
  return e as Empresa;
}

// ---------- contas e vínculos ----------
export function contasDaNatureza(e: Empresa, k: string): string[] {
  const v = e.naturezaConta[k];
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

export function naturezasDaConta(e: Empresa, codigo: string): string[] {
  return Object.keys(e.naturezaConta).filter(k => contasDaNatureza(e, k).indexOf(codigo) > -1);
}

export function contaPorCodigo(e: Empresa, codigo: string): Conta | undefined {
  return e.contas.find(a => a.codigo === codigo);
}

export function saldoAtualizado(e: Empresa, codigo: string): number | null {
  const c = contaPorCodigo(e, codigo);
  return c && c.valor != null ? c.valor : null;
}

export function nomeConta(e: Empresa, codigo: string): string | null {
  const c = contaPorCodigo(e, codigo);
  return c ? c.nome : null;
}

export function contasDoPassivo(e: Empresa, codigos: string[]): string[] {
  return (codigos || []).filter(c => contaPorCodigo(e, c)?.grupo === 'Passivo');
}

/** Vínculo errado vindo de antes (conta do Passivo): a mensagem do aviso, ou null. */
export function avisoPassivo(e: Empresa, codigos: string[]): string | null {
  const p = contasDoPassivo(e, codigos);
  if (!p.length) return null;
  return (p.length > 1 ? 'Contas do passivo: ' : 'Conta do passivo: ') + p.join(', ') +
    '. Corrija o vínculo em Cadastro › Configurações (só Ativo, Despesa ou Receita).';
}

export function naoContabil(e: Empresa, k: string): boolean {
  return !!(e.naoContabil || {})[k];
}

/** Ordem do plano de contas (a do balancete importado); sem ordem: grupo e código. */
export function ordemPlano<T extends Pick<Conta, 'grupo' | 'codigo' | 'ordem'>>(l: T[]): T[] {
  const gi = (a: T) => { const i = GRUPOS_ORDEM.indexOf(a.grupo); return i < 0 ? 99 : i; };
  return l.slice().sort((a, b) => {
    if (a.ordem != null && b.ordem != null) return a.ordem - b.ordem;
    return gi(a) - gi(b) || compararNumerico(String(a.codigo), String(b.codigo));
  });
}

/** Contas que dá pra vincular no Cadastro: analíticas, fora do Passivo, ainda não ligadas. */
export function contasParaVincular(e: Empresa, ligadas: string[], busca: string): Conta[] {
  let l = e.contas.filter(a => !a.sintetica && a.grupo !== 'Passivo' && ligadas.indexOf(a.codigo) < 0);
  if (busca) {
    const q = busca.toLowerCase();
    l = l.filter(a => a.nome.toLowerCase().indexOf(q) > -1 || a.codigo.indexOf(q) > -1);
  }
  return ordemPlano(l).slice(0, 50);
}

// ---------- o que a empresa tem ----------
/** "Não presta serviço" respondido: tudo de prestados some. */
export function semPrest(e: Empresa): boolean {
  return e.prestaServico === false;
}

export function listaTipo(e: Empresa, t: 'entradas' | 'saidas'): Nota[];
export function listaTipo(e: Empresa, t: TipoServico): NotaServico[];
export function listaTipo(e: Empresa, t: TipoMovimento): Nota[] | NotaServico[];
export function listaTipo(e: Empresa, t: TipoMovimento): Nota[] | NotaServico[] {
  if (t === 'prestados' && semPrest(e)) return [];
  return ehServ(t) ? e[SV[t].campo] || [] : e[t];
}

export function todasNotasComTipo(e: Empresa) {
  return comTipo(e.entradas, e.saidas);
}

export function todosGruposNatureza(e: Empresa) {
  return agruparTotaisPorNatureza(todasNotasComTipo(e));
}

/**
 * As naturezas de CFOP (entrada ou saída) sem conta no Cadastro › Configurações e sem o "Não vai para o Contábil": o
 * pontinho vermelho para configurar (Vitor, 08/10/2026). Sem o balancete ou sem as notas, não dá para configurar: nenhuma.
 */
export function naturezasSemConta(e: Empresa, tipo?: 'Entrada' | 'Saída'): string[] {
  if (!e.contas.length || (!e.entradas.length && !e.saidas.length)) return [];
  const grupos = todosGruposNatureza(e);
  return Object.keys(grupos).filter(k => (!tipo || grupos[k].tipo === tipo) && !contasDaNatureza(e, k).length && !naoContabil(e, k));
}

export function importacoesOk(e: Empresa): boolean {
  return !!(e.contas.length && ((e.entradas.length && e.saidas.length) || e.servPrestados.length || e.servTomados.length));
}

export interface JaImportado { balancete: boolean; entradas: boolean; saidas: boolean; prestados: boolean; tomados: boolean }

export function jaImportado(e: Empresa): JaImportado {
  return { balancete: e.contas.length > 0, entradas: e.entradas.length > 0, saidas: e.saidas.length > 0, prestados: e.servPrestados.length > 0, tomados: e.servTomados.length > 0 };
}

export function temNotas(e: Empresa): boolean {
  return !!(e.entradas.length || e.saidas.length || e.servPrestados.length || e.servTomados.length);
}

/** Ninguém nunca configurou nada nesta empresa. */
export function empresaNuncaAberta(e: Empresa): boolean {
  return e.avisoBalPendente === undefined && !e.contas.length && !e.entradas.length && !e.saidas.length &&
    !e.importHistorico.length && !Object.keys(e.naturezaConta).length && !e.dp.length && !e.servPrestados.length && !e.servTomados.length;
}

export type PaginaImportacao = 'balancete' | 'entradas' | 'saidas' | 'tomados' | 'prestados';

/** Onde a empresa abre: Apagar ao sair ligado → balancete; senão o Movimento, se tem nota. */
export function telaInicialEmpresa(e: Empresa): { secao: 'importacao'; pagina: PaginaImportacao } | { secao: 'movimento'; pagina: 'relatorio' } {
  if (e.autoLimparBalancete !== false) return { secao: 'importacao', pagina: 'balancete' };
  if (temNotas(e)) return { secao: 'movimento', pagina: 'relatorio' };
  return { secao: 'importacao', pagina: 'entradas' };
}

export function primeiraImportacaoPendente(e: Empresa): PaginaImportacao {
  if (!e.contas.length) return 'balancete';
  if (!e.entradas.length) return 'entradas';
  return 'saidas';
}

/** O que tem dado (o "tem" do aplicarBloqueios): trava abas e páginas. */
export interface Disponivel {
  entradas: boolean; saidas: boolean; prestados: boolean; tomados: boolean; fiscais: boolean; servicos: boolean;
}

export function disponivel(e: Empresa): Disponivel {
  const semP = semPrest(e);
  const t = { entradas: e.entradas.length > 0, saidas: e.saidas.length > 0, prestados: !semP && e.servPrestados.length > 0, tomados: e.servTomados.length > 0 };
  return { ...t, fiscais: t.entradas || t.saidas, servicos: t.tomados || t.prestados };
}
