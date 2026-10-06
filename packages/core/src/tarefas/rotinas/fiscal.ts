// A rotina do Fiscal, etapa por etapa (Vitor, 05/10/2026: "pegue o mesmo modelo do contábil; no meu Notion
// Fiscal/Heverton/Tarefas/[N°] - NOME, MM/AAAA, cada etapa e quais são as tarefas"). Do Notion (Alterdata › MM/AAAA):
//   Importação de Notas — Inicial (SIEG, recebimento de saídas) e a importação no Alterdata;
//   Conferência — Saídas, Entradas e Retenções;
//   Apuração — Simples Nacional (as outras apurações do Notion — ICMS, ISS, PIS/COFINS… — entram quando tiverem a página);
//   Envio — o "Enviado" do fim.
// Pelo regime (06/10/2026): o Simples só no Simples; ICMS, ISS, PIS/COFINS, IRPJ/CSLL (trimestral) e as obrigações
// (EFD ICMS/IPI, EFD-Contribuições, REINF e DCTFWeb) só no Presumido e no Real — Etapa.regimes e Etapa.meses.
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
    // ─── Importação de Notas ──────────────────────────────────────────────────
    etapa('fiscal-inicial', 'Importação de Notas', 'Inicial', 'Baixe as notas do mês no SIEG e receba as saídas.', [
      item('sieg', 'Download SIEG', { link: { rotulo: 'SIEG - Login', url: 'https://auth.sieg.com/login' } }),
      item('recebimento-saidas', 'Recebimento de Saídas'),
    ], { sieg: 'contagem' }),
    etapa('fiscal-importacao', 'Importação de Notas', 'Importação no Alterdata', 'Importe as notas no Alterdata.', [
      item('entradas', 'Entradas'),
      item('saidas', 'Saídas'),
      item('tomados', 'Serviços Tomados'),
      item('prestados', 'Serviços Prestados'),
      item('cte', 'CTE'),
    ]),
    // ─── Conferência ──────────────────────────────────────────────────────────
    etapa('fiscal-conf-saidas', 'Conferência', 'Saídas', 'Confira a sequência e as notas de saída.', [
      item('sequencia-saidas', 'Sequência de Saídas'),
      item('conferencia-nfs', 'Conferência das Notas Fiscais', { aviso: 'Se atentar caso os produtos sejam Monofásico, ST, Imune ou Isento. Observar cancelamentos.' }),
    ], { sieg: 'saidas' }),
    etapa('fiscal-conf-entradas', 'Conferência', 'Entradas', 'Confira o faturamento, a tributação e o SINTEGRA.', [
      item('faturamento-x-emitidas', 'Conferência de Faturamento x Notas Emitidas'),
      item('tributacao-entradas', 'Tributação das Entradas'),
      item('entradas-x-sintegra', 'Entradas x SINTEGRA'),
    ]),
    etapa('fiscal-retencoes', 'Conferência', 'Retenções', 'Confira as retenções do mês.', [
      item('iss-retido', 'ISS retido'),
      item('inss-retido', 'INSS retido'),
    ]),
    // ─── Apuração ─────────────────────────────────────────────────────────────
    etapa('fiscal-simples', 'Apuração', 'Simples Nacional', 'Apure o Simples Nacional e gere o DAS.', [
      item('receitas', 'Coletar receitas do mês'),
      item('base-calculo', 'Conferir composição da base de cálculo', { sub: ['Monofásico', 'ST', 'Retidos'] }),
      item('pgdas', 'Transmitir PGDAS-D'),
      item('das', 'Gerar DAS'),
      item('recibo', 'Baixar recibo, extrato e declaração'),
    ], { regimes: ['Simples'] }),
    // ─── Apuração do Presumido e do Real (Vitor, 06/10/2026: "continue fazendo as coisas do fiscal") ──────────
    // Rascunho para o Heverton ajustar (o Notion dele só tinha o Simples): cada uma só para Presumido e Real (no Simples e
    // nos outros regimes, "não se aplica"); o IRPJ/CSLL só no mês que fecha o trimestre.
    etapa('fiscal-icms', 'Apuração', 'ICMS', 'Apure o ICMS do mês (próprio, ST e DIFAL) e gere a guia.', [
      item('icms-apuracao', 'Apurar o ICMS próprio', { sub: ['Débitos das saídas', 'Créditos das entradas', 'Saldo credor anterior'] }),
      item('icms-st-difal', 'Conferir ST, DIFAL e antecipação', { aviso: 'Só se a empresa teve operações com ST, DIFAL ou antecipação no mês.' }),
      item('icms-guia', 'Gerar a guia do ICMS'),
    ], { regimes: ['Presumido', 'Real'] }),
    etapa('fiscal-iss', 'Apuração', 'ISS', 'Apure o ISS dos serviços prestados e entregue a declaração do município.', [
      item('iss-apuracao', 'Apurar o ISS próprio'),
      item('iss-declaracao', 'Entregar a declaração de serviços do município'),
      item('iss-guia', 'Gerar a guia do ISS'),
    ], { regimes: ['Presumido', 'Real'] }),
    etapa('fiscal-piscofins', 'Apuração', 'PIS/COFINS', 'Apure o PIS e a COFINS do mês e gere o DARF.', [
      item('pc-base', 'Conferir a base (receitas, monofásicos e isentos)', { aviso: 'No Presumido é cumulativo (sem créditos); no Real, não cumulativo (com os créditos das entradas).' }),
      item('pc-apuracao', 'Apurar PIS e COFINS'),
      item('pc-darf', 'Gerar os DARFs'),
    ], { regimes: ['Presumido', 'Real'] }),
    etapa('fiscal-irpj-csll', 'Apuração', 'IRPJ/CSLL', 'Apure o IRPJ e a CSLL do trimestre e gere os DARFs.', [
      item('ir-receita', 'Somar a receita do trimestre'),
      item('ir-apuracao', 'Apurar IRPJ (com adicional) e CSLL'),
      item('ir-darf', 'Gerar os DARFs (cota única ou parcelas)'),
    ], { regimes: ['Presumido', 'Real'], meses: [3, 6, 9, 12] }),
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
    ], { regimes: ['Presumido', 'Real'] }),
    // ─── Envio ────────────────────────────────────────────────────────────────
    etapa('fiscal-envio', 'Envio', 'Enviado', 'Envie as guias e os documentos do mês ao cliente.', [
      item('enviado', 'Enviado'),
    ]),
  ],
};
