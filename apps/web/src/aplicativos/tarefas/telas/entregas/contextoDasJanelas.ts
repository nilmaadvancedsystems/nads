// As janelas da entrega de documentos (16/10/2026, a cópia fiel do Entregas): como no entregas.html, uma janela por vez —
// abrir a assinatura no celular do cliente troca a janela da parada pela do QR, e voltar remonta a parada; a página do
// cliente abre a entrega e o "✕" da entrega volta para a página. Cada página do módulo (Nova entrega, Rota, Painel) tem o
// seu lugar das janelas (JanelasDasEntregas); quem quer abrir uma pede aqui.
import { createContext, useContext } from 'react';
import type { entregas } from '@nads/core';

type Entrega = ReturnType<typeof entregas.entregaDoDocumento>;

export type JanelaDaEntrega =
  /** confirmar a parada (openConfirmPendingModal); `assinatura`: a que o cliente fez no celular dele */
  | { tipo: 'parada'; entrega: Entrega; assinatura?: { assinatura: string; recebedor: string } }
  /** as paradas do mesmo lugar assinadas juntas (openConfirmLoteModal_) */
  | { tipo: 'juntas'; titulo: string; entregas: Entrega[] }
  /** "Não esqueça de falar com o cliente" (logo depois de concluir) */
  | { tipo: 'lembretes'; clientes: { id: string; nome: string }[] }
  /** o QR para o cliente assinar no celular dele */
  | { tipo: 'assinarNoCelular'; entrega: Entrega }
  /** a câmera lê o código de barras (ou o QR do PIX) da guia */
  | { tipo: 'lerGuia' }
  /** a página do cliente; `consulta`: só ler (como o Painel abre) */
  | { tipo: 'cliente'; clienteId: string; consulta: boolean; aba?: string }
  /** a entrega feita (renderHistoricoDetail); `voltar`: a janela de onde veio */
  | { tipo: 'entrega'; entrega: Entrega; nome: string; clienteId: string | null; voltar: JanelaDaEntrega | null }
  | { tipo: 'corrigirLocal'; clienteId: string; voltar: JanelaDaEntrega | null }
  | { tipo: 'aglutinar'; clienteId: string; voltar: JanelaDaEntrega | null }
  | { tipo: 'link'; clienteId: string }
  | { tipo: 'meta' }
  | { tipo: 'semEntrega'; ids: string[] }
  | { tipo: 'copiar'; titulo: string; texto: string };

export interface ControleDasJanelas {
  aberta: JanelaDaEntrega | null;
  abrir(j: JanelaDaEntrega): void;
  fechar(): void;
}

export const CtxDasJanelas = createContext<ControleDasJanelas | null>(null);

export function useJanelasDasEntregas(): ControleDasJanelas {
  const c = useContext(CtxDasJanelas);
  if (!c) throw new Error('useJanelasDasEntregas fora do JanelasDasEntregas');
  return c;
}
