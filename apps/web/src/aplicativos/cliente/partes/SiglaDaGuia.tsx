// O quadradinho da guia na Área do Cliente (Vitor, 16 e 17/10/2026: "a logo de cada guia no quadradinho"): a logo do
// órgão num fundo claro (claro também no tema escuro, para a logo aparecer) com a borda fina. DAS → Simples Nacional,
// DAE → Governo de Minas, FGTS → FGTS, DARF/INSS/DCTFWeb → Receita Federal, honorários → o N da Nilma; sem logo (a
// "outra" guia), a sigla. Peça do catálogo (Logos).
import { areaCliente as ac } from '@nads/core';
import { LogoFgts, LogoGovernoMinas, LogoReceitaFederal, LogoSimplesNacional, MarcaN } from '@nads/ui';
import type { ReactNode } from 'react';
import type { TipoDoQuadradinho } from '../dados/areaCliente';
import { siglaDaGuia } from './guia';

const LOGO: Partial<Record<TipoDoQuadradinho, { logo: ReactNode; /** a fração do quadradinho que a logo ocupa */ escala: number }>> = {
  DAS: { logo: <LogoSimplesNacional />, escala: 0.66 },
  DAE: { logo: <LogoGovernoMinas />, escala: 0.62 },
  FGTS: { logo: <LogoFgts cor />, escala: 0.76 },
  DARF: { logo: <LogoReceitaFederal />, escala: 0.7 },
  INSS: { logo: <LogoReceitaFederal />, escala: 0.7 },
  DCTFWeb: { logo: <LogoReceitaFederal />, escala: 0.7 },
  HON: { logo: <MarcaN />, escala: 0.56 },
};
const NOME: Record<Exclude<TipoDoQuadradinho, ac.TipoDeGuia>, string> = { DARF: 'DARF (Receita Federal)', INSS: 'INSS (Receita Federal)', DCTFWeb: 'DCTFWeb (Receita Federal)', HON: 'Honorários do escritório' };

export function SiglaDaGuia({ tipo, tamanho = 44 }: { tipo: TipoDoQuadradinho; /** em px */ tamanho?: number }) {
  const l = LOGO[tipo];
  const nome = tipo in NOME ? NOME[tipo as keyof typeof NOME] : ac.ROTULO_DA_GUIA[tipo as ac.TipoDeGuia];
  const lado = Math.round(tamanho * (l?.escala ?? 1));
  return (
    <span className={'cli-sigla' + (l ? ' com-logo' : '')} style={{ width: tamanho, height: tamanho }} title={nome}>
      {l ? <span className="cli-sigla-logo" style={{ width: lado, height: lado }}>{l.logo}</span> : siglaDaGuia(tipo as ac.TipoDeGuia)}
    </span>
  );
}

/** os tipos que já têm logo (o resto mostra a sigla) */
export const TIPOS_COM_LOGO = Object.keys(LOGO) as TipoDoQuadradinho[];
