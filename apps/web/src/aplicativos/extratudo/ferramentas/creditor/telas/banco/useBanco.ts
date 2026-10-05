// ViewModel da etapa Relatório do banco, no visual da Importação (Vitor, 05/10/2026): a linha do relatório com o que
// foi lido (títulos, dias, valor), o check (ou o logo do Drive) que exclui, a seta que abre os títulos, e o importar
// (do computador ou o exemplo) quando ainda não tem. Avisa os títulos liquidados fora da competência.
import { creditor as cr } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { indiceDaEtapa } from '../../casca/navegacao';
import { useSessao } from '../../casca/sessao';
import { lerRelatorio, mensagemDeErro } from '../../leitura';

export function useBanco() {
  const s = useSessao();
  const { modal, aviso } = useRetorno();
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const r = s.estado.relatorio;

  /**
   * Relatório novo: descarta as decisões do cruzamento (os títulos mudaram) e volta a travar as etapas
   * seguintes. Sem nenhum total impresso, a Conferência sai do fluxo (decidido aqui, na leitura, para a
   * etapa não sumir enquanto a pessoa edita).
   */
  function usar(rel: cr.RelatorioBanco, origem: string) {
    setErro('');
    s.usarRelatorio(rel, origem);
  }

  async function importar(f: File | undefined) {
    if (!f) return;
    setLendo(true);
    setErro('');
    try { usar(await lerRelatorio(f.name, await f.arrayBuffer()), f.name); }
    catch (e) { setErro(mensagemDeErro(e)); }
    finally { setLendo(false); }
  }

  /** O check da linha (como na Importação): exclui o relatório lido (pergunta antes); as decisões vão junto. */
  async function excluir() {
    const ok = await modal<boolean>({
      icone: 'alert', titulo: 'Excluir a importação?',
      botoes: [{ rotulo: 'Excluir', valor: true, variante: 'btn-danger' }, { rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }],
    });
    if (!ok) return;
    s.mudar(e => ({ ...e, relatorio: null, porMes: {}, origemBanco: '', decisoes: {}, passosFiscal: [], alcancada: Math.min(e.alcancada, indiceDaEtapa('banco')) }));
    aviso({ tom: 'ok', titulo: 'Importação excluída', texto: 'Relatório de liquidação' });
  }

  const titulos = r ? r.grupos.flatMap(g => g.titulos) : [];
  const foraDoMes = cr.titulosForaDaCompetencia(titulos, s.estado.competencia);
  const dias = new Set(titulos.map(t => t.liquidacao)).size;
  const origem = s.estado.origemBanco;
  return {
    competencia: cr.rotuloCompetencia(s.estado.competencia),
    aceitar: cr.EXTENSOES_BANCO.join(','),
    lendo, erro, fecharErro: () => setErro(''),
    importar: (f: File | undefined) => { void importar(f); },
    exemplo: () => usar(cr.lerRelatorioTexto(cr.EXEMPLO_RELATORIO), 'exemplo'),
    excluir: () => { void excluir(); },
    lido: r ? {
      // a origem e as baixas por pedido do cedente (não são dinheiro recebido) no check, não num aviso (Vitor: "muito poluído")
      origem: origem + (r.ignorados > 0 ? ' · ' + r.ignorados + (r.ignorados === 1 ? ' baixa' : ' baixas') + ' por pedido do cedente de fora' : ''),
      doDrive: origem.startsWith('Drive'),
      qtd: titulos.length,
      /** no meio da linha, como o "Extrato: 12 lançamentos" da Importação */
      resumo: [titulos.length + (titulos.length === 1 ? ' título' : ' títulos'), dias + (dias === 1 ? ' dia' : ' dias') + ' de liquidação', cr.brl(cr.somar(titulos.map(t => t.valor)))],
      titulos: titulos.map(t => ({ id: t.id, liquidacao: t.liquidacao, sacado: t.sacado, nf: t.nf, valor: t.valor, juros: t.mora + t.outros, desconto: t.desconto, cobrado: t.cobrado })),
      avisos: [
        ...r.avisos,
        ...(foraDoMes.length ? [foraDoMes.length + ' título(s) liquidado(s) fora de ' + cr.rotuloCompetencia(s.estado.competencia) + ' (ex.: NF ' + foraDoMes[0].nf + ' em ' + foraDoMes[0].liquidacao + '). Confira se é o relatório certo.'] : []),
      ],
    } : null,
    podeContinuar: titulos.length > 0,
    continuar: s.proxima,
  };
}
