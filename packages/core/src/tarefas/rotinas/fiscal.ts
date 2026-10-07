// A rotina do Fiscal, etapa por etapa (Vitor, 05/10/2026: "pegue o mesmo modelo do contábil; no meu Notion
// Fiscal/Heverton/Tarefas/[N°] - NOME, MM/AAAA, cada etapa e quais são as tarefas"). Do Notion (Alterdata › MM/AAAA):
//   Importação de Notas — Inicial (SIEG, recebimento de saídas) e a importação no Alterdata;
//   Conferência — Saídas, Entradas e Retenções;
//   Apuração — Simples Nacional (as outras apurações do Notion — ICMS, ISS, PIS/COFINS… — entram quando tiverem a página);
//   Envio — o "Enviado" do fim.
// Pelo regime (06/10/2026): o Simples só no Simples; ICMS, ISS, PIS/COFINS, IRPJ/CSLL (trimestral) e as obrigações
// (EFD ICMS/IPI, EFD-Contribuições, REINF e DCTFWeb) só no Presumido e no Real — Etapa.regimes e Etapa.meses.
// Processos do Departamento Fiscal (o documento do mapa de processos, 06/10/2026): ICMS das entradas (ROT-09), DAS-MEI,
// DAPI, MIT, a declaração municipal, as certidões do trimestre, as anuais (DEFIS, DASN-SIMEI, ECD, ECF) e o fechamento.
// A folha (eSocial, DCTFWeb e REINF da folha, FGTS) é da rotina do DP.
// Cada etapa é um checklist em ordem (como a Contabilização da Folha): só o próximo liberado; o avançar com tudo marcado.
// É o único lugar a mexer: a ordem, os nomes e as tarefas saem daqui.
import type { Etapa, ItemDoChecklist, Rotina } from '../tipos';

const item = (id: string, texto: string, mais: Omit<ItemDoChecklist, 'id' | 'texto'> = {}): ItemDoChecklist => ({ id, texto, ...mais });
const etapa = (id: string, secao: string, nome: string, descricao: string, checklist: ItemDoChecklist[], mais: Partial<Etapa> = {}): Etapa => ({
  id, secao, nome, descricao, ferramenta: null, verificacao: 'manual', objecoes: [], checklist, ...mais,
});

