// O fluxo operacional do Departamento Fiscal por regime (23/10/2026, o documento "FLUXO OPERACIONAL DO DEPARTAMENTO
// FISCAL", com o Lucro Real, o Lucro Presumido e o Simples Nacional; "pode substituir o atual"; vale já em setembro).
// Cada fluxo é uma sequência de etapas (Abertura → … → Fechamento) e cada etapa tem os seus subprocessos, que andam juntos
// (em qualquer ordem): a etapa seguinte só libera quando todos os subprocessos das de antes estão concluídos, aprovados ou
// marcados como não aplicáveis. Cada subprocesso tem o status (Pendente, Em execução, Em conferência, Aprovado, Não
// aplicável, Concluído), o responsável e quem mexeu por último; a própria pessoa passa por todos os status (o usuário
// decidiu em 23/10/2026). Nesta fase é só o fluxo, sem cálculo nem regra tributária: onde já existe a ferramenta do nads
// (o SIEG, a sequência das saídas, a prévia do DAS, o ICMS, o PIS/COFINS, o IRPJ, as guias, os relatórios), o
// subprocesso abre o painel dela.
// No banco é a mesma rotina de sempre (rotinas/{empresa}_{aaaa-mm}_fiscal): cada subprocesso é uma etapa da rotina
// (ROTINA_FISCAL, gerada daqui com o regime), com o status e o responsável no estado dela; as telas que leem a rotina
// (Empresas, Painel, Visão geral, Paradas) seguem iguais. O MEI e os outros regimes ficam na rotina antiga até terem o
// fluxo deles.
import type { Etapa, PainelDaTarefa, RelatorioImportavel } from '../tipos';

export type RegimeDoFluxo = 'Real' | 'Presumido' | 'Simples';
export type StatusDoSubprocesso = 'pendente' | 'execucao' | 'conferencia' | 'aprovado' | 'nao-aplicavel' | 'concluido';
export const STATUS_DO_SUBPROCESSO: readonly { valor: StatusDoSubprocesso; rotulo: string }[] = [
  { valor: 'pendente', rotulo: 'Pendente' }, { valor: 'execucao', rotulo: 'Em execução' }, { valor: 'conferencia', rotulo: 'Em conferência' },
  { valor: 'aprovado', rotulo: 'Aprovado' }, { valor: 'concluido', rotulo: 'Concluído' }, { valor: 'nao-aplicavel', rotulo: 'Não aplicável' },
];
/** o status que encerra o subprocesso (a etapa da rotina fica "feita"; o Não aplicável fica "dispensada") */
export const statusEncerra = (s: StatusDoSubprocesso | undefined) => s === 'concluido' || s === 'aprovado' || s === 'nao-aplicavel';

export type Periodicidade = 'mensal' | 'trimestral' | 'anual';
export const TRIMESTRE = [3, 6, 9, 12];

export interface SubprocessoFiscal {
  id: string;
  nome: string;
  /** o painel do nads que ajuda neste subprocesso (o mesmo do executor antigo) */
  painel?: PainelDaTarefa;
  /** os relatórios do Alterdata que dá para importar dali */
  importar?: RelatorioImportavel[];
  /** soltar os XMLs do cliente (as saídas) */
  xmls?: boolean;
  /** a Importação do Extratudo (os relatórios de notas com a conta contábil) */
  importacao?: boolean;
  link?: { rotulo: string; url: string };
  /** "quando aplicável", "quando exigível": começa igual, mas a pessoa costuma marcar Não aplicável */
  quandoAplicavel?: boolean;
  /** só nestes meses (as anuais) */
  meses?: number[];
}
export interface EtapaDoFluxo {
  /** o número da etapa no documento (1 = Abertura) */
  n: number;
  nome: string;
  periodicidade: Periodicidade;
  /** os subprocessos andam juntos (as apurações e as obrigações: "subprocessos independentes") */
  independentes?: boolean;
  /** só nestes meses (o trimestre do Presumido) */
  meses?: number[];
  subprocessos: SubprocessoFiscal[];
}
export interface FluxoFiscal { regime: RegimeDoFluxo; nome: string; prefixo: string; etapas: EtapaDoFluxo[] }

type Mais = Omit<SubprocessoFiscal, 'id' | 'nome'>;
const SIEG = { rotulo: 'SIEG - Login', url: 'https://auth.sieg.com/login' };
const REINF = { rotulo: 'Abrir a REINF do Fiscal', url: '/tarefas/fiscal/reinf' };

