// ViewModel de Importação › Lançamentos: o que foi lido de cada lado (extrato ou sistema), com busca.
import { formatos, extrator as x } from '@nads/core';
import { useSessao } from '../../casca/sessao';

export const LIMITE_LINHAS = 1000;

export function useLancamentos() {
  const s = useSessao();
  const { lado, busca } = s.lancamentos;
  const nomes: Record<string, string> = {};
  for (const a of s.empresa.arquivos) nomes[a.id] = a.nome;
  const todos = x.lancamentosDe(s.empresa, lado).sort((a, b) => a.data.localeCompare(b.data));
  const q = formatos.normalizarTexto(busca);
  const achados = q ? todos.filter(l => formatos.normalizarTexto(l.historico + ' ' + x.valorBR(l.valor) + ' ' + x.dataBR(l.data)).includes(q)) : todos;
  const t = x.totais(achados);
  const qtd = { banco: x.lancamentosDe(s.empresa, 'banco').length, sistema: x.lancamentosDe(s.empresa, 'sistema').length };

  return {
    lado,
    abas: [
      { valor: 'banco' as x.Lado, rotulo: 'Extrato (' + qtd.banco + ')' },
      { valor: 'sistema' as x.Lado, rotulo: 'Sistema (' + qtd.sistema + ')' },
    ],
    escolherLado: (v: x.Lado) => s.setLancamentos(c => ({ ...c, lado: v })),
    busca, setBusca: (v: string) => s.setLancamentos(c => ({ ...c, busca: v })),
    vazio: !todos.length,
    qtd: achados.length, qtdTotal: todos.length, entradas: t.entradas, saidas: t.saidas,
    linhas: achados.slice(0, LIMITE_LINHAS).map(l => ({ id: l.id, data: x.dataBR(l.data), historico: l.historico, valor: l.valor, arquivo: nomes[l.idArquivo] || '' })),
    cortado: achados.length > LIMITE_LINHAS,
    importar: () => s.irPara('importacao/arquivos'),
  };
}
