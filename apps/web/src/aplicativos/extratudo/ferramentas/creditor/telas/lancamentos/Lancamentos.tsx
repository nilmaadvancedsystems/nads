// Etapa 7 do Creditor: contas, fechamento da conta banco por dia e o arquivo de importação.
import { creditor as cr } from '@nads/core';
import { Alerta, baixarBytes, Icone, Stat } from '@nads/ui';
import { AcoesDoTopo } from '../../../../../../comum/topo';
import { CampoConta } from './partes/CampoConta';
import { useLancamentos, type CampoConta as IdCampo } from './useLancamentos';

const BADGE: Record<cr.SituacaoDia, [string, string]> = {
  ok: ['badge badge-ok', 'Bate'], explicada: ['badge badge-warn', 'Diferença = excluídos'], diverge: ['badge badge-bad', 'Não bate'],
};

export function Lancamentos() {
  const vm = useLancamentos();
  const baixar = () => { const a = vm.arquivo(); baixarBytes(a.bytes, a.nome, a.tipo); vm.baixou(); };
  return (
    <section>
      <AcoesDoTopo>
        <button className="btn btn-primary" type="button" disabled={!vm.podeBaixar} onClick={baixar}><Icone nome="download" />Baixar .xls</button>
      </AcoesDoTopo>

      <div className="card">
        <div className="card-head">
          <h3>Contas e históricos</h3>
          {vm.temSalvas && <button className="btn btn-ghost" type="button" onClick={vm.esquecerContas}>Voltar às sugestões</button>}
        </div>
        <p className="hint" style={{ marginTop: 0, marginBottom: 8 }}>{vm.fonte}</p>
        <datalist id="contasDoBalancete">
          {vm.opcoes.map(o => <option key={o.codigo} value={o.codigo}>{o.nome}</option>)}
        </datalist>
        <div className="form-grid">
          {(Object.keys(vm.rotuloConta) as IdCampo[]).map(c => {
            const d = vm.ehDoBalancete(c) ? vm.detalhe[c as keyof typeof vm.detalhe] : null;
            return (
              <div key={c} className="field">
                <CampoConta id={'fConta-' + c} rotulo={vm.rotuloConta[c]} valor={vm.contas[c]} lista={d && vm.opcoes.length ? 'contasDoBalancete' : undefined} onGravar={v => vm.mudarConta(c, v)} />
                {d && vm.carregada && (
                  <p className="hint" style={{ margin: '4px 0 0' }}>
                    <span className={'badge badge-' + d.tom}>{d.origem}</span>{d.nome && <> {d.nome}</>}
                    {d.aviso && <><br />{d.aviso}</>}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Conta {vm.contaBanco} por dia</h3></div>
        <p className="hint" style={{ marginTop: 0, marginBottom: 8 }}>Débitos − créditos da conta banco no arquivo, contra o que o banco creditou no dia (o total cobrado impresso, ou a soma conferida).</p>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Dia</th><th className="num">Débitos</th><th className="num">Créditos</th><th className="num">Líquido</th><th className="num">Banco creditou</th><th className="num">Fora do arquivo</th><th className="num">Diferença</th><th>Situação</th></tr></thead>
            <tbody>
              {vm.fechamento.map(f => (
                <tr key={f.data} className={f.situacao === 'diverge' ? 'bad' : ''}>
                  <td>{f.data || 'sem data'}</td>
                  <td className="num">{cr.brl(f.debitos)}</td>
                  <td className="num">{cr.brl(f.creditos)}</td>
                  <td className="num"><b>{cr.brl(f.liquido)}</b></td>
                  <td className="num" title={f.fonte === 'impresso' ? 'Total cobrado impresso no relatório' : 'Soma conferida dos títulos'}>{cr.brl(f.esperado)}{f.fonte === 'extraido' ? ' *' : ''}</td>
                  <td className="num">{f.fora ? cr.brl(f.fora) : '—'}</td>
                  <td className="num">{cr.brl(f.diferenca)}</td>
                  <td><span className={BADGE[f.situacao][0]}>{BADGE[f.situacao][1]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {vm.fechamento.some(f => f.fonte === 'extraido') && <p className="hint">* sem total cobrado impresso só daquele dia: vale a soma conferida dos títulos.</p>}
      </div>

      {vm.divergentes.length > 0 && (
        <Alerta titulo="O arquivo não fecha com o banco">
          {vm.divergentes.map(d => <p key={d} className="alert-text">{d}</p>)}
        </Alerta>
      )}

      {vm.fora.length > 0 && (
        <Alerta titulo={vm.fora.length + ' título(s) fora do arquivo'}>
          {vm.fora.map(t => <p key={t.id} className="alert-text">NF {t.nf} · {t.sacado} · {t.liquidacao} · {cr.brl(t.valor)}</p>)}
        </Alerta>
      )}

      <div className="dash-grid" style={{ margin: '16px 0' }}>
        <Stat rotulo="Lançamentos" valor={vm.totais.qtd} grande={false} />
        <Stat rotulo="Principal" valor={cr.brl(vm.totais.principal)} grande={false} />
        <Stat rotulo="Mora" valor={cr.brl(vm.totais.mora)} grande={false} />
        <Stat rotulo="Descontos" valor={cr.brl(vm.totais.desconto)} grande={false} />
      </div>

      <div className="card">
        <div className="card-head"><h3>Arquivo de importação (8 colunas)</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr>{cr.CABECALHO_8_COLUNAS.map(c => <th key={c} className={c === 'VALOR' || c === 'DOCUMENTO' ? 'num' : ''}>{c}</th>)}</tr></thead>
            <tbody>
              {vm.lancamentos.map((l, i) => (
                <tr key={i}>
                  <td>{l.automatico}</td><td>{l.data}</td><td>{l.debito}</td><td>{l.credito}</td><td>{l.codHistorico}</td><td>{l.historico}</td>
                  <td className="num">{cr.brl(l.valor)}</td><td className="num">{l.documento}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* sem o Voltar (Vitor, 05/10/2026: tudo é navegável pela barra de cima) */}
      <div className="btn-row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-success" type="button" disabled={!vm.podeBaixar} onClick={baixar}><Icone nome="download" />Baixar .xls</button>
      </div>
    </section>
  );
}
