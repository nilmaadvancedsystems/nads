// A etapa Empréstimos e financiamentos da Tarefa (Vitor, 07/10/2026), no desenho das outras etapas de razão: duas telas nas
// abas embaixo do cabeçalho (como as da Importação; Vitor, 07/10/2026: "no menu superior abaixo do cabeçalho"). Empréstimos: o importar (vários razões de uma vez) e um bloco por
// empréstimo — o arquivo, o banco no menu (já sugerido; gravado, só o administrador troca), o check que tira e as faixas
// Contratos (os achados no histórico; sem a grade de saldo: "já pode ir direto para contratos") e Pendências (o que
// conferir, no lugar dos avisos do topo: "deixe isso em pendências, em um dropdown igual a esses").
// Lançamentos: os de cada empréstimo, filtrados por contrato.
import { Icone, LogoBanco, MenuSuspenso, useRetorno } from '@nads/ui';
import { useRef, useState } from 'react';
import { FaixaQueAbre } from '../../../../../../comum/FaixaQueAbre';
import { useAbasDaEtapa } from '../contexto';
import { useEmprestimos, type VmEmprestimos } from './useEmprestimos';

function Emprestimo({ e, vm }: { e: VmEmprestimos['emprestimos'][number]; vm: VmEmprestimos }) {
  return (
    <div className={'imp-bloco' + (e.banco && !e.devedores.length ? ' imp-ok' : '')}>
      <div className="imp-linha">
        {/* o logo do banco escolhido (como na Importação); sem banco, o ícone */}
        <span className="imp-ico imp-logo">{e.banco ? <LogoBanco banco={e.banco.marca} cor /> : <Icone nome="landmark" />}</span>
        {/* só o banco (Vitor, 08/10/2026: sem o nome do arquivo e sem o resumo dos contratos; o arquivo fica no título do check) */}
        <div className="imp-txt"><span><b>{e.banco ? e.banco.rotulo : 'Escolha o banco'}</b></span></div>
        <div className="imp-resumo" />
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
      {/* os contratos achados no histórico (Vitor, 07/10/2026) */}
      <FaixaQueAbre titulo="Contratos" qtd={e.contratos.length}>
        <div className="imp-mov">
          <table className="table-compact emp-tabela">
            <thead><tr><th>Contrato</th><th>Data inicial</th><th>Valor liberado</th><th>Parcelas pagas</th><th className="num">Saldo</th><th>Situação</th></tr></thead>
            <tbody>
              {e.contratos.map(k => (
                <tr key={k.numero} title={k.periodo}>
                  <td className="num"><b>{k.numero}</b></td>
                  <td>{k.liberadoEm}</td>
                  <td>{k.liberado}</td>
                  <td>{k.parcelas}</td>
                  <td className={'num' + (k.situacao === 'quitado-com-saldo' ? ' ext-neg' : '')}>{k.saldo}</td>
                  <td><SeloDoContrato situacao={k.situacao} comSemNumero={k.comSemNumero} /></td>
                </tr>
              ))}
              {e.semNumero && (
                <tr className="imp-mov-anterior"><td colSpan={4}>Sem número de contrato ({e.semNumero.qtd} {e.semNumero.qtd === 1 ? 'lançamento' : 'lançamentos'}: implantação de saldo, histórico incompleto){e.semNumero.de && ' · são do ' + e.semNumero.de}</td><td className="num">{e.semNumero.soma}</td><td /></tr>
              )}
            </tbody>
          </table>
        </div>
      </FaixaQueAbre>
      {/* as pendências do empréstimo, no lugar dos avisos do topo (o número em laranja) */}
      {e.pendencias.length > 0 && (
        <FaixaQueAbre titulo="Pendências" qtd={e.pendencias.length} aviso>
          <ul className="emp-pendencias">
            {e.pendencias.map(x => (
              <li key={x.titulo}><Icone nome="alert" /><span><b>{x.titulo}</b><span className="hint">{x.texto}</span></span></li>
            ))}
          </ul>
        </FaixaQueAbre>
      )}
    </div>
  );
}

/** A tela Lançamentos: um empréstimo de cada vez (o menu, com mais de um) e o filtro por contrato. */
/** O selo da situação do contrato (na lista de contratos e no filtro dos lançamentos). */
function SeloDoContrato({ situacao, comSemNumero, saldo }: { situacao: 'aberto' | 'quitado' | 'quitado-com-saldo'; comSemNumero: boolean; saldo?: string }) {
  return situacao === 'aberto' ? <span className="badge badge-neutral" title={saldo ? 'Saldo ' + saldo : undefined}>Em aberto</span>
    : situacao === 'quitado' ? <span className="badge badge-ok" title={comSemNumero ? 'Zera com os lançamentos sem número (são dele)' : undefined}>{comSemNumero ? 'Quitado (com os sem número)' : 'Quitado'}</span>
    : <span className="badge badge-neutral ext-neg" title="Pagou todas as parcelas e ainda tem saldo: lançamento com o número errado, ou parcela que faltou">Quitado com saldo</span>;
}

