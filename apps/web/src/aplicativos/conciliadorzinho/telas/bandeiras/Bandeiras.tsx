// Etapa Bandeiras (conciliadorZINHO.html #step-brands ~L578).
import { Icone, LOGOS_BANDEIRAS } from '@nads/ui';
import { useBandeiras } from './useBandeiras';

export function Bandeiras() {
  const vm = useBandeiras();
  return (
    <section>
      <p className="page-desc" style={{ marginBottom: 16 }}>Quais operadoras entram nesta conciliação.</p>
      <div className="bandeira-grid">
        {vm.opcoes.map(b => (
          <label key={b.id} className={'bandeira-opcao' + (b.marcada ? ' on' : '')}>
            <input type="checkbox" className="sr-only" checked={b.marcada} onChange={() => vm.alternar(b.id)} />
            <span className="bandeira-logo" aria-hidden="true" dangerouslySetInnerHTML={{ __html: LOGOS_BANDEIRAS[b.id] }} />
            <span className="bandeira-nome">{b.rotulo}</span>
            <span className="bandeira-marca"><Icone nome="check" /></span>
          </label>
        ))}
      </div>
      <div className="btn-row">
        <span />
        <button className="btn btn-primary" type="button" disabled={!vm.podeContinuar} onClick={vm.continuar}>Continuar</button>
      </div>
    </section>
  );
}
