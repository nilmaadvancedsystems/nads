// Financeiro › Caixa (19/10/2026: "o Movimento de Caixa do Toriba, no nads"): o período e a busca, os quatro números (saldo
// inicial, entradas, saídas, saldo final) e a lista dos lançamentos. Clicar na linha abre o lançamento para alterar ou
// excluir; "Novo lançamento" abre a janela de criar; "Contar cédulas" abre a contagem.
import { formatos } from '@nads/core';
import { CampoData, Icone, Segmentado, useCarregando, Vazio } from '@nads/ui';
import { dataBr } from './formatosDaNota';
import { JanelaDeCedulas } from './JanelaDeCedulas';
import { JanelaDoLancamento } from './JanelaDoLancamento';
import { ValorDoCaixa } from './partes/ValorDoCaixa';
import { PERIODOS_RAPIDOS, useCaixaFinanceiro } from './useCaixaFinanceiro';

export function Caixa() {
  const vm = useCaixaFinanceiro();
  useCarregando(vm.carregando);
  const r = vm.resumo;
  const numeros = [
    { rotulo: 'Saldo inicial', valor: r?.saldoInicial, tom: 'neutro', icone: 'clock' },
    { rotulo: 'Entradas', valor: r?.entradas, tom: 'ok', icone: 'download' },
    { rotulo: 'Saídas', valor: r?.saidas, tom: 'marca', icone: 'upload' },
    { rotulo: 'Saldo final', valor: r?.saldoFinal, tom: (r?.saldoFinal ?? 0) < 0 ? 'marca' : 'info', icone: 'dinheiro' },
  ] as const;
  return (
    <section>
      {vm.aberto && <JanelaDoLancamento id={vm.aberto.id} valor={vm.aberto.valor} fechar={vm.fechar} />}
      {vm.contando && <JanelaDeCedulas fechar={() => vm.setContando(false)} usar={vm.usarCedulas} />}

      <div className="tarefas-barra-topo fin-barra">
        <span className="fin-periodo">
          <CampoData valor={vm.de} onMudar={vm.setDe} rotulo="Do dia" />
          <span className="fraco">até</span>
          <CampoData valor={vm.ate} onMudar={vm.setAte} rotulo="Até o dia" />
        </span>
        <Segmentado valor={vm.periodoRapido} opcoes={PERIODOS_RAPIDOS} onMudar={vm.escolherPeriodo} />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar lançamento" aria-label="Buscar lançamento (descrição, observações, valor, conta)" value={vm.busca}
            onChange={e => vm.setBusca(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') vm.setBusca(''); }} />
        </label>
        <span className="tarefas-barra-espaco" />
        {vm.exemplos && <span className="badge badge-neutral">Exemplos</span>}
        <button type="button" className="btn btn-outline" onClick={() => vm.setContando(true)}><Icone nome="dinheiro" />Contar cédulas</button>
        <button type="button" className="btn btn-primary" onClick={() => vm.abrir({})}><Icone nome="plus" />Novo lançamento</button>
      </div>
      {vm.erro && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erro}</p>}
      {!vm.periodoValido && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />Confira o período: as duas datas precisam existir e a primeira não pode vir depois da segunda.</p>}

      <div className="stat-grid fin-numeros">
        {numeros.map(n => (
          <div key={n.rotulo} className={'stat painel-numero painel-' + n.tom}>
            <span className="painel-numero-icone" aria-hidden="true"><Icone nome={n.icone} /></span>
            <p className="stat-label">{n.rotulo}</p>
            <p className="stat-value num">{n.valor == null ? '—' : formatos.reais(n.valor)}</p>
          </div>
        ))}
      </div>

      {!vm.carregando && vm.periodoValido && !vm.linhas.length ? (
        <Vazio icone="dinheiro" titulo={vm.busca ? 'Nenhum lançamento com isso' : 'Nenhum lançamento neste período'}>
          {vm.busca
            ? <button type="button" className="btn btn-outline" onClick={() => vm.setBusca('')}>Limpar a busca</button>
            : <button type="button" className="btn btn-primary" onClick={() => vm.abrir({})}><Icone nome="plus" />Novo lançamento</button>}
        </Vazio>
      ) : (
        <div className="table-wrap">
          <table className="tabela-empresas cad-lista fin-lista">
            <thead><tr><th>Data</th><th>Descrição</th><th>Conta</th><th className="fin-direita">Valor</th><th>Observações</th></tr></thead>
            <tbody>
              {!vm.carregando && vm.linhas.map(({ lancamento: l, conta }) => (
                <tr key={l.id} className="linha-abre" tabIndex={0} title="Abrir o lançamento" onClick={() => vm.abrir({ id: l.id })} onKeyDown={e => { if (e.key === 'Enter') vm.abrir({ id: l.id }); }}>
                  <td className="num fraco">{dataBr(l.data)}</td>
                  <td><span className="fin-corta" title={l.descricao}>{l.descricao}</span></td>
                  <td className="fraco">{conta ? <span title={conta.descricao}>{conta.codigo} · {conta.descricao}</span> : '—'}</td>
                  <td className="num fin-direita"><ValorDoCaixa valor={l.valor} tipo={l.tipo} /></td>
                  <td className="fraco"><span className="fin-corta" title={l.observacoes}>{l.observacoes || ''}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
