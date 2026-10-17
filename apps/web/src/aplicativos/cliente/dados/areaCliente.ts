// A Área do Cliente (Vitor, 16/10/2026): o site que o cliente abre por um LINK SECRETO, um por empresa, sem senha.
// Interface do repositório + os tipos do que a tela precisa; a versão de exemplo é areaCliente.memoria.ts. A do banco
// (areasCliente/{token} que o robô espelha; o cliente só cria nas caixas areaClienteEnvios e areaClienteChamados) ainda
// não existe.
// As seções que vieram do protótipo do Vitor (documentos, certificado, funcionários, ficha da empresa e atendimento) ainda
// não têm tipo no core: por enquanto os tipos simples ficam aqui e só a versão de exemplo os preenche.
import type { areaCliente as ac } from '@nads/core';

/** a área do escritório que mandou o documento */
export type AreaDoDocumento = 'fiscal' | 'dp' | 'contabil' | 'societario';
export const ROTULO_DA_AREA: Record<AreaDoDocumento, string> = { fiscal: 'Fiscal', dp: 'Pessoal', contabil: 'Contábil', societario: 'Societário' };

/** Um documento que o escritório deixou para o cliente (balancete, folha, certidão…). */
export interface DocumentoDoCliente {
  id: string;
  nome: string;
  /** a linha de baixo: o que é, em português simples */
  descricao: string;
  area: AreaDoDocumento;
  /** 'aaaa-mm'; '' = não é de um mês (certidão, contrato) */
  competencia: string;
  /** ISO */
  enviadoEm: string;
  /** o cliente ainda não baixou */
  novo: boolean;
  formato: 'PDF' | 'ZIP' | 'XLSX';
}

/** O certificado digital da empresa (o e-CNPJ). */
export interface CertificadoDigital { tipo: 'A1' | 'A3'; titular: string; /** 'aaaa-mm-dd' */ validoAte: string }

export type SituacaoDasFerias = 'em dia' | 'em ferias' | 'periodo aquisitivo' | 'vencidas';
export const ROTULO_DAS_FERIAS: Record<SituacaoDasFerias, string> = { 'em dia': 'Em dia', 'em ferias': 'Em férias', 'periodo aquisitivo': 'Período aquisitivo', vencidas: 'Férias vencidas' };

/** Um empregado ativo (o CPF já vem mascarado). */
export interface Empregado {
  id: string;
  nome: string;
  /** '***.491.826-**' */
  cpf: string;
  cargo: string;
  /** 'aaaa-mm-dd' */
  admissao: string;
  salario: number;
  ferias: SituacaoDasFerias;
  /** 'aaaa-mm-dd', quando está de férias */
  retornoEm?: string;
}

/** A ficha cadastral da empresa. */
export interface FichaDaEmpresa {
  razaoSocial: string;
  nomeFantasia?: string;
  cnpj: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
  regime: string;
  cnae: string;
  /** 'aaaa-mm-dd' */
  abertura?: string;
  endereco: string;
  socios: { nome: string; participacao: string }[];
}

/** Quem atende o cliente no escritório e por onde. */
export interface Atendimento {
  equipe: string;
  horario: string;
  setores: { nome: string; email: string }[];
}

/** Tudo o que o link mostra, já filtrado pelo robô. */
export interface EstadoDaArea {
  carregado: boolean;
  /** false = o link não existe ou foi trocado: a tela não mostra dado nenhum */
  valido: boolean;
  resumo: ac.ResumoDoCliente | null;
  guias: ac.GuiaDoCliente[];
  /** a linha digitável de cada guia (id da guia → código), quando tem */
  codigos: Record<string, string>;
  /** um item por mês de vencimento (areasCliente/{token}/agenda/{AAAA-MM}) */
  agenda: ac.AgendaDoMes[];
  envios: ac.ReciboDeEnvio[];
  chamados: ac.ChamadoDoCliente[];
  documentos: DocumentoDoCliente[];
  certificado: CertificadoDigital | null;
  empregados: Empregado[];
  ficha: FichaDaEmpresa | null;
  atendimento: Atendimento | null;
}

export const AREA_VAZIA: EstadoDaArea = {
  carregado: false, valido: false, resumo: null, guias: [], codigos: {}, agenda: [], envios: [], chamados: [],
  documentos: [], certificado: null, empregados: [], ficha: null, atendimento: null,
};

export interface RepoAreaCliente {
  /** true = dados de exemplo (nada vai para o escritório) */
  exemplos: boolean;
  /** acompanha o link: chama já com o que tem e de novo a cada mudança; devolve a função que para */
  assinar(token: string, aoMudar: (e: EstadoDaArea) => void): () => void;
  /** manda os arquivos (caixa areaClienteEnvios); o recibo volta pelo assinar */
  enviar(token: string, tipo: ac.TipoDeEnvio, arquivos: File[]): Promise<void>;
  /** abre um chamado novo (caixa areaClienteChamados); devolve o id */
  abrirChamado(token: string, dados: { tipo: ac.TipoDeChamado; texto: string }): Promise<string>;
  /** a resposta do cliente num chamado que já existe */
  responderChamado(token: string, id: string, texto: string): Promise<void>;
  /** o PDF da guia; null quando não tem */
  baixarGuia(token: string, id: string): Promise<{ nome: string; arquivo: Blob } | null>;
  /** o arquivo de um documento do escritório (deixa de ser "novo"); null quando não tem */
  baixarDocumento(token: string, id: string): Promise<{ nome: string; arquivo: Blob } | null>;
}
