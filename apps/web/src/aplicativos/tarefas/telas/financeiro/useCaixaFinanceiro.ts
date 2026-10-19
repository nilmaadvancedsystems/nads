// ViewModel de Financeiro › Caixa (19/10/2026: "o Movimento de Caixa do Toriba, no nads"): o período (de/até, começando no
// mês de hoje), a busca, os quatro números (saldo inicial, entradas, saídas, saldo final), as linhas, e qual janela está
// aberta (o lançamento novo ou aberto para alterar, ou a contagem de cédulas).
import { financeiro } from '@nads/core';
import { useMemo, useState } from 'react';
import { useCaixa } from '../../dados/repo';
import { dataBr, hoje, isoDaData } from './formatosDaNota';

export type PeriodoRapido = 'este-mes' | 'mes-passado' | 'este-ano' | 'outro';
export const PERIODOS_RAPIDOS: { valor: PeriodoRapido; rotulo: string; oculta?: boolean }[] = [
  { valor: 'este-mes', rotulo: 'Este mês' },
  { valor: 'mes-passado', rotulo: 'Mês passado' },
  { valor: 'este-ano', rotulo: 'Este ano' },
  { valor: 'outro', rotulo: 'Outro', oculta: true },
];

/** a janela do lançamento: id vazio é novo; `valor` já vem preenchido (o "Usar no lançamento" da contagem de cédulas) */
export interface LancamentoAberto { id?: string; valor?: number }

export function useCaixaFinanceiro() {
  const repo = useCaixa();
  const lanc = repo.lancamentos();
  const plano = repo.plano();
  const inicio = financeiro.periodoPronto('este-mes', hoje());
  const [de, setDe] = useState(dataBr(inicio.de));
  const [ate, setAte] = useState(dataBr(inicio.ate));
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<LancamentoAberto | null>(null);
  const [contando, setContando] = useState(false);

  const deIso = isoDaData(de), ateIso = isoDaData(ate);
  const periodoValido = !!deIso && !!ateIso && deIso <= ateIso;
  const contas = useMemo(() => new Map(plano.lista.map(c => [c.id, c])), [plano.lista]);
  const resumo = useMemo(() => (periodoValido ? financeiro.resumoDoPeriodo(lanc.lista, deIso, ateIso) : null), [lanc.lista, periodoValido, deIso, ateIso]);

  const q = busca.trim().toLowerCase();
  const linhas = useMemo(() => (resumo?.lancamentos ?? [])
    .filter(l => !q || financeiro.textoDoLancamento(l, l.conta ? contas.get(l.conta) : undefined).includes(q))
    .map(l => ({ lancamento: l, conta: l.conta ? contas.get(l.conta) : undefined })), [resumo, q, contas]);

  const periodoRapido: PeriodoRapido = (['este-mes', 'mes-passado', 'este-ano'] as const).find(p => {
    const x = financeiro.periodoPronto(p, hoje());
    return x.de === deIso && x.ate === ateIso;
  }) ?? 'outro';

  return {
    carregando: !lanc.carregada || !plano.carregada,
    erro: lanc.erro,
    exemplos: repo.exemplos,
    de, setDe, ate, setAte, periodoValido, periodoRapido,
    escolherPeriodo(p: PeriodoRapido) {
      if (p === 'outro') return;
      const x = financeiro.periodoPronto(p, hoje());
      setDe(dataBr(x.de)); setAte(dataBr(x.ate));
    },
    busca, setBusca,
    total: lanc.lista.length,
    resumo,
    linhas,
    aberto, abrir: (l: LancamentoAberto) => setAberto(l), fechar: () => setAberto(null),
    contando, setContando,
    /** "Usar no lançamento": fecha a contagem e abre um lançamento novo com o total */
    usarCedulas(valor: number) { setContando(false); setAberto({ valor }); },
  };
}
