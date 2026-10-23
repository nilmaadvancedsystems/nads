// Embaixo do item Pró-labore do checklist da Contabilização da Folha (Vitor, 14/10/2026): o ícone de importar o razão do
// Pró-labore a pagar (importado, o check que vira × e tira) e, com ele, só a conta do crédito, o dia útil do pagamento (1º
// ao 5º do mês seguinte) e o ícone do "Importar no meu Sistema" (o .xls do Alterdata). A relação do razão não aparece.
import { CampoArquivo, Icone, MenuSuspenso } from '@nads/ui';
import { useId } from 'react';
import { usePagamentosDoProLabore } from '../usePagamentosDoProLabore';

/** travado: o item Pró-labore marcado no checklist — os botões ficam travados (Vitor, 14/10/2026) */
export function PagamentosDoProLabore({ empresa, codigo, contaDoItem, travado }: { empresa: string; codigo: number | null; contaDoItem: string; travado?: boolean }) {
  const vm = usePagamentosDoProLabore(empresa, codigo, contaDoItem);
  const id = useId();
  return (
    <div className="btn-row" style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
      {vm.temRazao ? (
        <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" disabled={travado} onClick={vm.remover} title={'Razão do pró-labore importado: ' + vm.arquivo + '. Clique para tirar.'} aria-label="Tirar o razão do pró-labore">
          <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
        </button>
      ) : (
        <>
          <label htmlFor={id} className={'icon-btn icon-btn-sm imp-btn' + (travado ? ' is-locked' : '')} aria-disabled={travado || undefined} title="Importar o razão do Pró-labore a pagar (XLS da conciliação do Alterdata)" aria-label="Importar o razão do pró-labore"><Icone nome="upload" /></label>
          <CampoArquivo semCaixa id={id} aceitar=".xls,.xlsx,.ods" desabilitado={travado} onEscolher={f => { void vm.importar(f); }} />
        </>
      )}
      {vm.temRazao && (vm.qtd ? (
        <>
          {/* a conta do crédito digitada (Vitor, 14/10/2026: "não de selecionar, só o input"); sem ela, o baixar fica travado (Vitor, 23/10/2026) */}
          <input type="text" inputMode="numeric" placeholder="Conta" aria-label="Conta do crédito" title={vm.faltaConta ? 'Digite a conta do crédito para poder baixar' : 'O código da conta do crédito (ex.: 10101)'}
            value={vm.conta} disabled={travado} aria-invalid={vm.faltaConta || undefined} onChange={e => vm.digitarConta(e.target.value)} onBlur={vm.salvarConta}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} style={{ width: 96 }} />
          {travado
            ? <button type="button" className="btn btn-outline" disabled>{vm.diaUtil}º dia útil</button>
            : <MenuSuspenso rotulo={vm.diaUtil + 'º dia útil'} className="btn btn-outline" dica="O dia útil do pagamento, no mês seguinte à competência" largura={160}
              itens={[1, 2, 3, 4, 5].map(n => ({ rotulo: n + 'º dia útil', marcado: vm.diaUtil === n, onClick: () => vm.escolherDiaUtil(n) }))} />}
          <button type="button" className="icon-btn icon-btn-sm" disabled={travado || !vm.podeExportar} onClick={vm.baixarXls}
            title={vm.podeExportar ? 'Importar no meu Sistema: o .xls do Alterdata com ' + vm.qtd + ' pagamentos (' + vm.total + ')' : vm.faltaConta ? 'Digite a conta do crédito para baixar' : 'Nada para baixar'}
            aria-label="Importar no meu Sistema"><Icone nome="download" /></button>
        </>
      ) : <span className="hint">O razão já zera</span>)}
    </div>
  );
}
