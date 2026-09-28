// Lançamentos automáticos — página fora do menu (conferencia.html #view-depara ~L1176-1190, renderDP ~L2711).
import { Icone } from '@nads/ui';
import { useLancamentosAutomaticos, type GrupoDeContas } from './useLancamentosAutomaticos';

type VM = ReturnType<typeof useLancamentosAutomaticos>;
type Linha = VM['pendentes'][number];
const COLUNAS = { gridTemplateColumns: '104px 1fr 1fr 40px' };

export function LancamentosAutomaticos() {
  const vm = useLancamentosAutomaticos();
  return (
    <section id="view-depara">
      <div className="card">
        <h3>Lançamentos encontrados nas notas</h3>
        <div className="btn-row" style={{ justifyContent: 'flex-start', marginTop: 0, marginBottom: 18 }}>
          <button className={vm.classeBotao} id="btAutoLanc" type="button" onClick={vm.preencherAutomatico}>Lançamentos Automáticos</button>
        </div>
        <div id="dpPendentes">
          {vm.semLinhas ? <p className="empty">Nenhum lançamento encontrado ainda. Importe as notas de entradas e saídas primeiro.</p>
            : !vm.pendentes.length ? <p className="empty">Todos os lançamentos encontrados já têm conta vinculada.</p>
              : (
                <>
                  <div className="dp-head" style={COLUNAS}><div>Lançamento</div><div>CFOPs / natureza sugerida</div><div>Conta do balancete</div><div></div></div>
                  {vm.pendentes.map(l => (
                    <div key={l.lanc} className="dp" style={COLUNAS}>
                      <div className="locked" title="Descoberto nas notas">{l.lanc}</div>
                      <div className="wrap" style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>{l.cfops}{l.natureza ? ' · ' + l.natureza : ''}</div>
                      <SeletorConta l={l} grupos={vm.grupos} onMudar={v => vm.escolherConta(l.lanc, v)} />
                      <button className="icon-btn danger" type="button" title="Ignorar este lançamento" onClick={() => vm.remover(l.lanc)}><Icone nome="x" /></button>
                    </div>
                  ))}
                </>
              )}
        </div>
      </div>
      <div className="card" id="dpVinculadasCard" hidden={!vm.vinculadas.length}>
        <h3 style={{ fontSize: 15 }}>Contas já vinculadas</h3>
        <div id="dpVinculadas">
          {vm.vinculadas.length > 0 && (
            <>
              <div className="dp-head" style={COLUNAS}><div>Lançamento</div><div>CFOPs</div><div>Conta</div><div></div></div>
              {vm.vinculadas.map(l => (
                <div key={l.lanc} className="dp" style={COLUNAS}>
                  <div className="locked">{l.lanc}</div>
                  <div className="wrap" style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>{l.cfops}</div>
                  <SeletorConta l={l} grupos={vm.grupos} onMudar={v => vm.escolherConta(l.lanc, v)} />
                  <button className="icon-btn danger" type="button" title="Desvincular" onClick={() => vm.remover(l.lanc)}><Icone nome="x" /></button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function SeletorConta({ l, grupos, onMudar }: { l: Linha; grupos: GrupoDeContas[]; onMudar: (codigo: string) => void }) {
  return (
    <select aria-label="Conta" value={l.conta} onChange={ev => onMudar(ev.target.value)}>
      <option value="">— escolha a conta —</option>
      {grupos.map(g => (
        <optgroup key={g.grupo} label={g.grupo}>
          {g.contas.map(a => <option key={a.codigo} value={a.codigo}>{a.nome} · {a.codigo}</option>)}
        </optgroup>
      ))}
      {l.foraDoPlano && <option value={l.conta}>{l.conta} — fora do plano (ou sintética)</option>}
    </select>
  );
}
