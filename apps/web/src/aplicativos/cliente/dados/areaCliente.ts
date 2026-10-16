// A Área do Cliente (Vitor, 16/10/2026): o site que o cliente abre por um LINK SECRETO, um por empresa, sem senha.
// Interface do repositório + os tipos do que a tela precisa; a versão de exemplo é areaCliente.memoria.ts. A do banco
// (areasCliente/{token} que o robô espelha; o cliente só cria nas caixas areaClienteEnvios e areaClienteChamados) ainda
// não existe.
import type { areaCliente as ac } from '@nads/core';

/** Tudo o que o link mostra, já filtrado pelo robô. */
export interface EstadoDaArea {
  carregado: boolean;
  /** false = o link não existe ou foi trocado: a tela não mostra dado nenhum */
  valido: boolean;
  resumo: ac.ResumoDoCliente | null;
  guias: ac.GuiaDoCliente[];
  /** um item por mês de vencimento (areasCliente/{token}/agenda/{AAAA-MM}) */
  agenda: ac.AgendaDoMes[];
  envios: ac.ReciboDeEnvio[];
  chamados: ac.ChamadoDoCliente[];
}

export const AREA_VAZIA: EstadoDaArea = { carregado: false, valido: false, resumo: null, guias: [], agenda: [], envios: [], chamados: [] };

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
}