export const ROTINA_FISCAL: Rotina = {
  departamento: 'fiscal',
  etapas: [
    // ─── Relatório inicial (Vitor, 07/10/2026: "faça uma aba de relatório no final e no início") ─────────────
    etapa('fiscal-relatorio-inicio', 'Relatório inicial', 'Relatório', 'O mês antes de começar: o regime, as etapas que entram, o SIEG e o que já foi importado.', [
      item('relatorio-inicio', 'Conferi o relatório do início', { painel: 'relatorio-inicio' }),
    ]),
    // ─── Importação de Notas ──────────────────────────────────────────────────
    etapa('fiscal-inicial', 'Importação de Notas', 'Inicial', 'Baixe as notas do mês no SIEG e receba as saídas.', [
      item('sieg', 'Download SIEG', { link: { rotulo: 'SIEG - Login', url: 'https://auth.sieg.com/login' }, painel: 'sieg' }),
      item('recebimento-saidas', 'Recebimento de Saídas', { painel: 'recebimento', importar: ['saidas'] }),
    ], { sieg: 'contagem' }),
    // a Importação do Contábil, só as abas das notas (Vitor, 06/10/2026: "a pessoa do fiscal vai importar as notas com a
    // conta contábil e vlr contábil … e já vai ser considerado para os apps do contábil"): o relatório de cada tipo vai para
    // a Conferência da empresa (a mesma do Concilia aí e do Creditor), com o Valor contábil, o Lanç. e a Conta contábil.
    // O CT-e vem no relatório de Entradas.
    etapa('fiscal-importacao', 'Importação de Notas', 'Importação no Alterdata', 'Importe os relatórios de notas do Alterdata (com a conta contábil): Entradas, Saídas, Tomados e Prestados.', [], {
      checklist: undefined,
      ferramenta: { app: 'extratudo', nome: 'Importação', caminho: r => '/extratudo/' + r + '/extrator/tarefa/extratos?etapa=fiscal', embutir: true, periodo: true, requisitos: true },
    }),
    // ─── Conferência ──────────────────────────────────────────────────────────
    etapa('fiscal-conf-saidas', 'Conferência', 'Saídas', 'Confira a sequência e as notas de saída.', [
      item('sequencia-saidas', 'Sequência de Saídas', { painel: 'sequencia' }),
      item('conferencia-nfs', 'Conferência das Notas Fiscais', { aviso: 'Se atentar caso os produtos sejam Monofásico, ST, Imune ou Isento. Observar cancelamentos.', painel: 'saidas', importar: ['saidas'] }),
    ], { sieg: 'saidas' }),
    etapa('fiscal-conf-entradas', 'Conferência', 'Entradas', 'Confira o faturamento, a tributação e o SINTEGRA.', [
      item('faturamento-x-emitidas', 'Conferência de Faturamento x Notas Emitidas', { painel: 'faturamento', importar: ['saidas'] }),
      item('tributacao-entradas', 'Tributação das Entradas', { painel: 'entradas', importar: ['entradas'] }),
      item('entradas-x-sintegra', 'Entradas x SINTEGRA', { painel: 'entradas-sieg', importar: ['entradas'] }),
      // Processos do Fiscal (06/10/2026), DOC-04: confirmar ou desconhecer as notas recebidas
      item('manifestacao', 'Manifestação do destinatário', { aviso: 'Confirme ou desconheça as notas recebidas: não manifestar pode gerar crédito indevido de ICMS.' }),
    ]),
    etapa('fiscal-retencoes', 'Conferência', 'Retenções', 'Confira as retenções do mês.', [
      // os serviços das notas, com NBS, descrição, valor e o que cada uma retém (Vitor, 07/10/2026)
      item('servicos-retencoes', 'Serviços das notas e retenções', { painel: 'servicos', importar: ['tomados', 'prestados'] }),
      item('iss-retido', 'ISS retido', { painel: 'iss-retido', importar: ['tomados', 'prestados'] }),
      item('inss-retido', 'INSS retido', { painel: 'inss-retido', importar: ['tomados', 'prestados'] }),
      item('outras-retencoes', 'IRRF e PIS/COFINS/CSLL retidos'),
      item('retencoes-destino', 'Compensar ou recolher e informar na EFD-REINF/DCTFWeb', { aviso: 'Retenção indevida gera crédito (PER/DCOMP); falta de informação gera multa.' }),
    ]),
    // ─── Apuração ─────────────────────────────────────────────────────────────
    etapa('fiscal-simples', 'Apuração', 'Simples Nacional', 'Apure o Simples Nacional e gere o DAS (vence dia 20). ISS retido abate o DAS.', [
      item('receitas', 'Coletar receitas do mês', { painel: 'receitas', importar: ['saidas', 'prestados'] }),
      item('base-calculo', 'Conferir composição da base de cálculo', { sub: ['Monofásico', 'ST', 'Retidos'], painel: 'base' }),
      item('pgdas', 'Transmitir PGDAS-D', { sub: ['Anexo e atividade', 'Receita bruta dos últimos 12 meses (RBT12)'] }),
      item('das', 'Gerar DAS'),
      item('recibo', 'Baixar recibo, extrato e declaração'),
    ], { regimes: ['Simples'] }),
    // ─── Apuração do Presumido e do Real (Vitor, 06/10/2026: "continue fazendo as coisas do fiscal") ──────────
    // Rascunho para o Heverton ajustar (o Notion dele só tinha o Simples): cada uma só para Presumido e Real (no Simples e
    // nos outros regimes, "não se aplica"); o IRPJ/CSLL só no mês que fecha o trimestre.
    etapa('fiscal-icms', 'Apuração', 'ICMS', 'Apure o ICMS próprio do mês, transmita a DAPI e gere a guia (dia 9).', [
      item('icms-apuracao', 'Apurar o ICMS próprio', { sub: ['Débitos das saídas', 'Créditos das entradas', 'Saldo credor anterior'], painel: 'icms', importar: ['saidas', 'entradas'] }),
      item('icms-dapi', 'Transmitir a DAPI (SEF/MG)'),
      item('icms-guia', 'Gerar a guia do ICMS'),
    ], { regimes: ['Presumido', 'Real'] }),
    etapa('fiscal-iss', 'Apuração', 'ISS', 'Apure o ISS dos serviços prestados e entregue a declaração do município.', [
      item('iss-apuracao', 'Apurar o ISS próprio', { painel: 'prestados', importar: ['prestados'] }),
      item('iss-declaracao', 'Entregar a declaração de serviços do município'),
      item('iss-guia', 'Gerar a guia do ISS'),
    ], { regimes: ['Presumido', 'Real'] }),
    etapa('fiscal-piscofins', 'Apuração', 'PIS/COFINS', 'Apure o PIS e a COFINS do mês e gere o DARF.', [
      item('pc-base', 'Conferir a base (receitas, monofásicos e isentos)', { aviso: 'No Presumido é cumulativo (sem créditos); no Real, não cumulativo (com os créditos das entradas).', painel: 'base', importar: ['saidas', 'prestados'] }),
      item('pc-apuracao', 'Apurar PIS e COFINS'),
      item('pc-darf', 'Gerar os DARFs'),
    ], { regimes: ['Presumido', 'Real'] }),
    etapa('fiscal-irpj-csll', 'Apuração', 'IRPJ/CSLL', 'Apure o IRPJ e a CSLL do trimestre e gere os DARFs.', [
      item('ir-receita', 'Somar a receita do trimestre', { painel: 'irpj', importar: ['saidas', 'prestados'] }),
      item('ir-apuracao', 'Apurar IRPJ (com adicional) e CSLL'),
      item('ir-darf', 'Gerar os DARFs (cota única ou parcelas)'),
    ], { regimes: ['Presumido', 'Real'], meses: [3, 6, 9, 12] }),
    // ─── ICMS das entradas e DAS-MEI (Processos do Fiscal, 06/10/2026: ROT-09 e ROT-02) ─────────────────────────
    etapa('fiscal-icms-entradas', 'Apuração', 'ICMS das entradas', 'Antecipação, ST e DIFAL das notas interestaduais recebidas (até o último dia do mês seguinte).', [
      item('icms-interestaduais', 'Identificar as entradas interestaduais que pedem Antecipação, ST ou DIFAL', { painel: 'interestaduais', importar: ['entradas'], aviso: 'Nota que já teve ICMS-ST só entra se o responsável não recolheu: consulte o cliente.' }),
      item('icms-calculo', 'Calcular: ST no SIARE (SEFAZ-MG); Antecipação e DIFAL no Alterdata'),
      item('icms-dae', 'Gerar o DAE e arquivar na pasta do cliente'),
    ], { regimes: ['Simples', 'Presumido', 'Real'] }),
    etapa('fiscal-mei', 'Apuração', 'DAS-MEI', 'Gere o DAS-MEI do mês (vence dia 20).', [
      item('mei-limite', 'Conferir o faturamento (limite de R$ 81 mil no ano)', { aviso: 'Passou do teto: o MEI precisa ser desenquadrado.' }),
      item('mei-das', 'Gerar o DAS-MEI'),
      item('mei-comprovante', 'Baixar o comprovante'),
    ], { regimes: ['MEI'] }),
    // ─── Obrigações ───────────────────────────────────────────────────────────
    etapa('fiscal-efd-icms', 'Obrigações', 'EFD ICMS/IPI', 'Gere, valide e transmita a EFD ICMS/IPI do mês.', [
      item('efd-gerar', 'Gerar o arquivo no Alterdata'),
      item('efd-validar', 'Validar no PVA'),
      item('efd-transmitir', 'Transmitir e baixar o recibo'),
    ], { regimes: ['Presumido', 'Real'] }),
    etapa('fiscal-efd-contrib', 'Obrigações', 'EFD-Contribuições', 'Gere, valide e transmita a EFD-Contribuições do mês.', [
      item('contrib-gerar', 'Gerar o arquivo no Alterdata'),
      item('contrib-validar', 'Validar no PVA'),
      item('contrib-transmitir', 'Transmitir e baixar o recibo'),
    ], { regimes: ['Presumido', 'Real'] }),
    etapa('fiscal-reinf-dctfweb', 'Obrigações', 'EFD-REINF e DCTFWeb', 'Transmita a REINF (retenções) e feche a DCTFWeb do mês.', [
      item('reinf', 'Transmitir a EFD-REINF', { link: { rotulo: 'Abrir a REINF', url: '/tarefas/fiscal/reinf' } }),
      item('dctfweb', 'Transmitir a DCTFWeb e gerar o DARF'),
      item('mit', 'Transmitir a MIT (apuração dos tributos federais)'),
    ], { regimes: ['Presumido', 'Real'] }),
    // OBA-10: a declaração municipal de serviços (no Presumido e no Real ela está no ISS)
    etapa('fiscal-declaracao-municipal', 'Obrigações', 'Declaração municipal', 'Declare ao município os serviços prestados e tomados do mês.', [
      item('dms', 'Transmitir a declaração de serviços', { aviso: 'Só se a empresa prestou ou tomou serviços no mês; a regra varia por município.', painel: 'prestados', importar: ['prestados', 'tomados'] }),
    ], { regimes: ['Simples'] }),
    // ─── Regularidade (CER-01 a CER-05): as certidões no fim de cada trimestre ───
    etapa('fiscal-certidoes', 'Regularidade', 'Certidões', 'Confira a regularidade da empresa (no fim de cada trimestre).', [
      item('cnd-federal', 'CND Federal (RFB/PGFN)', { aviso: 'DAS, DCTFWeb ou DCTF pendentes bloqueiam a certidão.' }),
      item('cnd-estadual', 'CND Estadual (SEFAZ-MG)'),
      item('cnd-municipal', 'CND Municipal'),
      item('cnd-avisar', 'Avisar o cliente das pendências e regularizar'),
    ], { regimes: ['Simples', 'Presumido', 'Real', 'MEI'], meses: [3, 6, 9, 12] }),
    // ─── Anuais (OBA-03, 04, 08, 09): na competência trabalhada antes do prazo ───
    etapa('fiscal-defis', 'Anuais', 'DEFIS', 'A declaração anual do Simples (prazo 31/03): entra na competência de fevereiro.', [
      item('defis-receitas', 'Consolidar as receitas do ano'),
      item('defis-transmitir', 'Preencher e transmitir a DEFIS'),
    ], { regimes: ['Simples'], meses: [2] }),
    etapa('fiscal-dasn-simei', 'Anuais', 'DASN-SIMEI', 'A declaração anual do MEI (prazo 31/05): entra na competência de abril.', [
      item('dasn-receitas', 'Consolidar as receitas do ano', { aviso: 'MEI inativo também declara; a omissão cancela o CNPJ.' }),
      item('dasn-transmitir', 'Preencher e transmitir a DASN-SIMEI'),
    ], { regimes: ['MEI'], meses: [4] }),
    etapa('fiscal-ecd', 'Anuais', 'ECD', 'A escrituração contábil do ano (prazo: último dia útil de maio): entra na competência de abril.', [
      item('ecd-gerar', 'Gerar a partir da contabilidade e validar'),
      item('ecd-transmitir', 'Assinar e transmitir'),
    ], { regimes: ['Presumido', 'Real'], meses: [4] }),
    etapa('fiscal-ecf', 'Anuais', 'ECF', 'A apuração anual do IRPJ/CSLL (prazo: último dia útil de julho): entra na competência de junho.', [
      item('ecf-gerar', 'Gerar a partir da contabilidade e validar'),
      item('ecf-transmitir', 'Assinar e transmitir'),
    ], { regimes: ['Presumido', 'Real'], meses: [6] }),
    // ─── Envio ────────────────────────────────────────────────────────────────
    // ROT-10 e GES-03: o fechamento do mês
    etapa('fiscal-envio', 'Envio', 'Fechamento e envio', 'Feche o mês: confira as pendências, envie as guias e arquive os comprovantes.', [
      item('pendencias', 'Conferir o mês: guias, declarações e pendências'),
      item('guias-cliente', 'Enviar as guias ao cliente (DAS, DAE, ISS, DARF)'),
      item('arquivar', 'Arquivar guias, recibos e declarações no Drive (por cliente e mês)'),
      item('enviado', 'Enviado'),
    ]),
    // ─── Relatório final: o mês fechado (os números, cada etapa com quem e quando, o que ficou pendente) ───────
    etapa('fiscal-relatorio-fim', 'Relatório final', 'Relatório', 'O mês fechado: os números, cada etapa com quem fez e quando, e o que ficou pendente.', [
      item('relatorio-fim', 'Conferi o relatório do fim', { painel: 'relatorio-fim' }),
    ]),
  ],
};
