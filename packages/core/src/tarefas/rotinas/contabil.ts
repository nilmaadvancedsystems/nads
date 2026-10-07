// A rotina do Contábil, etapa por etapa (Vitor, 30/09/2026): a preparação (Importação, Conferência fiscal,
// Importação DP), as conferências que toda empresa tem — tiradas dos balancetes de 15 empresas (292, 309, 10, 54,
// 289, 363, 380, 393, 408, 409, 429, 450, 452, 476, 509): o que aparece em quase todas — e o fechamento. As
// conferências de cada empresa (as que só algumas têm) vêm depois, pelo balancete, no Cadastro.
// É o único lugar a mexer: a ordem, os nomes, as ferramentas, o que conferir e as objeções saem daqui.
import type { Rotina } from '../tipos';

// sem a saída "A folha ainda não saiu" (Vitor, 01/10/2026): a etapa do DP só é feita com a folha pronta
const SEM_FUNCIONARIOS = { id: 'sem-funcionarios', texto: 'A empresa não tem funcionários', solucao: { tipo: 'nao-se-aplica' as const, rotulo: 'Não tem funcionários' } };
const nao = (id: string, texto: string, rotulo = 'Não se aplica') => ({ id, texto, solucao: { tipo: 'nao-se-aplica' as const, rotulo } });

