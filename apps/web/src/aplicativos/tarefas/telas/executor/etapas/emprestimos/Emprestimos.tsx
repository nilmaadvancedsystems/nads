// A etapa Empréstimos e financiamentos da Tarefa (Vitor, 07/10/2026), no desenho das outras etapas de razão (Adiantamento,
// Clientes): o importar em cima (vários razões de uma vez, um por contrato) e um bloco por empréstimo — o arquivo, o banco
// no menu (já sugerido pelo razão), o check que tira, a grade com o saldo do fim de cada mês (devedor em vermelho) e a
// faixa com os lançamentos.
import { Alerta, Icone, LogoBanco, MenuSuspenso } from '@nads/ui';
import { useRef, useState } from 'react';
import { FaixaQueAbre } from '../../../../../../comum/FaixaQueAbre';
import { useColunaAjustavel, ValorNaGrade } from '../../../../../../comum/GradeDosMeses';
import { useEmprestimos, type VmEmprestimos } from './useEmprestimos';

function Emprestimo({ e, vm }: { e: VmEmprestimos['emprestimos'][number]; vm: VmEmprestimos }) {
  const grade = useColunaAjustavel('emprestimos', Math.max(14, 22 - e.meses.length) + '%', e.meses.length);
  // o filtro da faixa Lançamentos: os do período (a conta toda) ou os de um contrato (até o mês consultado)
  const [filtro, setFiltro] = useState('periodo');
  const doContrato = e.porContrato.find(k => k.id === filtro) || null;
  const linhas = doContrato ? doContrato.lancamentos : e.lancamentos;
  return (
    <div className={'imp-bloco' + (e.banco && !e.devedores.length ? ' imp-ok' : '')}>
      <div className="imp-linha">
        {/* o logo do banco escolhido (como na Importação); sem banco, o ícone */}
        <span className="imp-ico imp-logo">{e.banco ? <LogoBanco banco={e.banco.marca} cor /> : <Icone nome="landmark" />}</span>
        <div className="imp-txt"><span><b>{e.banco ? e.banco.rotulo : 'Escolha o banco'}</b><span className="imp-conta">{e.arquivo}</span></span></div>
        <div className="imp-resumo"><div><span>{e.resumo}</span></div></div>
        <div className="imp-grupos">
          <div className="imp-grupo">
            <span className="imp-rotulo">Banco</span>
            {e.travado ? (
              <span className="imp-periodo-info" title="Gravado no Cadastro da empresa: só um administrador troca o banco deste empréstimo"><Icone nome="lock" />Gravado</span>
            ) : <MenuSuspenso rotulo={e.banco ? 'Trocar' : 'Escolher'} direita largura={320} className={e.banco ? 'btn btn-outline' : 'btn btn-primary'}
              dica="O banco deste empréstimo (os bancos do Cadastro)"
              itens={vm.bancos.length ? vm.bancos.map(b => ({ rotulo: b.rotulo, icone: 'landmark' as const, marcado: e.banco?.id === b.id, onClick: () => vm.escolherBanco(e.id, b.id) }))
                : [{ rotulo: 'Nenhum banco no Cadastro da empresa', desabilitado: true, onClick: () => undefined }]} />}
            <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={() => vm.tirar(e.id)} title={'Importado: ' + e.arquivo + '. Clique para tirar.'} aria-label="Tirar o razão">
              <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
            </button>
          </div>
        </div>
      </div>
      <div className="imp-periodo-linha">
        <table className="imp-meses" style={grade.tabela}>
          <colgroup><col style={{ width: grade.largura }} /></colgroup>
          <thead>
            <tr>
              <th scope="col"><span className="sr-only">Mês</span>{grade.alca}</th>
              {e.meses.map(m => <th key={m.mes} scope="col">{m.rotulo}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr><th scope="row" style={{ textAlign: 'left' }} title="O saldo no fim do mês">Saldo final</th>
              {e.meses.map(m => <td key={m.mes} className={'num' + (m.devedor ? ' ext-neg' : '')} title={m.devedor ? 'Devedor: o empréstimo fica credor ou zera' : undefined}><ValorNaGrade texto={m.saldo} /></td>)}
            </tr>
            <tr><th scope="row" style={{ textAlign: 'left' }}>Lançamentos</th>
              {e.meses.map(m => <td key={m.mes} className="num">{m.qtd || '—'}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      {/* os contratos achados no histórico (Vitor, 07/10/2026) */}
      <FaixaQueAbre titulo="Contratos" qtd={e.contratos.length} aviso={e.quitadosComSaldo.length > 0}>
        <div className="imp-mov">
          <table className="table-compact">
            <thead><tr><th>Contrato</th><th>Liberado</th><th>Parcelas pagas</th><th className="num">Saldo</th><th>Situação</th></tr></thead>
            <tbody>
              {e.contratos.map(k => (
                <tr key={k.numero} title={k.periodo}>
                  <td className="num"><b>{k.numero}</b></td>
                  <td>{k.liberado}</td>
                  <td>{k.parcelas}</td>
                  <td className={'num' + (k.situacao === 'quitado-com-saldo' ? ' ext-neg' : '')}>{k.saldo}</td>
                  <td>{k.situacao === 'aberto' ? <span className="badge badge-neutral">Em aberto</span>
                    : k.situacao === 'quitado' ? <span className="badge badge-ok" title={k.comSemNumero ? 'Zera com os lançamentos sem número (são dele)' : undefined}>{k.comSemNumero ? 'Quitado (com os sem número)' : 'Quitado'}</span>
                    : <span className="badge badge-neutral ext-neg" title="Pagou todas as parcelas e ainda tem saldo: lançamento com o número errado, ou parcela que faltou">Quitado com saldo</span>}</td>
                </tr>
              ))}
              {e.semNumero && (
                <tr className="imp-mov-anterior"><td colSpan={3}>Sem número de contrato ({e.semNumero.qtd} {e.semNumero.qtd === 1 ? 'lançamento' : 'lançamentos'}: implantação de saldo, histórico incompleto){e.semNumero.de && ' · são do ' + e.semNumero.de}</td><td className="num">{e.semNumero.soma}</td><td /></tr>
              )}
            </tbody>
          </table>
        </div>
      </FaixaQueAbre>
      <FaixaQueAbre titulo="Lançamentos" qtd={linhas.length}>
        <div className="imp-mov-topo">
          <MenuSuspenso rotulo={doContrato ? (doContrato.id === 'sem-numero' ? 'Sem número de contrato' : 'Contrato ' + doContrato.rotulo) : 'Lançamentos do período'} className="btn btn-outline" largura={280}
            dica="Filtrar os lançamentos por contrato"
            itens={[
              { rotulo: 'Lançamentos do período', marcado: !doContrato, onClick: () => setFiltro('periodo') },
              'separador' as const,
              ...e.porContrato.map(k => ({ rotulo: k.id === 'sem-numero' ? 'Sem número de contrato' : 'Contrato ' + k.rotulo, dica: k.lancamentos.length + ' lançamentos', marcado: filtro === k.id, onClick: () => setFiltro(k.id) })),
            ]} />
        </div>
        <div className="imp-mov">
          <table className="table-compact">
            <thead><tr><th>Data</th><th>Contrapartida</th><th>Histórico</th><th className="num">Débito</th><th className="num">Crédito</th><th className="num">Saldo</th></tr></thead>
            <tbody>
              {!doContrato && <tr className="imp-mov-anterior"><td colSpan={5}>Saldo anterior</td><td className="num">{e.saldoAnterior}</td></tr>}
              {linhas.map(l => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{l.data}</td>
                  <td>{l.contrapartida}</td>
                  <td className="wrap">{l.historico}</td>
                  <td className="num">{l.debito}</td>
                  <td className="num">{l.credito}</td>
                  <td className={'num' + (l.devedor ? ' ext-neg' : '')}>{l.saldo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FaixaQueAbre>
    </div>
  );
}

export function Emprestimos() {
  const vm = useEmprestimos();
  const arquivo = useRef<HTMLInputElement>(null);
  const devedores = vm.emprestimos.filter(e => e.devedores.length);
  const quitadosComSaldo = vm.emprestimos.flatMap(e => e.quitadosComSaldo);
  return (
    <section>
      <header className="topbar"><div><h2 className="page-title">Empréstimos e financiamentos</h2></div></header>
      <div className="tarefas-barra-topo">
        <span className="tarefas-contador"><Icone nome="landmark" /><b>{vm.emprestimos.length}</b> {vm.emprestimos.length === 1 ? 'empréstimo' : 'empréstimos'}</span>
        <span className="tarefas-barra-espaco" />
        {/* importar: só o ícone (vários razões de uma vez, um por contrato) */}
        <button type="button" className="icon-btn" onClick={() => arquivo.current?.click()} title={'Importar o razão de cada empréstimo (XLS da conciliação do Alterdata), com ' + vm.periodo} aria-label="Importar razão">
          <Icone nome="upload" />
        </button>
        <input ref={arquivo} type="file" multiple accept=".xls,.xlsx,.ods" className="sr-only" tabIndex={-1} aria-hidden="true"
          onChange={ev => { const fs = Array.from(ev.target.files || []); ev.target.value = ''; vm.importar(fs); }} />
      </div>

      {devedores.length > 0 && (
        <div className="alerta-linha">
          <Alerta titulo="Empréstimo com saldo devedor"
            texto={devedores.map(e => (e.banco?.rotulo || e.arquivo) + ': ' + e.devedores.join(', ')).join(' · ') + '. O empréstimo fica credor ou zera: confira a parcela paga a mais ou lançada no empréstimo errado.'} />
        </div>
      )}

      {quitadosComSaldo.length > 0 && (
        <div className="alerta-linha">
          <Alerta titulo={quitadosComSaldo.length === 1 ? 'Contrato quitado com saldo' : 'Contratos quitados com saldo'}
            texto={'Pagou todas as parcelas e ainda tem saldo: ' + quitadosComSaldo.join(', ') + '. Costuma ser encargo ou parcela lançada com o número de outro contrato.'} />
        </div>
      )}

      {/* os empréstimos que o Cadastro já conhece neste período (de razões importados antes) */}
      {vm.noPeriodo.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>Empréstimos da empresa em {vm.periodo}</h3><span className="hint">do Cadastro: o banco e os meses de cada contrato, guardados quando o razão foi importado</span></div>
          <div className="table-wrap">
            <table className="table-compact emp-tabela">
              <thead><tr><th>Contrato</th><th>Banco</th><th>Desde</th><th>Até</th><th>Razão</th></tr></thead>
              <tbody>
                {vm.noPeriodo.map(e => (
                  <tr key={e.numero}>
                    <td><b>{e.numero}</b></td>
                    <td><span className="emp-banco"><span className="imp-ico imp-logo"><LogoBanco banco={e.marca} cor /></span>{e.banco}</span></td>
                    <td>{e.desde}</td>
                    <td>{e.ate || 'em aberto'}</td>
                    <td>{e.noRazao ? <span className="badge badge-ok">Importado</span> : <span className="badge badge-neutral">Falta importar</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="imp-lista">
        {vm.emprestimos.map(e => <Emprestimo key={e.id} e={e} vm={vm} />)}
      </div>

      {!vm.emprestimos.length && !vm.noPeriodo.length && (
        <div className="gh-blank">
          <Icone nome="landmark" />
          <h4>Importe o razão de cada empréstimo</h4>
          <p>No ícone de importar, em cima: um razão por contrato (o XLS da conciliação do Alterdata, com {vm.periodo}). O banco de cada um já vem sugerido pela contrapartida das parcelas; confira e troque se precisar.</p>
        </div>
      )}
    </section>
  );
}
