// A seção Documentos da Área do Cliente refeita (26/11/2026: "quero que esse modulo seja completamente refeito… o mais
// bonito e de facil entendimento possivel"): o que os clientes mandaram (Recebidos) e o que a equipe mandou ao cliente pela
// tela (Enviados). Funções puras, testadas em documentosDaArea.test.ts.
import { areaCliente as ac, type entregas as e } from '@nads/core';
import type { RecebidoDoCliente } from './areaCliente';

export type FiltroDosRecebidos = 'novos' | 'todos' | ac.TipoDeEnvio | 'recusados';

/** "novo" = chegou nos últimos 7 dias e não foi recusado */
const NOVO_MS = 7 * 24 * 36e5;

export function ehNovo(r: RecebidoDoCliente, agora: Date): boolean {
  const t = Date.parse(r.recebidoEm);
  return !r.recusa && Number.isFinite(t) && agora.getTime() - t <= NOVO_MS;
}

/** o rótulo curto do filtro (as pílulas do mesmo tamanho; 26/11/2026: "ta tudo um maior que o outro") */
const CURTO: Record<string, string> = { extrato: 'Extratos', nota: 'Notas', comprovante: 'Comprovantes', outro: 'Outros' };

/** Os filtros dos recebidos, na ordem da barra, com a contagem. */
export function filtrosDosRecebidos(lista: readonly RecebidoDoCliente[], agora: Date, recusados: ReadonlySet<string>): { valor: FiltroDosRecebidos; rotulo: string; conta: number }[] {
  const recusado = (r: RecebidoDoCliente) => !!r.recusa || recusados.has(r.id);
  return [
    { valor: 'novos', rotulo: 'Novos', conta: lista.filter(r => ehNovo(r, agora) && !recusados.has(r.id)).length },
    { valor: 'todos', rotulo: 'Todos', conta: lista.length },
    ...ac.TIPOS_DE_ENVIO.map(t => ({ valor: t.valor as FiltroDosRecebidos, rotulo: CURTO[t.valor] ?? t.rotulo, conta: lista.filter(r => r.tipo === t.valor).length })),
    { valor: 'recusados', rotulo: 'Recusados', conta: lista.filter(recusado).length },
  ];
}

/** Os recebidos do filtro, do mais novo ao mais velho. */
export function recebidosDoFiltro(lista: readonly RecebidoDoCliente[], filtro: FiltroDosRecebidos, agora: Date, recusados: ReadonlySet<string>): RecebidoDoCliente[] {
  const recusado = (r: RecebidoDoCliente) => !!r.recusa || recusados.has(r.id);
  return lista
    .filter(r => filtro === 'todos' ? true : filtro === 'novos' ? ehNovo(r, agora) && !recusados.has(r.id) : filtro === 'recusados' ? recusado(r) : r.tipo === filtro)
    .slice().sort((a, b) => b.recebidoEm.localeCompare(a.recebidoEm));
}

/** O filtro inicial: os novos quando há algum, senão todos. */
export const filtroInicial = (lista: readonly RecebidoDoCliente[], agora: Date): FiltroDosRecebidos => (lista.some(r => ehNovo(r, agora)) ? 'novos' : 'todos');

/** Um arquivo que a equipe mandou ao cliente pela tela (o envio com a marca da Área do Cliente). */
export interface EnviadoAoCliente {
  id: string;
  nome: string;
  codigo: string;
  area: ac.AreaDoEscritorio;
  criadoEm: string;
  situacao: 'fila' | 'pronto' | 'erro';
  erro: string;
}

/** Os meus envios que foram para a Área do Cliente, do mais novo ao mais velho. */
export function enviadosAoCliente(envios: readonly e.EnvioFeito[]): EnviadoAoCliente[] {
  const out: EnviadoAoCliente[] = [];
  for (const x of envios) {
    const c = x.cliente || '';
    if (!c.startsWith(ac.MARCA_DO_ENVIO_AO_CLIENTE)) continue;
    const area = ac.AREAS_DO_ESCRITORIO.find(a => a.valor === c.slice(ac.MARCA_DO_ENVIO_AO_CLIENTE.length))?.valor;
    if (!area) continue;
    out.push({ id: x.id, nome: x.nome, codigo: x.codigo || '', area, criadoEm: x.criadoEm, situacao: x.status === 'pronto' ? 'pronto' : x.status === 'erro' ? 'erro' : 'fila', erro: x.erro });
  }
  return out.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

/** O rótulo da área ("Departamento Pessoal"). */
export const rotuloDaArea = (a: ac.AreaDoEscritorio) => ac.AREAS_DO_ESCRITORIO.find(x => x.valor === a)?.rotulo ?? a;
