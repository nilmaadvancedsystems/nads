// Embaixo do item Pró-labore do checklist da Contabilização da Folha (Vitor, 14/10/2026): o ícone de importar o razão do
// Pró-labore a pagar (importado, o check que vira × e tira) e, com ele, só a conta do crédito, o dia útil do pagamento (1º
// ao 5º do mês seguinte) e o ícone do "Importar no meu Sistema" (o .xls do Alterdata). A relação do razão não aparece.
import { CampoArquivo, Icone, MenuSuspenso } from '@nads/ui';
import { useId } from 'react';
import { usePagamentosDoProLabore } from '../usePagamentosDoProLabore';
import { BotaoImportarNoAlterdata } from '../../../../../comum/BotaoImportarNoAlterdata';
import { BotaoDiario } from '../../../../../comum/BotaoDiario';
import { useModoDesenvolvedor } from '../../../../../comum/modoDesenvolvedor';
import { ComRoboDoRazao, MenuDeImportar } from '../../../etapas/extrator/telas/tarefa/BotaoVitorDoRazao';

/** travado: o item Pró-labore marcado no checklist — os botões ficam travados (Vitor, 14/10/2026) */
export function PagamentosDoProLabore({ empresa, codigo, contaDoItem, travado, meses }: { empresa: string; codigo: number | null; contaDoItem: string; travado?: boolean; meses?: readonly string[] }) {
  const vm = usePagamentosDoProLabore(empresa, codigo, contaDoItem);
  const id = useId();
  // o botão Vitor (18/11/2026: "coloca o botao vitor para o robo puxar o razao, modo desenvolvedor primeiro"): o ⬆ ganha o menu
  // com o robô do PC dele (só para a conta dele) puxando o razão da conta do Pró-labore no período
  const [dev] = useModoDesenvolvedor();
  const contaDoRobo = contaDoItem.split(' — ')[0].trim();
  const doComputador = (
    <>
      <label htmlFor={id} className={'icon-btn icon-btn-sm imp-btn' + (travado ? ' is-locked' : '')} aria-disabled={travado || undefined} title="Importar o razão do Pró-labore a pagar (XLS da conciliação do Alterdata)" aria-label="Importar o razão do pró-labore"><Icone nome="upload" /></label>
      <CampoArquivo semCaixa id={id} aceitar=".xls,.xlsx,.ods" desabilitado={travado} onEscolher={f => { void vm.importar(f); }} />
    </>
  );
  return (
    <div className="btn-row" style={{ justifyContent: 'flex-start', alignItems: 'center' }}>
      {vm.temRazao ? (
        <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" disabled={travado} onClick={vm.remover} title={'Razão do pró-labore importado: ' + vm.arquivo + '. Clique para tirar.'} aria-label="Tirar o razão do pró-labore">
          <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
        </button>
      ) : (
        <>
          <BotaoDiario onClick={vm.usarDiario} />
          {dev && meses && meses.length && contaDoRobo ? (
            <ComRoboDoRazao codigo={codigo} empresa={empresa} conta={contaDoRobo} meses={meses} importar={f => vm.importar(f)}>
              {robo => (robo
                ? <MenuDeImportar titulo={'o razão do Pró-labore (' + contaDoRobo + ')'} aceitar=".xls,.xlsx,.ods" travado={!!travado} robo={robo} onArquivos={fs => { if (fs[0]) void vm.importar(fs[0]); }} />
                : doComputador)}
            </ComRoboDoRazao>
          ) : doComputador}
        </>
      )}
      {vm.temRazao && (vm.qtd ? (
        <>
          {/* a conta do crédito digitada (Vitor, 14/10/2026: "não de selecionar, só o input") */}
          <input type="text" inputMode="numeric" placeholder="Conta" aria-label="Conta do crédito" title="O código da conta do crédito (ex.: 10101)"
            value={vm.conta} disabled={travado} onChange={e => vm.digitarConta(e.target.value)} onBlur={vm.salvarConta}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} style={{ width: 96 }} />
          {travado
            ? <button type="button" className="btn btn-outline" disabled>{vm.diaUtil}º dia útil</button>
            : <MenuSuspenso rotulo={vm.diaUtil + 'º dia útil'} className="btn btn-outline" dica="O dia útil do pagamento, no mês seguinte à competência" largura={160}
              itens={[1, 2, 3, 4, 5].map(n => ({ rotulo: n + 'º dia útil', marcado: vm.diaUtil === n, onClick: () => vm.escolherDiaUtil(n) }))} />}
          <BotaoImportarNoAlterdata {...vm.importacao} disabled={travado || !vm.podeExportar} motivo="Escolha a conta do crédito" />
          <button type="button" className="icon-btn icon-btn-sm" disabled={travado || !vm.podeExportar} onClick={vm.baixarXls}
            title={vm.podeExportar ? 'Importar no meu Sistema: o .xls do Alterdata com ' + vm.qtd + ' pagamentos (' + vm.total + ')' : 'Escolha a conta do crédito'}
            aria-label="Importar no meu Sistema"><Icone nome="download" /></button>
        </>
      ) : <span className="hint">O razão já zera</span>)}
    </div>
  );
}
