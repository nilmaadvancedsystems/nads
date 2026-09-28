// Serviços no Relatório (abas Tomados/Prestados) e no Cadastro (categorias).
// Origem: conferencia.html renderConfServ (~L4617, a parte que calcula) e
// renderCadServ (~L4486, a parte que calcula).
import { dataOrdem, lancN, nomeNorm } from '../../formatos';
import { SERV_CAT, SV, type CategoriaServico } from '../tabelas/servicos';
import type { Empresa, FiltroMovimento, Nota, NotaServico, TipoServico } from '../tipos';
import { chaveNaturezaNota } from './cfop';
import { podeConferir, situacaoDaConta, verifEstado, type Situacao } from './conciliacao';
import { avisoPassivo, contasDaNatureza, listaTipo, nomeConta, saldoAtualizado } from './empresa';
import { noPeriodo } from './periodo';
import { catDoPart, catFixa, catServ, chaveServ, contasDoPart, notasCfopDeServico, participantesDasNotas } from './servicos';

export function chaveResolvidoServ(tipo: TipoServico, n: NotaServico): string {
  return 'serv:' + tipo + '|' + chaveServ(n);
}

export interface LinhaSaldoServ {
  contas: string[];
  titulo: string;
  descricao: string;
  qtdNotas: number;
  participantes: string[];
  somaNotas: number;
  saldo: number | null;
  situacao: Situacao;
  avisoPassivo: string | null;
}

export interface NotaForaDoPadraoServ { nota: NotaServico; chave: string; esperado: CategoriaServico }
export interface GrupoForaDoPadraoServ {
  key: string;
  nome: string;
  cat: CategoriaServico;
  itens: NotaForaDoPadraoServ[];
  /** lançou com o lançamento de outra categoria: dá pra colocar o participante nela */
  sugerirCategorias: CategoriaServico[];
}

export type OrdemServ = 'nome' | 'valor' | 'data';

export interface ConferenciaServicos {
  totais: { valor: number; iss: number; issRet: number; irrf: number; inss: number };
  temIss: boolean;
  qtdNotas: number;
  qtdParticipantes: number;
  qtdForaDoPadrao: number;
  saldo: LinhaSaldoServ[];
  temDivergencias: boolean;
  pendentes: GrupoForaDoPadraoServ[];
  corrigidos: GrupoForaDoPadraoServ[];
  qtdCorrigidos: number;
}

