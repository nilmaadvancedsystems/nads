// Tipos da Conferência Contábil — o documento de UMA empresa, do jeito que o
// original guarda em empresas/{slug(nome)} (conferencia.html: norm() ~L1513,
// onSnapshot ~L4757). Na cópia (nads) esse documento vive só em memória.

export type TipoNotaFiscal = 'entradas' | 'saidas';
export type TipoServico = 'tomados' | 'prestados';
export type TipoMovimento = TipoNotaFiscal | TipoServico;
/** "Entrada" (CFOP 1/2/3) ou "Saída" (CFOP 5/6/7) */
export type TipoCfop = 'Entrada' | 'Saída';
export type Grupo = 'Ativo' | 'Passivo' | 'Despesa' | 'Receita' | 'Outros';

/** Conta do balancete (Alterdata, "XLS Dados Arquivo"). */
export interface Conta {
  codigo: string;
  nome: string;
  dc: 'D' | 'C';
  grupo: Grupo;
  sintetica?: boolean;
  /** saldo atual (coluna H) */
  valor: number;
  /** posição no plano de contas importado */
  ordem?: number;
}

/** Nota fiscal de entrada ou saída (relatório do fiscal em Excel). */
export interface Nota {
  cfop: string;
  /** lançamento, com os zeros da nota ("00182") */
  lanc: string;
  valor: number;
  numero: string;
  /** fornecedor ou cliente */
  nome: string;
  /** dd/mm/aaaa */
  data: string;
  /** descrição do CFOP que veio no arquivo */
  desc: string;
  /** CPF/CNPJ */
  doc?: string;
  exportado?: '' | 'Sim' | 'Não';
  /** competência aaaa-mm */
  comp: string;
  /** a conta contábil do cliente/fornecedor, quando o relatório traz a coluna (o Creditor acha a conta pela NF) */
  conta?: string;
}

/** Nota com o tipo do CFOP já resolvido (Entrada/Saída). */
export interface NotaComTipo extends Nota {
  tipo: TipoCfop;
}

/** Nota de serviço (relatório de ISS). */
export interface NotaServico {
  data: string;
  comp: string;
  numero: string;
  lanc: string;
  codPart: string;
  cnpj: string;
  nome: string;
  /** Valor Base (prestados) ou Valor do Documento (tomados) */
  valor: number;
  iss?: number;
  issRet?: number;
  irrf?: number;
  inss?: number;
  exportado?: '' | 'Sim' | 'Não';
}

/** Lançamento automático (de-para antigo lançamento → conta). */
export interface LancamentoDp {
  lanc: string;
  conta: string;
  nome: string;
  dc: 'D' | 'C';
  travado?: boolean;
}

export interface RegistroImportacao {
  ts: string;
  tipo: string;
  qtd: number;
  acao: 'importado' | 'excluido';
  modo?: 'sobreposto';
  substituidas?: number;
  forcado?: boolean;
  aviso?: string;
  /** excluído automaticamente ao sair (Apagar ao sair) */
  auto?: boolean;
}

export interface RegistroConferencia {
  ts: string;
  chave: string;
  texto: string;
  acao: 'marcado' | 'desmarcado';
  origem: 'manual' | 'automatico';
  categoria?: 'divergencia' | 'verificacao';
}

export interface VendaVista {
  ativo: boolean;
  /** lançamento à vista por natureza de venda */
  lancs: Record<string, string>;
  /** lançamento a prazo por natureza de venda */
  prazo?: Record<string, string>;
}

/** Participante de serviço colocado numa categoria (Telefone, Internet…). */
export interface CategoriaDoParticipante {
  cat: string;
  nome: string;
}

export type EstadoVerificacao = 'ok' | 'conferido';

/** O documento inteiro de uma empresa. */
export interface Empresa {
  nome: string;
  /** balancete */
  contas: Conta[];
  dp: LancamentoDp[];
  entradas: Nota[];
  saidas: Nota[];
  servPrestados: NotaServico[];
  servTomados: NotaServico[];
  /** "tipo|chave da nota" das notas fora do padrão marcadas como corrigidas */
  divResolvidos: string[];
  /** "periodoKey||natureza" marcadas como conferidas no Checklist */
  confMarcados: string[];
  confAutoMarcados: string[];
  confAutoRecusados: string[];
  confHistorico: RegistroConferencia[];
  importHistorico: RegistroImportacao[];
  /** natureza de CFOP (ou "serv|tipo|*" / "serv|tipo|cat:x") → contas */
  naturezaConta: Record<string, string[] | string>;
  /** participante normalizado → categoria, por tipo de serviço */
  servCat: Partial<Record<TipoServico, Record<string, CategoriaDoParticipante>>>;
  vendaVista: VendaVista;
  /** naturezas marcadas "Não vai para o Contábil" */
  naoContabil: Record<string, boolean>;
  /** "periodoKey||conta" → ok/conferido (Verificar por conta) */
  verifConta: Record<string, EstadoVerificacao>;
  /** resposta de "Esta empresa presta serviços?" (undefined = ainda não perguntado) */
  prestaServico?: boolean;
  /** Apagar ao sair (padrão ligado) */
  autoLimparBalancete: boolean;
  avisoBalPendente?: boolean;
  balanceteAssinatura?: Record<string, string>;
  balanceteAssinaturaTs?: string;
}

/** Empresa da lista de entrada: [código ERP, nome, regime]. */
export interface EmpresaDaLista {
  codigo: number | null;
  nome: string;
  regime: string;
}

/** Filtro do Movimento (o antigo ccState), comum ao Relatório e ao Checklist. */
export interface FiltroMovimento {
  dataDe: string;
  dataAte: string;
  busca: string;
  /** competências aaaa-mm marcadas no gráfico */
  meses: string[];
  tipo: '' | TipoCfop;
  status: '' | 'pendente' | 'conferido';
}

export const FILTRO_MOVIMENTO_VAZIO: FiltroMovimento = { dataDe: '', dataAte: '', busca: '', meses: [], tipo: '', status: '' };

/** Grupo de notas de uma natureza de CFOP. */
export interface GrupoNatureza<N = NotaComTipo> {
  desc: string;
  cfops: string[];
  itens: N[];
  tipo: TipoCfop;
}
