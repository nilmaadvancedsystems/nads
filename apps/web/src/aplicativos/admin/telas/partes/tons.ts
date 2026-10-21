// O tom da saúde ("ok / atenção / erro / sem informação") nas peças do catálogo: o número do painel (painel-numero), o
// selo suave e a cor da barra do ranking.
import type { entregas } from '@nads/core';

type Tom = entregas.TomDaSaude;

export const TOM_DO_NUMERO: Record<Tom, string> = { ok: 'painel-ok', aviso: 'painel-aviso', erro: 'painel-laranja', neutro: 'painel-neutro' };
export const TOM_DO_SELO: Record<Tom, string> = { ok: 'badge-ok', aviso: 'badge-warn', erro: 'badge-bad', neutro: 'badge-neutral' };
export const COR_DA_BARRA: Record<Tom, string> = { ok: 'var(--success)', aviso: 'var(--warn)', erro: 'var(--danger)', neutro: 'var(--ink-muted)' };
