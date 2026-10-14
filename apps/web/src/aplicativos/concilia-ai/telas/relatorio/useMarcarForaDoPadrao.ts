// As ações do "Lançamento fora do padrão": marcar a nota ou o grupo como corrigido e o "Colocar em …" do serviço.
// Ficam aqui porque o quadro aparece no Relatório e no Verificar por conta (Vitor, 14/10/2026).
// Origem: conferencia.html os change de data-resolve (~L3232-3268), data-resolve-serv (~L4730-4752) e
// data-serv-sug → servIrParaForm (~L4539, ~L4590).
import { conferencia as c, formatos } from '@nads/core';
import { useNavigate } from 'react-router';
import { caminho } from '../../casca/caminho';
import { useSessao } from '../../casca/sessao';

const { lancN } = formatos;

export function useMarcarForaDoPadrao() {
  const s = useSessao();
  const navegar = useNavigate();
  const e = s.empresa;

  function marcarNotaCorrigida(t: c.TipoNotaFiscal, d: c.Divergencia, marcado: boolean) {
    const key = c.chaveResolvido(t, d.chave);
    const n = d.nota;
    s.aplicar(x => c.marcarCorrigido(x, [key], marcado, 'div|' + key, 'Nota ' + n.numero + ' · ' + n.nome + ' · CFOP ' + n.cfop + ' · lanç. ' + n.lanc, new Date()));
  }
  function marcarGrupoCorrigido(t: c.TipoNotaFiscal, gr: c.GrupoForaDoPadrao, marcado: boolean) {
    const q = gr.itens.length;
    s.aplicar(x => c.marcarCorrigido(x, gr.chavesDaNatureza, marcado, 'divg|' + t + '|' + gr.key, gr.titulo + ' (' + q + ' nota' + (q > 1 ? 's' : '') + ')', new Date()));
  }
  function marcarServCorrigido(t: c.TipoServico, it: c.NotaForaDoPadraoServ, marcado: boolean) {
    const n = it.nota;
    const l = lancN(n.lanc);
    const texto = c.SV[t].rotulo + ' · nota ' + n.numero + ' · ' + n.nome + ' · lanç. ' + (l || '—') + ' (esperado ' + it.esperado.lanc + ' — ' + it.esperado.nome + ')';
    s.aplicar(x => c.marcarCorrigido(x, ['serv:' + it.chave], marcado, 'servdiv|' + it.chave, texto, new Date()));
  }
  function marcarServGrupoCorrigido(t: c.TipoServico, gr: c.GrupoForaDoPadraoServ, marcado: boolean) {
    const q = gr.itens.length;
    const texto = c.SV[t].rotulo + ' · ' + gr.nome + ' (' + q + ' nota' + (q > 1 ? 's' : '') + ')';
    s.aplicar(x => c.marcarCorrigido(x, gr.itens.map(it => 'serv:' + it.chave), marcado, 'servdivg|' + t + '|' + gr.key, texto, new Date()));
  }
  /** "Colocar em X": abre o Cadastro já com o formulário da categoria e o participante. */
  function colocarNaCategoria(t: c.TipoServico, catId: string, nome: string) {
    s.setAbaCadastro(t);
    if (!c.importacoesOk(e)) { s.irPara('cadastro/configuracoes'); return; }
    navegar(caminho(s.rota + '/cadastro/configuracoes') + '?servAdd=' + encodeURIComponent(t + '|' + catId + '|' + nome));
  }

  return { marcarNotaCorrigida, marcarGrupoCorrigido, marcarServCorrigido, marcarServGrupoCorrigido, colocarNaCategoria };
}

export type AcoesForaDoPadrao = ReturnType<typeof useMarcarForaDoPadrao>;

/** "527 é de Telefone —" (a dica antes dos botões "Colocar em …") */
export function dicaSugestao(gr: c.GrupoForaDoPadraoServ): string {
  return gr.sugerirCategorias.map(x => x.lanc).filter((v, i, l) => l.indexOf(v) === i).join(', ') + ' é de ' + gr.sugerirCategorias.map(x => x.nome).join(' / ') + ' —';
}
