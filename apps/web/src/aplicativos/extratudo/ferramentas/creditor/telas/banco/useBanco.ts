// ViewModel da etapa Relatório do banco: mostra o que veio do Drive (etapa Competência) ou lê o arquivo
// anexado aqui (PDF no navegador, com o pdf.js, ou planilha); ou carrega o exemplo. Avisa os títulos
// liquidados fora da competência.
import { creditor as cr } from '@nads/core';
import { useState } from 'react';
import { useSessao } from '../../casca/sessao';
import { lerRelatorio, mensagemDeErro } from '../../leitura';

export function useBanco() {
  const s = useSessao();
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
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

  async function escolherArquivo(f: File | null) {
    setArquivo(f);
    if (!f) return;
    setLendo(true);
    setErro('');
    try {
      usar(await lerRelatorio(f.name, await f.arrayBuffer()), f.name);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setArquivo(null);
    } finally {
      setLendo(false);
    }
  }

  const titulos = r ? r.grupos.flatMap(g => g.titulos) : [];
  const foraDoMes = cr.titulosForaDaCompetencia(titulos, s.estado.competencia);
  return {
    competencia: cr.competenciaPorExtenso(s.estado.competencia),
    aceitar: cr.EXTENSOES_BANCO.join(','),
    lendo, erro, fecharErro: () => setErro(''),
    arquivo, escolherArquivo,
    exemplo: () => usar(cr.lerRelatorioTexto(cr.EXEMPLO_RELATORIO), 'exemplo'),
    lido: r ? {
      origem: s.estado.origemBanco,
      titulos: titulos.length,
      grupos: r.grupos.length,
      dias: new Set(titulos.map(t => t.liquidacao)).size,
      ignorados: r.ignorados,
      valor: cr.somar(titulos.map(t => t.valor)),
      avisos: [
        ...r.avisos,
        ...(foraDoMes.length ? [foraDoMes.length + ' título(s) liquidado(s) fora de ' + cr.rotuloCompetencia(s.estado.competencia) + ' (ex.: NF ' + foraDoMes[0].nf + ' em ' + foraDoMes[0].liquidacao + '). Confira se é o relatório certo.'] : []),
      ],
    } : null,
    podeContinuar: titulos.length > 0,
    rotuloContinuar: 'Continuar para ' + (s.estado.conferir ? 'a conferência' : 'o fiscal'),
    continuar: s.proxima,
    voltar: s.anterior,
  };
}
