// Ao entrar em Minhas empresas (Vitor, 05/10/2026: "pergunte em uma popup qual competência ela quer seguir"): uma grade
// de meses, com o ano em cima e as setas para trocar de ano ("quero uma coisa mais interativa"). Um clique escolhe, dois
// cliques já seguem; os meses fora da lista ficam apagados. Volta do executor ou da página da empresa (a competência no
// endereço): não pergunta de novo.
import { classeDaJanela, Icone } from '@nads/ui';
import { useState } from 'react';

const NOMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export function JanelaDaCompetencia({ competencias, competencia, onSeguir }: {
  competencias: { valor: string; rotulo: string }[];
  competencia: string;
  onSeguir: (c: string) => void;
}) {
  const [c, setC] = useState(competencia);
  const [ano, setAno] = useState(Number(competencia.slice(0, 4)));
  const anos = [...new Set(competencias.map(m => Number(m.valor.slice(0, 4))))].sort();
  const pode = new Set(competencias.map(m => m.valor));
  const rotulo = competencias.find(m => m.valor === c)?.rotulo || c;
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) onSeguir(competencia); }}>
      <div className={classeDaJanela({}) + ' competencia-janela'} role="dialog" aria-modal="true" aria-labelledby="competenciaTitulo">
        <button type="button" className="modal-x" aria-label="Fechar" title="Fechar" onClick={() => onSeguir(competencia)}><Icone nome="x" /></button>
        <h3 id="competenciaTitulo">Selecione uma competência</h3>
        <div className="comp-ano">
          <button type="button" className="comp-seta" aria-label="Ano anterior" disabled={ano <= anos[0]} onClick={() => setAno(a => a - 1)}><Icone nome="chevronLeft" /></button>
          <b>{ano}</b>
          <button type="button" className="comp-seta" aria-label="Próximo ano" disabled={ano >= anos[anos.length - 1]} onClick={() => setAno(a => a + 1)}><Icone nome="chevronRight" /></button>
        </div>
        <div className="comp-grade" role="grid" aria-label={'Meses de ' + ano}>
          {NOMES.map((nome, i) => {
            const valor = ano + '-' + String(i + 1).padStart(2, '0');
            return (
              <button key={valor} type="button" className={'comp-mes' + (valor === c ? ' on' : '') + (valor === competencia ? ' atual' : '')}
                disabled={!pode.has(valor)} aria-pressed={valor === c} title={competencias.find(m => m.valor === valor)?.rotulo}
                onClick={() => setC(valor)} onDoubleClick={() => onSeguir(valor)}>
                {nome}
                {valor === competencia && <span className="comp-mes-ponto" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary comp-selecionar" autoFocus onClick={() => onSeguir(c)} title={rotulo}>Selecionar</button>
        </div>
      </div>
    </div>
  );
}
