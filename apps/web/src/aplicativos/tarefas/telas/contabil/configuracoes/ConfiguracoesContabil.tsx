// Contábil › Configurações: os históricos do Creditor, os mesmos para todas as empresas (o desenho do Cadastro ›
// Configurações: o cartão com o ícone, o título e os campos).
import { Icone } from '@nads/ui';
import { useConfiguracoesContabil } from './useConfiguracoesContabil';

export function ConfiguracoesContabil() {
  const vm = useConfiguracoesContabil();
  return (
    <section className="config-nads">
      <div className="card config-item">
        <div className="config-item-topo">
          <Icone nome="hash" />
          <div>
            <h3>Históricos do Creditor</h3>
            <p className="fraco">Os códigos de histórico do arquivo de importação do Creditor. Valem para todas as empresas.</p>
          </div>
        </div>
        <div className="form-grid">
          {vm.campos.map(c => (
            <div key={c.id} className="field">
              <label htmlFor={'fHist-' + c.id}>{c.rotulo}</label>
              {/* key = valor: quando muda por fora (outra guia, outra pessoa), o campo acompanha */}
              <input key={c.valor} id={'fHist-' + c.id} type="text" inputMode="numeric" autoComplete="off" defaultValue={c.valor}
                placeholder={c.padrao} disabled={!vm.carregados}
                onBlur={e => vm.mudar(c.id, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
