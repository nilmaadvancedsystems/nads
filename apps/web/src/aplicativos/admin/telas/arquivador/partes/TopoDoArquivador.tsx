// O topo do Arquivador (Vitor, 22/10/2026: "se possível algo bem visual"): o modo num selo grande (Produção verde,
// Simulação âmbar, Desligado cinza), a situação de agora com o ponto colorido e o último sinal, os botões (Arquivar agora,
// Parar) à direita; embaixo, a barra de progresso da passada ("1.240 de 17.158"), a porcentagem, a previsão de término e
// o ritmo. A barra só avança com os dados (sem animação). Peça do catálogo (Cartões).
import type { ReactNode } from 'react';

export type TomDoTopo = 'ok' | 'aviso' | 'erro' | 'neutro';
export interface DadosDoTopo {
  modo: { rotulo: string; tom: TomDoTopo; texto: string };
  situacao: { tom: TomDoTopo; titulo: string; texto: string };
  ultimoSinal?: string;
  progresso?: { texto: string; pct: number; previsao: string; inicio?: string; terminou: boolean } | null;
  ritmo?: string;
}

export function TopoDoArquivador({ t, acoes }: { t: DadosDoTopo; acoes?: ReactNode }) {
  return (
    <div className="card arq-topo">
      <div className="arq-topo-linha">
        <span className={'arq-modo ' + t.modo.tom} title={t.modo.texto}>{t.modo.rotulo}</span>
        <div className="arq-topo-situacao">
          <b><span className={'arq-ponto ' + t.situacao.tom} aria-hidden="true" />{t.situacao.titulo}</b>
          <span className="fraco">{t.situacao.texto}{t.ultimoSinal ? ' · ' + t.ultimoSinal : ''}</span>
        </div>
        {acoes && <div className="arq-topo-acoes">{acoes}</div>}
      </div>
      {t.progresso ? (
        <div className="arq-progresso">
          <div className="arq-progresso-linha">
            <b className="num">{t.progresso.texto}</b>
            <span className="arq-progresso-pct num">{t.progresso.pct}%</span>
          </div>
          <span className="tarefas-barra larga arq-progresso-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={t.progresso.pct} aria-label={t.progresso.texto}>
            <span style={{ width: t.progresso.pct + '%' }} />
          </span>
          <div className="arq-progresso-linha fraco">
            <span>{t.progresso.previsao}{t.progresso.inicio ? ' · ' + t.progresso.inicio : ''}</span>
            {t.ritmo && <span className="num">Ritmo: {t.ritmo}</span>}
          </div>
        </div>
      ) : t.ritmo ? <p className="arq-progresso-linha fraco">Ritmo: {t.ritmo}</p> : null}
    </div>
  );
}
