// Peças da Carteira (12/11/2026): o seletor do mês, abrir e baixar um arquivo da Carteira e o tipo de cada arquivo.
import { carteira } from '@nads/core';
import { baixarBytes, MenuSuspenso } from '@nads/ui';
import { useState } from 'react';

export const tipoDoArquivo = (nome: string) => (/\.pdf$/i.test(nome) ? 'application/pdf' : /\.png$/i.test(nome) ? 'image/png' : /\.jpe?g$/i.test(nome) ? 'image/jpeg' : 'application/octet-stream');
export const tamanhoBr = (n: number) => (n >= 1024 * 1024 ? (n / 1024 / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
export const mensagem = (e: unknown, o: string) => (e instanceof Error && e.message ? e.message : o);
/** "Nov/2026" */
export const mesCurto = (c: string) => { const m = /^(\d{4})-(\d{2})$/.exec(c); return m ? carteira.mesPorExtenso(c).slice(0, 3).replace(/^./, x => x.toUpperCase()) + '/' + m[1] : c; };
const comMaiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * O mês escolhido na tela e os últimos 12 para escolher. proximo: 'incluir' põe também o mês seguinte (onde entram as
 * comissões que a equipe registra; 12/11/2026) e 'comecar' já abre nele.
 */
export function useMes(proximo: false | 'incluir' | 'comecar' = false) {
  const seguinte = carteira.mesDoPagamento(new Date());
  const meses = [...(proximo ? [seguinte] : []), ...carteira.ultimosMeses(new Date(), 12)];
  const [mes, setMes] = useState(proximo === 'comecar' ? seguinte : carteira.competenciaDe(new Date()));
  return { mes, setMes, meses };
}

export function SeletorDoMes({ mes, setMes, meses }: ReturnType<typeof useMes>) {
  return (
    <MenuSuspenso rotulo={comMaiuscula(carteira.mesPorExtenso(mes))} icone="calendar" titulo="O mês" dica="Trocar o mês" largura={220}
      itens={meses.map(m => ({ rotulo: comMaiuscula(carteira.mesPorExtenso(m)), marcado: m === mes, onClick: () => setMes(m) }))} />
  );
}

const TOM: Record<carteira.SituacaoDaComissao, string> = { lancada: 'badge-warn', aprovada: 'badge-suave badge-info', paga: 'badge-ok', recusada: 'badge-bad' };
export function SeloDaComissao({ s }: { s: carteira.SituacaoDaComissao }) {
  return <span className={'badge ' + TOM[s]}>{carteira.rotuloDaSituacao(s)}</span>;
}

/** Abre numa aba nova (a aba nasce no clique; o arquivo chega depois, como nos anexos das contas). */
export async function abrirBytes(buscar: () => Promise<Uint8Array>, nome: string, falhou: (m: string) => void) {
  const janela = window.open('', '_blank');
  try {
    const url = URL.createObjectURL(new Blob([(await buscar()) as BlobPart], { type: tipoDoArquivo(nome) }));
    if (janela && !janela.closed) janela.location.href = url; else window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { janela?.close(); falhou(mensagem(e, 'Não consegui abrir o arquivo.')); }
}

export async function baixarDaCarteira(buscar: () => Promise<Uint8Array>, nome: string, falhou: (m: string) => void) {
  try { baixarBytes(await buscar(), nome, tipoDoArquivo(nome)); } catch (e) { falhou(mensagem(e, 'Não consegui baixar o arquivo.')); }
}
