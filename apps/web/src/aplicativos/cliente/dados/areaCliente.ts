// A Área do Cliente (Vitor, 16/10/2026): o site que o cliente abre por um LINK SECRETO, um por empresa, sem senha.
// Interface do repositório + os tipos do que a tela precisa; a versão de exemplo é areaCliente.memoria.ts e a do banco é
// areaCliente.firestore.ts (lê o espelho areasCliente/{token} que o robô grava; o cliente só cria nas caixas
// areaClienteEnvios e areaClienteChamados).
// As seções que vieram do protótipo do Vitor (documentos, certificado, empregados, ficha da empresa, atendimento, avisos e
// guias pagas) ainda não têm tipo no core nem fonte no banco: os tipos simples ficam aqui, só a versão de exemplo os
// preenche, e `secoes` diz à tela o que esconder quando o repositório não tem de onde tirar.
import type { areaCliente as ac, mandei } from '@nads/core';
import type { FormatoDoArquivo } from '@nads/ui';
import type { DanfeNoEspelho } from './biblioteca';

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
  /** cada setor com o e-mail e o WhatsApp dele (13/11/2026: "colocar número dos setores do WhatsApp") */
  setores: { nome: string; email: string; whatsapp?: string }[];
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
  /** o Registro (12/11/2026): os funcionários pelas guias do FGTS e os documentos do DP; no banco, quando o robô gravou */
  dp: boolean;
  /** as guias já pagas, com o comprovante */
  pagas: boolean;
}
export const TODAS_AS_SECOES: SecoesDaArea = { documentos: true, dp: true, pagas: true };
/**
 * o que o banco tem hoje (17/10/2026): o robô espelha guias, agenda, recibos de envio e chamados; o Registro (12/11/2026)
 * fica sempre no menu ("as opções do dp que pedi"): sem funcionário nem documento ainda, a aba diz o que vai aparecer
 */
export const SECOES_DO_BANCO: SecoesDaArea = { documentos: false, dp: true, pagas: false };

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
  /** o Registro (12/11/2026): os funcionários (resumo/pessoal) e os documentos do DP (documentos com tipo 'dp') */
  pessoal: ac.ResumoDoPessoal | null;
  documentosDp: ac.DocumentoDoDp[];
  /** o Faturamento (12/11/2026): os 12 meses de cada empresa pelas notas emitidas no SIEG (resumo/faturamento) */
  faturamento: ac.ResumoDoFaturamento | null;
  /** a logo da empresa (12/11/2026), que o gestor põe no nads: data URL (resumo/marca); null = o ícone do prédio */
  logo: string | null;
  /** as DANFEs que o cliente já pediu e estão no espelho (documentos/danfe-<chave>): a pasta Notas da Central */
  danfes: DanfeNoEspelho[];
  ficha: FichaDaEmpresa | null;
  atendimento: Atendimento | null;
  avisos: AvisoDoEscritorio[];
  /**
   * Os tickets do Mandei esperando o cliente (11/11/2026: o que o escritório pede, num lugar só, como no Liscio e no G-Click
   * da Omie). Por enquanto só nos dados de exemplo: o banco ainda não liga o Mandei (o robô não espelha os tickets).
   */
  tickets: mandei.TicketNaArea[];
}

export const AREA_VAZIA: EstadoDaArea = {
  carregado: false, valido: false, erro: '', exemplos: false, secoes: SECOES_DO_BANCO, resumo: null, guias: [], codigos: {}, pagas: [], agenda: [], envios: [], chamados: [],
  documentos: [], certificado: null, pessoal: null, documentosDp: [], faturamento: null, logo: null, danfes: [], ficha: null, atendimento: null, avisos: [], tickets: [],
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
  /** a resposta do cliente num chamado que já existe */
  responderChamado(token: string, id: string, texto: string): Promise<void>;
  /** o PDF da guia; null quando não tem */
  baixarGuia(token: string, id: string): Promise<{ nome: string; arquivo: Blob } | null>;
  /** o arquivo de um documento do escritório (deixa de ser "novo"); null quando não tem */
  baixarDocumento(token: string, id: string): Promise<{ nome: string; arquivo: Blob } | null>;
  /** o comprovante de uma guia paga; null quando não tem */
  baixarComprovante(token: string, id: string): Promise<{ nome: string; arquivo: Blob } | null>;
  /** um documento do DP do Registro (a folha, o recibo, as férias…); null quando não tem */
  baixarDocumentoDp(token: string, id: string): Promise<{ nome: string; arquivo: Blob } | null>;
  /** as notas emitidas de um mês da empresa (o relatório do dia; resumo/notas-{código}-{mês}); null = ainda não chegou */
  notasDoMes(token: string, codigo: number, mes: string): Promise<ac.NotaDoRelatorio[] | null>;
  /** os lançamentos do mês pelos extratos (13/11/2026; resumo/extrato-{código}-{mês}); null = ainda não chegou */
  extratoDoMes(token: string, codigo: number, mes: string): Promise<{ lancamentos: ac.LancamentoDoCliente[]; cortados: number } | null>;
  /** a DANFE da nota (12/11/2026): pede ao robô pela caixa dos chamados e espera o PDF no espelho; ou o porquê de não vir */
  pedirDanfe(token: string, chave: string): Promise<{ nome: string; arquivo: Blob } | { erro: string }>;
}
