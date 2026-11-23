// ViewModel da parte Impostos do Faturamento e impostos da Área do Cliente (23/11/2026; o dono: "a planilha da defis so que
// em dados para o cliente"; "impostos entram dentro do faturamento"; "consegue melhorar isso?"): o quadro do ano mês a mês
// (o faturamento das notas, a folha do DP e as guias que o escritório emitiu por imposto), os números do ano e a planilha.
// É o valor das guias emitidas, não o pago.
import { areaCliente as ac, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { baixarArquivo } from '../dados/baixar';
import type { DaCasca } from './useAreaCliente';

/** o valor, ou null para a célula vazia (a tela apaga, sem o traço pesado) */
const reais = (n: number | null) => (n ? formatos.reais(n) : null);
const porcento = (n: number | null) => (n == null ? null : (n * 100).toFixed(1).replace('.', ',') + '%');

export function useImpostos({ area, hoje }: DaCasca) {
  const { toast } = useRetorno();
  const anos = [hoje.getFullYear(), hoje.getFullYear() - 1];
  const [ano, setAno] = useState(anos[0]);
  const q = ac.quadroDosImpostos({ ano, hoje, faturamento: area.faturamento?.empresas ?? [], folha: area.pessoal?.historico ?? [], guias: area.guias });
  const nome = area.resumo?.empresas.map(e => e.nome).join(' · ') || 'Empresa';
  const mesDeHoje = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0');
  return {
    ano, anos, setAno,
    temDado: q.temDado,
    variasEmpresas: (area.resumo?.empresas.length ?? 0) > 1,
    numeros: {
      faturamento: reais(q.totais.faturamento) ?? '—',
      folha: reais(q.totais.folha) ?? '—',
      impostos: reais(q.totais.total) ?? '—',
      porcento: porcento(q.totais.porcento) ?? '—',
    },
    colunas: q.colunas,
    linhas: q.meses.map(m => ({
      competencia: m.competencia, mes: m.rotulo + '/' + String(ano).slice(2), emAndamento: m.competencia === mesDeHoje,
      faturamento: reais(m.faturamento), folha: reais(m.folha), impostos: m.impostos.map(v => reais(v)), total: reais(m.total),
      porcento: m.total ? porcento(m.porcento) : null,
    })).reverse(),
    totais: { faturamento: reais(q.totais.faturamento) ?? '—', folha: reais(q.totais.folha) ?? '—', impostos: q.totais.impostos.map(v => reais(v) ?? '—'), total: reais(q.totais.total) ?? '—', porcento: porcento(q.totais.porcento) ?? '—' },
    baixar: () => {
      baixarArquivo('impostos-' + ano + '-' + formatos.slug(nome) + '.xlsx', new Blob([ac.planilhaDosImpostos(nome, q)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      toast('Planilha dos impostos de ' + ano + ' baixada.');
    },
  };
}
