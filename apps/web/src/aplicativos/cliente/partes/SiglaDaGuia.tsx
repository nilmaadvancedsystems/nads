// O quadradinho da guia na Área do Cliente (Vitor, 16/10/2026: "a logo de cada guia no quadradinho"): a logo do órgão
// ou do programa num fundo claro com a borda fina, e a sigla quando a logo ainda não existe no nads. Hoje só o FGTS tem
// logo (LogoFgts, do pacote do nads); o DAS (Simples Nacional), o DAE (SEFAZ-MG) e a outra guia ficam com a sigla até
// o Vitor mandar as logos. Peça do catálogo (Logos).
import { areaCliente as ac } from '@nads/core';
import { LogoFgts } from '@nads/ui';
import type { ReactNode } from 'react';
import { siglaDaGuia } from './guia';

const LOGO: Partial<Record<ac.TipoDeGuia, ReactNode>> = { FGTS: <LogoFgts cor /> };

export function SiglaDaGuia({ tipo, tamanho = 44 }: { tipo: ac.TipoDeGuia; /** em px */ tamanho?: number }) {
  const logo = LOGO[tipo];
  return (
    <span className={'cli-sigla' + (logo ? ' com-logo' : '')} style={{ width: tamanho, height: tamanho }} title={ac.ROTULO_DA_GUIA[tipo]}>
      {logo ? <span className="cli-sigla-logo" style={{ width: Math.round(tamanho * 0.74), height: Math.round(tamanho * 0.74) }}>{logo}</span> : siglaDaGuia(tipo)}
    </span>
  );
}

/** os tipos que já têm logo (o resto mostra a sigla) */
export const TIPOS_COM_LOGO = Object.keys(LOGO) as ac.TipoDeGuia[];
