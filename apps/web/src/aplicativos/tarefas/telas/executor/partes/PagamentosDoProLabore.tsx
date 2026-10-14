// Embaixo do item Pró-labore do checklist da Contabilização da Folha (Vitor, 14/10/2026): a linha do razão do Pró-labore a
// pagar (importar; importado, o check que vira × e tira) e, com ele, os pagamentos que faltam para o razão zerar — a conta
// do crédito (uma para todos, e dá para trocar em cada um) e o "Importar no meu Sistema" (o .xls do Alterdata).
import { Icone, MenuSuspenso } from '@nads/ui';
import { useId } from 'react';
import { MenuDeConta } from '../../../../extratudo/ferramentas/creditor/partes/MenuDeConta';
import { usePagamentosDoProLabore } from '../usePagamentosDoProLabore';

export function PagamentosDoProLabore({ empresa, contaDoItem }: { empresa: string; contaDoItem: string }) {
  const vm = usePagamentosDoProLabore(empresa, contaDoItem);
  const id = useId();
  return (
    <div className="imp-bloco" style={{ marginTop: 8 }}>
      <div className="imp-linha">
        <span className="imp-ico"><Icone nome="scale" /></span>
        <div className="imp-txt">
          <span><b>Pagamentos do pró-labore</b><span className="imp-conta">{vm.arquivo || 'Importe o razão do Pró-labore a pagar para lançar os pagamentos que faltam'}</span></span>
        </div>
        <div className="imp-resumo">{vm.temRazao && <div><span>{vm.pagamentos.length ? vm.pagamentos.length + ' a pagar · ' + vm.total : 'O razão já zera'}</span></div>}</div>
        <div className="imp-grupos">
          <div className="imp-grupo" aria-label="Razão do Pró-labore a pagar">
            <span className="imp-rotulo">Razão</span>
            {vm.temRazao ? (
              <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={vm.remover} title={'Importado: ' + vm.arquivo + '. Clique para tirar.'} aria-label="Tirar o razão do pró-labore">
                <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
              </button>
            ) : (
              <>
                <label htmlFor={id} className="icon-btn icon-btn-sm imp-btn" title="Importar o razão do Pró-labore a pagar (XLS da conciliação do Alterdata)" aria-label="Importar o razão do pró-labore"><Icone nome="upload" /></label>
                <input id={id} type="file" accept=".xls,.xlsx,.ods" className="sr-only" onChange={e => { const f = e.target.files?.[0] || null; e.target.value = ''; void vm.importar(f); }} />
              </>
            )}
          </div>
        </div>
      </div>
      {vm.temRazao && vm.pagamentos.length > 0 && (
        <div className="imp-mov-caixa" style={{ marginLeft: 12 }}>
          {/* numa linha: o débito (a conta do pró-labore), a conta do crédito para todos e o Importar no meu Sistema */}
          <div className="tarefas-barra-topo">
            <span className="hint">Débito</span><b>{vm.debito}</b>{vm.nomeDoDebito && <span className="hint">{vm.nomeDoDebito}</span>}
            <span className="hint" style={{ marginLeft: 12 }}>Dia</span>
            {/* o dia do pagamento no mês da competência (Vitor, 14/10/2026) */}
            <MenuSuspenso rotulo={vm.dia ? 'Dia ' + vm.dia : 'Último dia do mês'} className="btn btn-outline" dica="O dia do pagamento em cada mês" largura={200}
              itens={[0, ...Array.from({ length: 31 }, (_, k) => k + 1)].map(d => ({ rotulo: d ? 'Dia ' + d : 'Último dia do mês', marcado: vm.dia === d, onClick: () => vm.escolherDia(d) }))} />
            <span className="hint" style={{ marginLeft: 12 }}>Crédito</span>
            <MenuDeConta valor={vm.contaGeral} contas={vm.contas} onEscolher={vm.escolherContaGeral} />
            {vm.nomeDaContaGeral && <span className="hint">{vm.nomeDaContaGeral}</span>}
            <span className="tarefas-barra-espaco" />
            {vm.faltaConta > 0 && <span className="hint">Falta a conta de {vm.faltaConta} {vm.faltaConta === 1 ? 'pagamento' : 'pagamentos'}</span>}
            <button type="button" className="btn btn-primary" disabled={!vm.podeExportar} onClick={vm.baixarXls}
              title={vm.podeExportar ? 'Baixar o .xls de importação do Alterdata com os pagamentos' : 'Escolha a conta do crédito'}>
              <Icone nome="download" />Importar no meu Sistema
            </button>
          </div>
          <div className="imp-mov">
            <table className="table-compact">
              <thead><tr><th>Data</th><th>Crédito</th><th className="num">Valor</th><th>Histórico</th></tr></thead>
              <tbody>
                {vm.pagamentos.map(p => (
                  <tr key={p.chave}>
                    <td style={{ whiteSpace: 'nowrap' }}>{p.data}</td>
                    <td>
                      <MenuDeConta valor={p.conta} contas={vm.contas} onEscolher={c => vm.escolherConta(p.chave, c)} />
                      {p.nomeDaConta && <span className="hint" style={{ display: 'block', marginTop: 2 }}>{p.nomeDaConta}</span>}
                    </td>
                    <td className="num">{p.valor}</td>
                    <td className="wrap">{p.historico}{p.doSaldoAnterior && <span className="hint" style={{ display: 'block' }}>O saldo que vinha de antes do razão</span>}</td>
                  </tr>
                ))}
                <tr className="imp-mov-anterior"><td colSpan={2}>Total (o saldo do razão: {vm.saldoFinal})</td><td className="num">{vm.total}</td><td /></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
