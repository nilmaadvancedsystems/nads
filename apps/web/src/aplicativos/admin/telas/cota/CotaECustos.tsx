// Admin › Cota e custos: o consumo do banco hoje contra a cota grátis (as barras do ranking: verde, âmbar a partir de 70%,
// vermelho a partir de 90%), o histórico dos últimos 7 ou 30 dias (as barras em coluna; clicar no dia mostra os três
// números) e o armazenamento do banco e da hospedagem. Nada é estimado: sem medição, a linha diz o porquê. Só peças do
// catálogo: o Ranking, as Barras em coluna, o Segmentado, a tabela compacta, o Alerta e o Vazio.
import { BarrasEmColuna, Alerta, Dica, Esqueleto, Segmentado, Vazio, useCarregando } from '@nads/ui';
import type { entregas } from '@nads/core';
import { COR_DA_BARRA } from '../partes/tons';
import { useCotaECustos } from './useCotaECustos';

/** As linhas de cota no Ranking: o nome, o "usado de limite (%)" e a barra no tom. */
function BarrasDaCota({ linhas }: { linhas: readonly entregas.LinhaDaCota[] }) {
  return (
    <div className="rank">
      {linhas.map(l => (
        <div key={l.id} className="rank-item">
          <span className="rank-nome">{l.rotulo}</span><span className={'rank-val num' + (l.usado === null ? ' fraco' : '')}>{l.texto}</span>
          <span className="rank-barra"><span style={{ width: Math.min(100, l.pct ?? 0) + '%', background: COR_DA_BARRA[l.tom] }} /></span>
        </div>
      ))}
    </div>
  );
}

export function CotaECustos() {
  const vm = useCotaECustos();
  useCarregando(vm.carregando);
  if (vm.semPermissao) return <Vazio icone="lock" titulo="Sem acesso à cota" texto="Só o administrador vê o consumo do banco." />;
  return (
    <section className="admin-cota">
      {vm.exemplos && <p className="hint">Dados de exemplo: nada aqui vem do banco.</p>}

      <div className="card">
        <div className="card-head">
          <h3>Banco hoje
            <Dica texto="Leituras, gravações e exclusões do sistema inteiro (o nads, o Entregas, os robôs e os aparelhos de todos) desde a meia-noite da Califórnia, quando a cota grátis zera." />
          </h3>
        </div>
        {vm.carregando ? <Esqueleto linhas={3} /> : (
          <>
            <BarrasDaCota linhas={vm.hoje} />
            <p className="hint">{vm.medidoHoje}</p>
          </>
        )}
      </div>

      <div className="card admin-historico">
        <div className="card-head">
          <h3>Últimos dias
            <Dica texto="Um dia completo por coluna (o dia da cota, da meia-noite à meia-noite da Califórnia) e o de hoje até agora. Em âmbar, os dias que passaram de 70% da cota grátis. Clique num dia para ver os três números." />
          </h3>
          <span className="card-head-ctl admin-historico-ctl">
            <Segmentado valor={vm.campo} opcoes={vm.campos} onMudar={vm.setCampo} />
            <Segmentado valor={vm.periodo} opcoes={vm.periodos} onMudar={vm.setPeriodo} />
          </span>
        </div>
        {vm.carregando ? <Esqueleto linhas={5} /> : !vm.colunas.length ? (
          <Vazio compacto icone="barChart" texto="Sem histórico ainda: o robô da nuvem mede os últimos 30 dias no primeiro resumo do dia (robo/saudeBanco)." />
        ) : (
          <>
            <BarrasEmColuna colunas={vm.colunas} ativa={vm.escolhido} onEscolher={vm.escolher} />
            <p className="hint">
              {vm.emMil ? 'Os números em cima das barras estão em milhares. ' : ''}
              {vm.resumoDoPeriodo ? 'Média de ' + vm.resumoDoPeriodo.media + ' ' + vm.resumoDoPeriodo.rotulo + ' por dia em ' + vm.resumoDoPeriodo.dias + (vm.resumoDoPeriodo.dias === 1 ? ' dia' : ' dias') + ' (o limite é ' + vm.resumoDoPeriodo.limite + '); ' + (vm.resumoDoPeriodo.acima ? vm.resumoDoPeriodo.acima + (vm.resumoDoPeriodo.acima === 1 ? ' dia passou' : ' dias passaram') + ' de 70%.' : 'nenhum dia passou de 70%.') : ''}
              {!vm.temHistorico ? ' Os dias anteriores aparecem depois do primeiro resumo do robô.' : ''}
            </p>
            {vm.doDia && <Alerta naLinha titulo={vm.doDia.titulo} texto={vm.doDia.texto} />}
          </>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Armazenamento
            <Dica texto="O tamanho do banco (os dados e os índices; o grátis é 1 GB) e o espaço da hospedagem de cada projeto (as versões publicadas dos sites; cada site guarda as 10 últimas). Medido uma vez por dia." />
          </h3>
        </div>
        {vm.carregando ? <Esqueleto linhas={3} /> : !vm.temResumo ? (
          <Vazio compacto icone="arquivo" texto="O robô ainda não publicou o resumo do dia (robo/saudeBanco): o armazenamento aparece aqui depois dele." />
        ) : (
          <>
            <BarrasDaCota linhas={vm.armazenamento} />
            {vm.erroDoArmazenamento && <p className="hint">Banco sem medição: {vm.erroDoArmazenamento}</p>}
            {vm.hospedagem.filter(h => h.erro).map(h => (
              <p key={h.projeto} className="hint">Hospedagem do {h.projeto} sem medição: {h.erro}</p>
            ))}
            {vm.hospedagem.filter(h => h.sites.length).map(h => (
              <div key={h.projeto} className="table-wrap admin-sites"><table className="table-compact">
                <thead><tr><th>Site ({h.projeto})</th><th className="num">Espaço</th></tr></thead>
                <tbody>{h.sites.map(s => <tr key={s.site}><td>{s.site}</td><td className="num">{s.tamanho}</td></tr>)}</tbody>
              </table></div>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
