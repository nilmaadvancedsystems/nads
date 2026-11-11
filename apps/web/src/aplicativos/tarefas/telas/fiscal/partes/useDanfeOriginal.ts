// ViewModel da DANFE idêntica à original (11/11/2026, no LCDPR: "a danfe que tem que ficar identica a danfe original"):
// o XML inteiro da nota (useNotaOriginal: o robô pega no SIEG pela chave; nos exemplos, um XML de exemplo) desenhado
// pelo desenharDanfe — o mesmo PDF que o robô gera, medido dos PDFs do portal do SIEG. Abre pedindo a nota na hora; dá
// para baixar o PDF e o XML. Só NF-e e NFC-e (o CT-e fica no espelho). As folhas aparecem como imagem (o pdf.js desenha
// cada página; 11/11/2026: "coloca o vizualizador de verdade nao esse trem de impressao"), com o zoom próprio.
import { lcdpr, type tarefas as t } from '@nads/core';
import { baixarBytes } from '@nads/ui';
import { useEffect, useState } from 'react';
import { imagensDoPdf } from '../../ferramentas/pdfParaArquivos';
import { desenharDanfe } from './danfePdf';
import { useNotaOriginal } from './useNotaOriginal';

export function useDanfeOriginal(nota: t.sieg.NotaDoSieg, codigo: string | number | null | undefined, competencia?: string) {
  const o = useNotaOriginal(nota, codigo, competencia);
  const [pdf, setPdf] = useState<{ folhas: string[]; bytes: Uint8Array } | null>(null);
  /** o zoom: 'largura' (a folha na largura da janela) ou a porcentagem do tamanho real */
  const [zoom, setZoom] = useState<'largura' | number>('largura');
  const [erroDoPdf, setErroDoPdf] = useState('');

  // pede a nota assim que a janela abre
  useEffect(() => {
    if (o.pode && o.fase === 'parado') void o.abrir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.pode, o.fase]);

  // com o XML, o PDF e cada folha como imagem (as URLs liberadas ao fechar)
  useEffect(() => {
    if (!o.xml) return;
    let urls: string[] = [];
    let viva = true;
    (async () => {
      const bytes = await desenharDanfe(o.xml);
      const imagens = await imagensDoPdf(bytes, 2.5);
      if (!viva) return;
      urls = imagens.map(b => URL.createObjectURL(b));
      setPdf({ folhas: urls, bytes });
    })().catch((e: unknown) => { if (viva) setErroDoPdf(e instanceof Error ? e.message : String(e)); });
    return () => { viva = false; for (const u of urls) URL.revokeObjectURL(u); };
  }, [o.xml]);
  const PASSOS = [50, 75, 100, 125, 150, 200];
  const atual = zoom === 'largura' ? 100 : zoom;

  const erro = !o.pode ? 'Não dá para pedir esta nota ao robô: falta a chave de acesso, a empresa ou o mês dela.' : o.erro || erroDoPdf;
  return {
    titulo: (nota.tipo === 'NFC-e' ? 'NFC-e ' : 'NF-e ') + nota.numero + (nota.serie ? ' · série ' + nota.serie : ''),
    emitente: lcdpr.semEntidades(nota.emitente.nome),
    carregando: !pdf && !erro,
    andamento: o.andamento || (o.xml ? 'Desenhando a DANFE…' : 'Buscando a nota…'),
    erro,
    /** as folhas da DANFE (imagens), na ordem */
    folhas: pdf?.folhas || [],
    pronta: !!pdf,
    zoom,
    rotuloDoZoom: zoom === 'largura' ? 'Ajustada' : zoom + '%',
    menos: () => setZoom(PASSOS.slice().reverse().find(p => p < atual) ?? PASSOS[0]),
    mais: () => setZoom(PASSOS.find(p => p > atual) ?? PASSOS[PASSOS.length - 1]),
    ajustar: () => setZoom('largura'),
    baixarPdf: () => { if (pdf) baixarBytes(pdf.bytes, 'DANFE ' + nota.numero + '.pdf', 'application/pdf'); },
    baixarXml: () => { if (o.xml) baixarBytes(new TextEncoder().encode(o.xml), (nota.chave || nota.numero) + '.xml', 'application/xml'); },
    tentarDeNovo: () => { setErroDoPdf(''); void o.abrir(); },
  };
}
