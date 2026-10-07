// A linha de Salários a pagar ou do FGTS a recolher na etapa da folha (Vitor, 07/10/2026), no desenho da linha do INSS: o
// nome, o resumo e só o Razão à direita (o ⚡ e o importar; importado, o check que vira × e tira). Embaixo, a grade dos meses
// com o saldo do fim de cada um, sem D/C: o certo (credor ou zero) em branco, o devedor em azul.
import { Icone } from '@nads/ui';
import { useId, useState } from 'react';
import { BotaoDeTeste, type ItemDeTeste } from '../../../../../comum/BotaoDeTeste';
import { useColunaAjustavel, ValorNaGrade } from '../../../../../comum/GradeDosMeses';
import type { RazaoDaFolha as Vm } from '../useRazaoDaFolha';

export function RazaoDaFolha({ vm, dev }: { vm: Vm; dev: boolean }) {
  const id = useId();
  const [aberta, setAberta] = useState(true);
  const grade = useColunaAjustavel('folha-' + vm.conta, '96px', vm.meses.length);
  const teste: ItemDeTeste[] = dev ? vm.teste : [];
  return (
    <div className={'imp-bloco' + (vm.ok ? ' imp-ok' : '')}>
      <div className="imp-linha">
        <button type="button" className={'imp-seta' + (aberta ? ' aberta' : '')} aria-expanded={aberta} disabled={!vm.temRazao}
          title={aberta ? 'Recolher' : 'Abrir'} aria-label={'Os meses de ' + vm.nome} onClick={() => setAberta(a => !a)}>
          <Icone nome="caretDown" />
        </button>
        <span className="imp-ico"><Icone nome="scale" /></span>
        <div className="imp-txt">
          <span><b>{vm.nome}</b>{vm.arquivo && <span className="imp-conta">{vm.arquivo}</span>}</span>
        </div>
        <div className="imp-resumo">{vm.resumo.length > 0 && <div>{vm.resumo.map(x => <span key={x}>{x}</span>)}</div>}</div>
        <div className="imp-grupos">
          <div className="imp-grupo" aria-label={'Razão de ' + vm.nome}>
            <span className="imp-rotulo">Razão</span>
            {vm.temRazao ? (
              <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={vm.remover} title={'O razão de ' + vm.nome + ': importado. Clique para excluir.'} aria-label={'Excluir o razão de ' + vm.nome}>
                <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
              </button>
            ) : (
              <>
                <BotaoDeTeste itens={teste} />
                <label htmlFor={id} className="icon-btn icon-btn-sm imp-btn" title={'Importar o razão de ' + vm.nome + ' (XLS da conciliação do Alterdata)'} aria-label={'Importar o razão de ' + vm.nome}><Icone nome="upload" /></label>
                <input id={id} type="file" accept=".xls,.xlsx,.ods" className="sr-only"
                  onChange={e => { const f = e.target.files?.[0] || null; e.target.value = ''; void vm.importar(f); }} />
              </>
            )}
          </div>
        </div>
      </div>
      {vm.temRazao && aberta && (
        <div className="imp-periodo-linha">
          <table className="imp-meses" style={grade.tabela}>
            <colgroup><col style={{ width: grade.largura }} /></colgroup>
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Mês</span>{grade.alca}</th>
                {vm.meses.map(m => <th key={m.mes} scope="col">{m.rotulo}</th>)}
              </tr>
            </thead>
            <tbody>
              <tr><th scope="row" title="O saldo no fim do mês">Saldo final</th>
                {vm.meses.map(m => <td key={m.mes} className={'num' + (m.errado ? ' ext-azul' : '')} title={m.errado ? 'Devedor: corrija no Alterdata' : undefined}><ValorNaGrade texto={m.saldo} /></td>)}
              </tr>
              <tr><th scope="row">Lançamentos</th>{vm.meses.map(m => <td key={m.mes} className="num">{m.qtd || '—'}</td>)}</tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
