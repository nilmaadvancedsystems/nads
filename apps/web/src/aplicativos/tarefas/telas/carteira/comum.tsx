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

/** O mês escolhido na tela (o atual, para começar) e os últimos 12 para escolher. */
export function useMes() {
  const meses = carteira.ultimosMeses(new Date(), 12);
  const [mes, setMes] = useState(meses[0]);
  return { mes, setMes, meses };
}

export function SeletorDoMes({ mes, setMes, meses }: ReturnType<typeof useMes>) {
  return (
    <MenuSuspenso rotulo={comMaiuscula(carteira.mesPorExtenso(mes))} icone="calendar" titulo="O mês" dica="Trocar o mês" largura={220}
      itens={meses.map(m => ({ rotulo: comMaiuscula(carteira.mesPorExtenso(m)), marcado: m === mes, onClick: () => setMes(m) }))} />
  );
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
