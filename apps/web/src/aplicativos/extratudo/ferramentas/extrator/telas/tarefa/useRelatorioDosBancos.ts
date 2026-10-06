// ViewModel do relatório dos bancos (a etapa Bancos da Tarefa; Vitor, 06/10/2026: "só coloque um relatório com gráficos
// de tudo o que foi feito em bancos… a pessoa só vê os saldos, saldo bancário do período, e dá Próximo"). Por banco: o
// saldo do começo e do fim do período, as entradas e saídas mês a mês (as colunas) e as categorias pelo histórico do
// extrato (o ranking): CRÉD.LIQ.COBRANÇA, despesas bancárias, boletos, transferência para o sócio (do Cadastro), água, luz.
import { extrator as x, tarefas } from '@nads/core';
import { useSearchParams } from 'react-router';
import { useRequisitosParaATarefa } from '../../../../../../comum/ponte';
import { useCadastroDaEmpresa } from '../../dados/repo';
import { useSessao } from '../../casca/sessao';

const ALTURA = 110;

export function useRelatorioDosBancos() {
  const s = useSessao();
  const { cadastro } = useCadastroDaEmpresa(s.nome, s.codigo);
  const [params] = useSearchParams();
  const doEndereco = (params.get('meses') || '').split(',').filter(m => /^\d{4}-\d{2}$/.test(m));
  const competencia = /^\d{4}-\d{2}$/.test(params.get('competencia') || '') ? (params.get('competencia') as string) : '';
  const meses = doEndereco.length ? [...doEndereco].sort() : competencia ? [competencia] : [];
  const { bancos, primeiro } = x.bancosDaEmpresaNa(s.empresa, cadastro, s.codigo, meses[meses.length - 1] || '');
  const resumo = x.resumoDosBancos(s.empresa, bancos, primeiro, meses, cadastro?.socios || []);
  // só olhar: a Tarefa pode seguir (o Próximo)
  useRequisitosParaATarefa({ pronto: true, faltam: [] });
  return {
    periodo: meses.length > 1 ? tarefas.rotuloNumericoCompetencia(meses[0]) + ' a ' + tarefas.rotuloNumericoCompetencia(meses[meses.length - 1]) : meses[0] ? tarefas.rotuloNumericoCompetencia(meses[0]) : '',
    semSocios: !cadastro?.socios?.length,
    bancos: resumo.map(r => {
      const b = bancos.find(x2 => x2.id === r.id);
      const maior = Math.max(1, ...r.meses.flatMap(m => [m.entradas, m.saidas]));
      const maiorCat = Math.max(1, ...r.categorias.map(c => c.total));
      return {
        id: r.id, nome: r.nome, marca: b?.marca || '', temExtrato: r.temExtrato,
        conta: b ? [b.agencia && 'Ag. ' + b.agencia, b.conta && 'C/C ' + b.conta].filter(Boolean).join(' · ') : '',
        saldoInicial: x.reaisBR(r.saldoInicial), saldoFinal: x.reaisBR(r.saldoFinal),
        meses: r.meses.map(m => ({
          mes: m.mes, rotulo: tarefas.rotuloCurtoCompetencia(m.mes),
          titulo: tarefas.rotuloCompetencia(m.mes) + ' — entradas ' + x.reaisBR(m.entradas) + ' · saídas ' + x.reaisBR(m.saidas) + ' · saldo ' + x.reaisBR(m.saldoFinal),
          alturaEnt: Math.round((m.entradas / maior) * ALTURA), alturaSai: Math.round((m.saidas / maior) * ALTURA),
        })),
        // sem o número de lançamentos (Vitor, 06/10/2026); o clique mostra a relação embaixo
        categorias: r.categorias.map(c => ({
          id: c.id, rotulo: c.rotulo, valor: x.reaisBR(c.total), largura: Math.max(2, Math.round((c.total / maiorCat) * 100)), entrada: c.id === 'credliq' || c.id === 'outras-entradas',
          lancamentos: c.lancamentos.map(l => ({ data: x.dataBR(l.data), historico: l.historico, valor: x.reaisBR(Math.abs(l.valor)) })),
        })),
      };
    }),
  };
}
