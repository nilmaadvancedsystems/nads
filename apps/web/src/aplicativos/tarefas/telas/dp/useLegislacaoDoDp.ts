// DP › Legislação (Vitor, 14/10/2026: "importa as legislações em uma aba no DP"): os textos de consulta que vieram do Toriba
// (core empresas/legislacaoDp.ts), com a busca no assunto e no texto; clicar abre o texto inteiro na janela lateral.
import { empresas } from '@nads/core';
import { useMemo, useState } from 'react';

export type TopicoDaLegislacao = 'texto' | 'observacoes';

/** sem acento e minúsculo, para a busca achar "ferias" em "Férias" */
const simples = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function useLegislacaoDoDp() {
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState<number | null>(null);
  const [topico, setTopico] = useState<TopicoDaLegislacao>('texto');
  const itens = useMemo(() => {
    const q = simples(busca.trim());
    const todas = [...empresas.LEGISLACAO_DP].sort((a, b) => a.assunto.localeCompare(b.assunto, 'pt-BR'));
    if (!q) return todas;
    // o assunto primeiro, depois o que só tem a palavra no texto
    const noAssunto = todas.filter(l => simples(l.assunto).includes(q));
    const noTexto = todas.filter(l => !noAssunto.includes(l) && simples(l.texto + ' ' + l.observacoes).includes(q));
    return [...noAssunto, ...noTexto];
  }, [busca]);
  const item = aberta == null ? null : empresas.LEGISLACAO_DP.find(l => l.id === aberta) || null;
  return {
    busca, setBusca, itens, total: empresas.LEGISLACAO_DP.length, item, topico,
    setTopico,
    abrir(id: number) { setAberta(id); setTopico('texto'); },
    fechar() { setAberta(null); },
    /** 'aaaa-mm-dd' → 'dd/mm/aaaa' */
    data: (iso: string) => (iso ? iso.split('-').reverse().join('/') : ''),
  };
}
