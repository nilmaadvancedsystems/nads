// Contábil › Configurações: os históricos do Creditor, os mesmos para todas as empresas, e uma seção por etapa que exporta
// Excel, com o padrão e as variáveis de cada texto. O visual (Vitor, 06/11/2026: "deixar essas configurações mais atrativas
// visualmente"): uma coluna (os textos são longos), o cabeçalho cinza do cartão com o ícone da etapa (as logos do INSS e do
// FGTS) e quantos históricos tem; os códigos lado a lado; as variáveis em etiquetas; e, em cada campo, se está no padrão ou
// alterado, com o Voltar ao padrão.
import { Icone, LogoFgts, LogoInss, type NomeIcone } from '@nads/ui';
import type { ReactNode } from 'react';
import { useConfiguracoesContabil, type ItemDeHistorico } from './useConfiguracoesContabil';

/** O ícone de cada seção (as etapas sem ícone próprio ficam com o #). */
const ICONE: Record<string, NomeIcone> = {
  Honorários: 'briefcase', 'Pró-labore': 'usuario', 'Adiantamento salarial': 'dinheiro', 'Cheque especial': 'landmark',
};

function IconeDaSecao({ nome }: { nome: string }) {
  if (nome === 'INSS') return <span className="config-logo"><LogoInss cor /></span>;
  if (nome === 'FGTS') return <span className="config-logo"><LogoFgts cor /></span>;
  return <Icone nome={ICONE[nome] || 'hash'} />;
}

function Secao({ icone, titulo, qtd, descricao, children }: { icone: ReactNode; titulo: string; qtd: number; descricao: string; children: ReactNode }) {
  return (
    <div className="card config-item config-secao">
      <div className="card-head">
        <h3 className="config-secao-titulo">{icone}{titulo}</h3>
        <span className="badge badge-neutral">{qtd} {qtd === 1 ? 'histórico' : 'históricos'}</span>
      </div>
      <p className="fraco config-secao-desc">{descricao}</p>
      {children}
    </div>
  );
}

/** Padrão ou alterado, e o botão de voltar ao padrão quando foi alterado. */
function Situacao({ alterado, onPadrao, desligado }: { alterado: boolean; onPadrao: () => void; desligado?: boolean }) {
  return (
    <span className="config-situacao">
      <span className={'badge ' + (alterado ? 'badge-info' : 'badge-suave')}>{alterado ? 'Alterado' : 'Padrão'}</span>
      {alterado && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onPadrao} disabled={desligado} title="Volta para o texto padrão">
          <Icone nome="girar" />Voltar ao padrão
        </button>
      )}
    </span>
  );
}

function Campo({ item, desligado, onMudar }: { item: ItemDeHistorico; desligado: boolean; onMudar: (v: string) => boolean }) {
  const alterado = item.valor !== item.padrao;
  return (
    <div className="field">
      <div className="config-rotulo">
        <label htmlFor={'fHistC-' + item.id}>{item.rotulo}</label>
        <Situacao alterado={alterado} desligado={desligado} onPadrao={() => onMudar('')} />
      </div>
      {/* key = valor: quando muda por fora (outra guia, outra pessoa, o Voltar ao padrão), o campo acompanha */}
      <input key={item.valor} id={'fHistC-' + item.id} type="text" inputMode={item.codigo ? 'numeric' : undefined} autoComplete="off" defaultValue={item.valor}
        placeholder={item.padrao} disabled={desligado}
        onBlur={ev => { if (!onMudar(ev.target.value)) ev.target.value = item.valor; }}
        onKeyDown={ev => { if (ev.key === 'Enter') ev.currentTarget.blur(); }} />
      {item.codigo
        ? <small className="fraco">Só números, até 10 dígitos{alterado ? ' · padrão: ' + item.padrao : ''}.</small>
        : (
          <>
            {alterado && <small className="fraco">Padrão: {item.padrao}</small>}
            {item.variaveis.length > 0 && (
              <div className="config-variaveis">
                <span className="fraco">Variáveis:</span>
                {item.variaveis.map(v => (
                  <span key={v.nome} className="config-variavel"><span className="badge badge-neutral num">{'{' + v.nome + '}'}</span><span className="fraco">{v.descricao}</span></span>
                ))}
              </div>
            )}
          </>
        )}
    </div>
  );
}

export function ConfiguracoesContabil() {
  const vm = useConfiguracoesContabil();
  return (
    <section className="config-nads config-contabil">
      <Secao icone={<Icone nome="recibo" />} titulo="Históricos do Creditor" qtd={vm.campos.length} descricao="Os códigos de histórico dos títulos. Valem para todas as empresas.">
        <div className="config-codigos">
          {vm.campos.map(c => (
            <div key={c.id} className="field">
              <div className="config-rotulo">
                <label htmlFor={'fHist-' + c.id}>{c.rotulo}</label>
                <Situacao alterado={c.valor !== c.padrao} desligado={!vm.carregados} onPadrao={() => vm.mudar(c.id, '')} />
              </div>
              {/* key = valor: quando muda por fora (outra guia, outra pessoa), o campo acompanha */}
              <input key={c.valor} id={'fHist-' + c.id} type="text" inputMode="numeric" autoComplete="off" defaultValue={c.valor}
                placeholder={c.padrao} disabled={!vm.carregados}
                onBlur={e => vm.mudar(c.id, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
            </div>
          ))}
        </div>
      </Secao>

      {vm.etapas.map(e => {
        const codigos = e.itens.filter(i => i.codigo);
        const textos = e.itens.filter(i => !i.codigo);
        return (
          <Secao key={e.nome} icone={<IconeDaSecao nome={e.nome} />} titulo={e.nome} qtd={e.itens.length}
            descricao="Textos e códigos do Excel de importação. Valem para todas as empresas; em branco volta ao padrão.">
            {textos.length > 0 && (
              <div className="form-grid">
                {textos.map(i => <Campo key={i.id} item={i} desligado={!vm.carregadosDoContabil} onMudar={v => vm.mudarHistorico(i.id, v)} />)}
              </div>
            )}
            {codigos.length > 0 && (
              <div className="config-codigos">
                {codigos.map(i => <Campo key={i.id} item={i} desligado={!vm.carregadosDoContabil} onMudar={v => vm.mudarHistorico(i.id, v)} />)}
              </div>
            )}
          </Secao>
        );
      })}
    </section>
  );
}
