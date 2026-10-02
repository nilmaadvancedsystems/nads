// O seletor de competência das telas de iniciar (Minhas empresas e a página da empresa), com duas abas como o "Code ▾"
// do GitHub (Vitor, 02/10/2026: "se já configurou qual mês está mexendo, começa o mês que escolheu antes"): Competência
// (um mês) e Em lote (De e Até). O Iniciar começa no que estiver escolhido aqui, sem perguntar de novo.
import { tarefas as t } from '@nads/core';
import { Icone, MenuSuspenso } from '@nads/ui';
import { useState } from 'react';

export function SeletorDoInicio({ competencias, competencia, lote, onCompetencia, onLote, direita }: {
  competencias: { valor: string; rotulo: string }[];
  competencia: string;
  /** o período do Em lote ('aaaa-mm..aaaa-mm'), ou '' */
  lote: string;
  onCompetencia: (c: string) => void;
  onLote: (rota: string) => void;
  direita?: boolean;
}) {
  const meses = lote ? t.competenciasDoPeriodo(lote) : [];
  const [aba, setAba] = useState<'mes' | 'lote'>(lote ? 'lote' : 'mes');
  const ordem = [...competencias].sort((a, b) => a.valor.localeCompare(b.valor));
  const [de, setDe] = useState(meses[0] || competencia);
  const [ate, setAte] = useState(meses[meses.length - 1] || competencia);
  const qtd = t.competenciasDoPeriodo(t.rotaDoPeriodo(de, ate)).length;
  const rotulo = meses.length > 1 ? t.rotuloNumericoCompetencia(meses[0]) + ' a ' + t.rotuloNumericoCompetencia(meses[meses.length - 1]) : t.rotuloCompetencia(competencia);
  return (
    <MenuSuspenso icone="calendar" rotulo={rotulo} titulo="Competência" dica="Trocar a competência ou fazer em lote" direita={direita} largura={300}
      conteudo={fechar => (
        <div className="comp-pop">
          <div className="iniciar-abas comp-abas" role="tablist">
            <button type="button" role="tab" className="iniciar-aba" aria-selected={aba === 'mes'} onClick={() => setAba('mes')}>Competência</button>
            <button type="button" role="tab" className="iniciar-aba" aria-selected={aba === 'lote'} onClick={() => setAba('lote')}>Em lote</button>
          </div>
          {aba === 'mes' ? (
            <div className="comp-lista">
              {competencias.map(c => (
                <button key={c.valor} type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); onCompetencia(c.valor); }}>
                  <span className="popover-marca">{!lote && c.valor === competencia && <Icone nome="check" />}</span>
                  <span className="popover-texto">{c.rotulo}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="comp-varios">
              <div className="periodo-campos" style={{ margin: 0 }}>
                <label className="field"><span>De</span>
                  <select value={de} onChange={e => { setDe(e.target.value); if (ate < e.target.value) setAte(e.target.value); }}>{ordem.map(m => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}</select>
                </label>
                <label className="field"><span>Até</span>
                  <select value={ate} onChange={e => { setAte(e.target.value); if (de > e.target.value) setDe(e.target.value); }}>{ordem.map(m => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}</select>
                </label>
              </div>
              <p className="hint">{qtd > 1 ? qtd + ' meses, todas as etapas de uma vez' : 'Escolha dois meses ou mais'}</p>
              <button type="button" className="btn btn-primary comp-varios-botao" disabled={qtd < 2} onClick={() => { fechar(); onLote(t.rotaDoPeriodo(de, ate)); }}>Usar {qtd > 1 ? qtd + ' meses' : ''}</button>
            </div>
          )}
        </div>
      )} />
  );
}
