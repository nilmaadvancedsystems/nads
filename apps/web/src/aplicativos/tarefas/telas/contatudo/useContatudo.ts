// O Contatudo (Vitor, 17/11/2026: "as ferramentas de todas as etapas do contábil do nads, num link chamado Contatudo, onde a
// pessoa vai colocar tudo manual... sem importar nada no banco, apenas para usar em urgências"; "o usuario loga na empresa na
// primeira tela e usa as ferramentas, puxando o que puder do banco, mas nada de la e upado"). As ferramentas escolhidas:
// Cheque especial, Creditor, Cartões, Vendas no cartão, Caixa e Honorários — as mesmas telas da Tarefa, abertas soltas, com a
// empresa e o período escolhidos aqui. Debaixo de /tarefas/contatudo nada grava no banco (comum/travaDoModoDev.ts, emConsulta).
import { empresas, type tarefas } from '@nads/core';
import { useMemo, useState } from 'react';
import type { AbasDaEtapa, EtapaAberta } from '../executor/etapas/contexto';

export interface FerramentaDoContatudo { id: tarefas.TelaDaEtapa; rotulo: string }

export const FERRAMENTAS: readonly FerramentaDoContatudo[] = [
  { id: 'cheque-especial', rotulo: 'Cheque especial' },
  { id: 'creditor', rotulo: 'Creditor' },
  { id: 'cartoes', rotulo: 'Cartões' },
  { id: 'vendas-cartao', rotulo: 'Vendas no cartão' },
  { id: 'conciliacao-caixa', rotulo: 'Caixa' },
  { id: 'honorarios', rotulo: 'Honorários' },
];

const mesAnterior = () => {
  const d = new Date();
  d.setDate(1); d.setMonth(d.getMonth() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
};

/** Os meses de 'aaaa-mm' até 'aaaa-mm', em ordem (no máximo 12). */
export function mesesEntre(de: string, ate: string): string[] {
  const out: string[] = [];
  let [a, m] = de.split('-').map(Number);
  const [a2, m2] = ate.split('-').map(Number);
  while ((a < a2 || (a === a2 && m <= m2)) && out.length < 12) {
    out.push(a + '-' + String(m).padStart(2, '0'));
    m++; if (m > 12) { m = 1; a++; }
  }
  return out;
}

const normal = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function useContatudo() {
  const [codigo, setCodigo] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const [de, setDe] = useState(mesAnterior);
  const [ate, setAte] = useState(mesAnterior);
  const [ferramenta, setFerramenta] = useState<tarefas.TelaDaEtapa>('cheque-especial');
  const [abas, setAbas] = useState<AbasDaEtapa | null>(null);

  const lista = useMemo(() => empresas.EMPRESAS.filter((e): e is typeof e & { codigo: number } => e.codigo != null).sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR')), []);
  const achadas = useMemo(() => {
    const b = normal(busca.trim());
    if (!b) return lista.slice(0, 60);
    return lista.filter(e => normal(e.nome).includes(b) || String(e.codigo) === b).slice(0, 60);
  }, [busca, lista]);
  const empresa = codigo == null ? null : lista.find(e => e.codigo === codigo) || null;

  const ateValido = ate < de ? de : ate;
  const meses = mesesEntre(de, ateValido);
  const etapa: EtapaAberta | null = empresa ? {
    nome: empresa.nome, codigo: empresa.codigo, competencia: meses[meses.length - 1] || de, meses, dev: false, prestaServico: null, mesesDaTarefa: meses.length > 1,
  } : null;

  return {
    lista: achadas, busca, setBusca, empresa,
    entrar: (c: number) => { setCodigo(c); setAbas(null); },
    sair: () => { setCodigo(null); setAbas(null); },
    de, ate: ateValido, setDe: (v: string) => { if (v) { setDe(v); setAbas(null); } }, setAte: (v: string) => { if (v) { setAte(v); setAbas(null); } },
    ferramenta, abrir: (id: tarefas.TelaDaEtapa) => { setFerramenta(id); setAbas(null); },
    etapa, chave: (empresa?.codigo ?? '') + '|' + ferramenta + '|' + meses.join(','),
    abas, setAbas,
  };
}
