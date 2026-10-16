// O que o cartão e a linha de guia da Área do Cliente (Vitor, 16/10/2026) mostram igual: a sigla no quadradinho e a cor do
// selo da situação.
import type { areaCliente as ac } from '@nads/core';

export const siglaDaGuia = (tipo: ac.TipoDeGuia) => (tipo === 'outra' ? 'GUIA' : tipo);
export const CLASSE_DA_SITUACAO: Record<ac.SituacaoDaGuia, string> = { 'a vencer': 'cli-selo-info', 'vence hoje': 'cli-selo-warn', vencida: 'cli-selo-bad' };
