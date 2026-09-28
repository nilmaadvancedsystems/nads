// ViewModel da etapa Relatório do banco: lê o PDF (no navegador, com o pdf.js), a planilha ou o
// texto colado; ou começa em branco para digitar (foto); ou carrega o exemplo.
import { creditor as cr } from '@nads/core';
import workerPdf from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { caminhoDaEtapa } from '../../casca/navegacao';
import { useSessao } from '../../casca/sessao';

export function useBanco() {
  const s = useSessao();
  const navegar = useNavigate();
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState('');
  const [texto, setTexto] = useState('');
  const r = s.estado.relatorio;

  /** Relatório novo: descarta as decisões do cruzamento (os títulos mudaram) e volta a travar as etapas seguintes. */
  function usar(rel: cr.RelatorioBanco, origem: string, alcancada = 0) {
    setErro('');
    s.mudar(e => ({ ...e, relatorio: rel, origemBanco: origem, decisoes: {}, alcancada }));
  }

  async function escolherArquivo(f: File | null) {
    if (!f) return;
    setLendo(true);
    setErro('');
    try {
      const buf = await f.arrayBuffer();
      const nome = f.name.toLowerCase();
      if (nome.endsWith('.pdf')) usar(cr.lerRelatorioTexto(await cr.textoDoPdf(buf, workerPdf)), f.name);
      else if (nome.endsWith('.txt')) usar(cr.lerRelatorioTexto(new TextDecoder().decode(buf)), f.name);
      else usar(cr.lerRelatorioPlanilha(buf, f.name), f.name);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível ler o arquivo.');
    } finally {
      setLendo(false);
    }
  }

  function lerTexto() {
    if (!texto.trim()) return;
    usar(cr.lerRelatorioTexto(texto), 'texto colado');
  }

  function emBranco() {
    const vazio: cr.Titulo = { id: 1, sacado: '', nossoNumero: '', nf: '', valor: 0, mora: 0, desconto: 0, liquidacao: '', cobrado: null };
    usar({ grupos: [{ id: 1, titulos: [vazio], impresso: { ...cr.TOTAIS_VAZIOS } }], totalGeral: { ...cr.TOTAIS_VAZIOS }, ignorados: 0, avisos: [] }, 'digitado', 1);
    navegar(caminhoDaEtapa(s.rota, 'conferencia'));
  }

  const titulos = r ? r.grupos.flatMap(g => g.titulos) : [];
  return {
    aceitar: cr.EXTENSOES_BANCO.join(','),
    lendo, erro, fecharErro: () => setErro(''),
    escolherArquivo,
    texto, setTexto, lerTexto,
    emBranco,
    exemplo: () => { setTexto(cr.EXEMPLO_RELATORIO); usar(cr.lerRelatorioTexto(cr.EXEMPLO_RELATORIO), 'exemplo'); },
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