/** monta o fluxo: os ids dos subprocessos são o prefixo, o número da etapa e o apelido ("fs-6-das") */
function fluxo(regime: RegimeDoFluxo, nome: string, prefixo: string, etapas: [number, string, Periodicidade, (string | [string, string, Mais?])[], Partial<EtapaDoFluxo>?][]): FluxoFiscal {
  return {
    regime, nome, prefixo,
    etapas: etapas.map(([n, nomeDaEtapa, periodicidade, subs, mais]) => ({
      n, nome: nomeDaEtapa, periodicidade, ...mais,
      subprocessos: subs.map((s, i) => {
        const [apelido, texto, extra] = typeof s === 'string' ? [String(i + 1), s, {}] : s;
        return { id: prefixo + '-' + n + '-' + apelido, nome: texto, ...(extra || {}) };
      }),
    })),
  };
}

// ─── Lucro Real ─────────────────────────────────────────────────────────────────────────────────────────────────
export const FLUXO_REAL: FluxoFiscal = fluxo('Real', 'Lucro Real', 'fr', [
  [1, 'Abertura da competência', 'mensal', [
    ['empresas', 'Identificar empresas e estabelecimentos que serão processados'],
    ['rotinas', 'Criar as rotinas fiscais da competência'],
    ['obrigacoes', 'Identificar obrigações aplicáveis', { painel: 'relatorio-inicio' }],
    ['responsaveis', 'Definir responsáveis e prazos'],
    ['liberar', 'Liberar as tarefas para execução'],
  ]],
  [2, 'Recebimento e importação dos documentos', 'mensal', [
    ['entradas', 'Importar notas fiscais de entrada', { painel: 'sieg', link: SIEG }],
    ['saidas', 'Importar notas fiscais de saída', { painel: 'xml-saidas', xmls: true }],
    ['prestados', 'Importar notas fiscais de serviços prestados', { painel: 'prestados', importar: ['prestados'] }],
    ['tomados', 'Importar notas fiscais de serviços tomados', { painel: 'servicos', importar: ['tomados'] }],
    ['transporte', 'Importar documentos de transporte'],
    ['cancelados', 'Identificar documentos cancelados e devoluções', { painel: 'recebimento' }],
    ['ausentes', 'Verificar documentos ausentes ou duplicados', { painel: 'sequencia' }],
  ], { independentes: true }],
  [3, 'Escrituração fiscal', 'mensal', [
    ['conferir', 'Conferir os documentos importados', { importacao: true }],
    ['classificar', 'Classificar as operações fiscais', { painel: 'saidas', importar: ['saidas'] }],
    ['validar', 'Validar CFOP, CST, NCM e demais classificações', { painel: 'entradas', importar: ['entradas'] }],
    ['entradas', 'Escriturar as entradas', { painel: 'entradas-sieg', importar: ['entradas'] }],
    ['saidas', 'Escriturar as saídas', { painel: 'faturamento', importar: ['saidas'] }],
    ['servicos', 'Escriturar os serviços prestados e tomados', { painel: 'servicos', importar: ['tomados', 'prestados'] }],
    ['ajustes', 'Registrar ajustes e ocorrências'],
    ['inconsistencias', 'Encaminhar inconsistências para correção'],
  ]],
  [4, 'Apuração dos tributos', 'mensal', [
    ['icms', 'ICMS próprio', { painel: 'icms' }],
    ['icms-st', 'ICMS-ST'],
    ['icms-antecipacao', 'ICMS-Antecipação', { painel: 'interestaduais' }],
    ['icms-difal', 'ICMS-DIFAL'],
    ['ipi', 'IPI'],
    ['pis', 'PIS', { painel: 'piscofins' }],
    ['cofins', 'COFINS', { painel: 'creditos' }],
    ['iss', 'ISS', { painel: 'prestados' }],
    ['retencoes', 'Retenções tributárias', { painel: 'servicos' }],
    ['irpj', 'IRPJ', { painel: 'irpj' }],
    ['csll', 'CSLL'],
    ['ibs-cbs', 'IBS e CBS, quando aplicáveis', { quandoAplicavel: true }],
  ], { independentes: true }],
  [5, 'Conferência das apurações', 'mensal', [
    ['valores', 'Conferir os valores apurados'],
    ['debitos-creditos', 'Conciliar débitos e créditos'],
    ['saldos', 'Conferir saldos anteriores'],
    ['ajustes', 'Verificar ajustes fiscais'],
    ['divergencias', 'Identificar divergências'],
    ['correcoes', 'Registrar correções'],
    ['revisao', 'Submeter à revisão do responsável'],
  ]],
  [6, 'Obrigações acessórias', 'mensal', [
    ['efd-icms', 'EFD ICMS/IPI'],
    ['efd-contrib', 'EFD-Contribuições, quando exigível', { quandoAplicavel: true }],
    ['reinf', 'EFD-Reinf', { link: REINF }],
    ['dctfweb', 'DCTFWeb/MIT'],
    ['estaduais', 'Declarações estaduais'],
    ['municipais', 'Declarações municipais'],
    ['ecd', 'ECD, em integração com o setor contábil', { meses: [4] }],
    ['ecf', 'ECF, em integração com o setor contábil', { meses: [6] }],
  ], { independentes: true }],
  [7, 'Emissão e controle das guias', 'mensal', [
    ['tributos', 'Identificar tributos a recolher'],
    ['gerar', 'Gerar ou registrar guias', { painel: 'guia-dae' }],
    ['conferir', 'Conferir valores e vencimentos'],
    ['liberar', 'Liberar guias para envio'],
    ['envio', 'Registrar envio ao cliente'],
    ['comprovantes', 'Acompanhar comprovantes de pagamento'],
    ['pendentes', 'Identificar guias pendentes'],
  ]],
  [8, 'Fechamento da competência', 'mensal', [
    ['escrituracao', 'Conferir escrituração'],
    ['apuracoes', 'Conferir apurações'],
    ['obrigacoes', 'Verificar obrigações acessórias'],
    ['guias', 'Conferir guias emitidas'],
    ['pendencias', 'Verificar pendências'],
    ['evidencias', 'Consolidar evidências'],
    ['relatorio', 'Emitir relatório de fechamento', { painel: 'relatorio-fim' }],
    ['encerrar', 'Aprovar e encerrar a competência fiscal'],
  ]],
]);

