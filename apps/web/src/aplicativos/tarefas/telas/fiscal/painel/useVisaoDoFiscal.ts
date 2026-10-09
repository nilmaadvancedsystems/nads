// ViewModel do Painel do Fiscal (Vitor, 09/10/2026: "4 — todos os clientes do mês numa tela"): por cliente, a etapa da
// rotina, as notas no SIEG, os buracos na sequência das saídas (das contagens e das saídas do mês, numa consulta só) e o
// que a rotina do cliente conferiu (os números que ela guarda na execução ao abrir: XMLs, notas que faltam no
// Alterdata, valores que não batem e itens com tributação para revisar). Os clientes com pendência em cima.
import { tarefas as t } from '@nads/core';
import { useState } from 'react';
import { caminhoDoExecutor } from '../../../casca/navegacao';
import { useExecucoes, useSieg } from '../../../dados/repo';
import { useAndamento } from '../../empresas/andamento';

export type FiltroDoPainel = 'todos' | 'pendencias';

export function useVisaoDoFiscal() {
  const a = useAndamento();
  const sieg = useSieg();
  const mes = sieg.doMes(a.competencia);
  const { execucoes } = useExecucoes(a.competencia, 'fiscal');
  const porNome = new Map(execucoes.map(e => [e.empresa, e]));
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroDoPainel>('todos');

  const todas = a.linhas.map(l => {
    const cod = String(l.codigo ?? '');
    const v = porNome.get(l.nome)?.valores || {};
    const c = mes.contagens.get(cod);
    const sai = mes.saidas.get(cod);
    const num = (k: string) => (typeof v[k] === 'number' ? v[k] : null);
    const linha = {
      chave: l.chave, codigo: cod, nome: l.nome, situacao: l.situacao, rotuloSituacao: l.rotuloSituacao,
      etapa: l.situacao === 'concluida' ? 'Concluída' : l.etapaAtual || (l.situacao === 'nao-iniciada' ? 'Não iniciada' : '—'),
      progresso: l.total ? Math.round((l.concluidas / l.total) * 100) : 0,
      rota: caminhoDoExecutor(l.rota, a.competencia),
      notas: c ? t.sieg.totalDe(c.emitidas) + t.sieg.totalDe(c.recebidas) : null,
      buracos: sai ? t.sieg.conferirSaidas(sai).series.reduce((s, x) => s + x.faltando.length, 0) : null,
      xmls: num('fiscalXmls'),
      faltam: num('fiscalFaltam'),
      valores: num('fiscalValores'),
      tributacao: num('fiscalTributacao'),
    };
    return { ...linha, pendencias: (linha.buracos || 0) + (linha.faltam || 0) + (linha.valores || 0) + (linha.tributacao || 0) };
  });
  const q = busca.trim().toLowerCase();
  const linhas = todas
    .filter(l => !q || l.nome.toLowerCase().includes(q) || l.codigo === q)
    .filter(l => filtro === 'todos' || l.pendencias > 0)
    .sort((x, y) => y.pendencias - x.pendencias || x.nome.localeCompare(y.nome, 'pt-BR'));
  const com = (f: (l: typeof todas[number]) => number | null) => todas.filter(l => (f(l) || 0) > 0).length;

  return {
    competencia: a.competencia,
    competencias: a.competencias,
    setCompetencia: a.setCompetencia,
    carregando: a.carregando || !mes.carregado,
    exemplos: sieg.exemplos,
    busca, setBusca, filtro, setFiltro,
    numeros: [
      { rotulo: 'Clientes', valor: todas.length, tom: 'info' as const, icone: 'briefcase' as const },
      { rotulo: 'Notas no SIEG', valor: todas.reduce((s, l) => s + (l.notas || 0), 0), tom: 'neutro' as const, icone: 'arquivo' as const },
      { rotulo: 'Com buraco nas saídas', valor: com(l => l.buracos), tom: 'aviso' as const, icone: 'alert' as const },
      { rotulo: 'Faltando no Alterdata', valor: com(l => l.faltam), tom: 'laranja' as const, icone: 'upload' as const },
      { rotulo: 'Valores que não batem', valor: com(l => l.valores), tom: 'roxo' as const, icone: 'scale' as const },
      { rotulo: 'Tributação a revisar', valor: com(l => l.tributacao), tom: 'marca' as const, icone: 'checklist' as const },
    ],
    linhas,
    quantas: linhas.length,
  };
}

export type VmVisaoDoFiscal = ReturnType<typeof useVisaoDoFiscal>;
