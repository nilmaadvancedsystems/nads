// Financeiro › Conciliação (22/10/2026, o item 7 da lista do Painel): escolhe o extrato do banco (PDF, OFX, planilha ou
// foto), confere com o Caixa do mesmo período e mostra os números (conferidos, faltam no Caixa, só no Caixa, outros) e as
// pendências; o que está no extrato e falta no Caixa se lança daqui. Só as peças do catálogo (CampoArquivo, Stat,
// Segmentado, Tabela, badge, Vazio).
import { CampoArquivo, Icone, Segmentado, Stat, useCarregando, Vazio } from '@nads/ui';
import { useConciliacao } from './useConciliacao';

export function Conciliacao() {
  const vm = useConciliacao();
  useCarregando(vm.carregando || vm.lendo);
  const n = vm.numeros;
  return (
    <section className="fin-painel">
      <div className="tarefas-barra-topo">
        <span className="fin-conc-arquivo"><CampoArquivo arquivo={vm.arquivo} onEscolher={f => void vm.escolher(f)} aceitar=".pdf,.ofx,.xlsx,.xls,.csv,.txt,.jpg,.jpeg,.png" /></span>
        {vm.periodo && <span className="fraco">Extrato de {vm.periodo.de} a {vm.periodo.ate}, conferido com o Caixa do mesmo período</span>}
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
      </div>
      {vm.lendo && <p className="registro-dica"><span className="btn-spinner" aria-hidden="true" />Lendo o extrato…</p>}
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

      {!n ? (
        !vm.lendo && <Vazio icone="fileSearch" titulo="Escolha o extrato do banco" texto="PDF, OFX, planilha ou foto. O nads lê os lançamentos e confere com o Caixa do mesmo período (com até 3 dias de diferença na data). O arquivo não fica guardado." />
      ) : (
        <>
          <div className="stat-grid fin-numeros">
            <Stat rotulo="Conferidos" valor={n.conferidos + ' de ' + n.extrato} cor="entrada" />
            <Stat rotulo="Faltam no Caixa" valor={String(n.faltando)} cor={n.faltando ? 'saida' : undefined} />
            <Stat rotulo="Só no Caixa" valor={String(n.amais)} />
            <Stat rotulo="Diferentes ou duplicados" valor={String(n.outros)} />
          </div>
          <div className="card">
            <h3>
              <span>{n.pendentes ? n.pendentes + (n.pendentes === 1 ? ' pendência' : ' pendências') : 'Tudo conferido'}</span>
              <Segmentado valor={vm.filtro} opcoes={vm.filtros} onMudar={vm.setFiltro} />
            </h3>
            {vm.linhas.length ? (
              <div className="table-wrap">
                <table className="table-compact">
                  <thead><tr><th>Data</th><th>Histórico</th><th className="num">No extrato</th><th className="num">No Caixa</th><th>Situação</th><th /></tr></thead>
                  <tbody>
                    {vm.linhas.map(l => (
                      <tr key={l.chave}>
                        <td className="num">{l.data}</td>
                        <td><span className="nf-corta" title={l.historico}>{l.historico}</span></td>
                        <td className={'num ' + (l.noExtrato === '—' ? 'fraco' : l.entrada ? 'fin-valor-entrada' : 'fin-valor-saida')}>{l.noExtrato}</td>
                        <td className={'num ' + (l.noCaixa === '—' ? 'fraco' : l.entrada ? 'fin-valor-entrada' : 'fin-valor-saida')}>{l.noCaixa}</td>
                        <td><span className={'badge badge-' + l.situacao.tom} title={l.motivo}>{l.situacao.rotulo}</span></td>
                        <td className="nf-direita">
                          {l.lancar && (
                            <button type="button" className="btn btn-outline btn-sm" disabled={vm.lancando === l.lancar.id} onClick={() => l.lancar && void vm.lancar(l.lancar)}>
                              <Icone nome="plus" />Lançar no Caixa
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="fraco">Nenhuma pendência: todo lançamento do extrato está no Caixa.</p>}
          </div>
        </>
      )}
    </section>
  );
}
