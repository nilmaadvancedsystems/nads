// Ao entrar em Minhas empresas (Vitor, 05/10/2026: "pergunte em uma popup qual competência ela quer seguir"): a janela
// com o mês, já no que a tela abriria. Volta do executor ou da página da empresa (a competência no endereço): não
// pergunta de novo.
import { classeDaJanela, Icone } from '@nads/ui';
import { useState } from 'react';

export function JanelaDaCompetencia({ competencias, competencia, onSeguir }: {
  competencias: { valor: string; rotulo: string }[];
  competencia: string;
  onSeguir: (c: string) => void;
}) {
  const [c, setC] = useState(competencia);
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) onSeguir(competencia); }}>
      <div className={classeDaJanela({}) + ' competencia-janela'} role="dialog" aria-modal="true" aria-labelledby="competenciaTitulo">
        <button type="button" className="modal-x" aria-label="Fechar" title="Fechar" onClick={() => onSeguir(competencia)}><Icone nome="x" /></button>
        <h3 id="competenciaTitulo">Selecione uma competência</h3>
        <label className="field competencia-campo">
          <select value={c} onChange={e => setC(e.target.value)} aria-label="Competência" autoFocus>
            {competencias.map(m => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
          </select>
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" onClick={() => onSeguir(c)}>Selecionar</button>
        </div>
      </div>
    </div>
  );
}