// ─── Lucro Presumido ────────────────────────────────────────────────────────────────────────────────────────────
export const FLUXO_PRESUMIDO: FluxoFiscal = fluxo('Presumido', 'Lucro Presumido', 'fp', [
  [1, 'Abertura da competência', 'mensal', [
    ['empresas', 'Identificar empresas e estabelecimentos'],
    ['tarefas', 'Criar as tarefas fiscais mensais'],
    ['obrigacoes', 'Identificar obrigações aplicáveis', { painel: 'relatorio-inicio' }],
    ['responsaveis', 'Definir responsáveis'],
    ['prazos', 'Estabelecer prazos e dependências'],
  ]],
  [2, 'Importação dos documentos', 'mensal', [
    ['entradas', 'Importar notas fiscais de entrada', { painel: 'sieg', link: SIEG }],
    ['saidas', 'Importar notas fiscais de saída', { painel: 'xml-saidas', xmls: true }],
    ['prestados', 'Importar notas fiscais de serviços prestados', { painel: 'prestados', importar: ['prestados'] }],
    ['tomados', 'Importar notas fiscais de serviços tomados', { painel: 'servicos', importar: ['tomados'] }],
    ['transporte', 'Importar documentos de transporte'],
    ['cancelados', 'Identificar devoluções e cancelamentos', { painel: 'recebimento' }],
    ['integridade', 'Conferir a integridade dos documentos', { painel: 'sequencia' }],
  ], { independentes: true }],
  [3, 'Escrituração e conferência', 'mensal', [
    ['conferir', 'Conferir documentos fiscais', { importacao: true }],
    ['classificar', 'Classificar as operações', { painel: 'saidas', importar: ['saidas'] }],
    ['validar', 'Validar CFOP, CST, NCM e demais informações', { painel: 'entradas', importar: ['entradas'] }],
    ['entradas-saidas', 'Escriturar entradas e saídas', { painel: 'entradas-sieg', importar: ['entradas'] }],
    ['servicos', 'Escriturar serviços', { painel: 'servicos', importar: ['tomados', 'prestados'] }],
    ['receitas', 'Conferir receitas fiscais', { painel: 'faturamento', importar: ['saidas'] }],
    ['retencoes', 'Conferir retenções', { painel: 'iss-retido' }],
    ['inconsistencias', 'Identificar e corrigir inconsistências'],
  ]],
  [4, 'Apurações mensais', 'mensal', [
    ['icms', 'ICMS próprio', { painel: 'icms' }],
    ['icms-st', 'ICMS-ST'],
    ['icms-antecipacao', 'ICMS-Antecipação', { painel: 'interestaduais' }],
    ['icms-difal', 'ICMS-DIFAL'],
    ['ipi', 'IPI, quando aplicável', { quandoAplicavel: true }],
    ['pis', 'PIS', { painel: 'piscofins' }],
    ['cofins', 'COFINS', { painel: 'piscofins' }],
    ['iss', 'ISS', { painel: 'prestados' }],
    ['retencoes', 'Retenções tributárias', { painel: 'servicos' }],
    ['ibs-cbs', 'IBS e CBS, quando aplicáveis', { quandoAplicavel: true }],
  ], { independentes: true }],
  [5, 'Apurações trimestrais', 'trimestral', [
    ['receitas', 'Consolidar as receitas do trimestre'],
    ['segregacao', 'Conferir a segregação por atividade'],
    ['irpj', 'Preparar a apuração do IRPJ', { painel: 'irpj' }],
    ['csll', 'Preparar a apuração da CSLL'],
    ['retencoes', 'Conferir retenções e compensações'],
    ['revisao', 'Submeter as apurações à revisão'],
    ['conclusao', 'Registrar a conclusão do trimestre'],
  ], { meses: TRIMESTRE }],
  [6, 'Obrigações acessórias', 'mensal', [
    ['efd-icms', 'EFD ICMS/IPI'],
    ['efd-contrib', 'EFD-Contribuições, quando exigível', { quandoAplicavel: true }],
    ['reinf', 'EFD-Reinf', { link: REINF }],
    ['dctfweb', 'DCTFWeb/MIT'],
    ['estaduais', 'Declarações estaduais'],
    ['municipais', 'Declarações municipais'],
    ['ecd', 'ECD, quando exigível e em integração com o setor contábil', { quandoAplicavel: true, meses: [4] }],
    ['ecf', 'ECF, em integração com o setor contábil', { meses: [6] }],
  ], { independentes: true }],
  [7, 'Emissão e envio de guias', 'mensal', [
    ['consolidar', 'Consolidar os tributos apurados'],
    ['identificar', 'Identificar guias mensais e trimestrais'],
    ['gerar', 'Gerar ou registrar as guias', { painel: 'guia-dae' }],
    ['conferir', 'Conferir os valores e vencimentos'],
    ['enviar', 'Enviar ao cliente'],
    ['comprovantes', 'Controlar os comprovantes de pagamento'],
    ['pendencias', 'Registrar pendências'],
  ]],
  [8, 'Fechamento mensal', 'mensal', [
    ['documentos', 'Conferir documentos escriturados'],
    ['tributos', 'Conferir tributos mensais'],
    ['obrigacoes', 'Conferir obrigações'],
    ['guias', 'Verificar guias e pendências'],
    ['relatorio', 'Consolidar o relatório mensal', { painel: 'relatorio-fim' }],
    ['aprovar', 'Aprovar o fechamento'],
  ]],
  [9, 'Fechamento trimestral', 'trimestral', [
    ['meses', 'Conferir os três meses do trimestre'],
    ['receitas', 'Validar a consolidação das receitas'],
    ['irpj-csll', 'Conferir IRPJ e CSLL'],
    ['obrigacoes', 'Verificar obrigações correspondentes'],
    ['guias', 'Validar guias e evidências'],
    ['relatorio', 'Gerar relatório trimestral'],
    ['encerrar', 'Encerrar o período'],
  ], { meses: TRIMESTRE }],
]);

