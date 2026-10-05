// Ao entrar em Minhas empresas (Vitor, 05/10/2026: "pergunte em uma popup qual competência ela quer seguir"): uma grade
// de meses, com o ano em cima e as setas para trocar de ano ("quero uma coisa mais interativa"). Um clique escolhe, dois
// cliques já seguem; os meses fora da lista ficam apagados. Volta do executor ou da página da empresa (a competência no
// endereço): não pergunta de novo.
// Mais enxuta (Vitor, 05/10/2026): sem o título e sem o Selecionar (dois cliques no mês — ou Enter — abrem); só de 2026
// para frente (a seta da esquerda só aparece para voltar a um ano depois de 2026); os meses em blocos (3 por linha, como o exemplo que ele mandou, nas cores do sistema), sem o ponto.
import { classeDaJanela, Icone } from '@nads/ui';
import { useState } from 'react';

const NOMES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
/** antes disso, nada (o sistema começou em 2026) */
const PRIMEIRO_ANO = 2026;

export function JanelaDaCompetencia({ competencias, competencia, onSeguir }: {
  competencias: { valor: string; rotulo: string }[];
  competencia: string;
  onSeguir: (c: string) => void;
}) {
  const [c, setC] = useState(competencia);
  const [ano, setAno] = useState(Math.max(PRIMEIRO_ANO, Number(competencia.slice(0, 4))));
  const anos = [...new Set(competencias.map(m => Number(m.valor.slice(0, 4))))].filter(a => a >= PRIMEIRO_ANO).sort();
  const pode = new Set(competencias.map(m => m.valor).filter(v => Number(v.slice(0, 4)) >= PRIMEIRO_ANO));
  const ultimoAno = anos[anos.length - 1] ?? PRIMEIRO_ANO;
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) onSeguir(competencia); }}>
      <div className={classeDaJanela({}) + ' competencia-janela'} role="dialog" aria-modal="true" aria-label="Competência">
        <button type="button" className="modal-x" aria-label="Fechar" title="Fechar" onClick={() => onSeguir(competencia)}><Icone nome="x" /></button>
        <div className="comp-ano">
          {ano > PRIMEIRO_ANO ? <button type="button" className="comp-seta" aria-label="Ano anterior" onClick={() => setAno(a => a - 1)}><Icone nome="chevronLeft" /></button> : <span className="comp-seta" aria-hidden="true" />}
          <b>{ano}</b>
          {ano < ultimoAno ? <button type="button" className="comp-seta" aria-label="Próximo ano" onClick={() => setAno(a => a + 1)}><Icone nome="chevronRight" /></button> : <span className="comp-seta" aria-hidden="true" />}
        </div>
        <div className="comp-grade" role="grid" aria-label={'Meses de ' + ano}>
          {NOMES.map((nome, i) => {
            const valor = ano + '-' + String(i + 1).padStart(2, '0');
            return (
              <button key={valor} type="button" className={'comp-mes' + (valor === c ? ' on' : '') + (valor === competencia ? ' atual' : '')}
                disabled={!pode.has(valor)} aria-pressed={valor === c} autoFocus={valor === c}
                title={pode.has(valor) ? (competencias.find(m => m.valor === valor)?.rotulo || '') + ' — dois cliques para abrir' : undefined}
                onClick={() => setC(valor)} onDoubleClick={() => onSeguir(valor)}
                onKeyDown={ev => { if (ev.key === 'Enter') { ev.preventDefault(); onSeguir(valor); } }}>
                {nome}
              </button>
            );
          })}
        </div>
        <p className="hint comp-dica">Dois cliques no mês para abrir</p>
      </div>
    </div>
  );
}
