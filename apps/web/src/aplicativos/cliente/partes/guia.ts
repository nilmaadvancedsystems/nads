// O que o cartão e a linha de guia da Área do Cliente (Vitor, 16/10/2026) mostram igual: a sigla da guia e o selo do nads
// para a situação (Vencida vermelho, Vence hoje amarelo, A vencer neutro).
import type { areaCliente as ac } from '@nads/core';

export const siglaDaGuia = (tipo: ac.TipoDeGuia) => (tipo === 'outra' ? 'GUIA' : tipo);
export const SELO_DA_SITUACAO: Record<ac.SituacaoDaGuia, string> = { 'a vencer': 'badge badge-neutral', 'vence hoje': 'badge badge-warn', vencida: 'badge badge-bad' };
