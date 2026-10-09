// A janela do andamento dos extratos (Vitor, 08/10/2026: "janela de andamento" no Contábil): a mesma peça do "Baixar XMLs
// do SIEG" (sieg-andamento, no catálogo) — o título com o tempo, a porcentagem, a barra, a linha do que está fazendo, os
// números e os passos que vão ficando verdes. No centro da tela, com o fundo embaçado (Vitor, 09/10/2026; o fundo das janelas,
// modal-overlay); no body: a página tem faixas com transform. Clicar fora não fecha (o trabalho está andando): só o ×.
import { Icone, type NomeIcone } from '@nads/ui';
import { createPortal } from 'react-dom';

export interface AndamentoDeExtratos {
  titulo: string;
  /** o tempo passado / quanto falta (ou "Concluído") */
  subtitulo: string;
  pct: number;
  pronto: boolean;
  detalhe: string;
  numeros: { rotulo: string; valor: number; tom: 'info' | 'ok' | 'aviso' | 'roxo'; icone: NomeIcone }[];
  passos: { texto: string; feito: boolean; atual: boolean; falhou?: boolean }[];
}

export function AndamentoDosExtratos({ a, fechar }: { a: AndamentoDeExtratos; fechar: () => void }) {
  return createPortal(
    <div className="modal-overlay" role="presentation">
    <div className="card gmail-andamento sieg-andamento andamento-centro" role="status" aria-live="polite">
      <div className="fgts-resumo-topo">
        <div className="fgts-resumo-titulo">
          <h3>{a.titulo}</h3>
          <span className="hint">{a.subtitulo}</span>
        </div>
        <b className="sieg-andamento-pct num">{a.pct}%</b>
        <button type="button" className="btn btn-ghost" onClick={fechar} aria-label="Fechar" title="Fechar"><Icone nome="x" /></button>
      </div>
      <span className={'tarefas-barra fgts-barra' + (a.pronto ? '' : ' andando')}><span style={{ width: a.pct + '%' }} /></span>
      {a.detalhe && <span className="fgts-robo-linha"><span className={'bolinha-sit ' + (a.pronto ? 'concluida' : 'em-andamento')} aria-hidden="true" />{a.detalhe}</span>}
      {a.numeros.length > 0 && (
        <div className="stat-grid sieg-andamento-numeros">
          {a.numeros.map(n => (
            <div key={n.rotulo} className={'stat painel-numero painel-' + n.tom}>
              <span className="painel-numero-icone" aria-hidden="true"><Icone nome={n.icone} /></span>
              <p className="stat-label">{n.rotulo}</p><p className="stat-value num">{n.valor}</p>
            </div>
          ))}
        </div>
      )}
      <ol className="fgts-passos sieg-andamento-passos">
        {a.passos.map((p, i) => (
          <li key={i + p.texto} className={p.feito && !p.falhou ? 'feito' : p.atual ? 'atual' : undefined}>
            <span className="fgts-passo-marca" aria-hidden="true">{p.falhou ? <Icone nome="alert" /> : p.feito ? <Icone nome="check" /> : i + 1}</span>
            <div>{p.atual ? <b>{p.texto}</b> : p.texto}</div>
          </li>
        ))}
      </ol>
      {/* pronto: o Ok fecha (Vitor, 09/10/2026) */}
      {a.pronto && <div className="btn-row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn btn-primary" onClick={fechar}>Ok</button></div>}
    </div>
    </div>,
    document.body,
  );
}

/** "1 min 05 s" / "42 s" */
export const tempo = (s: number) => (s >= 60 ? Math.floor(s / 60) + ' min ' + String(s % 60).padStart(2, '0') + ' s' : s + ' s');
