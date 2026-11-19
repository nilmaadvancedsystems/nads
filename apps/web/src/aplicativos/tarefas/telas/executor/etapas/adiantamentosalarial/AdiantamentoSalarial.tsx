// A etapa Adiantamento salarial (Vitor, 16/10/2026): a linha do razão (como a da folha: o importar; importado, o check que
// vira × e tira) e, como no Pró-labore (19/11/2026), a grade pago / não pago do período — o descontado na folha, o pago, o que
// falta e o saldo — e, faltando pagamento, o "Gerar lançamentos" (o banco no menu e o .xls de importação do Alterdata).
import { CampoArquivo, Icone } from '@nads/ui';
import { ImportarRazaoComRobo } from '../../partes/ImportarRazaoComRobo';
import { BotaoImportarNoAlterdata } from '../../../../../../comum/BotaoImportarNoAlterdata';
import { BotaoDiario } from '../../../../../../comum/BotaoDiario';
import { useId, useState } from 'react';
import { MenuDaContaDoPagamento } from '../../partes/PagamentosDoProLabore';
import { useColunaAjustavel, ValorNaGrade } from '../../../../../../comum/GradeDosMeses';
import type { VmAdiantamentoSalarial } from './useAdiantamentoSalarial';
import { useAdiantamentoSalarial } from './useAdiantamentoSalarial';
import { BotaoSemMovimento } from '../../partes/BotaoSemMovimento';

