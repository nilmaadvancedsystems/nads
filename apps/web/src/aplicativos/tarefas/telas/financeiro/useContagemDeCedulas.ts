// ViewModel da contagem de cédulas (19/10/2026): a quantidade digitada de cada nota ou moeda e o total geral.
import { financeiro } from '@nads/core';
import { useState } from 'react';

export function useContagemDeCedulas() {
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const total = financeiro.totalDasCedulas(Object.fromEntries(Object.entries(quantidades).map(([k, v]) => [k, Number(v)])));
  return {
    quantidades, total,
    mudar: (valor: string, quantidade: string) => setQuantidades(q => ({ ...q, [valor]: quantidade })),
    zerar: () => setQuantidades({}),
  };
}
