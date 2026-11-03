// Os históricos configuráveis da Contábil (Vitor, 03/11/2026: "configurar todos os históricos de etapas que envolvem
// exportação em Excel"). Cada texto começa com o padrão de hoje; o escritório troca em Contábil › Configurações, e o
// texto trocado vale na exportação de cada etapa. Os textos têm {variaveis} (ex.: {ref} = mês MM/AAAA). Pura: sem React
// nem banco. Os códigos do Alterdata (Creditor, Cheque especial) ficam aqui também, mas são só dígitos.

export type IdDoHistorico =
  | 'honorarios.provisao' | 'honorarios.pagamento' | 'honorarios.juros'
  | 'prolabore.pagamento'
  | 'adiantamento.pagamento'
  | 'inss.provisao_a_maior' | 'inss.provisao_a_recolher' | 'inss.producao_rural' | 'inss.ajuste_centavos' | 'inss.pagamento'
  | 'fgts.provisao_a_maior' | 'fgts.provisao_a_recolher' | 'fgts.pagamento'
  | 'cheque.codigo';

export interface VariavelDoHistorico { nome: string; descricao: string }

export interface DefinicaoDoHistorico {
  id: IdDoHistorico;
  /** a etapa da Contábil (rótulo da seção nas Configurações) */
  etapa: string;
  /** o rótulo do campo */
  rotulo: string;
  /** o texto padrão (com {variaveis}); para o código, só os dígitos */
  padrao: string;
  variaveis: readonly VariavelDoHistorico[];
  /** true = código do histórico do Alterdata (só dígitos, até 10), não texto */
  codigo?: true;
}

const MES: VariavelDoHistorico = { nome: 'ref', descricao: 'mês de referência (MM/AAAA)' };

export const HISTORICOS_DO_CONTABIL: readonly DefinicaoDoHistorico[] = [
  { id: 'honorarios.provisao', etapa: 'Honorários', rotulo: 'Provisão',
    padrao: 'Honorários contábeis ref. {ref} conf. cobrança nº {cobranca}',
    variaveis: [MES, { nome: 'cobranca', descricao: 'número da cobrança (sem zeros à frente)' }] },
  { id: 'honorarios.pagamento', etapa: 'Honorários', rotulo: 'Pagamento',
    padrao: 'Pagamento de honorários contábeis ref. {ref} conf. cobrança nº {cobranca}',
    variaveis: [MES, { nome: 'cobranca', descricao: 'número da cobrança (sem zeros à frente)' }] },
  { id: 'honorarios.juros', etapa: 'Honorários', rotulo: 'Juros e multa paga a mais',
    padrao: 'Juros e multa s/ pagamento de honorários contábeis ref. {ref} conf. cobrança nº {cobranca}',
    variaveis: [MES, { nome: 'cobranca', descricao: 'número da cobrança (sem zeros à frente)' }] },
  { id: 'prolabore.pagamento', etapa: 'Pró-labore', rotulo: 'Pagamento',
    padrao: 'Pagamento de pro-labore {ref} {socio}',
    variaveis: [MES, { nome: 'socio', descricao: 'nome do sócio' }] },
  { id: 'adiantamento.pagamento', etapa: 'Adiantamento salarial', rotulo: 'Pagamento',
    padrao: 'Pagamento de adiantamento salarial {ref}',
    variaveis: [MES] },
  { id: 'inss.provisao_a_maior', etapa: 'INSS', rotulo: 'Provisão a maior',
    padrao: 'Pelo valor de INSS provisionado a maior — {grupo} <{ref}>',
    variaveis: [{ nome: 'grupo', descricao: 'grupo do INSS (patronal, terceiros, segurados…)' }, MES] },
  { id: 'inss.provisao_a_recolher', etapa: 'INSS', rotulo: 'Provisão a recolher',
    padrao: 'Pelo valor de INSS a recolher — {grupo} <{ref}>',
    variaveis: [{ nome: 'grupo', descricao: 'grupo do INSS (patronal, terceiros, segurados…)' }, MES] },
  { id: 'inss.producao_rural', etapa: 'INSS', rotulo: 'Produção rural PF (sub-rogação)',
    padrao: 'INSS sobre aquisição de produção rural de PF (sub-rogação) <{ref}>',
    variaveis: [MES] },
  { id: 'inss.ajuste_centavos', etapa: 'INSS', rotulo: 'Ajuste de centavos',
    padrao: 'Ajuste de centavos do INSS a recolher <{ref}>',
    variaveis: [MES] },
  { id: 'inss.pagamento', etapa: 'INSS', rotulo: 'Pagamento (guia)',
    padrao: 'Pagamento de INSS ref {ref} conforme DARF.',
    variaveis: [MES] },
  { id: 'fgts.provisao_a_maior', etapa: 'FGTS', rotulo: 'Provisão a maior',
    padrao: 'Pelo valor de FGTS provisionado a maior s/ folha <{ref}> {trabalhador}',
    variaveis: [MES, { nome: 'trabalhador', descricao: 'nome do trabalhador' }] },
  { id: 'fgts.provisao_a_recolher', etapa: 'FGTS', rotulo: 'Provisão a recolher',
    padrao: 'Pelo valor de FGTS a recolher s/ folha <{ref}> {trabalhador}',
    variaveis: [MES, { nome: 'trabalhador', descricao: 'nome do trabalhador' }] },
  { id: 'fgts.pagamento', etapa: 'FGTS', rotulo: 'Pagamento (guia)',
    padrao: 'Pagamento de FGTS referente {ref}, conforme GFD quitada.',
    variaveis: [MES] },
  { id: 'cheque.codigo', etapa: 'Cheque especial', rotulo: 'Código do histórico', codigo: true,
    padrao: '92029', variaveis: [] },
];

