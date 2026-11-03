// Contábil › Configurações: os históricos do Creditor, os mesmos para todas as empresas (o desenho do Cadastro ›
// Configurações: o cartão com o ícone, o título e os campos), e uma seção por etapa que exporta Excel, com o padrão e
// as variáveis de cada texto.
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
            <p className="fraco">Valem para todas as empresas.</p>
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

      {vm.etapas.map(e => (
        <div key={e.nome} className="card config-item">
          <div className="config-item-topo">
            <Icone nome="hash" />
            <div>
              <h3>{e.nome}</h3>
              <p className="fraco">Textos e códigos do Excel de importação. Valem para todas as empresas; em branco volta ao padrão.</p>
            </div>
          </div>
          <div className="form-grid">
            {e.itens.map(i => (
              <div key={i.id} className="field">
                <label htmlFor={'fHistC-' + i.id}>{i.rotulo}</label>
                {/* key = valor: quando muda por fora (outra guia, outra pessoa), o campo acompanha */}
                <input key={i.valor} id={'fHistC-' + i.id} type="text" inputMode={i.codigo ? 'numeric' : undefined} autoComplete="off" defaultValue={i.valor}
                  placeholder={i.padrao} disabled={!vm.carregadosDoContabil}
                  onBlur={ev => { if (!vm.mudarHistorico(i.id, ev.target.value)) ev.target.value = i.valor; }}
                  onKeyDown={ev => { if (ev.key === 'Enter') ev.currentTarget.blur(); }} />
                <small className="fraco">
                  {i.codigo
                    ? 'Padrão: ' + i.padrao + ' · só números, até 10 dígitos.'
                    : 'Padrão: ' + i.padrao + '. Variáveis: ' + i.variaveis.map(v => '{' + v.nome + '} ' + v.descricao).join(' · ') + '.'}
                </small>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
