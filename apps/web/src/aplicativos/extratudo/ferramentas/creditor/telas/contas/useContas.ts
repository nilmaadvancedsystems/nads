// ViewModel da etapa Contas do Creditor (Vitor, 14/10/2026: "se faltar alguma conta, coloque isso para o usuário cadastrar em
// uma tela anterior"): os títulos sem conta (o cliente não está no balancete), um cliente por linha. Escolheu a conta, vale
// para todos os títulos dele (e fica aprendida quando o arquivo é baixado); dá para excluir os títulos do cliente do arquivo.
import { creditor as cr } from '@nads/core';
import { useSessao } from '../../casca/sessao';

export function useContas() {
  const s = useSessao();
  const porId = new Map(s.d.titulos.map(t => [t.id, t]));
  const grupos = new Map<string, { nome: string; titulos: cr.Titulo[]; cruzamentos: cr.Cruzamento[] }>();
  for (const c of s.d.semConta) {
    const t = porId.get(c.tituloId);
    if (!t) continue;
    const k = t.sacado.trim().toUpperCase();
    const g = grupos.get(k) || { nome: t.sacado.trim(), titulos: [], cruzamentos: [] };
    g.titulos.push(t);
    g.cruzamentos.push(c);
    grupos.set(k, g);
  }
  const decidir = (ids: number[], f: (atual: cr.Decisao | undefined) => cr.Decisao | null, guardar = false) => {
    const decisoes = { ...s.estado.decisoes };
    for (const id of ids) {
      const d = f(decisoes[id]);
      if (d) decisoes[id] = d; else delete decisoes[id];
    }
    s.mudar(e => ({ ...e, decisoes }));
    // a conta informada fica guardada na hora (aprendida para os próximos meses)
    if (guardar) s.aprenderJa(ids, decisoes);
  };

  const linhas = [...grupos.entries()].map(([k, g]) => {
    const ids = g.titulos.map(t => t.id);
    const ds = ids.map(id => s.d.decisoes[id]);
    const excluido = ds.every(d => d?.tipo === 'excluir');
    // a conta: a escolhida aqui ou a aprendida antes (guardada)
    const contas = [...new Set(ds.map((d, n) => (d?.tipo === 'manual' ? d.contrapartida : g.cruzamentos[n].linha?.contrapartida || '')))];
    const aprendida = !ds.some(d => d) && g.cruzamentos.every(c => c.aprendida);
    return {
      chave: k, nome: g.nome,
      nfs: g.titulos.map(t => t.nf).join(', '),
      qtd: g.titulos.length,
      valor: cr.reais(cr.somar(g.cruzamentos.map(c => c.valorBanco))),
      /** a conta escolhida (a mesma em todos os títulos dele) */
      conta: contas.length === 1 ? contas[0] : '',
      excluido, aprendida,
      resolvido: g.cruzamentos.every(c => c.situacao !== 'nao-encontrada' || cr.decisaoValida(c, s.d.decisoes[c.tituloId])),
      /** filiais de nome igual no balancete: as contas para escolher com um clique */
      opcoes: [...new Map(g.cruzamentos.flatMap(c => c.opcoes || []).map(o => [o.codigo, o])).values()],
      escolher: (codigo: string) => decidir(ids, atual => ({ tipo: 'manual', contrapartida: codigo.trim(), historico: atual?.tipo === 'manual' ? atual.historico : '' }), true),
      excluir: () => decidir(ids, () => ({ tipo: 'excluir' })),
      desfazer: () => decidir(ids, () => null),
    };
  }).sort((a, b) => Number(a.resolvido) - Number(b.resolvido) || a.nome.localeCompare(b.nome, 'pt-BR'));

  return {
    linhas,
    faltam: linhas.filter(l => !l.resolvido).length,
    guardadas: linhas.filter(l => l.aprendida).length,
    /** as contas de clientes do balancete, para o menu de conta */
    contasClientes: s.contas.clientes,
    semBalancete: s.contas.carregada && s.contas.balancete.origem === 'nenhum',
  };
}