// ─── Simples Nacional ───────────────────────────────────────────────────────────────────────────────────────────
export const FLUXO_SIMPLES: FluxoFiscal = fluxo('Simples', 'Simples Nacional', 'fs', [
  [1, 'Abertura da competência', 'mensal', [
    ['empresas', 'Identificar empresas do Simples Nacional'],
    ['tarefas', 'Criar as tarefas da competência'],
    ['anexos', 'Identificar anexos e atividades cadastradas'],
    ['obrigacoes', 'Identificar obrigações aplicáveis', { painel: 'relatorio-inicio' }],
    ['responsaveis', 'Definir responsáveis e vencimentos'],
    ['liberar', 'Liberar a execução'],
  ]],
  [2, 'Recebimento e importação', 'mensal', [
    ['entradas', 'Importar notas fiscais de entrada', { painel: 'sieg', link: SIEG }],
    ['saidas', 'Importar notas fiscais de saída', { painel: 'xml-saidas', xmls: true }],
    ['prestados', 'Importar notas fiscais de serviços prestados', { painel: 'prestados', importar: ['prestados'] }],
    ['tomados', 'Importar notas fiscais de serviços tomados', { painel: 'servicos', importar: ['tomados'] }],
    ['transporte', 'Importar documentos de transporte, quando pertinentes', { quandoAplicavel: true }],
    ['cancelados', 'Identificar devoluções e cancelamentos', { painel: 'recebimento' }],
    ['ausentes', 'Conferir documentos ausentes e duplicados', { painel: 'sequencia' }],
  ], { independentes: true }],
  [3, 'Escrituração fiscal', 'mensal', [
    ['conferir', 'Conferir documentos importados', { importacao: true }],
    ['classificar', 'Classificar entradas e saídas', { painel: 'saidas', importar: ['saidas'] }],
    ['validar', 'Validar CFOP, CSOSN, CST, NCM e CEST', { painel: 'entradas', importar: ['entradas'] }],
    ['escriturar', 'Escriturar os documentos', { painel: 'entradas-sieg', importar: ['entradas'] }],
    ['interestaduais', 'Conferir movimentações interestaduais', { painel: 'interestaduais' }],
    ['servicos', 'Conferir serviços e retenções', { painel: 'servicos', importar: ['tomados', 'prestados'] }],
    ['inconsistencias', 'Registrar e tratar inconsistências'],
  ]],
  [4, 'Conferência do faturamento', 'mensal', [
    ['consolidar', 'Consolidar as receitas do período', { painel: 'receitas' }],
    ['comercio', 'Conferir receitas de comércio', { painel: 'base' }],
    ['industria', 'Conferir receitas de indústria', { quandoAplicavel: true }],
    ['servicos', 'Conferir receitas de serviços', { painel: 'prestados' }],
    ['devolucoes', 'Identificar devoluções e cancelamentos', { painel: 'recebimento' }],
    ['especificos', 'Identificar receitas com tratamentos específicos'],
    ['erp', 'Conciliar faturamento fiscal e informações do ERP', { painel: 'faturamento', importar: ['saidas'] }],
  ]],
  [5, 'Segregação das receitas', 'mensal', [
    ['normal', 'Receitas de tributação normal', { painel: 'pgdas' }],
    ['st', 'Receitas com ICMS-ST', { painel: 'pgdas' }],
    ['monofasicos', 'Receitas com produtos monofásicos', { painel: 'pgdas' }],
    ['aliquota-zero', 'Receitas com alíquota zero de PIS/COFINS'],
    ['isentas', 'Receitas isentas ou com outros tratamentos especiais'],
    ['iss-retido', 'Receitas de serviços com ISS retido', { painel: 'iss-retido' }],
    ['anexo', 'Receitas por anexo do Simples Nacional', { painel: 'base' }],
    ['fator-r', 'Receitas de atividades sujeitas ao Fator R', { quandoAplicavel: true, link: { rotulo: 'Abrir a calculadora do Simples', url: '/tarefas/fiscal/simples' } }],
    ['demais', 'Demais segregações aplicáveis ao PGDAS-D'],
  ], { independentes: true }],
  [6, 'Apuração do Simples Nacional', 'mensal', [
    ['faturamento', 'Conferir o faturamento mensal', { painel: 'receitas' }],
    ['acumulado', 'Conferir o acumulado dos 12 meses', { link: { rotulo: 'Abrir a calculadora do Simples', url: '/tarefas/fiscal/simples' } }],
    ['anexos', 'Validar anexos e segregações'],
    ['pgdas', 'Preparar a apuração do PGDAS-D', { painel: 'pgdas' }],
    ['resultado', 'Conferir o resultado'],
    ['aprovacao', 'Submeter à aprovação'],
    ['transmissao', 'Registrar a transmissão'],
    ['das', 'Gerar ou registrar o DAS', { painel: 'guia-das' }],
  ]],
  [7, 'Apurações estaduais complementares', 'mensal', [
    ['interestaduais', 'Identificação de entradas interestaduais', { painel: 'interestaduais' }],
    ['st', 'Análise de ICMS-ST'],
    ['antecipacao', 'Análise de ICMS-Antecipação', { link: { rotulo: 'Abrir a antecipação do ICMS (ES)', url: '/tarefas/fiscal/antecipacao-es' } }],
    ['difal', 'Análise de ICMS-DIFAL'],
    ['recolhidos', 'Conferência de tributos já recolhidos'],
    ['calculos', 'Preparação dos cálculos'],
    ['resultados', 'Conferência dos resultados'],
    ['guias', 'Emissão ou registro das guias estaduais', { painel: 'guia-dae' }],
  ], { independentes: true }],
  [8, 'Obrigações acessórias', 'mensal', [
    ['pgdas', 'PGDAS-D'],
    ['defis', 'DEFIS anual', { meses: [2] }],
    ['reinf', 'EFD-Reinf, quando exigível', { quandoAplicavel: true, link: REINF }],
    ['dctfweb', 'DCTFWeb, quando exigível', { quandoAplicavel: true }],
    ['estaduais', 'Declarações estaduais aplicáveis', { quandoAplicavel: true }],
    ['municipais', 'Declarações municipais aplicáveis', { quandoAplicavel: true, painel: 'prestados' }],
    ['demais', 'Demais obrigações específicas do contribuinte', { quandoAplicavel: true }],
  ], { independentes: true }],
  [9, 'Controle de guias', 'mensal', [
    ['das', 'Conferir DAS', { painel: 'guia-das' }],
    ['estaduais', 'Conferir guias estaduais', { painel: 'guia-dae' }],
    ['outras', 'Conferir eventuais guias municipais e federais', { quandoAplicavel: true }],
    ['vencimentos', 'Validar vencimentos'],
    ['enviar', 'Enviar guias ao cliente'],
    ['comprovantes', 'Registrar comprovantes de pagamento'],
    ['pendencias', 'Identificar pendências'],
  ]],
  [10, 'Fechamento mensal', 'mensal', [
    ['escrituracao', 'Validar a escrituração fiscal'],
    ['faturamento', 'Validar o faturamento'],
    ['segregacoes', 'Conferir segregações'],
    ['pgdas-das', 'Conferir PGDAS-D e DAS'],
    ['estaduais', 'Conferir ICMS-ST, antecipação e DIFAL'],
    ['obrigacoes', 'Conferir obrigações acessórias'],
    ['envio', 'Verificar envio das guias'],
    ['pendencias', 'Registrar pendências e justificativas'],
    ['relatorio', 'Gerar relatório de fechamento', { painel: 'relatorio-fim' }],
    ['encerrar', 'Aprovar e encerrar a competência'],
  ]],
]);

