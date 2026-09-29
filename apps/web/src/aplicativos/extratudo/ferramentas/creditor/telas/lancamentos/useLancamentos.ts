// ViewModel da etapa Lançamentos: as contas do layout, o fechamento da conta banco por dia (a última
// checagem) e o arquivo .xls de 8 colunas. Só baixa quando todos os dias batem (ou a diferença é
// exatamente o que a pessoa excluiu).
import { creditor as cr } from '@nads/core';
import { useSessao } from '../../casca/sessao';

export type CampoConta = keyof cr.ContasCreditor;

export const ROTULO_CONTA: Record<CampoConta, string> = {
  banco: 'Conta banco', juros: 'Conta de juros/mora', desconto: 'Conta de descontos',
  histPrincipal: 'Histórico do principal', histJuros: 'Histórico da mora', histDesconto: 'Histórico do desconto',
};

export function useLancamentos() {
  const s = useSessao();
  const { lancamentos, fechamento, fora } = s.d;
  const divergentes = fechamento.filter(f => f.situacao === 'diverge');
  const contasOk = Object.values(s.estado.contas).every(v => !!String(v).trim());

  return {
    contas: s.estado.contas,
    rotuloConta: ROTULO_CONTA,
    mudarConta: (c: CampoConta, v: string) => s.mudar(e => ({ ...e, contas: { ...e.contas, [c]: v.trim() } })),
    restaurarContas: () => s.mudar(e => ({ ...e, contas: cr.CONTAS_PADRAO })),
    contaBanco: s.estado.contas.banco,
    fechamento,
    lancamentos,
    totais: {
      qtd: lancamentos.length,
      principal: cr.somar(lancamentos.filter(l => l.tipo === 'principal').map(l => l.valor)),
      mora: cr.somar(lancamentos.filter(l => l.tipo === 'mora').map(l => l.valor)),
      desconto: cr.somar(lancamentos.filter(l => l.tipo === 'desconto').map(l => l.valor)),
    },
    fora: fora.map(t => ({ id: t.id, nf: t.nf, sacado: t.sacado, liquidacao: t.liquidacao, valor: cr.liquidoDoTitulo(t) })),
    divergentes: divergentes.map(f => f.data + ': diferença de ' + cr.brl(f.diferenca)),
    podeBaixar: lancamentos.length > 0 && divergentes.length === 0 && contasOk,
    arquivo: () => ({ bytes: cr.planilhaDeImportacao(lancamentos), nome: cr.nomeDoArquivo(s.empresa.codigo != null ? String(s.empresa.codigo) : null), tipo: cr.TIPO_XLS }),
    voltar: s.anterior,
  };
}
