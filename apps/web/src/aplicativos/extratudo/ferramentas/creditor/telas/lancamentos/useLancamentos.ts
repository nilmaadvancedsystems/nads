// ViewModel da etapa Lançamentos: as contas do layout, o fechamento da conta banco por dia (a última
// checagem) e o arquivo .xls de 8 colunas. Só baixa quando todos os dias batem (ou a diferença é
// exatamente o que a pessoa excluiu).
// As contas vêm do balancete da empresa (sugeridas pelo nome) ou do que foi salvo nela; trocar uma
// conta salva na empresa, e baixar o arquivo confirma as sugeridas e ensina a conta de cada cliente.
import { creditor as cr } from '@nads/core';
import { useSessao } from '../../casca/sessao';

export type CampoConta = keyof cr.ContasCreditor;

// só as contas: os históricos ficam no Contábil › Configurações, os mesmos para todas as empresas (Vitor, 05/10/2026)
export const ROTULO_CONTA: Partial<Record<CampoConta, string>> = {
  banco: 'Conta banco', juros: 'Conta de juros/mora', desconto: 'Conta de descontos',
};

const ORIGEM: Record<cr.OrigemConta, string> = { salva: 'Salva na empresa', sugerida: 'Sugerida pelo balancete', padrao: 'Padrão', falta: 'Falta escolher' };

export function useLancamentos() {
  const s = useSessao();
  const { lancamentos, fechamento, fora } = s.d;
  const { resolvidas, balancete, carregada } = s.contas;
  const divergentes = fechamento.filter(f => f.situacao === 'diverge');
  const contasOk = carregada && Object.values(resolvidas.contas).every(v => !!String(v).trim())
    && cr.CONTAS_DO_LAYOUT.every(k => !resolvidas.detalhe[k].bloqueia);

  return {
    contas: resolvidas.contas,
    rotuloConta: ROTULO_CONTA,
    /** detalhe das três contas do balancete (nome, de onde veio, aviso) */
    detalhe: Object.fromEntries(cr.CONTAS_DO_LAYOUT.map(k => {
      const d = resolvidas.detalhe[k];
      return [k, { nome: d.nome, origem: ORIGEM[d.origem], tom: d.bloqueia ? 'bad' : d.aviso ? 'warn' : d.origem === 'salva' ? 'ok' : 'neutral', aviso: d.aviso }];
    })) as Record<cr.ContaDoLayout, { nome: string | null; origem: string; tom: 'ok' | 'warn' | 'bad' | 'neutral'; aviso?: string }>,
    ehDoBalancete: (c: CampoConta) => (cr.CONTAS_DO_LAYOUT as readonly string[]).includes(c),
    /** as contas do balancete para escolher (sem as sintéticas) */
    opcoes: balancete.contas.filter(c => !c.sintetica).map(c => ({ codigo: c.codigo, nome: c.nome })),
    carregada,
    mudarConta: (c: CampoConta, v: string) => { if (v.trim() !== resolvidas.contas[c]) s.contas.escolher(c, v); },
    contaBanco: resolvidas.contas.banco,
    fechamento,
    lancamentos,
    totais: {
      qtd: lancamentos.length,
      principal: cr.somar(lancamentos.filter(l => l.tipo === 'principal').map(l => l.valor)),
      mora: cr.somar(lancamentos.filter(l => l.tipo === 'mora').map(l => l.valor)),
      desconto: cr.somar(lancamentos.filter(l => l.tipo === 'desconto').map(l => l.valor)),
    },
    fora: fora.map(t => ({ id: t.id, nf: t.nf, sacado: t.sacado, liquidacao: t.liquidacao, valor: cr.liquidoDoTitulo(t) })),
    divergentes: divergentes.map(f => f.data + ': diferença de ' + cr.reais(f.diferenca)),
    podeBaixar: lancamentos.length > 0 && divergentes.length === 0 && contasOk,
    /** baixar conclui: as contas sugeridas passam a ser salvas e os clientes conciliados são aprendidos */
    baixou: s.concluir,
    arquivo: () => ({ bytes: cr.planilhaDeImportacao(lancamentos), nome: cr.nomeDoArquivo(s.empresa.codigo != null ? String(s.empresa.codigo) : null), tipo: cr.TIPO_XLS }),
    voltar: s.anterior,
  };
}
