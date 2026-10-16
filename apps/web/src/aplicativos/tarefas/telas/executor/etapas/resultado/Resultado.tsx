// A etapa Despesas e receitas (Vitor, 16/10/2026): a linha do balancete dinâmico (o do Clientes, ou um mais novo importado
// aqui) e a tabela das contas do lado errado — a despesa credora e a receita devedora, com os meses. Tudo certo, o Ok.
import { Icone } from '@nads/ui';
import { useId } from 'react';
import { useResultado } from './useResultado';

export function Resultado() {
  const vm = useResultado();
  const id = useId();
  return (
    <section>
      <header className="topbar"><div><h2 className="page-title">Despesas e receitas</h2></div></header>
      <div className={'imp-bloco' + (vm.temDinamico && !vm.contas.length ? ' imp-ok' : '')}>
        <div className="imp-linha">
          <span className="imp-ico"><Icone nome="scale" /></span>
          <div className="imp-txt">
            <span><b>Balancete dinâmico</b>{vm.arquivo && <span className="imp-conta">{vm.arquivo}{vm.doClientes ? ' (do Clientes)' : ''}</span>}</span>
          </div>
          <div className="imp-resumo">{vm.resumo.length > 0 && <div>{vm.resumo.map(x => <span key={x}>{x}</span>)}</div>}</div>
          <div className="imp-grupos">
            <div className="imp-grupo" aria-label="Balancete dinâmico">
              <span className="imp-rotulo">Dinâmico</span>
              {vm.proprio ? (
                <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={vm.tirar} title="Importado aqui. Clique para tirar (volta o do Clientes)." aria-label="Tirar o balancete dinâmico importado aqui">
                  <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                </button>
              ) : (
                <>
                  <label htmlFor={id} className="icon-btn icon-btn-sm imp-btn" title={vm.temDinamico ? 'Importar um balancete dinâmico mais novo (o corrigido)' : 'Importar o balancete dinâmico'} aria-label="Importar o balancete dinâmico"><Icone nome="upload" /></label>
                  <input id={id} type="file" accept=".xls,.xlsx,.ods" className="sr-only"
                    onChange={e => { const f = e.target.files?.[0] || null; e.target.value = ''; void vm.importar(f); }} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {!vm.temDinamico ? (
        <div className="gh-blank">
          <Icone nome="scale" />
          <h4>Despesas credoras e receitas devedoras</h4>
          <p>Importe o balancete dinâmico (ou importe em Clientes): confiro, mês a mês, as despesas com saldo credor e as receitas com saldo devedor. As redutoras "(-)" ficam de fora.</p>
        </div>
      ) : !vm.contas.length ? (
        <div className="gh-blank">
          <Icone nome="checkCircle" />
          <h4>Nenhuma despesa credora nem receita devedora</h4>
        </div>
      ) : (
        <div className="table-wrap" style={{ maxHeight: 'none' }}>
          <table className="table-compact">
            <thead><tr><th>Conta</th><th>Classificação</th><th>Nome</th><th>Situação</th><th>Meses</th></tr></thead>
            <tbody>
              {vm.contas.map(x => (
                <tr key={x.id}>
                  <td>{x.codigo}</td>
                  <td className="hint">{x.classificacao}</td>
                  <td className="wrap">{x.nome}</td>
                  <td style={{ whiteSpace: 'nowrap' }}><span className="badge badge-bad">{x.tipo}</span></td>
                  <td className="wrap" style={{ fontSize: 12 }}>{x.meses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
