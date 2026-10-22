// O ranking com a marca (Admin › Arquivador, 22/10/2026): o Ranking do catálogo (rank, rank-item, rank-barra) com a logo do
// órgão (Simples, Receita, FGTS, Minas), o ícone do formato do arquivo (XML, TXT, XLS) ou um ícone do nads na frente de
// cada barra. As barras são SVG-livres (largura em %), proporcionais à maior; no claro e no escuro pelos tokens. Peça do
// catálogo (Gráficos).
import { entregas } from '@nads/core';
import { Icone, IconeDeArquivo, LogoFgts, LogoGovernoMinas, LogoReceitaFederal, LogoSimplesNacional, type FormatoDoArquivo, type NomeIcone } from '@nads/ui';
import type { ReactNode } from 'react';

export interface BarraComMarca {
  chave: string; rotulo: string; n: number;
  /** 0 a 100: a largura da barra (a maior = 100) */
  pct: number;
  marca?: entregas.MarcaDoTipo; formato?: FormatoDoArquivo | null; icone?: NomeIcone | null;
  dica?: string;
}

const LOGO: Record<Exclude<entregas.MarcaDoTipo, null>, () => ReactNode> = {
  simples: () => <LogoSimplesNacional />, receita: () => <LogoReceitaFederal />, fgts: () => <LogoFgts cor />, minas: () => <LogoGovernoMinas />,
};

/** A marca da barra: a logo, o ícone do arquivo ou o ícone (sempre 20 px). */
export function MarcaDaBarra({ marca, formato, icone }: Pick<BarraComMarca, 'marca' | 'formato' | 'icone'>) {
  if (marca) return <span className="rank-marca logo" aria-hidden="true" style={{ width: 20, height: 20 }}>{LOGO[marca]()}</span>;
  if (formato) return <span className="rank-marca" aria-hidden="true"><IconeDeArquivo formato={formato} tamanho={20} /></span>;
  if (icone) return <span className="rank-marca icone" aria-hidden="true"><Icone nome={icone} width={14} height={14} /></span>;
  return null;
}

/** O ranking: uma linha por barra, com a marca, o rótulo, o número e a barra; tom ok (verde) ou marca (carmim). */
export function RankingComMarca({ barras, tom = 'ok', vazio }: { barras: readonly BarraComMarca[]; tom?: 'ok' | 'marca'; vazio?: ReactNode }) {
  if (!barras.length) return <>{vazio ?? null}</>;
  const comMarca = barras.some(b => b.marca || b.formato || b.icone);
  return (
    <div className={'rank rank-com-marca' + (comMarca ? '' : ' sem-marca')}>
      {barras.map(b => (
        <div key={b.chave} className="rank-item" title={b.dica || undefined}>
          {comMarca && <MarcaDaBarra marca={b.marca} formato={b.formato} icone={b.icone} />}
          <span className="rank-nome">{b.rotulo}</span>
          <span className="rank-val num">{b.n.toLocaleString('pt-BR')}</span>
          <span className="rank-barra"><span style={{ width: b.pct + '%', background: tom === 'ok' ? 'var(--success)' : 'var(--accent)' }} /></span>
        </div>
      ))}
    </div>
  );
}
