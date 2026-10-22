// A Área do Cliente (Vitor, 16/10/2026): o site que o cliente abre por um LINK SECRETO, um por empresa, sem senha.
// Interface do repositório + os tipos do que a tela precisa; a versão de exemplo é areaCliente.memoria.ts e a do banco é
// areaCliente.firestore.ts (lê o espelho areasCliente/{token} que o robô grava; o cliente só cria nas caixas
// areaClienteEnvios e areaClienteChamados).
// As seções que vieram do protótipo do Vitor (documentos, certificado, empregados, ficha da empresa, atendimento, avisos e
// guias pagas) ainda não têm tipo no core nem fonte no banco: os tipos simples ficam aqui, só a versão de exemplo os
// preenche, e `secoes` diz à tela o que esconder quando o repositório não tem de onde tirar.
import type { areaCliente as ac } from '@nads/core';
import type { FormatoDoArquivo } from '@nads/ui';

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
  formato: FormatoDoArquivo;
}

/** O formato do arquivo (o ícone da Central de documentos sai dele; o IconeDeArquivo do @nads/ui). */
export type { FormatoDoArquivo };

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
  /** a foto (Vitor, 16/10/2026: "subir a foto da pessoa que foi contratada"): o JPEG 256×256 como data URL */
  foto?: string;
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

/** Um recado do escritório (ex.: mandar os extratos até o dia 5). */
export interface AvisoDoEscritorio { id: string; titulo: string; texto: string; /** a aba que resolve */ ir?: 'documentos' | 'guias' | 'dp' | 'chamados' }

/** O que vai no quadradinho da guia: os tipos do core, mais os das guias pagas (DARF, INSS, DCTFWeb e os honorários). */
export type TipoDoQuadradinho = ac.TipoDeGuia | 'DARF' | 'INSS' | 'DCTFWeb' | 'HON';

/** Uma guia já paga no mês, com o comprovante. */
export interface GuiaPaga { id: string; /** de que é (a logo do órgão no quadradinho); sem ele, o ✓ */ tipo?: TipoDoQuadradinho; nome: string; competencia: string; valor: number; /** 'dd/mm/aaaa' */ pagoEm: string; temComprovante: boolean }

/**
 * As seções que o repositório consegue preencher. false = não tem fonte (o banco, por enquanto): a tela esconde o item do
 * menu, os cards e os avisos que dependem dela, em vez de mostrar uma lista vazia que parece verdade ("nada pago",
 * "nenhum funcionário"). O certificado e a ficha da empresa não precisam disto: sem eles (null), a tela já esconde.
 */
export interface SecoesDaArea {
  /** a Central de documentos (os documentos que o escritório deixa para o cliente) */
  documentos: boolean;
  /** o Departamento pessoal (os funcionários e os pedidos de admissão, férias e desligamento com a foto) */
  dp: boolean;
  /** as guias já pagas, com o comprovante */
  pagas: boolean;
}
export const TODAS_AS_SECOES: SecoesDaArea = { documentos: true, dp: true, pagas: true };
/** o que o banco tem hoje (17/10/2026): o robô espelha guias, agenda, recibos de envio e chamados, e nada disto */
export const SECOES_DO_BANCO: SecoesDaArea = { documentos: false, dp: false, pagas: false };

/** Tudo o que o link mostra, já filtrado pelo robô. */
export interface EstadoDaArea {
  carregado: boolean;
  /** false = o link não existe ou foi trocado: a tela não mostra dado nenhum */
  valido: boolean;
  /** o banco não respondeu por outro motivo (não é o link): a frase para o cliente; '' = sem problema */
  erro: string;
  /** true = dados de exemplo (nada vai para o escritório) */
  exemplos: boolean;
  /** o que este link consegue mostrar (o resto some da tela) */
  secoes: SecoesDaArea;
  resumo: ac.ResumoDoCliente | null;
  guias: ac.GuiaDoCliente[];
  /** a linha digitável de cada guia (id da guia → código), quando tem */
  codigos: Record<string, string>;
  pagas: GuiaPaga[];
  /** um item por mês de vencimento (areasCliente/{token}/agenda/{AAAA-MM}) */
  agenda: ac.AgendaDoMes[];
  envios: ac.ReciboDeEnvio[];
  chamados: ac.ChamadoDoCliente[];
  documentos: DocumentoDoCliente[];
  certificado: CertificadoDigital | null;
  empregados: Empregado[];
  ficha: FichaDaEmpresa | null;
  atendimento: Atendimento | null;
  avisos: AvisoDoEscritorio[];
}

export const AREA_VAZIA: EstadoDaArea = {
  carregado: false, valido: false, erro: '', exemplos: false, secoes: SECOES_DO_BANCO, resumo: null, guias: [], codigos: {}, pagas: [], agenda: [], envios: [], chamados: [],
  documentos: [], certificado: null, empregados: [], ficha: null, atendimento: null, avisos: [],
};

export interface RepoAreaCliente {
  /** acompanha o link: chama já com o que tem e de novo a cada mudança; devolve a função que para */
  assinar(token: string, aoMudar: (e: EstadoDaArea) => void): () => void;
  /** manda os arquivos (caixa areaClienteEnvios); o recibo volta pelo assinar. Erro: joga um Error em português */
  enviar(token: string, tipo: ac.TipoDeEnvio, arquivos: File[]): Promise<void>;
  /** abre um chamado novo (caixa areaClienteChamados); devolve o id. Na admissão, a foto do funcionário vai junto
   *  (o JPEG 256×256 em base64, sem o prefixo data:; só no exemplo: a caixa do banco ainda não tem campo para ela).
   *  Erro (link revogado, sem rede): joga um Error com a mensagem em português */
  abrirChamado(token: string, dados: { tipo: ac.TipoDeChamado; texto: string; foto?: string }): Promise<string>;
  /** a foto de um funcionário (o JPEG 256×256 em base64, sem o prefixo data:). No banco vai pela caixa areaClienteEnvios
   *  com o tipo 'foto' e o id do funcionário, e o robô grava no espelho e no Drive (o contrato e as regras ainda faltam) */
  enviarFotoDoFuncionario(token: string, funcionarioId: string, base64Jpeg: string): Promise<void>;
  /** a resposta do cliente num chamado que já existe */
  responderChamado(token: string, id: string, texto: string): Promise<void>;
  /** o PDF da guia; null quando não tem */
  baixarGuia(token: string, id: string): Promise<{ nome: string; arquivo: Blob } | null>;
  /** o arquivo de um documento do escritório (deixa de ser "novo"); null quando não tem */
  baixarDocumento(token: string, id: string): Promise<{ nome: string; arquivo: Blob } | null>;
  /** o comprovante de uma guia paga; null quando não tem */
  baixarComprovante(token: string, id: string): Promise<{ nome: string; arquivo: Blob } | null>;
}
