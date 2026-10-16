import { useRef } from 'react';
// View da pergunta "Quais meses?" ao iniciar uma empresa: De e Até; o mesmo mês é um mês só, meses diferentes é Em lote.
import { BotaoFechar, classeDaJanela, Icone, useJanela } from '@nads/ui';
import type { usePerguntaDoPeriodo } from './usePerguntaDoPeriodo';

export function JanelaDoPeriodo({ vm }: { vm: ReturnType<typeof usePerguntaDoPeriodo> }) {
  const p = vm.pedido;
  // revisão da UI, 16/10/2026: Esc, foco preso e o foco de volta pela peça useJanela (antes, um Esc à mão por janela)
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.cancelar, !!p);
  if (!p) return null;
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) vm.cancelar(); }}>
      <div ref={janela} className={classeDaJanela({ icone: 'calendar' }) + ' periodo-janela'} role="dialog" aria-modal="true" aria-labelledby="periodoTitulo">
        <BotaoFechar canto onClick={vm.cancelar} />
        <h3 id="periodoTitulo">{p.titulo || 'Quais meses?'}</h3>
        <p><b>{p.nome}</b></p>
        <div className="periodo-campos">
          <label className="field">
            <span>De</span>
            <select value={p.de} onChange={e => vm.setDe(e.target.value)}>{vm.meses.map(m => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}</select>
          </label>
          <label className="field">
            <span>Até</span>
            <select value={p.ate} onChange={e => vm.setAte(e.target.value)}>{vm.meses.map(m => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}</select>
          </label>
        </div>
        <p className="periodo-resumo">{vm.qtd > 1 ? <><b>Em lote</b>: {vm.qtd} meses, todas as etapas de uma vez</> : 'Um mês'}</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-primary" autoFocus onClick={vm.iniciar}>{p.botao ? p.botao : <><Icone nome="play" />Iniciar</>}</button>
        </div>
      </div>
    </div>
  );
}