export function AdiantamentoSalarial() {
  const vm = useAdiantamentoSalarial();
  const id = useId();
  // o desenho do Pró-labore (19/11/2026: "remove isso, muito confuso"; "deixa a mesma coisa que o pro-labore"):
  // sem o arquivo e o resumo no alto; as contas e o Baixar só atrás do "Gerar lançamentos"; embaixo, a grade pago / não pago
  const [gerar, setGerar] = useState(false);
  return (
    <section>
      <header className="topbar">
        <div><h2 className="page-title">Adiantamento salarial</h2></div>
        {/* Vitor, 26/10/2026: a conta não mexeu mais; marcado, a etapa não cobra nada (clicar de novo desfaz) */}
        {vm.mostrarSemMovimento && <div className="btn-row"><BotaoSemMovimento marcado={vm.semMovimento} onClick={vm.alternarSemMovimento} /></div>}
      </header>
      <div className="imp-lista">
        <div className={'imp-bloco' + (vm.ok ? ' imp-ok' : '')}>
          <div className="imp-linha">
            <span className="imp-ico"><Icone nome="dinheiro" /></span>
            <div className="imp-txt imp-txt-larga">
              <span><b>Adiantamento salarial</b></span>
            </div>
            <div className="imp-grupos">
              {/* zerou em todos os meses: o Ok padrão (o selo, como nos Bancos) */}
              {vm.ok && <span className="badge badge-ok" title="O Adiantamento salarial zerou em todos os meses do período">Ok</span>}
              <div className="imp-grupo" aria-label="Razão do Adiantamento salarial">
                <span className="imp-rotulo">Razão</span>
                {vm.temRazao ? (
                  <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={vm.remover} title="O razão do Adiantamento salarial: importado. Clique para tirar." aria-label="Tirar o razão do Adiantamento salarial">
                    <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                  </button>
                ) : (
                  <>
                    <BotaoDiario onClick={vm.usarDiario} />
                    <ImportarRazaoComRobo robo={vm.robo} titulo="o razão do Adiantamento salarial" importar={f => vm.importar(f)}>
                      <label htmlFor={id} className="icon-btn icon-btn-sm imp-btn" title="Importar o razão do Adiantamento salarial (XLS da conciliação do Alterdata)" aria-label="Importar o razão do Adiantamento salarial"><Icone nome="upload" /></label>
                      <CampoArquivo semCaixa id={id} aceitar=".xls,.xlsx,.ods" onEscolher={f => { void vm.importar(f); }} />
                    </ImportarRazaoComRobo>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* os lançamentos que faltam, só se a pessoa quiser (como no Pró-labore) */}
          {vm.temRazao && vm.qtd > 0 && (
            <div className="btn-row adiantamento-gerar">
              {!gerar ? (
                <button type="button" className="btn btn-outline" onClick={() => setGerar(true)}
                  title={'Montar ' + (vm.qtd === 1 ? 'o pagamento que falta' : 'os ' + vm.qtd + ' pagamentos que faltam') + ' para importar no Alterdata'}>
                  <Icone nome="plus" />Gerar lançamentos
                </button>
              ) : (
                <>
                  {!vm.contaAdiantamento && (
                    <input type="text" inputMode="numeric" placeholder="Conta do adiantamento" aria-label="Conta do adiantamento (débito)" title="O código da conta do Adiantamento salarial (débito)"
                      value={vm.contaAdiantamento} onChange={e => vm.digitarContaAdiantamento(e.target.value)} style={{ width: 180 }} />
                  )}
                  <MenuDaContaDoPagamento valor={vm.contaBanco} nome={vm.nomeDoBanco} contas={vm.contasDePagamento} travado={false} onEscolher={vm.escolherBanco} />
                  <BotaoImportarNoAlterdata {...vm.importacao} disabled={!vm.podeExportar} motivo="Escolha a conta do crédito" baixar={vm.baixarXls} />
                </>
              )}
            </div>
          )}
          {/* a grade pago / não pago do período (19/11/2026) */}
          {vm.grade && vm.grade.length > 0 && <GradeDoAdiantamento grade={vm.grade} />}
        </div>
      </div>

    </section>
  );
}

const SITUACAO = {
  pago: { texto: 'Pago', classe: 'badge badge-ok' },
  parcial: { texto: 'Parcial', classe: 'badge badge-warn' },
  falta: { texto: 'Não pago', classe: 'badge badge-bad' },
  sem: { texto: '—', classe: 'hint' },
} as const;

/** O Adiantamento salarial mês a mês, no desenho da grade do Pró-labore (19/11/2026): a situação e, embaixo, os valores. */
function GradeDoAdiantamento({ grade }: { grade: NonNullable<VmAdiantamentoSalarial['grade']> }) {
  const g = useColunaAjustavel('adiantamento-salarial', '96px', grade.length);
  const abertos = grade.filter(m => m.falta);
  const linha = (rotulo: string, valor: (m: (typeof grade)[number]) => string, titulo?: string, classe?: (m: (typeof grade)[number]) => string) => (
    <tr><th scope="row" title={titulo}>{rotulo}</th>{grade.map(m => <td key={m.mes} className={'num ' + (classe ? classe(m) : '')}>{valor(m) ? <ValorNaGrade texto={valor(m)} /> : '—'}</td>)}</tr>
  );
  return (
    <div className="prolabore-meses adiantamento-grade">
      <p className="hint">{abertos.length ? abertos.length + (abertos.length === 1 ? ' mês sem pagar tudo' : ' meses sem pagar tudo') : 'Tudo pago no período'}</p>
      <table className="imp-meses" style={g.tabela}>
        <colgroup><col style={{ width: g.largura }} /></colgroup>
        <thead><tr><th scope="col"><span className="sr-only">Mês</span>{g.alca}</th>{grade.map(m => <th key={m.mes} scope="col"><span className="imp-meses-mes">{m.rotulo}</span></th>)}</tr></thead>
        <tbody>
          <tr><th scope="row">Situação</th>{grade.map(m => (
            <td key={m.mes} title={m.pagoEm ? 'Pago em ' + m.pagoEm + ' (dia certo ' + m.diaCerto + ')' : 'Dia certo ' + m.diaCerto}><span className={SITUACAO[m.situacao].classe}>{SITUACAO[m.situacao].texto}</span></td>
          ))}</tr>
          {linha('Descontado', m => m.descontado, 'O adiantamento descontado na folha do mês')}
          {linha('Pago', m => m.pago, 'O pagamento do adiantamento (o dia 15, ou o útil antes)')}
          {linha('Falta', m => m.falta, 'O que ainda falta pagar do mês', m => (m.falta ? 'ext-neg' : ''))}
          {linha('Saldo', m => m.saldo, 'O saldo da conta no fim do mês')}
        </tbody>
      </table>
    </div>
  );
}
