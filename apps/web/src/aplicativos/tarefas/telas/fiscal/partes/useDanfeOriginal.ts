// ViewModel da DANFE idêntica à original (11/11/2026, no LCDPR: "a danfe que tem que ficar identica a danfe original"):
// o XML inteiro da nota (useNotaOriginal: o robô pega no SIEG pela chave; nos exemplos, um XML de exemplo) desenhado
// pelo desenharDanfe — o mesmo PDF que o robô gera, medido dos PDFs do portal do SIEG. Abre pedindo a nota na hora; dá
// para baixar o PDF e o XML. Só NF-e e NFC-e (o CT-e fica no espelho).
import type { tarefas as t } from '@nads/core';
import { baixarBytes } from '@nads/ui';
import { useEffect, useState } from 'react';
import { desenharDanfe } from './danfePdf';
import { useNotaOriginal } from './useNotaOriginal';

export function useDanfeOriginal(nota: t.sieg.NotaDoSieg, codigo: string | number | null | undefined, competencia?: string) {
  const o = useNotaOriginal(nota, codigo, competencia);
  const [pdf, setPdf] = useState<{ url: string; bytes: Uint8Array } | null>(null);
  const [erroDoPdf, setErroDoPdf] = useState('');

  // pede a nota assim que a janela abre
  useEffect(() => {
    if (o.pode && o.fase === 'parado') void o.abrir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.pode, o.fase]);

  // com o XML, o PDF (e a URL dele, liberada ao fechar)
  useEffect(() => {
    if (!o.xml) return;
    let url = '';
    let viva = true;
    desenharDanfe(o.xml).then(bytes => {
      if (!viva) return;
      url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: 'application/pdf' }));
      setPdf({ url, bytes });
    }).catch((e: unknown) => { if (viva) setErroDoPdf(e instanceof Error ? e.message : String(e)); });
    return () => { viva = false; if (url) URL.revokeObjectURL(url); };
  }, [o.xml]);

  const erro = !o.pode ? 'Esta nota não tem a chave de acesso para o robô buscar o XML.' : o.erro || erroDoPdf;
  return {
    titulo: (nota.tipo === 'NFC-e' ? 'NFC-e ' : 'NF-e ') + nota.numero + (nota.serie ? ' · série ' + nota.serie : ''),
    emitente: nota.emitente.nome,
    carregando: !pdf && !erro,
    andamento: o.andamento || (o.xml ? 'Desenhando a DANFE…' : 'Buscando a nota…'),
    erro,
    url: pdf?.url || '',
    baixarPdf: () => { if (pdf) baixarBytes(pdf.bytes, 'DANFE ' + nota.numero + '.pdf', 'application/pdf'); },
    baixarXml: () => { if (o.xml) baixarBytes(new TextEncoder().encode(o.xml), (nota.chave || nota.numero) + '.xml', 'application/xml'); },
    tentarDeNovo: () => { setErroDoPdf(''); void o.abrir(); },
  };
}