export const ROTINA_CONTABIL: Rotina = {
  departamento: 'contabil',
  etapas: [
    // ─── Preparação ───────────────────────────────────────────────────────────
    {
      // "Importação" (Vitor, 30/09/2026): importar tudo o que a empresa precisa na competência. O id continua
      // "extratos": é a chave do que já foi gravado.
      id: 'extratos',
      secao: 'Preparação',
      nome: 'Importação',
      descricao: 'Importe tudo o que a empresa precisa na competência: o extrato de cada banco e o razão da conta.',
      ferramenta: { app: 'extratudo', nome: 'Extrator', caminho: r => '/extratudo/' + r + '/extrator/tarefa/extratos', embutir: true, periodo: true, requisitos: true },
      verificacao: 'extrato-e-sistema',
      objecoes: [
        { id: 'sem-extrato', texto: 'O cliente não enviou o extrato', soMotivo: true, solucao: { tipo: 'contato', rotulo: 'Pedir extrato' } },
        { id: 'no-drive', texto: 'O extrato está no Drive do cliente', soMotivo: true, solucao: { tipo: 'drive', rotulo: 'Buscar no Drive' } },
        { id: 'sem-movimento', texto: 'A empresa não teve movimento no banco', soMotivo: true, solucao: { tipo: 'nao-se-aplica', rotulo: 'Não teve movimento' } },
        { id: 'sem-razao', texto: 'O razão da conta ainda não foi gerado no sistema', soMotivo: true, solucao: { tipo: 'orientacao', rotulo: 'Como resolver', texto: 'Gere o razão da conta do banco no Alterdata (Excel ou PDF) e importe na linha "Lançamentos contábeis".' } },
      ],
    },
    {
      // Vitor, 01/10/2026: com o extrato e o razão batendo, os dias que fecham negativos pedem o cheque especial — gerar
      // os lançamentos (a ferramenta Cheque especial), lançar no Alterdata e importar o razão de novo. A mesma página da
      // Importação, só os bancos: o avançar só aparece com todo banco Ok (o saldo final confere sem o cheque especial).
      id: 'cheque-especial',
      secao: 'Preparação',
      nome: 'Cheque especial',
      descricao: 'Os dias em que o banco fecha negativo: gere os lançamentos no Cheque especial, lance no Alterdata e importe o razão de novo.',
      ferramenta: { app: 'extratudo', nome: 'Extrator', caminho: r => '/extratudo/' + r + '/extrator/tarefa/extratos?etapa=cheque', embutir: true, periodo: true, requisitos: true },
      verificacao: 'manual',
      objecoes: [
        { id: 'cheque-nao-lancado', texto: 'O cheque especial ainda não foi lançado no Alterdata', soMotivo: true, solucao: { tipo: 'orientacao', rotulo: 'Como resolver', texto: 'Gere os lançamentos no Cheque especial, lance no Alterdata e importe o razão da conta do banco de novo.' } },
      ],
    },
    {
      id: 'fiscal',
      secao: 'Preparação',
      nome: 'Conferência fiscal',
      descricao: 'Confira se o Fiscal fechou a competência: as notas de entrada e saída batem com o balancete.',
      // a Conferência (Concilia aí) dentro da etapa, no período que a pessoa está fazendo (o mês ou os meses do Em Lote)
      ferramenta: { app: 'concilia-ai', nome: 'Conferência', caminho: r => '/' + r + '/movimento/relatorio', embutir: true, periodo: true, requisitos: true },
      verificacao: 'manual',
      // sem a saída "O Fiscal ainda não fechou as notas" (Vitor, 01/10/2026): sem o Fiscal fechado, o Contábil nem abre a empresa
      objecoes: [],
    },
    {
      id: 'dp',
      secao: 'Preparação',
      // "Contabilização da Folha" (Vitor, 01/10/2026; antes "Importação DP"; o id continua "dp"): o checklist sai do
      // balancete importado — só o que a empresa tem (core: tarefas.checklistDaFolha)
      nome: 'Contabilização da Folha',
      descricao: 'Contabilize a folha do mês, item por item, conforme o que a empresa tem no balancete.',
      ferramenta: null,
      verificacao: 'manual',
      checklistDaFolha: true,
      objecoes: [SEM_FUNCIONARIOS],
    },

    // ─── Ativo ────────────────────────────────────────────────────────────────
    {
      id: 'caixa',
      secao: 'Ativo',
      nome: 'Caixa',
      descricao: 'O caixa nunca fica credor.',
      ferramenta: null,
      verificacao: 'manual',
      // o botão de importar o razão do caixa (Vitor, 05/10/2026)
      razao: { conta: 'caixa' },
      conferir: [
        'O saldo do caixa é devedor (ou zero) no fim do mês e em nenhum dia fica credor.',
        'Caixa credor: procure pagamentos lançados no caixa que saíram pelo banco e vendas à vista que faltam.',
        'O saldo está de acordo com o tamanho da empresa (caixa alto demais também é sinal de lançamento errado).',
      ],
      objecoes: [
        { id: 'caixa-credor', texto: 'O caixa ficou credor e não achei o motivo', solucao: { tipo: 'orientacao', rotulo: 'Como resolver', texto: 'Interrompa com esta objeção: a competência aparece para os sêniores revisarem.' } },
        nao('sem-caixa', 'A empresa não usa caixa'),
      ],
    },
    {
      // o caixa recebeu liquidação de cobrança do banco (CRÉD.LIQ.COBRANÇA): o Creditor é obrigatório no mês (Vitor,
      // 05/10/2026). A etapa só entra quando o razão do caixa importado tem isso.
      id: 'creditor',
      secao: 'Ativo',
      nome: 'Creditor',
      descricao: 'As liquidações de cobrança que caíram no caixa conciliadas com o relatório do banco.',
      ferramenta: { app: 'extratudo', nome: 'Creditor', caminho: r => '/extratudo/' + r + '/creditor/competencia', embutir: true, requisitos: true },
      verificacao: 'manual',
      soQuandoAdicionada: true,
      conferir: ['O razão do caixa tem CRÉD.LIQ.COBRANÇA: concilie as liquidações com o relatório do banco e importe no sistema.'],
      objecoes: [
        { id: 'sem-relatorio', texto: 'O relatório de liquidação não chegou', solucao: { tipo: 'contato', rotulo: 'Pedir o relatório ao cliente' } },
      ],
    },
    {
      id: 'bancos',
      secao: 'Ativo',
      nome: 'Bancos',
      descricao: 'O saldo de cada banco é o do extrato no último dia; banco negativo vai para o cheque especial.',
      // só o relatório do que passou pelos bancos no período (Vitor, 06/10/2026): a pessoa vê os saldos e dá Próximo
      ferramenta: null,
      tela: { id: 'bancos', periodo: true },
      verificacao: 'manual',
      conferir: [
        'O saldo contábil de cada banco é igual ao saldo do extrato no último dia do mês.',
        'Banco com saldo credor: gere o ajuste do cheque especial (saldo negativo).',
      ],
      objecoes: [
        { id: 'saldo-diferente', texto: 'O saldo não bate com o extrato', solucao: { tipo: 'orientacao', rotulo: 'Como resolver', texto: 'Volte na Importação e confira extrato × razão do banco: o lançamento que falta ou sobra aparece lá.' } },
        { id: 'sem-saldo-diario', texto: 'Não tenho o relatório de saldo diário', solucao: { tipo: 'orientacao', rotulo: 'Como resolver', texto: 'Tire o relatório de saldo diário da conta no Alterdata e importe na ferramenta.' } },
        nao('sem-negativo', 'Nenhum banco ficou negativo', 'Nenhum banco negativo'),
      ],
    },
    {
      id: 'clientes',
      secao: 'Ativo',
      nome: 'Clientes',
      descricao: 'Nenhum cliente com saldo credor; os recebimentos do mês baixados.',
      // a ferramenta Clientes (Vitor, 06/10/2026): o balancete e o dinâmico, o saldo credor, a situação de cada cliente e o envio
      ferramenta: null,
      tela: { id: 'clientes', periodo: true },
      verificacao: 'manual',
      conferir: [
        'Nenhum cliente com saldo credor (recebeu mais do que vendeu: recebimento sem a nota, ou baixa em duplicidade).',
        'As liquidações do banco (títulos recebidos) estão baixadas nos clientes.',
      ],
      objecoes: [
        { id: 'sem-relatorio', texto: 'O relatório de liquidação não chegou', solucao: { tipo: 'contato', rotulo: 'Pedir o relatório ao cliente' } },
        nao('sem-clientes', 'A empresa não vende a prazo'),
      ],
    },
    {
      id: 'adiantamento-fornecedores',
      secao: 'Ativo',
      nome: 'Adiantamento a fornecedores',
      descricao: 'Os adiantamentos baixados quando a nota do fornecedor chega.',
      ferramenta: null,
      // o razão da conta, mês a mês: credor trava o Próximo (Vitor, 07/10/2026: "ou ele fica devedor ou zera")
      tela: { id: 'adiantamento-fornecedores', periodo: true },
      verificacao: 'manual',
      conferir: [
        'Nenhum adiantamento com saldo credor.',
        'A nota do fornecedor chegou: baixe o adiantamento contra o fornecedor.',
        'Adiantamento antigo parado: confirme com o cliente se a mercadoria ou o serviço veio.',
      ],
      objecoes: [nao('sem-adiantamento', 'A empresa não teve adiantamento a fornecedor')],
    },
    {
      // só na competência 12 (Vitor, 07/10/2026): fora dela a etapa nem aparece; nela, dois checks em ordem — o cliente
      // enviou o estoque e o estoque foi lançado
      id: 'estoque',
      secao: 'Ativo',
      nome: 'Estoque',
      descricao: 'O inventário do fim do ano: o cliente envia o estoque e ele é lançado.',
      ferramenta: null,
      verificacao: 'manual',
      meses: [12],
      checklist: [
        { id: 'estoque-enviado', texto: 'Estoque enviado', sub: ['O cliente mandou o inventário de 31/12'] },
        { id: 'estoque-lancado', texto: 'Estoque lançado', sub: ['O estoque final lançado no Alterdata'] },
      ],
      objecoes: [
        { id: 'sem-inventario', texto: 'O cliente não mandou o inventário', solucao: { tipo: 'contato', rotulo: 'Pedir o inventário' } },
        nao('sem-estoque', 'A empresa não tem estoque'),
      ],
    },
    {
      id: 'bens',
      secao: 'Ativo',
      nome: 'Bens',
      descricao: 'As compras e vendas de bens do período lançadas no imobilizado.',
      // a tela Bens (Vitor, 07/10/2026): as notas de entrada 1551/2551 e os CFOPs ligados a bem, as saídas que baixam bem e
      // o uso e consumo com item de bem, das notas importadas na Conferência, no período da tarefa
      ferramenta: null,
      tela: { id: 'bens', periodo: true },
      verificacao: 'manual',
      conferir: [
        'Nota de compra de veículo, máquina, equipamento, móvel ou computador: lançada no imobilizado, não na despesa.',
        'Venda ou baixa de bem: o bem e a depreciação dele saem juntos.',
      ],
      objecoes: [nao('sem-bens', 'A empresa não tem bens')],
    },
    // a etapa Depreciação saiu por enquanto (Vitor, 07/10/2026: "remova essa função de depreciação por enquanto"). Para
    // voltar: id 'depreciacao', secao 'Ativo', depois de Bens — o histórico do git tem o texto dela.

    // ─── Passivo ──────────────────────────────────────────────────────────────
    {
      id: 'fornecedores',
      secao: 'Passivo',
      nome: 'Fornecedores',
      descricao: 'Nenhum fornecedor com saldo devedor; as notas de entrada e os pagamentos do mês lançados.',
      ferramenta: null,
      // a mesma tela do Clientes, com o fornecedor devedor no lugar do cliente credor (Vitor, 07/10/2026)
      tela: { id: 'fornecedores', periodo: true },
      verificacao: 'manual',
      conferir: [
        'Nenhum fornecedor com saldo devedor (pagou mais do que comprou: pagamento sem a nota, ou nota que faltou entrar).',
        'Os pagamentos do extrato estão baixados no fornecedor certo.',
      ],
      objecoes: [nao('sem-fornecedores', 'A empresa não compra a prazo')],
    },
    {
      // o cartão de crédito empresarial (Vitor, 07/10/2026): a fatura quebrada no razão do cartão, uma linha por compra
      // (D Cartão de Crédito / C Banco) no dia em que o banco pagou. Só entra na empresa com "Cartão empresarial: Sim" no
      // Cadastro (a Tarefa põe a etapa nos meses do período).
      id: 'cartoes',
      secao: 'Passivo',
      nome: 'Cartões',
      descricao: 'A fatura do cartão empresarial quebrada no razão do cartão, no dia do pagamento.',
      ferramenta: { app: 'extratudo', nome: 'Cartões', caminho: r => '/extratudo/' + r + '/cartoes/compras/fatura', embutir: true, requisitos: true },
      verificacao: 'manual',
      soQuandoAdicionada: true,
      conferir: ['Cada compra da fatura no razão do cartão, no dia em que o banco pagou; a soma igual ao total da fatura.'],
      objecoes: [
        { id: 'sem-fatura', texto: 'A fatura do cartão não chegou', solucao: { tipo: 'contato', rotulo: 'Pedir a fatura ao cliente' } },
        nao('sem-compras-cartao', 'Não teve compra no cartão no mês', 'Sem fatura no mês'),
      ],
    },
    {
      id: 'adiantamento-clientes',
      secao: 'Passivo',
      nome: 'Adiantamento de clientes',
      descricao: 'Os adiantamentos baixados quando a nota de venda sai.',
      ferramenta: null,
      // a tela do Adiantamento a fornecedores ao contrário (Vitor, 07/10/2026): fica credor ou zera; mês devedor trava o Próximo
      tela: { id: 'adiantamento-clientes', periodo: true },
      verificacao: 'manual',
      conferir: [
        'Nenhum adiantamento de cliente com saldo devedor.',
        'A nota de venda saiu: baixe o adiantamento contra o cliente.',
      ],
      objecoes: [nao('sem-adiantamento-clientes', 'A empresa não recebeu adiantamento de cliente')],
    },
    {
      id: 'emprestimos',
      secao: 'Passivo',
      nome: 'Empréstimos e financiamentos',
      descricao: 'O saldo de cada contrato igual ao do banco: parcela paga, juros e saldo devedor.',
      ferramenta: null,
      // o razão de cada empréstimo com o banco dele, mês a mês (Vitor, 07/10/2026)
      tela: { id: 'emprestimos', periodo: true },
      verificacao: 'manual',
      conferir: [
        'Cada empréstimo tem saldo credor igual ao saldo devedor do contrato no banco.',
        'A parcela do mês está lançada: o principal baixa o empréstimo e os juros vão para a despesa financeira.',
        'Cartão de crédito a pagar: a fatura do mês lançada e a paga baixada.',
      ],
      objecoes: [
        { id: 'sem-extrato-contrato', texto: 'Não tenho o extrato do empréstimo', solucao: { tipo: 'contato', rotulo: 'Pedir o extrato do empréstimo' } },
        nao('sem-emprestimos', 'A empresa não tem empréstimo'),
      ],
    },
    {
      id: 'folha',
      secao: 'Passivo',
      nome: 'Salários, INSS e FGTS',
      descricao: 'A folha paga e as guias do mês: salários a pagar zerados, INSS e FGTS iguais às guias.',
      ferramenta: null,
      verificacao: 'manual',
      // o razão do INSS a recolher × o PDF das guias: o que falta provisionar e baixar (Vitor, 05/10/2026); com Salários a
      // pagar e FGTS a recolher (um razão cada), na tela própria: mês devedor trava o Próximo (Vitor, 07/10/2026)
      tela: { id: 'salarios', periodo: true },
      conferir: [
        'Salários a pagar: a folha do mês entra e o pagamento zera; nenhum saldo devedor.',
        'INSS a recolher e FGTS a recolher iguais às guias do mês; a guia paga zera o saldo.',
        'Férias, 13º e rescisões pagos baixados (e a multa do FGTS na GRRF).',
      ],
      objecoes: [SEM_FUNCIONARIOS],
    },
    {
      id: 'pro-labore',
      secao: 'Passivo',
      nome: 'Pró-labore',
      descricao: 'O pró-labore a pagar recebe a despesa do mês e zera no pagamento.',
      ferramenta: null,
      verificacao: 'manual',
      conferir: [
        'O crédito do mês no pró-labore a pagar é igual à despesa de pró-labore.',
        'O pagamento zera o saldo; nenhum saldo devedor.',
      ],
      objecoes: [nao('sem-pro-labore', 'A empresa não paga pró-labore')],
    },
    {
      id: 'honorarios',
      secao: 'Passivo',
      nome: 'Honorários',
      descricao: 'O honorário a pagar recebe a despesa do mês e zera no pagamento.',
      ferramenta: null,
      verificacao: 'manual',
      conferir: [
        'O crédito do mês em honorários a pagar é igual à despesa de honorários contábeis.',
        'O pagamento zera o saldo; nenhum saldo devedor.',
      ],
      objecoes: [
        { id: 'honorario-diferente', texto: 'A despesa e o a pagar não batem', solucao: { tipo: 'orientacao', rotulo: 'Como resolver', texto: 'Lance a provisão do honorário do mês (despesa × honorários a pagar) e baixe o pagamento contra o a pagar, não contra a despesa.' } },
      ],
    },
    {
      id: 'impostos',
      secao: 'Passivo',
      nome: 'Impostos a recolher',
      descricao: 'O imposto do mês (Simples ou ICMS) igual à guia; a guia paga zera o saldo.',
      ferramenta: null,
      verificacao: 'manual',
      conferir: [
        'Simples Nacional a recolher: o crédito do mês é igual à despesa (ou à dedução da receita) e à guia do DAS.',
        'ICMS a recolher: o crédito do mês é igual à dedução "(-) ICMS" da receita.',
        'A guia paga zera o saldo; nenhum imposto a recolher devedor.',
      ],
      objecoes: [
        { id: 'sem-guia', texto: 'Não tenho a guia do mês', solucao: { tipo: 'orientacao', rotulo: 'Como resolver', texto: 'A guia sai do Fiscal. Interrompa e retome quando o Fiscal liberar a competência.' } },
      ],
    },

    // ─── Resultado ────────────────────────────────────────────────────────────
    {
      id: 'despesas',
      secao: 'Resultado',
      nome: 'Despesas',
      descricao: 'Todas as despesas e custos devedores.',
      ferramenta: null,
      verificacao: 'manual',
      conferir: [
        'Nenhuma despesa ou custo com saldo credor, menos as redutoras "(-)" (devoluções de compra, por exemplo).',
        'Despesa credora: lançamento invertido, ou estorno lançado na conta errada.',
        'Nota de compra de bem lançada como despesa: passe para o imobilizado.',
      ],
      objecoes: [
        { id: 'despesa-credora', texto: 'Tem despesa credora e não achei o motivo', solucao: { tipo: 'orientacao', rotulo: 'Como resolver', texto: 'Interrompa com esta objeção: a competência aparece para os sêniores revisarem.' } },
      ],
    },
    {
      id: 'receitas',
      secao: 'Resultado',
      nome: 'Receitas',
      descricao: 'Todas as receitas credoras; as vendas em cartão conciliadas com as notas.',
      ferramenta: { app: 'conciliadorzinho', nome: 'Conciliadorzinho', caminho: r => '/conciliadorzinho/' + r + '/conciliacao/bandeiras', embutir: true },
      verificacao: 'manual',
      conferir: [
        'Nenhuma receita com saldo devedor, menos as deduções "(-)" (impostos sobre a venda, devoluções).',
        'Vende em cartão: as vendas das bandeiras conciliadas com as notas.',
      ],
      objecoes: [
        { id: 'receita-devedora', texto: 'Tem receita devedora e não achei o motivo', solucao: { tipo: 'orientacao', rotulo: 'Como resolver', texto: 'Interrompa com esta objeção: a competência aparece para os sêniores revisarem.' } },
        { id: 'sem-extrato-cartao', texto: 'O extrato da operadora não chegou', soMotivo: true, solucao: { tipo: 'contato', rotulo: 'Pedir o extrato da operadora' } },
      ],
    },

    // ─── Fechamento ───────────────────────────────────────────────────────────
    {
      id: 'fechamento',
      secao: 'Fechamento',
      nome: 'Fechar a competência',
      descricao: 'Revise os saldos e feche a competência no sistema.',
      ferramenta: null,
      verificacao: 'manual',
      conferir: [
        'O balancete fecha: ativo = passivo + patrimônio líquido + resultado.',
        'Todas as conferências acima feitas (ou com o motivo de não se aplicar).',
        'Feche a competência no Alterdata.',
      ],
      objecoes: [
        { id: 'revisao', texto: 'Precisa de revisão de um sênior', solucao: { tipo: 'orientacao', rotulo: 'Como resolver', texto: 'Interrompa com esta objeção: a competência aparece para os sêniores revisarem.' } },
      ],
    },
  ],
};
