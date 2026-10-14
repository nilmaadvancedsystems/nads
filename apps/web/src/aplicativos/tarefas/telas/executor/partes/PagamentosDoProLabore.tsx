// Embaixo do item Pró-labore do checklist da Contabilização da Folha (Vitor, 14/10/2026): o ícone de importar o razão do
// Pró-labore a pagar (importado, o check que vira × e tira) e, com ele, a lista dos pagamentos que faltam para o razão
// zerar — no cabeçalho, o dia e a conta do crédito para todos (dá para trocar em cada um); na linha do total, o ícone do
// "Importar no meu Sistema" (o .xls do Alterdata).
import { Icone } from '@nads/ui';
import { useId } from 'react';
import { MenuDeConta } from '../../../../extratudo/ferramentas/creditor/partes/MenuDeConta';
import { usePagamentosDoProLabore } from '../usePagamentosDoProLabore';

export function PagamentosDoProLabore({ empresa, contaDoItem }: { empresa: string; contaDoItem: string }) {
  const vm = usePagamentosDoProLabore(empresa, contaDoItem);
  const id = useId();
  // só o ícone de importar o razão e a lista (Vitor, 14/10/2026: "deixe apenas o ícone de importação e a lista abaixo"):
  // o dia e o crédito de todos ficam no cabeçalho da lista; o .xls do Alterdata, no ícone de baixar da linha do total
  return (
    <div style={{ marginTop: 8 }}>
      <div className="btn-row" style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
        {vm.temRazao ? (
          <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={vm.remover} title={'Razão do pró-labore importado: ' + vm.arquivo + '. Clique para tirar.'} aria-label="Tirar o razão do pró-labore">
            <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
          </button>
        ) : (
          <>
            <label htmlFor={id} className="icon-btn icon-btn-sm imp-btn" title="Importar o razão do Pró-labore a pagar (XLS da conciliação do Alterdata)" aria-label="Importar o razão do pró-labore"><Icone nome="upload" /></label>
            <input id={id} type="file" accept=".xls,.xlsx,.ods" className="sr-only" onChange={e => { const f = e.target.files?.[0] || null; e.target.value = ''; void vm.importar(f); }} />
          </>
        )}
        {vm.temRazao && !vm.pagamentos.length && <span className="hint">O razão já zera</span>}
      </div>
      {vm.temRazao && vm.pagamentos.length > 0 && (
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table className="table-compact">
            <thead>
              <tr>
                {/* a data: o 5º dia útil do mês seguinte à competência (a regra; Vitor, 14/10/2026) */}
                <th title="O 5º dia útil do mês seguinte à competência">Data</th>
                <th title={'Débito: ' + vm.debito + (vm.nomeDoDebito ? ' — ' + vm.nomeDoDebito : '') + '. Crédito: a conta escolhida aqui vale para todos.'}>
                  <MenuDeConta valor={vm.contaGeral} contas={vm.contas} onEscolher={vm.escolherContaGeral} />
                </th>
                <th className="num">Valor</th>
                <th>Histórico</th>
              </tr>
            </thead>
            <tbody>
              {vm.pagamentos.map(p => (
                <tr key={p.chave}>
                  <td style={{ whiteSpace: 'nowrap' }}>{p.data}</td>
                  <td><MenuDeConta valor={p.conta} contas={vm.contas} onEscolher={c => vm.escolherConta(p.chave, c)} /></td>
                  <td className="num">{p.valor}</td>
                  <td className="wrap">{p.historico}{p.doSaldoAnterior && <span className="hint" style={{ display: 'block' }}>O saldo que vinha de antes do razão</span>}</td>
                </tr>
              ))}
              <tr className="imp-mov-anterior">
                <td colSpan={2}>Total (o saldo do razão: {vm.saldoFinal})</td>
                <td className="num">{vm.total}</td>
                <td className="num">
                  <button type="button" className="icon-btn icon-btn-sm" disabled={!vm.podeExportar} onClick={vm.baixarXls}
                    title={vm.podeExportar ? 'Importar no meu Sistema: o .xls do Alterdata com os pagamentos' : 'Falta a conta do crédito' + (vm.faltaConta ? ' de ' + vm.faltaConta + (vm.faltaConta === 1 ? ' pagamento' : ' pagamentos') : '')}
                    aria-label="Importar no meu Sistema"><Icone nome="download" /></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
