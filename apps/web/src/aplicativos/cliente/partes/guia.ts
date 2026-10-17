// O que o cartão e a linha de guia da Área do Cliente (Vitor, 16/10/2026) mostram igual: o selo só quando informa algo
// (vencida ou vence hoje; a vencer fica sem selo).
import type { areaCliente as ac } from '@nads/core';

export const SELO_DA_SITUACAO: Record<ac.SituacaoDaGuia, string> = { 'a vencer': '', 'vence hoje': 'badge badge-warn', vencida: 'badge badge-bad' };
