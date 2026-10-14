// O que foi puxado do e-mail (ou, no Creditor, do Drive) para o "olhinho" ao lado do mês (Vitor, 14/10/2026: "quando
// importar algo do Drive ou que puxou no e-mail, coloca um olhinho ao lado direito do ícone, no mês, para que eu consiga
// ver o que puxou; faça isso em todas as telas que têm essa mecânica").
// O arquivo fica só na memória desta aba (um link blob:), nunca no banco: fechou a página, some o olhinho do que veio do
// e-mail. O extrato do Drive na Importação não precisa disto: ele guarda o arquivo do Drive e abre pelo link temporário.
import { Icone } from '@nads/ui';
import { useSyncExternalStore } from 'react';

export interface Puxado { nome: string; url: string; origem: 'drive' | 'email'; meses: string[] }

const porChave = new Map<string, Puxado[]>();
const ouvintes = new Set<() => void>();
let versao = 0;
const avisar = () => { versao++; ouvintes.forEach(f => f()); };

const tipoDe = (nome: string) => (/\.pdf$/i.test(nome) ? 'application/pdf' : /\.(txt|ofx|csv)$/i.test(nome) ? 'text/plain' : 'application/octet-stream');

/**
 * Guarda o arquivo puxado (uma cópia: o leitor de PDF pode consumir o original depois), nos meses em que ele vale. Não
 * troca o que já está lá (um mês pode ter dois relatórios): quem importa de novo chama o esquecerPuxado do mês antes.
 */
export function guardarPuxado(chave: string, nome: string, conteudo: ArrayBuffer | Uint8Array | Blob, origem: Puxado['origem'], meses: readonly string[]) {
  const bytes = conteudo instanceof Uint8Array ? conteudo.slice() : conteudo instanceof Blob ? conteudo : conteudo.slice(0);
  const novo: Puxado = { nome, url: URL.createObjectURL(new Blob([bytes], { type: tipoDe(nome) })), origem, meses: [...meses] };
  porChave.set(chave, [...(porChave.get(chave) || []), novo]);
  avisar();
}

/** Esquece o que foi puxado na chave (num mês só, ou tudo): a importação do mês foi excluída ou trocada. */
export function esquecerPuxado(chave: string, mes?: string) {
  const lista = porChave.get(chave);
  if (!lista) return;
  const fica = lista.filter(p => (mes ? !p.meses.includes(mes) : false));
  lista.filter(p => !fica.includes(p)).forEach(p => URL.revokeObjectURL(p.url));
  if (fica.length) porChave.set(chave, fica); else porChave.delete(chave);
  avisar();
}

/** O que foi puxado na chave e vale no mês (o mais novo primeiro). Na tela, junto com o useVersaoDosPuxados. */
export function puxadosDe(chave: string, mes?: string): Puxado[] {
  return (porChave.get(chave) || []).filter(p => !mes || p.meses.includes(mes)).reverse();
}

const assinar = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };

/** Redesenha a tela quando algo é puxado ou esquecido (para quem lê várias chaves com o puxadosDe). */
export function useVersaoDosPuxados(): number {
  return useSyncExternalStore(assinar, () => versao);
}

/** O que foi puxado na chave e vale no mês (o mais novo primeiro); acompanha as mudanças. */
export function usePuxados(chave: string, mes?: string): Puxado[] {
  useVersaoDosPuxados();
  return puxadosDe(chave, mes);
}

/** A chave do extrato de um banco da empresa (a Importação e os recebidos por e-mail). */
export const chaveDoExtrato = (codigo: number | null, banco: string) => 'extrato|' + (codigo ?? '') + '|' + banco;

/** Abre o arquivo puxado numa aba nova. */
export function abrirPuxado(p: Puxado) {
  window.open(p.url, '_blank');
}

/** O olhinho ao lado do mês: abre o que foi puxado (um clique). */
export function BotaoVer({ titulo, onVer, desabilitado }: { titulo: string; onVer: () => void; desabilitado?: boolean }) {
  return (
    <button type="button" className="icon-btn icon-btn-sm imp-btn imp-ver" style={{ marginLeft: 4 }} disabled={desabilitado} title={titulo} aria-label={titulo}
      onClick={ev => { ev.stopPropagation(); onVer(); }}>
      <Icone nome="olho" />
    </button>
  );
}
