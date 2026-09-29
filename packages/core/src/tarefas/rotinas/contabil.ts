// A rotina do Contábil, etapa por etapa. RASCUNHO para o Vitor corrigir (2026-09-29): a ordem, os
// nomes, as ferramentas e as objeções saem daqui — é o único lugar a mexer.
import type { Rotina } from '../tipos';

export const ROTINA_CONTABIL: Rotina = {
  departamento: 'contabil',
  etapas: [
    {
      // importar e conferir na mesma tela (pedido do Vitor, 29/09/2026): era uma etapa para cada
      id: 'extratos',
      nome: 'Importar e conferir os extratos',
      descricao: 'Importe o extrato do banco e o razão da conta e confira o que falta, está diferente ou duplicado.',
      ferramenta: { app: 'extratudo', nome: 'Extrator', caminho: r => '/extratudo/' + r + '/extrator/tarefa/extratos', embutir: true },
      verificacao: 'extrato-e-sistema',
      objecoes: [
        { id: 'sem-extrato', texto: 'O cliente não enviou o extrato', solucao: { tipo: 'contato', rotulo: 'Pedir extrato' } },
        { id: 'no-drive', texto: 'O extrato está no Drive do cliente', solucao: { tipo: 'drive', rotulo: 'Buscar no Drive' } },
        { id: 'sem-movimento', texto: 'A empresa não teve movimento no banco', solucao: { tipo: 'nao-se-aplica', rotulo: 'Não teve movimento' } },
        { id: 'sem-razao', texto: 'O razão da conta ainda não foi gerado no sistema', soMotivo: true, solucao: { tipo: 'orientacao', rotulo: 'Como resolver', texto: 'Gere o razão da conta do banco no Alterdata (Excel ou PDF) e importe na linha "Lançamentos contábeis".' } },
        { id: 'diferenca', texto: 'Diferença que não sei explicar', soMotivo: true, solucao: { tipo: 'orientacao', rotulo: 'Como resolver', texto: 'Anote a linha da conferência e peça ajuda a um sênior antes de seguir.' } },
      ],
    },
    {
      id: 'cheque-especial',
      nome: 'Ajustar o cheque especial',
      descricao: 'Gere os lançamentos de ajuste do saldo negativo.',
      ferramenta: { app: 'extratudo', nome: 'Cheque especial', caminho: r => '/extratudo/' + r + '/cheque-especial/ajuste/saldo-negativo', embutir: true },
      verificacao: 'manual',
      objecoes: [
        { id: 'sem-negativo', texto: 'A conta não ficou negativa', solucao: { tipo: 'nao-se-aplica', rotulo: 'Não se aplica nesta competência' } },
        { id: 'sem-saldo-diario', texto: 'Não tenho o relatório de saldo diário', solucao: { tipo: 'orientacao', rotulo: 'Como resolver', texto: 'Tire o relatório de saldo diário da conta no Alterdata e importe na ferramenta.' } },
      ],
    },
    {
      id: 'cartoes',
      nome: 'Conciliar os cartões',
      descricao: 'Concilie as vendas em cartão com as notas fiscais.',
      ferramenta: { app: 'conciliadorzinho', nome: 'Conciliadorzinho', caminho: r => '/conciliadorzinho/' + r + '/conciliacao/bandeiras', embutir: true },
      verificacao: 'manual',
      objecoes: [
        { id: 'sem-cartao', texto: 'A empresa não vende em cartão', solucao: { tipo: 'nao-se-aplica', rotulo: 'Não se aplica' } },
        { id: 'sem-extrato-cartao', texto: 'O extrato da operadora não chegou', solucao: { tipo: 'contato', rotulo: 'Pedir o extrato da operadora' } },
      ],
    },
    {
      id: 'liquidacoes',
      nome: 'Liquidações de títulos',
      descricao: 'Concilie o relatório de liquidação do banco com o sistema.',
      ferramenta: { app: 'extratudo', nome: 'Creditor', caminho: r => '/extratudo/' + r + '/creditor/banco', embutir: true },
      verificacao: 'manual',
      objecoes: [
        { id: 'sem-titulos', texto: 'A empresa não tem cobrança no banco', solucao: { tipo: 'nao-se-aplica', rotulo: 'Não se aplica' } },
        { id: 'sem-relatorio', texto: 'O relatório de liquidação não chegou', solucao: { tipo: 'contato', rotulo: 'Pedir o relatório ao cliente' } },
      ],
    },
    {
      id: 'balancete',
      nome: 'Conferir o balancete',
      descricao: 'Confira o balancete com as notas na Conferência.',
      ferramenta: { app: 'concilia-ai', nome: 'Conferência', caminho: r => '/conferencia/' + r, embutir: false },
      verificacao: 'manual',
      objecoes: [
        { id: 'fiscal-pendente', texto: 'O Fiscal ainda não fechou as notas', solucao: { tipo: 'orientacao', rotulo: 'Como resolver', texto: 'A etapa depende do Fiscal. Interrompa e retome quando o Fiscal liberar a competência.' } },
        { id: 'dp-pendente', texto: 'A folha (Departamento Pessoal) ainda não saiu', solucao: { tipo: 'orientacao', rotulo: 'Como resolver', texto: 'A etapa depende do Departamento Pessoal. Interrompa e retome quando a folha for liberada.' } },
      ],
    },
    {
      id: 'fechamento',
      nome: 'Fechar a competência',
      descricao: 'Revise os saldos e feche a competência no sistema.',
      ferramenta: null,
      verificacao: 'manual',
      objecoes: [
        { id: 'revisao', texto: 'Precisa de revisão de um sênior', solucao: { tipo: 'orientacao', rotulo: 'Como resolver', texto: 'Interrompa com esta objeção: a competência aparece para os sêniores revisarem.' } },
      ],
    },
  ],
};
