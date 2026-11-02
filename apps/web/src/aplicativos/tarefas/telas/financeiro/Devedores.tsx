// Financeiro › Devedores (22/10/2026, o item 2 da lista do Painel): os números (total devido, clientes devendo, em dia) e a
// lista de quem deve, do que deve mais meses ao que deve menos: cada mês em aberto é um botão que abre o Receber (a mesma
// janela dos Honorários). Não há vencimento: conta como em aberto o mês sem recebimento, do começo do controle no nads até
// o mês passado. Só as peças do catálogo (Stat, Tabela, Vazio, chip).
import { formatos } from '@nads/core';
import { Icone, Stat, useCarregando, Vazio } from '@nads/ui';
import { JanelaReceber } from './JanelaReceber';
import { useDevedores } from './useDevedores';

export function Devedores() {
  const vm = useDevedores();
  useCarregando(vm.carregando);
  const n = vm.numeros;
  return (
    <section className="fin-painel">
      {vm.recebendo && <JanelaReceber contratoId={vm.recebendo.contratoId} competencia={vm.recebendo.competencia} fechar={vm.fecharReceber} />}
      <div className="tarefas-barra-topo">
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar cliente" aria-label="Buscar cliente (nome, código ou CNPJ)" value={vm.busca}
            onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <span className="fraco">De {vm.desde} a {vm.ate}</span>
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}

      <div className="stat-grid fin-numeros">
        <Stat rotulo="Total devido" valor={formatos.reais(n.total)} cor={n.total ? 'saida' : undefined} />
        <Stat rotulo="Clientes devendo" valor={String(n.devendo)} />
        <Stat rotulo="Meses em aberto" valor={String(n.meses)} />
        <Stat rotulo="Clientes em dia" valor={String(n.emDia)} cor="entrada" />
      </div>

      {!vm.carregando && !vm.linhas.length ? (
        <Vazio icone="checkCircle" titulo={vm.busca ? 'Ninguém com isso devendo' : 'Ninguém devendo'}>
          {vm.busca && <button type="button" className="btn btn-outline" onClick={() => vm.setBusca('')}>Limpar a busca</button>}
        </Vazio>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="table-compact">
              <thead><tr><th>Cód.</th><th>Cliente</th><th>Meses em aberto (clique para receber)</th><th className="num">Honorário</th><th className="num">Total devido</th></tr></thead>
              <tbody>
                {vm.linhas.map(d => (
                  <tr key={d.contrato.id}>
                    <td className="num">{d.contrato.codigo || '—'}</td>
                    <td>{d.contrato.nome}</td>
                    <td>
                      <span className="fin-meses">
                        {d.mesesBr.map(m => (
                          <button key={m.competencia} type="button" className="chip-f" title={'Receber ' + m.rotulo} onClick={() => vm.receber(d.contrato.id, m.competencia)}>{m.rotulo}</button>
                        ))}
                      </span>
                    </td>
                    <td className="num">{formatos.reais(d.contrato.valor)}</td>
                    <td className="num fin-valor-saida">{formatos.reais(d.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
