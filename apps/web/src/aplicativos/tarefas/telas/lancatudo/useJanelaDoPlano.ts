// ViewModel da janela do plano de contas (17/11/2026: "quero que abra o plano de contas assim como no econtador"): a árvore
// do plano (core: lancatudo.linhasDoPlano), a busca, os grupos abertos e fechados e a conta destacada (↑ ↓ andam, Enter
// escolhe, → abre o grupo, ← fecha). Sem plano, ou com um código que não está nele, o "Usar o código" grava o digitado.
import { lancatudo as lt } from '@nads/core';
import { useMemo, useState } from 'react';

export function useJanelaDoPlano(linhas: readonly lt.LinhaDoPlano[], contaAtual: string | null, escolher: (codigo: string) => void) {
  const [busca, setBusca] = useState('');
  // um plano pequeno abre inteiro; o grande começa com os grupos de baixo fechados, menos o caminho da conta atual
  const [fechados, setFechados] = useState<ReadonlySet<string>>(() => {
    if (linhas.length <= 120) return new Set();
    const f = lt.gruposFechadosNoInicio(linhas);
    for (const p of linhas.find(l => l.codigo === contaAtual)?.pais || []) f.delete(p);
    return f;
  });
  const visiveis = useMemo(() => lt.linhasVisiveisDoPlano(linhas, busca, fechados), [linhas, busca, fechados]);
  const escolhiveis = visiveis.filter(l => !l.sintetica);
  const [destaque, setDestaque] = useState<string | null>(contaAtual);
  const destacada = escolhiveis.find(l => l.codigo === destaque)?.codigo ?? escolhiveis[0]?.codigo ?? null;

  const q = busca.trim();
  const digitado = /^\d+$/.test(q) && !linhas.some(l => l.codigo === q) ? q : '';

  const alternar = (codigo: string) => setFechados(f => { const n = new Set(f); if (n.has(codigo)) n.delete(codigo); else n.add(codigo); return n; });
  const mover = (d: number) => {
    if (!escolhiveis.length) return;
    const i = Math.max(0, escolhiveis.findIndex(l => l.codigo === destacada));
    setDestaque(escolhiveis[Math.min(escolhiveis.length - 1, Math.max(0, i + d))].codigo);
  };

  function tecla(k: string): boolean {
    if (k === 'ArrowDown') { mover(1); return true; }
    if (k === 'ArrowUp') { mover(-1); return true; }
    if (k === 'Enter') {
      if (escolhiveis.length === 1) escolher(escolhiveis[0].codigo);
      else if (destacada && (!digitado || escolhiveis.length)) escolher(destacada);
      else if (digitado) escolher(digitado);
      return true;
    }
    return false;
  }

  return {
    busca, setBusca: (v: string) => { setBusca(v); setDestaque(null); },
    visiveis, fechados, alternar, destacada, setDestaque, digitado, tecla,
    abrirTudo: () => setFechados(new Set()),
    fecharTudo: () => setFechados(lt.gruposFechadosNoInicio(linhas, 1)),
    semPlano: !linhas.length,
    total: linhas.filter(l => !l.sintetica).length,
  };
}