function Lancamentos({ vm }: { vm: VmEmprestimos }) {
  const [qual, setQual] = useState<number | null>(null);
  const [filtro, setFiltro] = useState('periodo');
  const e = vm.emprestimos.find(x => x.id === qual) || vm.emprestimos[0];
  if (!e) return <p className="hint">Importe o razão de um empréstimo na tela Empréstimos.</p>;
  const doContrato = e.porContrato.find(k => k.id === filtro) || null;
  const linhas = doContrato ? doContrato.lancamentos : e.lancamentos;
  const nome = (x: typeof e) => (x.banco ? x.banco.rotulo : 'Sem banco') + ' · ' + x.arquivo;
  return (
    <div className="imp-lista">
      <div className="imp-bloco">
        <div className="imp-linha">
          <span className="imp-ico imp-logo">{e.banco ? <LogoBanco banco={e.banco.marca} cor /> : <Icone nome="landmark" />}</span>
          {vm.emprestimos.length > 1 ? (
            <MenuSuspenso rotulo={nome(e)} className="btn btn-outline" largura={360} dica="O empréstimo"
              itens={vm.emprestimos.map(x => ({ rotulo: nome(x), marcado: x.id === e.id, onClick: () => { setQual(x.id); setFiltro('periodo'); } }))} />
          ) : <div className="imp-txt"><span><b>{e.banco ? e.banco.rotulo : 'Sem banco'}</b><span className="imp-conta">{e.arquivo}</span></span></div>}
          <span className="tarefas-barra-espaco" />
          <MenuSuspenso rotulo={doContrato ? (doContrato.id === 'sem-numero' ? 'Sem número de contrato' : 'Contrato ' + doContrato.rotulo) : 'Lançamentos do período'} className="btn btn-outline" largura={280} direita
            dica="Filtrar os lançamentos por contrato"
            itens={[
              { rotulo: 'Lançamentos do período', marcado: !doContrato, onClick: () => setFiltro('periodo') },
              'separador' as const,
              ...e.porContrato.map(k => ({ rotulo: k.id === 'sem-numero' ? 'Sem número de contrato' : 'Contrato ' + k.rotulo, dica: k.lancamentos.length + ' lançamentos', marcado: filtro === k.id, onClick: () => setFiltro(k.id) })),
            ]} />
          {/* escolhido um contrato, no lugar da contagem: a situação dele (Vitor, 07/10/2026) */}
          {doContrato?.situacao ? <SeloDoContrato situacao={doContrato.situacao} comSemNumero={doContrato.comSemNumero} saldo={doContrato.saldo} />
            : <span className="tarefas-contador"><b>{linhas.length}</b> {linhas.length === 1 ? 'lançamento' : 'lançamentos'}</span>}
        </div>
        <div className="imp-mov-caixa">
          <div className="imp-mov">
            <table className="table-compact">
              <thead><tr><th>Data</th><th>Contrapartida</th><th>Histórico</th><th className="num">Débito</th><th className="num">Crédito</th><th className="num">Saldo</th></tr></thead>
              <tbody>
                {!doContrato && <tr className="imp-mov-anterior"><td colSpan={5}>Saldo anterior</td><td className="num">{e.saldoAnterior}</td></tr>}
                {!linhas.length && <tr><td colSpan={6} className="hint">Nenhum lançamento {doContrato ? 'deste contrato até o mês consultado' : 'no período'}.</td></tr>}
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
        </div>
      </div>
    </div>
  );
}

type Tela = 'emprestimos' | 'lancamentos';

export function Emprestimos() {
  const vm = useEmprestimos();
  const arquivo = useRef<HTMLInputElement>(null);
  // as duas telas no menu de cima (Vitor, 07/10/2026: "a aba lançamentos, deixe em outra tela, no menu superior")
  const [tela, setTela] = useState<Tela>('emprestimos');
  const qtdLancamentos = vm.emprestimos.reduce((n, e) => n + e.lancamentos.length, 0);
  const { aviso } = useRetorno();
  const semRazao = !vm.emprestimos.length;
  useAbasDaEtapa([
    { id: 'emprestimos', rotulo: 'Empréstimos', icone: 'landmark', ativa: tela === 'emprestimos' },
    { id: 'lancamentos', rotulo: 'Lançamentos' + (qtdLancamentos ? ' (' + qtdLancamentos + ')' : ''), icone: 'list', ativa: tela === 'lancamentos', travada: semRazao },
  ], id => {
    if (id === 'lancamentos' && semRazao) { aviso({ tom: 'erro', titulo: 'Lançamentos', texto: 'Importe o razão primeiro.' }); return; }
    setTela(id as Tela);
  });
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

      {tela === 'lancamentos' ? <Lancamentos vm={vm} /> : (
        <div className="imp-lista">
          {vm.emprestimos.map(e => <Emprestimo key={e.id} e={e} vm={vm} />)}
        </div>
      )}

      {!vm.emprestimos.length && (
        <div className="gh-blank">
          <Icone nome="landmark" />
          <h4>Importe o razão de cada empréstimo</h4>
          <p>No ícone de importar, em cima: um razão por contrato (o XLS da conciliação do Alterdata, com {vm.periodo}). O banco de cada um já vem sugerido pela contrapartida das parcelas; confira e troque se precisar.</p>
        </div>
      )}
    </section>
  );
}