/** O código do Alterdata: só dígitos, até 10 (Vitor, 03/11/2026). */
export const LIMITE_DO_CODIGO = 10;
export const codigoValido = (v: string): boolean => /^\d{1,10}$/.test(v);

export type ModelosDoHistorico = Readonly<Record<IdDoHistorico, string>>;

/** Os textos e códigos padrão, do jeito que o sistema exportava antes de haver configuração. */
export const MODELOS_PADRAO: ModelosDoHistorico = Object.freeze(
  Object.fromEntries(HISTORICOS_DO_CONTABIL.map(h => [h.id, h.padrao])) as Record<IdDoHistorico, string>,
);

export const definicaoDoHistorico = (id: IdDoHistorico): DefinicaoDoHistorico =>
  HISTORICOS_DO_CONTABIL.find(h => h.id === id) as DefinicaoDoHistorico;

/**
 * O documento guardado → os modelos (o que faltar, estiver em branco ou for inválido, vai o padrão). Texto: sem
 * espaços nas pontas. Código: só dígitos, até 10.
 */
export function modelosDoDocumento(d: unknown): ModelosDoHistorico {
  const o = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
  const out = {} as Record<IdDoHistorico, string>;
  for (const h of HISTORICOS_DO_CONTABIL) {
    const v = typeof o[h.id] === 'string' ? (o[h.id] as string).trim() : '';
    out[h.id] = h.codigo ? (codigoValido(v) ? v : h.padrao) : (v || h.padrao);
  }
  return Object.freeze(out);
}

/**
 * O texto de um histórico com as variáveis preenchidas: {nome} vira vars.nome; variável que não veio vira vazio. Sem
 * `modelos`, usa o padrão.
 */
export function preencherHistorico(id: IdDoHistorico, vars: Readonly<Record<string, string | number>> = {}, modelos: ModelosDoHistorico = MODELOS_PADRAO): string {
  const texto = modelos[id] ?? MODELOS_PADRAO[id];
  return texto.replace(/\{(\w+)\}/g, (_, nome: string) => String(vars[nome] ?? ''));
}
