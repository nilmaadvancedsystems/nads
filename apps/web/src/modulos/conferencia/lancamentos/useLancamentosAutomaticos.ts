// ViewModel dos Lançamentos automáticos (de-para lançamento → conta; página fora do menu).
// Origem: conferencia.html #view-depara (~L1176-1190), opcoesContaAnalitica (~L2686),
// renderDP (~L2711), change/remover (~L2743-2761), btAutoLanc (~L2762-2786).
import { conferencia as c } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useSessao } from '../sessao';

export interface GrupoDeContas { grupo: c.Grupo; contas: { codigo: string; nome: string }[] }

export function useLancamentosAutomaticos() {
  const s = useSessao();
  const { toast, modal } = useRetorno();
  const e = s.empresa;
  const temContas = e.contas.length > 0;
  const linhas = c.linhasDp(e);
  const analiticas = e.contas.filter(a => !a.sintetica);

  // <select> com as contas analíticas por grupo (optgroup), em ordem de nome
  const porGrupo: Partial<Record<c.Grupo, c.Conta[]>> = {};
  for (const a of analiticas) { const g = a.grupo || 'Outros'; (porGrupo[g] = porGrupo[g] || []).push(a); }
  const grupos: GrupoDeContas[] = c.GRUPOS_ORDEM.filter(g => porGrupo[g]?.length).map(g => ({
    grupo: g,
    contas: (porGrupo[g] as c.Conta[]).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(a => ({ codigo: a.codigo, nome: a.nome })),
  }));
  const foraDoPlano = (codigo: string) => !!codigo && !analiticas.some(a => a.codigo === codigo);

  const montar = (l: c.LinhaDp) => ({ lanc: l.lanc, cfops: l.cfops.join(', ') || '—', natureza: l.natureza, conta: l.conta, foraDoPlano: foraDoPlano(l.conta) });
  const pendentes = linhas.filter(l => !l.conta).map(montar);
  const vinculadas = linhas.filter(l => l.conta).map(montar);

  function escolherConta(lanc: string, codigo: string) {
    s.aplicar(x => c.gravarDp(x, lanc, codigo));
  }

  function remover(lanc: string) {
    s.aplicar(x => c.gravarDp(x, lanc, ''));
  }

  function preencherAutomatico() {
    if (!e.contas.length) {
      void modal({
        icone: 'alert', titulo: 'Falta importar o plano de contas',
        html: 'Para preencher automaticamente, a ferramenta precisa comparar a natureza de cada lançamento com as contas do balancete desta empresa. Vá em <b>Plano de contas</b> e leia um balancete primeiro.',
        botoes: [{ rotulo: 'Entendi', valor: true, variante: 'btn-primary' }],
      });
      return;
    }
    if (!pendentes.length) { toast('Não há lançamento pendente pra preencher.'); return; }
    const sugestoes = c.sugerirLancamentos(e);
    s.aplicar(x => c.aplicarSugestoesDp(x, sugestoes));
    toast(sugestoes.length
      ? sugestoes.length + ' lançamento(s) vinculado(s) automaticamente. Confira se ficou certo — o resto precisa ser feito à mão.'
      : 'Não achei nenhuma conta parecida com os lançamentos pendentes. Preencha à mão.');
  }

  return {
    classeBotao: temContas ? 'btn btn-primary' : 'btn btn-outline',
    preencherAutomatico,
    semLinhas: !linhas.length,
    pendentes, vinculadas, grupos,
    escolherConta, remover,
  };
}
