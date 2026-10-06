// A rotina do Fiscal, etapa por etapa (Vitor, 05/10/2026: "pegue o mesmo modelo do contábil; no meu Notion
// Fiscal/Heverton/Tarefas/[N°] - NOME, MM/AAAA, cada etapa e quais são as tarefas"). Do Notion (Alterdata › MM/AAAA):
//   Importação de Notas — Inicial (SIEG, recebimento de saídas) e a importação no Alterdata;
//   Conferência — Saídas, Entradas e Retenções;
//   Apuração — Simples Nacional (as outras apurações do Notion — ICMS, ISS, PIS/COFINS… — entram quando tiverem a página);
//   Envio — o "Enviado" do fim.
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
    ]),
    // ─── Envio ────────────────────────────────────────────────────────────────
    etapa('fiscal-envio', 'Envio', 'Enviado', 'Envie as guias e os documentos do mês ao cliente.', [
      item('enviado', 'Enviado'),
    ]),
  ],
};
