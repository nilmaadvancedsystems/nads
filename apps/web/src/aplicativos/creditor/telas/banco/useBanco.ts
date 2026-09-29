// ViewModel da etapa Relatório do banco: lê o PDF (no navegador, com o pdf.js) ou a planilha; ou
// carrega o exemplo.
import { creditor as cr } from '@nads/core';
import workerPdf from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useState } from 'react';
import { useSessao } from '../../casca/sessao';

export function useBanco() {
  const s = useSessao();
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const r = s.estado.relatorio;

  /** Relatório novo: descarta as decisões do cruzamento (os títulos mudaram) e volta a travar as etapas seguintes. */
  function usar(rel: cr.RelatorioBanco, origem: string) {
    setErro('');
    s.mudar(e => ({ ...e, relatorio: rel, origemBanco: origem, decisoes: {}, alcancada: 0 }));
  }

  async function escolherArquivo(f: File | null) {
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
      setErro(e instanceof Error ? e.message : 'Não foi possível ler o arquivo.');
    } finally {
      setLendo(false);
    }
  }

  const titulos = r ? r.grupos.flatMap(g => g.titulos) : [];
  return {
    aceitar: cr.EXTENSOES_BANCO.join(','),
    lendo, erro, fecharErro: () => setErro(''),
    escolherArquivo,
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
    continuar: s.proxima,
  };
}