export function conferirServicos(e: Empresa, tipo: TipoServico, f: FiltroMovimento, ordem: OrdemServ): ConferenciaServicos {
  const notas = listaTipo(e, tipo).filter(n => noPeriodo(n, f));
  const res: Record<string, 1> = {};
  for (const k of e.divResolvidos) res[k] = 1;
  const catDe: Record<string, CategoriaServico> = {};
  for (const n of notas) { const k = nomeNorm(n.nome); if (!catDe[k]) catDe[k] = catServ(tipo, catDoPart(e, tipo, n.nome)); }
  const catN = (n: NotaServico) => catDe[nomeNorm(n.nome)];
  const divs = notas.filter(n => lancN(n.lanc) !== catN(n).lanc);
  const pend = divs.filter(n => !res[chaveResolvidoServ(tipo, n)]);
  const corr = divs.filter(n => res[chaveResolvidoServ(tipo, n)]);

  const tot = { valor: 0, iss: 0, issRet: 0, irrf: 0, inss: 0 };
  const parts: Record<string, string> = {};
  for (const n of notas) {
    tot.valor += n.valor; tot.iss += n.iss || 0; tot.issRet += n.issRet || 0; tot.irrf += n.irrf || 0; tot.inss += n.inss || 0;
    parts[nomeNorm(n.nome)] = n.nome;
  }

  // conciliação: soma das notas por conta da categoria × saldo do balancete
  interface G { contas: string[]; cats: Record<string, CategoriaServico>; total: number; parts: Record<string, string>; qtd: number; cfops?: Record<string, 1> }
  const grupos: Record<string, G> = {};
  for (const n of notas) {
    const c = catN(n);
    const cs = contasDoPart(e, tipo, n.nome).slice().sort();
    const k = cs.length ? cs.join('+') : '__sem|' + c.id;
    const g = (grupos[k] = grupos[k] || { contas: cs, cats: {}, total: 0, parts: {}, qtd: 0 });
    g.cats[c.id] = c; g.total += n.valor; g.parts[nomeNorm(n.nome)] = n.nome; g.qtd++;
  }
  // contas com nota de serviço aqui: as notas com CFOP delas entram junto
  const comServ: Record<string, 1> = {};
  for (const k of Object.keys(grupos)) for (const c of grupos[k].contas) comServ[c] = 1;
  const tNf = tipo === 'tomados' ? 'Entrada' : 'Saída';
  for (const n of notasCfopDeServico(e, tipo).filter(x => noPeriodo(x, f)) as Nota[]) {
    const cs = contasDaNatureza(e, chaveNaturezaNota(n, tNf)).slice().sort();
    if (!cs.some(c => comServ[c])) continue;
    const k = cs.join('+');
    const g = (grupos[k] = grupos[k] || { contas: cs, cats: {}, total: 0, parts: {}, qtd: 0 });
    (g.cfops = g.cfops || {})[n.cfop] = 1; g.total += n.valor; g.parts[nomeNorm(n.nome)] = n.nome; g.qtd++;
  }
  const saldo: LinhaSaldoServ[] = Object.keys(grupos).sort().map(k => {
    const g = grupos[k];
    const descricao = Object.keys(g.cats).map(id => (id === 'geral' ? 'Serviços Gerais' : g.cats[id].nome))
      .concat(g.cfops ? ['CFOP ' + Object.keys(g.cfops).sort().join(', ')] : []).join(', ');
    const titulo = g.contas.length ? g.contas.map(c => { const nm = nomeConta(e, c); return c + (nm ? ' — ' + nm : ''); }).join(' + ') : 'Sem conta vinculada';
    const falta = g.contas.some(c => saldoAtualizado(e, c) == null);
    const sal = g.contas.length && !falta ? g.contas.reduce((s, c) => s + (saldoAtualizado(e, c) as number), 0) : null;
    const situacao: Situacao = !g.contas.length ? { tipo: 'sem-conta' } : situacaoDaConta({
      somaNotas: g.total, saldo: sal,
      revisao: verifEstado(e, f, g.contas[0]),
      conferidoManual: false,
      podeConferir: podeConferir(e, g.contas, Object.keys(g.cats).map(id => g.cats[id].nome)),
    });
    return {
      contas: g.contas, titulo, descricao, qtdNotas: g.qtd, participantes: Object.keys(g.parts).map(x => g.parts[x]),
      somaNotas: g.total, saldo: sal, situacao, avisoPassivo: avisoPassivo(e, g.contas),
    };
  });

  const soma = (l: NotaForaDoPadraoServ[]) => l.reduce((s, x) => s + x.nota.valor, 0);
  const agrupar = (lista: NotaServico[], marcado: boolean): GrupoForaDoPadraoServ[] => {
    const g: Record<string, GrupoForaDoPadraoServ> = {};
    for (const n of lista) {
      const k = nomeNorm(n.nome);
      (g[k] = g[k] || { key: k, nome: n.nome, cat: catN(n), itens: [], sugerirCategorias: [] }).itens.push({ nota: n, chave: tipo + '|' + chaveServ(n), esperado: catN(n) });
    }
    return Object.keys(g).map(k => {
      const gr = g[k];
      gr.itens.sort((a, b) => dataOrdem(a.nota.data) - dataOrdem(b.nota.data));
      if (!marcado && gr.cat.id === 'geral') {
        for (const it of gr.itens) {
          const l = lancN(it.nota.lanc);
          for (const x of SERV_CAT[tipo]) if (l && x.lanc === l && x.id !== gr.cat.id && !x.travado && gr.sugerirCategorias.indexOf(x) < 0) gr.sugerirCategorias.push(x);
        }
      }
      return gr;
    }).sort((a, b) => {
      if (ordem === 'valor') return soma(b.itens) - soma(a.itens);
      if (ordem === 'data') return Math.min(...a.itens.map(i => dataOrdem(i.nota.data))) - Math.min(...b.itens.map(i => dataOrdem(i.nota.data)));
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  };

  return {
    totais: tot,
    temIss: notas.some(n => n.iss != null),
    qtdNotas: notas.length,
    qtdParticipantes: Object.keys(parts).length,
    qtdForaDoPadrao: pend.length,
    saldo,
    temDivergencias: divs.length > 0,
    pendentes: agrupar(pend, false),
    corrigidos: agrupar(corr, true),
    qtdCorrigidos: corr.length,
  };
}

// ---------- Cadastro › Configurações › Tomados/Prestados ----------
export interface ParticipanteNaCategoria { chave: string; nome: string; qtd: number | null }
export interface CategoriaNoCadastro {
  cat: CategoriaServico;
  /** chave do vínculo de conta da categoria */
  chaveConta: string;
  contas: string[];
  participantes: ParticipanteNaCategoria[];
  /** participantes na categoria geral lançados com o lançamento desta categoria */
  sugestoes: string[];
}

export function cadastroServicos(e: Empresa, t: TipoServico): CategoriaNoCadastro[] {
  const parts = participantesDasNotas(e, t);
  const mapa = (e.servCat || {})[t] || {};
  const porCat: Record<string, string[]> = {};
  for (const k of Object.keys(parts)) { const c = catDoPart(e, t, parts[k].nome); (porCat[c] = porCat[c] || []).push(k); }
  for (const k of Object.keys(mapa)) { const m = mapa[k]; if (!parts[k] && m.cat !== 'geral' && !catFixa(t, m.nome)) (porCat[m.cat] = porCat[m.cat] || []).push(k); }
  return SERV_CAT[t].map(c => {
    const chaveConta = 'serv|' + t + '|' + (c.id === 'geral' ? '*' : 'cat:' + c.id);
    const especifica = c.id !== 'geral' && !c.travado;
    return {
      cat: c, chaveConta, contas: contasDaNatureza(e, chaveConta),
      participantes: especifica ? (porCat[c.id] || []).slice().sort().map(k => {
        const p = parts[k];
        const m = mapa[k];
        return { chave: k, nome: p ? p.nome : m ? m.nome : k, qtd: p ? p.qtd : null };
      }) : [],
      sugestoes: especifica ? Object.keys(parts).filter(k => catDoPart(e, t, parts[k].nome) === 'geral' && parts[k].lancs[c.lanc]).sort().map(k => parts[k].nome) : [],
    };
  });
}

/** Participantes que dá pra pôr numa categoria (os de outras categorias, fora os fixos). */
export function participantesParaCategoria(e: Empresa, t: TipoServico, cat: string, busca: string): { nome: string; qtd: number; hoje: string }[] {
  const parts = participantesDasNotas(e, t);
  const q = nomeNorm(busca);
  return Object.keys(parts)
    .filter(k => { const c = catDoPart(e, t, parts[k].nome); return c !== cat && !catFixa(t, parts[k].nome) && (!q || k.indexOf(q) > -1); })
    .sort().slice(0, 50)
    .map(k => ({ nome: parts[k].nome, qtd: parts[k].qtd, hoje: catServ(t, catDoPart(e, t, parts[k].nome)).nome }));
}

/** O que foi digitado já é um participante das notas? (senão, oferece "Adicionar …") */
export function ehParticipanteConhecido(e: Empresa, t: TipoServico, busca: string): boolean {
  return !!participantesDasNotas(e, t)[nomeNorm(busca)];
}

export { SV };
