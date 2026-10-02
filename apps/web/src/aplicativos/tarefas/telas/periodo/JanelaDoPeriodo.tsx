// View da pergunta "Quais meses?" ao iniciar uma empresa: De e Até; o mesmo mês é um mês só, meses diferentes é Em lote.
import { classeDaJanela, Icone } from '@nads/ui';
import type { usePerguntaDoPeriodo } from './usePerguntaDoPeriodo';

export function JanelaDoPeriodo({ vm }: { vm: ReturnType<typeof usePerguntaDoPeriodo> }) {
  const p = vm.pedido;
  if (!p) return null;
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) vm.cancelar(); }}>
      <div className={classeDaJanela({ icone: 'calendar' }) + ' periodo-janela'} role="dialog" aria-modal="true" aria-labelledby="periodoTitulo">
        <h3 id="periodoTitulo">Quais meses?</h3>
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
          <button type="button" className="btn btn-primary" autoFocus onClick={vm.iniciar}><Icone nome="play" />Iniciar</button>
          <button type="button" className="btn btn-outline" onClick={vm.cancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
