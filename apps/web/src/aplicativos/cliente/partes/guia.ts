// O que o cartão e a linha de guia da Área do Cliente (Vitor, 16/10/2026) mostram igual: a sigla da guia e o selo suave da
// situação (vencida em vermelho, vence hoje em atenção, a vencer neutro).
import type { areaCliente as ac } from '@nads/core';

export const siglaDaGuia = (tipo: ac.TipoDeGuia) => (tipo === 'outra' ? 'GUIA' : tipo);
export const SELO_DA_SITUACAO: Record<ac.SituacaoDaGuia, string> = { 'a vencer': 'cli-selo', 'vence hoje': 'cli-selo atencao', vencida: 'cli-selo ruim' };
