// ViewModel do Faturamento dos clientes (Fiscal › Faturamento; Heverton, 20/10/2026: "relação de faturamento dos
// clientes"; o usuário decidiu em 21/10/2026: é a receita de cada cliente). O período (o mês, o ano até o mês, ou os
// últimos 12 meses), uma linha por cliente com o faturamento de cada mês, o total e a variação contra o mês anterior, e
// de onde veio cada número (hoje, as NF-e e NFC-e emitidas no SIEG; core tarefas.sieg.faturamento). Sem dado, vazio.
// Exporta para o Excel e imprime. Fica no Fiscal porque o dado é do Fiscal (o SIEG, a mesma fonte do Painel) e a tela
// das Solicitações, onde o pedido nasceu, é da Entregas.
import { empresas as emp, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { competenciasDaTela } from '../../../casca/navegacao';
import { useRepo, useSieg } from '../../../dados/repo';
import { imprimirHtml } from '../../dp/imprimirHtml';

const f = t.sieg;

export function useFaturamentoDosClientes() {
  const repo = useRepo();
  const sieg = useSieg();
  const { toast } = useRetorno();
  const [periodo, setPeriodo] = useState<t.sieg.PeriodoDoFaturamento>('12m');
  const [competencia, setCompetencia] = useState(() => competenciasDaTela(1)[0]);
  const [busca, setBusca] = useState('');
  const [regime, setRegime] = useState('');
  const [soComDado, setSoComDado] = useState(true);
  // o cliente aberto no faturamento detalhado (22/10/2026: "quando eu clique no cliente abra um faturamento detalhado")
  const [aberto, setAberto] = useState<number | null>(null);
  const competencias = f.competenciasDoPeriodo(periodo, competencia);
  // cada mês numa consulta só (todos os clientes; a mesma do Painel do Fiscal)
  const meses = competencias.map(c => sieg.doMes(c));
  const empresas = repo.listarEmpresas().filter(e => e.codigo != null).map(e => ({ codigo: e.codigo as number, nome: e.nome, regime: e.regime || '' }));
  const todas = f.linhasDoFaturamento(empresas, competencias, c => sieg.doMes(c).saidas);
  const q = busca.trim();
  const achadas = q ? new Set(emp.buscarEmpresas(todas, q).map(e => e.codigo)) : null;
  const linhas = todas.filter(l => (!achadas || achadas.has(l.codigo)) && (!regime || l.regime === regime) && (!soComDado || l.total != null));
  const totalDoMes = (c: string) => { const v = linhas.reduce((s, l) => s + (l.meses[c]?.valor || 0), 0); return linhas.some(l => l.meses[c]) ? Math.round(v * 100) / 100 : null; };
  const rotuloDoPeriodo = periodo === 'mes' ? t.rotuloCompetencia(competencia) : periodo === 'ano' ? 'Janeiro a ' + t.rotuloCompetencia(competencia) : '12 meses até ' + t.rotuloCompetencia(competencia);
  return {
    exemplos: sieg.exemplos,
    carregando: meses.some(m => !m.carregado),
    periodo, setPeriodo, periodos: f.PERIODOS_DO_FATURAMENTO,
    competencia, setCompetencia,
    busca, setBusca,
    regime, setRegime, regimes: [...new Set(empresas.map(e => e.regime).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    soComDado, alternarSoComDado: () => setSoComDado(s => !s),
    competencias: competencias.map(c => ({ chave: c, rotulo: f.mesCurto(c), total: totalDoMes(c) })),
    linhas,
    /** o faturamento detalhado: o cliente aberto, as competências do período, abrir e fechar */
    aberto: aberto == null ? null : linhas.find(l => l.codigo === aberto) || todas.find(l => l.codigo === aberto) || null,
    competenciasDoPeriodo: competencias,
    abrir: (codigo: number) => setAberto(codigo),
    fechar: () => setAberto(null),
    semDado: todas.filter(l => l.total == null).length,
    totalGeral: linhas.reduce((s, l) => s + (l.total || 0), 0),
    fonte: f.FONTE_SIEG,
    rotuloDoPeriodo,
    exportar() {
      const p = f.planilhaDoFaturamento(linhas, competencias);
      return { bytes: t.planilhaXlsx('Faturamento', p.cabecalho, p.linhas), nome: 'Faturamento dos clientes ' + competencias[0] + (competencias.length > 1 ? ' a ' + competencias[competencias.length - 1] : '') + '.xlsx' };
    },
    imprimir() {
      imprimirHtml(f.htmlDoFaturamento({ titulo: 'Faturamento dos clientes · ' + rotuloDoPeriodo, linhas, competencias }));
      toast('Relação pronta: escolha a impressora');
    },
  };
}
