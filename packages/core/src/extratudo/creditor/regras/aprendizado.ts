// O Creditor aprende a conta (contrapartida) de cada cliente já conciliado na empresa.
// Pedido do Vitor (2026-09-29): cliente conciliado uma vez fica salvo; quando a NF dele não está no
// arquivo do sistema, a conta aprendida já resolve o título (dá para trocar). O que vem do arquivo do
// sistema sempre vale e atualiza o que foi aprendido. Aprende quando o arquivo é baixado.
import { nomeNorm } from '../../../formatos';
import type { Titulo } from '../tipos';
import { decisaoValida, type Cruzamento, type Decisao } from './cruzamento';

/** O que ficou aprendido de um cliente (a chave é o nome do sacado, normalizado). */
export interface ClienteAprendido {
  /** a contrapartida (conta do cliente) */
  conta: string;
  /** o nome como veio do banco, para mostrar */
  nome: string;
  /** quando foi aprendido (ISO) */
  em: string;
}

export type ClientesAprendidos = Record<string, ClienteAprendido>;

export const chaveDoCliente = (sacado: string) => nomeNorm(sacado);

/**
 * A conta aprendida do sacado: o mesmo nome; senão, um nome que contém o outro (o banco às vezes corta
 * o nome), mas só quando isso aponta para um cliente só.
 */
export function contaAprendida(aprendidos: ClientesAprendidos, sacado: string): ClienteAprendido | null {
  const k = chaveDoCliente(sacado);
  if (!k) return null;
  if (aprendidos[k]) return aprendidos[k];
  const parecidos = Object.keys(aprendidos).filter(x => x.length >= 6 && k.length >= 6 && (x.includes(k) || k.includes(x)));
  const contas = new Set(parecidos.map(x => aprendidos[x].conta));
  return parecidos.length && contas.size === 1 ? aprendidos[parecidos[0]] : null;
}

/**
 * As decisões que a conta aprendida resolve sozinha: NF não encontrada no sistema, sem decisão da
 * pessoa, com o cliente já aprendido. A decisão da pessoa sempre vence (é juntada por cima).
 */
export function decisoesAprendidas(titulos: Titulo[], cruzamentos: Cruzamento[], aprendidos: ClientesAprendidos, daPessoa: Record<number, Decisao>): Record<number, Decisao> {
  const porId = new Map(titulos.map(t => [t.id, t]));
  const saida: Record<number, Decisao> = {};
  for (const c of cruzamentos) {
    if (c.situacao !== 'nao-encontrada' || daPessoa[c.tituloId]) continue;
    const t = porId.get(c.tituloId);
    const a = t && contaAprendida(aprendidos, t.sacado);
    if (a) saida[c.tituloId] = { tipo: 'manual', contrapartida: a.conta, historico: '' };
  }
  return saida;
}

/**
 * O que a conciliação ensina: a contrapartida de cada título que entrou no arquivo (a do sistema, a
 * confirmada ou a informada). Excluído não ensina nada. O novo substitui o antigo do mesmo cliente.
 */
export function aprender(atuais: ClientesAprendidos, titulos: Titulo[], cruzamentos: Cruzamento[], decisoes: Record<number, Decisao>, agora: Date): ClientesAprendidos {
  const porId = new Map(titulos.map(t => [t.id, t]));
  const novo: ClientesAprendidos = { ...atuais };
  for (const c of cruzamentos) {
    const t = porId.get(c.tituloId);
    const k = t && chaveDoCliente(t.sacado);
    if (!t || !k) continue;
    const d = decisoes[c.tituloId];
    let conta = '';
    if (d?.tipo === 'excluir') continue;
    if (d?.tipo === 'manual' && decisaoValida(c, d)) conta = d.contrapartida.trim();
    else if (c.linha && (c.situacao === 'ok' || c.situacao === 'dividido' || (d?.tipo === 'confirmar' && decisaoValida(c, d)))) conta = c.linha.contrapartida.trim();
    if (conta) novo[k] = { conta, nome: t.sacado.trim(), em: agora.toISOString() };
  }
  return novo;
}

/** Os aprendidos guardados, conferidos (entrada estranha fica de fora). */
export function clientesDoDocumento(doc: Record<string, unknown> | null | undefined): ClientesAprendidos {
  const bruto = (doc?.clientes || {}) as Record<string, Record<string, unknown>>;
  const saida: ClientesAprendidos = {};
  for (const [k, v] of Object.entries(bruto)) {
    const conta = v && v.conta != null ? String(v.conta).trim() : '';
    if (k && conta) saida[k] = { conta, nome: String(v.nome || k), em: String(v.em || '') };
  }
  return saida;
}

/** Mudou alguma conta aprendida? (para não gravar à toa) */
export function mesmosClientes(a: ClientesAprendidos, b: ClientesAprendidos): boolean {
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every(k => b[k] && b[k].conta === a[k].conta && b[k].nome === a[k].nome);
}
