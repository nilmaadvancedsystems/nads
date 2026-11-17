// A busca geral da Área do Cliente (13/11/2026: "busca geral"): uma busca no topo que acha a tela, a guia, o documento,
// a solicitação ou o funcionário, de qualquer aba (Ctrl+K no computador). Aqui só a regra: o índice do que a área tem e
// a procura (sem acento, sem maiúscula, todas as palavras), em grupos e com um limite por grupo. A tela só desenha.
import type { NomeIcone } from '@nads/ui';

export type GrupoDaBusca = 'Telas' | 'Guias' | 'Documentos' | 'Solicitações' | 'Funcionários';

export interface ItemDaBusca {
  /** único no índice */
  chave: string;
  grupo: GrupoDaBusca;
  titulo: string;
  detalhe: string;
  icone: NomeIcone;
  /** a aba que abre */
  ir: string;
  /** o que a aba recebe ao abrir: a busca já preenchida ou a solicitação escolhida */
  pedido?: { busca?: string; chamado?: string };
}

const ORDEM: GrupoDaBusca[] = ['Telas', 'Guias', 'Documentos', 'Solicitações', 'Funcionários'];

/** sem acento e em minúsculas */
export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** O índice: o que a área tem, cada coisa com a aba que abre. */
export function indiceDaBusca(e: {
  abas: readonly { id: string; rotulo: string; icone: NomeIcone }[];
  guias: readonly { id: string; nome: string; competencia: string; vencimento: string; situacao: string }[];
  documentos: readonly { chave: string; nome: string; detalhe: string; pasta: string }[];
  chamados: readonly { id: string; titulo: string; situacao: string }[];
  funcionarios: readonly { id: string; nome: string; ativo: boolean }[];
}): ItemDaBusca[] {
  const mes = (c: string) => (c.length >= 7 ? c.slice(5, 7) + '/' + c.slice(0, 4) : c);
  return [
    ...e.abas.map(a => ({ chave: 'aba-' + a.id, grupo: 'Telas' as const, titulo: a.rotulo, detalhe: 'Abrir a tela', icone: a.icone, ir: a.id })),
    ...e.guias.map(g => ({ chave: 'guia-' + g.id, grupo: 'Guias' as const, titulo: g.nome, detalhe: 'competência ' + mes(g.competencia) + ' · vence ' + g.vencimento.slice(0, 5) + ' · ' + g.situacao, icone: 'recibo' as const, ir: 'guias' })),
    ...e.documentos.map(d => ({ chave: 'doc-' + d.chave, grupo: 'Documentos' as const, titulo: d.nome, detalhe: [d.pasta, d.detalhe].filter(Boolean).join(' · '), icone: 'arquivo' as const, ir: 'documentos', pedido: { busca: d.nome } })),
    ...e.chamados.map(c => ({ chave: 'ch-' + c.id, grupo: 'Solicitações' as const, titulo: c.titulo, detalhe: c.situacao, icone: 'mensagem' as const, ir: 'chamados', pedido: { chamado: c.id } })),
    ...e.funcionarios.map(f => ({ chave: 'f-' + f.id, grupo: 'Funcionários' as const, titulo: f.nome, detalhe: f.ativo ? 'no registro' : 'saiu do registro', icone: 'usuario' as const, ir: 'dp', pedido: { busca: f.nome } })),
  ];
}

/**
 * A procura: todas as palavras do termo no título ou no detalhe (sem acento); o título que começa com o termo vem
 * primeiro. Os grupos na ordem fixa, cada um com até `porGrupo`. Termo vazio: só as telas.
 */
export function buscarNaArea(indice: readonly ItemDaBusca[], termo: string, porGrupo = 5): { grupo: GrupoDaBusca; itens: ItemDaBusca[] }[] {
  const t = normalizar(termo);
  const palavras = t.split(/\s+/).filter(Boolean);
  const achados = palavras.length
    ? indice.filter(i => { const texto = normalizar(i.titulo + ' ' + i.detalhe); return palavras.every(p => texto.includes(p)); })
    : indice.filter(i => i.grupo === 'Telas');
  const peso = (i: ItemDaBusca) => (palavras.length && normalizar(i.titulo).startsWith(t) ? 0 : 1);
  return ORDEM.map(grupo => ({
    grupo,
    itens: achados.filter(i => i.grupo === grupo).map((i, k) => ({ i, k })).sort((a, b) => peso(a.i) - peso(b.i) || a.k - b.k).map(x => x.i).slice(0, porGrupo),
  })).filter(g => g.itens.length > 0);
}
