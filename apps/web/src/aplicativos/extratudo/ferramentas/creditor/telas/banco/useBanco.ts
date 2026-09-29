// ViewModel da etapa Relatório do banco: lê o PDF (no navegador, com o pdf.js) ou a planilha; ou
// carrega o exemplo.
import { creditor as cr } from '@nads/core';
import workerPdf from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { useState } from 'react';
import { useSessao } from '../../casca/sessao';

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
    s.mudar(e => ({ ...e, relatorio: rel, origemBanco: origem, decisoes: {}, passosFiscal: [], conferir: cr.temTotalImpresso(rel), alcancada: 0 }));
  }

  async function escolherArquivo(f: File | null) {
    setArquivo(f);
    if (!f) return;
    setLendo(true);
    setErro('');
    try {
      const buf = await f.arrayBuffer();
      const nome = f.name.toLowerCase();
      if (nome.endsWith('.pdf')) usar(await cr.lerRelatorioPdf(buf, workerPdf), f.name);
      else if (nome.endsWith('.txt')) usar(cr.lerRelatorioTexto(new TextDecoder().decode(buf)), f.name);
      else usar(cr.lerRelatorioPlanilha(buf, f.name), f.name);
    } catch (e) {
      setErro(mensagemDeErro(e));
      setArquivo(null);
    } finally {
      setLendo(false);
    }
  }

  const titulos = r ? r.grupos.flatMap(g => g.titulos) : [];
  return {
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
      avisos: r.avisos,
    } : null,
    podeContinuar: titulos.length > 0,
    rotuloContinuar: 'Continuar para ' + (s.estado.conferir ? 'a conferência' : 'o fiscal'),
    continuar: s.proxima,
  };
}

/** A mensagem para a tela. Página aberta antes de uma atualização não acha mais o leitor de PDF antigo. */
function mensagemDeErro(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e || '');
  if (/dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically/i.test(m)) {
    return 'O Creditor foi atualizado enquanto a página estava aberta. Recarregue a página (F5) e escolha o arquivo de novo.';
  }
  return m || 'Não foi possível ler o arquivo.';
}
