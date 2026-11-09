// O período da Importação no cabeçalho da Tarefa (Vitor, 04/11/2026: "o em lote deixa no cabeçalho"): o mesmo seletor que ficava
// na aba Bancos, com as duas abas — Competência (num mês só, troca o mês; no Em lote, mostra os meses dele) e Em Lote (de / até e
// Iniciar; no lote, os meses e o Cancelar função). Só a Importação troca o período; nas outras etapas fica o PeriodoDaTarefa.
import { tarefas } from '@nads/core';
import { Icone, MenuSuspenso } from '@nads/ui';
import { useState } from 'react';
import { CANCELAR_LOTE_A_QUALQUER_HORA } from '../../../../../comum/desenvolvimento';

export function SeletorDoPeriodo({ meses, competencia, concluido, trocar, encerrar }: {
  /** os meses do Em lote (vazio ou um só = um mês) */
  meses: readonly string[];
  competencia: string;
  /** todos os meses do lote concluídos */
  concluido: boolean;
  trocar: (competenciaOuPeriodo: string) => void;
  encerrar: () => void;
}) {
  const mmaaaa = tarefas.rotuloNumericoCompetencia;
  const periodo = meses.length > 1 ? meses : [];
  const competencias = tarefas.competenciasRecentes(new Date(), 24).filter(c => c >= tarefas.PRIMEIRA_COMPETENCIA);
  const [aba, setAba] = useState<'mes' | 'varios'>(periodo.length ? 'varios' : 'mes');
  const [de, setDe] = useState(competencias[Math.min(2, competencias.length - 1)] || competencia);
  const [ate, setAte] = useState(competencias[0] || competencia);
  const qtd = tarefas.competenciasDoPeriodo(tarefas.rotaDoPeriodo(de, ate)).length;
  const rotulo = periodo.length ? mmaaaa(periodo[0]) + ' a ' + mmaaaa(periodo[periodo.length - 1]) : tarefas.rotuloCurtoCompetencia(competencia);
  return (
    <MenuSuspenso icone="calendar" rotulo={rotulo} largura={300} direita
      dica={periodo.length ? 'Em lote: ' + periodo.map(mmaaaa).join(', ') : 'Trocar a competência'}
      className={'btn btn-primary' + (periodo.length ? ' imp-periodo-ativo' : '')}
      conteudo={fechar => (
        <div className="comp-pop">
          <div className="iniciar-abas comp-abas" role="tablist">
            <button type="button" role="tab" className="iniciar-aba" aria-selected={aba === 'mes'} onClick={() => setAba('mes')}>Competência</button>
            <button type="button" role="tab" className="iniciar-aba" aria-selected={aba === 'varios'} onClick={() => setAba('varios')}>
              Em Lote{periodo.length > 0 && <span className="imp-periodo-qtd">{periodo.length}</span>}
            </button>
          </div>
          {aba === 'mes' ? (
            <div className="comp-lista">
              {periodo.length ? periodo.map(c => (
                // no Em lote, a empresa fica em todos os meses juntos: a lista só mostra
                <span key={c} className="popover-item" role="menuitem" aria-disabled="true">
                  <span className="popover-marca"><Icone nome="check" /></span>
                  <span className="popover-texto">{tarefas.rotuloCompetencia(c)}</span>
                </span>
              )) : competencias.map(c => (
                <button key={c} type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); trocar(c); }}>
                  <span className="popover-marca">{c === competencia && <Icone nome="check" />}</span>
                  <span className="popover-texto">{tarefas.rotuloCompetencia(c)}</span>
                </button>
              ))}
            </div>
          ) : periodo.length ? (
            <div className="comp-varios">
              <p className="comp-varios-texto">A empresa está nos meses <b>{mmaaaa(periodo[0])} a {mmaaaa(periodo[periodo.length - 1])}</b> ({periodo.length} meses).</p>
              <div className="imp-mes-chips">{periodo.map(m => <span key={m} className="imp-mes-chip">{mmaaaa(m)}</span>)}</div>
              {concluido
                ? <p className="comp-varios-texto ok"><Icone nome="checkCircle" />Todos os meses concluídos: já dá para cancelar a função.</p>
                : CANCELAR_LOTE_A_QUALQUER_HORA
                  ? <p className="hint">Em desenvolvimento: dá para cancelar mesmo sem os meses concluídos. O que já foi feito em cada mês continua.</p>
                  : <p className="hint">Para cancelar a função, os {periodo.length} meses precisam estar 100% concluídos (todas as etapas). Até lá, a empresa abre sempre nesses meses.</p>}
              <button type="button" className="btn btn-primary comp-varios-botao" disabled={!concluido && !CANCELAR_LOTE_A_QUALQUER_HORA} onClick={() => { fechar(); encerrar(); }}>Cancelar função</button>
            </div>
          ) : (
            <div className="comp-varios">
              <p className="hint">A empresa abre nesses meses juntos e fica neles até todos estarem concluídos.</p>
              <div className="varios-de-ate">
                <label>De
                  <select value={de} onChange={e => setDe(e.target.value)}>
                    {competencias.map(c => <option key={c} value={c}>{mmaaaa(c)}</option>)}
                  </select>
                </label>
                <label>Até
                  <select value={ate} onChange={e => setAte(e.target.value)}>
                    {competencias.map(c => <option key={c} value={c}>{mmaaaa(c)}</option>)}
                  </select>
                </label>
              </div>
              <button type="button" className="btn btn-primary comp-varios-botao" disabled={qtd < 2} onClick={() => { fechar(); trocar(tarefas.rotaDoPeriodo(de, ate)); }}>
                {qtd > 1 ? 'Iniciar ' + qtd + ' meses' : 'Escolha dois meses ou mais'}
              </button>
            </div>
          )}
        </div>
      )} />
  );
}
