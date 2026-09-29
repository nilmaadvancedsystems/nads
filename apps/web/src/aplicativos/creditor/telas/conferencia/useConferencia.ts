// ViewModel da etapa Conferência: cada grupo do relatório contra o total impresso, com os títulos
// editáveis (corrigir o dígito lido errado, digitar o que veio de foto) e o total geral.
// Só libera o Sistema quando todos os grupos batem centavo a centavo.
import { creditor as cr } from '@nads/core';
import { proximoIdTitulo, useSessao } from '../../casca/sessao';

export type CampoTexto = 'sacado' | 'nossoNumero' | 'nf' | 'liquidacao';
export type CampoValor = 'valor' | 'mora' | 'desconto' | 'outros' | 'cobrado';

export function useConferencia() {
  const s = useSessao();
  const r = s.estado.relatorio as cr.RelatorioBanco;

  const mudarRel = (f: (r: cr.RelatorioBanco) => cr.RelatorioBanco) => s.mudar(e => (e.relatorio ? { ...e, relatorio: f(e.relatorio) } : e));
  const mudarGrupo = (gid: number, f: (g: cr.Grupo) => cr.Grupo) => mudarRel(x => ({ ...x, grupos: x.grupos.map(g => (g.id === gid ? f(g) : g)) }));
  const mudarTitulo = (gid: number, tid: number, f: (t: cr.Titulo) => cr.Titulo) => mudarGrupo(gid, g => ({ ...g, titulos: g.titulos.map(t => (t.id === tid ? f(t) : t)) }));

  function editarTexto(gid: number, tid: number, campo: CampoTexto, v: string) {
    const valor = campo === 'liquidacao' ? cr.dataBR(v) : v.trim();
    mudarTitulo(gid, tid, t => ({ ...t, [campo]: valor, aviso: undefined }));
  }

  function editarValor(gid: number, tid: number, campo: CampoValor, v: string) {
    const n = cr.dinheiro(v);
    mudarTitulo(gid, tid, t => ({ ...t, [campo]: campo === 'cobrado' ? n : n ?? 0, aviso: undefined }));
  }

  function adicionarTitulo(gid: number) {
    mudarRel(x => {
      const id = proximoIdTitulo(x);
      return {
        ...x, grupos: x.grupos.map(g => (g.id !== gid ? g : {
          ...g, titulos: [...g.titulos, { id, sacado: '', nossoNumero: '', nf: '', valor: 0, mora: 0, desconto: 0, outros: 0, liquidacao: g.titulos[0]?.liquidacao || '', cobrado: null }],
        })),
      };
    });
  }

  const grupos = r.grupos.map(g => {
    const c = cr.conferirGrupo(g);
    return {
      id: g.id,
      rotulo: (g.rotulo || 'Grupo ' + g.id) + (c.datas.length ? ' · ' + (c.datas.length > 3 ? c.datas[0] + ' a ' + c.datas[c.datas.length - 1] : c.datas.map(d => d || 'sem data').join(', ')) : ''),
      registros: c.registros,
      situacao: c.situacao,
      titulos: g.titulos.map(t => ({ ...t, incoerente: c.incoerentes.includes(t.id) })),
      colunas: c.colunas,
    };
  });
  const geral = cr.conferirTotalGeral(r);
  const temTotalGeral = Object.values(r.totalGeral).some(v => v != null);
  const problemas = grupos.filter(g => g.situacao !== 'ok' && g.titulos.length);

  return {
    grupos,
    rotuloColuna: cr.ROTULO_COLUNA,
    editarTexto, editarValor, adicionarTitulo,
    removerTitulo: (gid: number, tid: number) => mudarGrupo(gid, g => ({ ...g, titulos: g.titulos.filter(t => t.id !== tid) })),
    editarImpresso: (gid: number, c: CampoValor, v: string) => mudarGrupo(gid, g => ({ ...g, impresso: { ...g.impresso, [c]: cr.dinheiro(v) } })),
    novoGrupo: () => mudarRel(x => {
      const id = x.grupos.reduce((m, g) => Math.max(m, g.id), 0) + 1;
      const t: cr.Titulo = { id: proximoIdTitulo(x), sacado: '', nossoNumero: '', nf: '', valor: 0, mora: 0, desconto: 0, outros: 0, liquidacao: '', cobrado: null };
      return { ...x, grupos: [...x.grupos, { id, titulos: [t], impresso: { ...cr.TOTAIS_VAZIOS } }] };
    }),
    removerGrupo: (gid: number) => mudarRel(x => ({ ...x, grupos: x.grupos.filter(g => g.id !== gid) })),
    geral: { colunas: geral.colunas, registros: geral.registros, ok: geral.ok, tem: temTotalGeral || r.registrosGeral != null },
    editarTotalGeral: (c: CampoValor, v: string) => mudarRel(x => ({ ...x, totalGeral: { ...x.totalGeral, [c]: cr.dinheiro(v) } })),
    problemas: problemas.map(g => g.rotulo + (g.situacao === 'sem-total' ? ': falta o total impresso' : g.registros.impresso != null && g.registros.impresso !== g.registros.lidos ? ': ' + g.registros.impresso + ' registros impressos, ' + g.registros.lidos + ' lidos' : ': não bate')),
    geralDiverge: !geral.ok,
    podeContinuar: s.d.conferido,
    continuar: s.proxima,
    voltar: s.anterior,
  };
}
