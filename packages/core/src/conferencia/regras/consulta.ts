// Consulta de notas (Movimento › Consulta): Fiscais (entradas + saídas) e Serviços
// (tomados + prestados), busca, período, ordenação e CSV.
// Origem: conferencia.html CONS_TIPOS/listaConsulta/filtrar/SORT_CAMPOS (~L2942-2975),
// renderConsulta (~L3018), CSV (~L3296).
import { brl, dataOrdem } from '../../formatos';
import type { Empresa, TipoMovimento } from '../tipos';
import { listaTipo } from './empresa';

export type GrupoConsulta = 'fiscais' | 'servicos';

export const CONS_TIPOS: readonly { tipo: TipoMovimento; rotulo: string; cor: string }[] = [
  { tipo: 'entradas', rotulo: 'Entrada', cor: 'var(--danger)' },
  { tipo: 'saidas', rotulo: 'Saída', cor: 'var(--success)' },
  { tipo: 'tomados', rotulo: 'Tomado', cor: 'var(--warn)' },
  { tipo: 'prestados', rotulo: 'Prestado', cor: 'var(--accent)' },
];

const GRUPOS: Record<GrupoConsulta, TipoMovimento[]> = { fiscais: ['entradas', 'saidas'], servicos: ['tomados', 'prestados'] };

/** Uma linha da Consulta (nota fiscal ou de serviço, com o tipo). */
export interface NotaConsulta {
  tipo: TipoMovimento;
  ordemTipo: number;
  data: string;
  numero: string;
  nome: string;
  cfop: string;
  lanc: string;
  valor: number;
  iss: number;
}

export function listaConsulta(e: Empresa, g: GrupoConsulta): NotaConsulta[] {
  const out: NotaConsulta[] = [];
  CONS_TIPOS.forEach((t, i) => {
    if (GRUPOS[g].indexOf(t.tipo) < 0) return;
    for (const n of listaTipo(e, t.tipo) as { data: string; numero: string; nome: string; lanc: string; valor: number; cfop?: string; iss?: number; issRet?: number }[]) {
      out.push({
        tipo: t.tipo, ordemTipo: i, data: n.data, numero: n.numero, nome: n.nome, cfop: n.cfop || '', lanc: n.lanc || '', valor: n.valor,
        iss: n.iss != null ? n.iss : n.issRet || 0,
      });
    }
  });
  return out;
}

export type CampoOrdem = 'tipo' | 'data' | 'numero' | 'nome' | 'cfop' | 'lanc' | 'valor' | 'iss';

export interface FiltroConsulta { de: string; ate: string; q: string; sortCol: CampoOrdem; sortDir: 'asc' | 'desc' }

export const FILTRO_CONSULTA_VAZIO: FiltroConsulta = { de: '', ate: '', q: '', sortCol: 'data', sortDir: 'asc' };

const CHAVES: Record<CampoOrdem, (n: NotaConsulta) => number | string> = {
  data: n => dataOrdem(n.data),
  numero: n => n.numero || '',
  nome: n => (n.nome || '').toLowerCase(),
  cfop: n => n.cfop || '',
  lanc: n => n.lanc || '',
  valor: n => n.valor,
  iss: n => n.iss,
  tipo: n => n.ordemTipo || 0,
};

export function filtrarConsulta(lista: NotaConsulta[], f: FiltroConsulta): NotaConsulta[] {
  const q = f.q.toLowerCase();
  const de = f.de && f.de.length === 10 ? dataOrdem(f.de) : 0;
  const ate = f.ate && f.ate.length === 10 ? dataOrdem(f.ate) : 0;
  const l = lista.filter(n => {
    const t = dataOrdem(n.data);
    return (!de || t >= de) && (!ate || t <= ate) &&
      (!q || n.nome.toLowerCase().indexOf(q) > -1 || n.numero.indexOf(q) > -1 || n.cfop.indexOf(q) > -1 || n.lanc.indexOf(q) > -1);
  });
  const chave = CHAVES[f.sortCol] || CHAVES.data;
  const dir = f.sortDir === 'desc' ? -1 : 1;
  return l.slice().sort((a, b) => { const va = chave(a), vb = chave(b); return va < vb ? -dir : va > vb ? dir : 0; });
}

/** Clicar no cabeçalho: mesma coluna inverte, outra começa crescente. */
export function alternarOrdem(f: FiltroConsulta, campo: CampoOrdem): FiltroConsulta {
  if (f.sortCol === campo) return { ...f, sortDir: f.sortDir === 'asc' ? 'desc' : 'asc' };
  return { ...f, sortCol: campo, sortDir: 'asc' };
}

/** Linhas do CSV (as mesmas colunas da tela; respeita o filtro). */
export function csvConsulta(l: NotaConsulta[], g: GrupoConsulta): string[] {
  const serv = g === 'servicos';
  const rot: Record<string, string> = {};
  CONS_TIPOS.forEach(t => { rot[t.tipo] = t.rotulo; });
  const L = [serv ? 'Tipo;Data;Nota;Participante;Valor de ISS;Lançamento;Valor' : 'Tipo;Data;Nota;Participante;CFOP;Lançamento;Valor'];
  for (const n of l) L.push((serv ? [rot[n.tipo], n.data, n.numero, n.nome, brl(n.iss), n.lanc, brl(n.valor)] : [rot[n.tipo], n.data, n.numero, n.nome, n.cfop || '', n.lanc, brl(n.valor)]).join(';'));
  return L;
}

/** Limite de linhas na tela (o resto, pelo CSV). */
export const LIMITE_LINHAS_CONSULTA = 400;
