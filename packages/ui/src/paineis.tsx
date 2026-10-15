// As peças dos painéis com gráfico (Savio, 15/10/2026: "aprimorar o Dashboard do Departamento Pessoal para que fique
// semelhante ao do Certificados Digital, mantendo-se assim um padrão"): a rosca com a legenda que filtra, as barras em
// coluna (a barra filtra) e o cartão com o anel da contagem regressiva saíram de Senhas › Certificados para cá, e agora
// o Certificados e o Painel do DP usam as mesmas. As classes continuam cert-* (o visual de Certificados não mudou, e a
// camada global de animação já conhece a rosca, o número e a barra pelas classes).
import type { ReactNode } from 'react';

/** a cor de cada fatia, barra ou anel: ok (verde), aviso (âmbar), perigo (vermelho), neutro (cinza) */
export type TomDoPainel = 'ok' | 'aviso' | 'perigo' | 'neutro';
const COR: Record<TomDoPainel, string> = { ok: 'ok', aviso: 'vence', perigo: 'vencido', neutro: 'sem' };
/** o raio do círculo com circunferência 100 (as fatias em porcentagem) */
const R = 15.915;

export interface FatiaDaRosca { id: string; rotulo: string; valor: number; tom: TomDoPainel }

/** A rosca das situações com a legenda ao lado; clicar na fatia ou na legenda escolhe (o pai filtra a lista). */
export function RoscaComLegenda({ fatias, total, subtitulo, ativa, onEscolher }: {
  fatias: readonly FatiaDaRosca[]; total: number; subtitulo: string; ativa: string | null; onEscolher: (id: string) => void;
}) {
  const soma = fatias.reduce((s, f) => s + f.valor, 0) || 1;
  let antes = 0;
  return (
    <div className="cert-rosca">
      <svg viewBox="0 0 42 42" className="cert-rosca-svg" role="img" aria-label={fatias.map(f => f.rotulo + ' ' + f.valor).join(', ')}>
        <circle cx="21" cy="21" r={R} className="cert-rosca-fundo" />
        {fatias.map(f => {
          const pct = (f.valor / soma) * 100;
          const fatia = pct > 0 && (
            <circle key={f.id} cx="21" cy="21" r={R} className={'cert-rosca-fatia cert-cor-' + COR[f.tom] + (ativa === f.id ? ' ativa' : '')}
              strokeDasharray={pct + ' ' + (100 - pct)} strokeDashoffset={25 - antes} onClick={() => onEscolher(f.id)} />
          );
          antes += pct;
          return fatia;
        })}
        <text x="21" y="20.5" className="cert-rosca-total">{total}</text>
        <text x="21" y="26" className="cert-rosca-sub">{subtitulo}</text>
      </svg>
      <ul className="cert-legenda">
        {fatias.map(f => (
          <li key={f.id}>
            <button type="button" className={'cert-legenda-item' + (ativa === f.id ? ' ativo' : '')} onClick={() => onEscolher(f.id)}>
              <span className={'cert-legenda-cor cert-cor-' + COR[f.tom]} aria-hidden="true" />
              <span>{f.rotulo}</span>
              <b className="num">{f.valor}</b>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface ColunaDasBarras {
  chave: string; rotulo: string; total: number;
  /** o pequeno rótulo de baixo (o ano, nas barras de meses) */
  sub?: string;
  /** a barra no tom de aviso (âmbar) em vez do verde */
  aviso?: boolean;
  /** o texto do leitor de tela da barra */
  leitura: string;
}

/** As barras em coluna (uma por mês, etapa…); a altura é proporcional ao maior; clicar escolhe, de novo desfaz (no pai). */
export function BarrasEmColuna({ colunas, ativa, onEscolher }: { colunas: readonly ColunaDasBarras[]; ativa: string | null; onEscolher: (chave: string) => void }) {
  const max = Math.max(1, ...colunas.map(m => m.total));
  return (
    <div className="cert-barras" style={{ gridTemplateColumns: 'repeat(' + colunas.length + ', 1fr)' }}>
      {colunas.map(m => (
        <button key={m.chave} type="button" className={'cert-barra' + (ativa === m.chave ? ' ativa' : '') + (m.aviso ? ' logo' : '')} disabled={!m.total}
          onClick={() => onEscolher(m.chave)} aria-label={m.leitura}>
          <span className="cert-barra-num num">{m.total || ''}</span>
          <span className="cert-barra-trilho"><span className="cert-barra-cheia" style={{ height: (m.total / max) * 100 + '%' }} /></span>
          <span className="cert-barra-mes">{m.rotulo}</span>
          <span className="cert-barra-ano fraco">{m.sub || ''}</span>
        </button>
      ))}
    </div>
  );
}

/** O anel da contagem regressiva: cheio = o ciclo (30 dias); atrasado (dias < 0) = o anel inteiro no tom de perigo. */
export function AnelDeContagem({ dias, ciclo = 30 }: { dias: number; ciclo?: number }) {
  const atrasado = dias < 0;
  const pct = atrasado ? 100 : Math.max(4, Math.min(100, (dias / ciclo) * 100));
  return (
    <span className={'cert-contagem ' + (atrasado ? 'cert-cor-vencido' : 'cert-cor-vence')}>
      <svg viewBox="0 0 42 42" aria-hidden="true">
        <circle cx="21" cy="21" r={R} className="cert-rosca-fundo" />
        <circle cx="21" cy="21" r={R} className="cert-contagem-arco" strokeDasharray={pct + ' ' + (100 - pct)} strokeDashoffset={25} />
      </svg>
      <span className={'cert-contagem-num num' + (Math.abs(dias) >= 100 ? ' longo' : '')}>{Math.abs(dias)}</span>
    </span>
  );
}

/** O cartão de quem pede atenção: o anel dos dias, o nome, o prazo colorido e uma linha de apoio; clicar abre. */
export function CartaoComAnel({ dias, ciclo, titulo, prazo, apoio, atrasado, classe, dica, onClick }: {
  dias: number; ciclo?: number; titulo: string; prazo: string; apoio?: ReactNode; atrasado: boolean; classe?: string; dica?: string; onClick?: () => void;
}) {
  const tom = atrasado ? 'vencido' : 'vence';
  return (
    <button type="button" className={'card cert-urgente ' + tom + (classe ? ' ' + classe : '')} title={dica} onClick={onClick}>
      <AnelDeContagem dias={dias} ciclo={ciclo} />
      <span className="cert-urgente-texto">
        <b>{titulo}</b>
        <span className={'cert-urgente-prazo ' + tom}>{prazo}</span>
        {apoio != null && <span className="fraco num">{apoio}</span>}
      </span>
    </button>
  );
}