export const FLUXOS_FISCAIS: readonly FluxoFiscal[] = [FLUXO_SIMPLES, FLUXO_PRESUMIDO, FLUXO_REAL];

/** o fluxo do regime (null: o MEI e os outros regimes seguem na rotina antiga) */
export function fluxoDoRegime(regime: string | null | undefined): FluxoFiscal | null {
  return FLUXOS_FISCAIS.find(f => f.regime === regime) || null;
}

/** o fluxo e a etapa de um subprocesso pelo id */
export function ondeEsta(subId: string): { fluxo: FluxoFiscal; etapa: EtapaDoFluxo; sub: SubprocessoFiscal } | null {
  for (const fluxo of FLUXOS_FISCAIS) for (const etapa of fluxo.etapas) {
    const sub = etapa.subprocessos.find(s => s.id === subId);
    if (sub) return { fluxo, etapa, sub };
  }
  return null;
}

/** a etapa do fluxo entra no mês? (as trimestrais, nos meses do trimestre) e o subprocesso (as anuais, no mês delas) */
export const etapaDoFluxoNoMes = (e: EtapaDoFluxo, mes: number) => !e.meses || e.meses.includes(mes);
export const subprocessoNoMes = (e: EtapaDoFluxo, s: SubprocessoFiscal, mes: number) => etapaDoFluxoNoMes(e, mes) && (!s.meses || s.meses.includes(mes));

/**
 * As etapas da rotina geradas dos fluxos: cada subprocesso vira uma etapa da rotina, na seção do nome da etapa do fluxo,
 * só no regime dele (e nos meses dele). É o que guarda o estado no banco e o que as telas de sempre contam.
 */
export function etapasDaRotinaDosFluxos(): Etapa[] {
  return FLUXOS_FISCAIS.flatMap(f => f.etapas.flatMap(e => e.subprocessos.map(s => {
    const meses = s.meses || e.meses;
    return {
      id: s.id, secao: e.n + '. ' + e.nome, nome: s.nome, descricao: '', ferramenta: null, verificacao: 'manual' as const, objecoes: [],
      regimes: [f.regime], ...(meses ? { meses } : {}),
    };
  })));
}
