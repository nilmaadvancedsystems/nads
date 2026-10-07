// Cartões › Cartão empresarial, no desenho da Importação (Vitor, 07/10/2026): em cima, o período da Tarefa, quantas
// faturas, a importação do PDF e o Baixar; as contas (a do cartão perguntada uma vez, como no Creditor); e um bloco por
// fatura — o pagamento achado no extrato, a soma × o total e as faixas Lançamentos (o razão do cartão) e Fora do razão.
import { baixarBytes, Icone } from '@nads/ui';
import { useId } from 'react';
import type { empresas } from '@nads/core';
import { FaixaQueAbre } from '../../../../../../comum/FaixaQueAbre';
import { useRequisitosParaATarefa } from '../../../../../../comum/ponte';
import { MenuDeConta } from '../../../creditor/partes/MenuDeConta';
import { useCompras, type VmCompras } from './useCompras';

function Fatura({ f, vm }: { f: VmCompras['faturas'][number]; vm: VmCompras }) {
  return (
    <div className={'imp-bloco' + (f.noPeriodo ? '' : ' sem-movimento')}>
      <div className="imp-linha">
        <span className="imp-ico"><Icone nome="cartao" /></span>
        <div className="imp-txt" title={'Cartão ' + f.cartao + ' · ' + f.arquivo}>
          <span><b>{f.rotulo}</b><span className="imp-conta">venc. {f.vencimento}</span></span>
        </div>
        <div className="imp-resumo">
          <div>
            <span>{f.qtd} {f.qtd === 1 ? 'compra' : 'compras'} · {f.soma}</span>
            <span>{f.bate ? 'Bate com o total da fatura' : 'Total da fatura ' + f.total + (f.diferenca ? ' (diferença ' + f.diferenca + ')' : '')}</span>
          </div>
        </div>
        <div className="imp-grupos">
          {f.pagamento
            ? <span className="badge badge-ok" title={f.pagamento.historico}>Pago em {f.pagamento.data} · {f.pagamento.nomeDoBanco}</span>
            : <span className="badge badge-neutral" title="Importe o extrato do banco na Importação">Pagamento não achado no extrato</span>}
          <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={() => vm.remover(f.id)} title={f.arquivo + ': importada. Clique para excluir.'} aria-label="Excluir a fatura">
            <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
          </button>
        </div>
      </div>
      {!f.noPeriodo && <p className="hint imp-mov-vazio">Paga em {f.mesDoPagamento}, fora do período da tarefa: fica de fora do arquivo.</p>}
      {f.pagamento && f.pagamento.dias !== 0 && f.noPeriodo && (
        <p className="hint imp-mov-vazio">O débito caiu {Math.abs(f.pagamento.dias)} {Math.abs(f.pagamento.dias) === 1 ? 'dia' : 'dias'} {f.pagamento.dias > 0 ? 'depois' : 'antes'} do vencimento: os lançamentos vão no dia do débito ({f.pagamento.data}).</p>
      )}
      {!f.pagamento && f.noPeriodo && (
        <p className="hint imp-mov-vazio">Não achei no extrato importado o débito de {f.soma} perto do vencimento. Importe o extrato do banco na Importação; até lá, os lançamentos ficam no dia do vencimento.</p>
      )}
      {f.bancoSemConta && f.pagamento && (
        <div className="imp-mov-caixa">
          <span className="hint">O banco {f.pagamento.nomeDoBanco} não tem conta contábil no Cadastro. Escolha a conta do banco (ou cadastre em Cadastro › Contas bancárias):</span>
          <MenuDeConta valor="" contas={vm.opcoes} onEscolher={c => vm.escolherContaBanco(f.pagamento!.banco, c)} />
        </div>
      )}
      <FaixaQueAbre titulo="Lançamentos" qtd={f.linhas.length}>
        <div className="imp-mov">
          <table className="table-compact">
            <thead><tr><th>Data</th><th>Débito</th><th>Crédito</th><th>Histórico</th><th className="num">Valor</th></tr></thead>
            <tbody>
              {f.linhas.map(l => (
                <tr key={l.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{l.data}</td>
                  <td className="num">{l.debito}</td>
                  <td className="num">{l.credito}</td>
                  <td className="wrap" title={l.portador}>{l.historico}</td>
                  <td className="num">{l.valor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FaixaQueAbre>
      <FaixaQueAbre titulo="Fora do razão" qtd={f.deFora.length}>
        <div className="imp-mov">
          <table className="table-compact">
            <thead><tr><th>Data</th><th>Descrição</th><th className="num">Valor</th><th>Por quê</th></tr></thead>
            <tbody>
              {f.deFora.map(d => (
                <tr key={d.id}><td>{d.data}</td><td className="wrap">{d.descricao}</td><td className="num">{d.valor}</td><td className="wrap hint">{d.motivo}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </FaixaQueAbre>
    </div>
  );
}

export function Compras({ empresa }: { empresa: empresas.EmpresaDoEscritorio }) {
  const vm = useCompras(empresa);
  const id = useId();
  // na Tarefa: o Próximo só com o arquivo pronto (ou sem fatura nenhuma importada ainda, ele pede)
  useRequisitosParaATarefa({ pronto: vm.pronto, faltam: vm.falta });
  return (
    <section>
      <div className="imp-topo">
        {vm.periodo && <span className="imp-periodo-info" title="O período da tarefa (escolhido na Importação)"><Icone nome="calendar" />{vm.periodo}<Icone nome="lock" /></span>}
        <span className="imp-topo-num"><Icone nome="cartao" /><b>{vm.faturas.length}</b> {vm.faturas.length === 1 ? 'fatura' : 'faturas'}</span>
        <span className="imp-topo-meio" />
        {vm.lendo ? <span className="icon-btn"><span className="btn-spinner" /></span> : (
          <>
            <label htmlFor={id} className="icon-btn" title="Importar a fatura do cartão (PDF; pode ser mais de uma)" aria-label="Importar a fatura do cartão"><Icone nome="upload" /></label>
            <input id={id} type="file" multiple accept=".pdf" className="sr-only" onChange={e => { const fs = Array.from(e.target.files || []); e.target.value = ''; vm.importar(fs); }} />
          </>
        )}
        <button type="button" className="btn btn-primary" disabled={!vm.pronto} title={vm.pronto ? 'O razão do cartão para importar no Alterdata' : vm.falta.join(' · ')}
          onClick={() => { const a = vm.arquivo(); baixarBytes(a.bytes, a.nome, a.tipo); }}>
          <Icone nome="download" />Baixar o razão{vm.qtdLancamentos ? ' (' + vm.qtdLancamentos + ')' : ''}
        </button>
      </div>

      {vm.foraDoPeriodo.length > 0 && (
        <div className="alert">
          <Icone nome="alert" />
          <div>
            <p className="alert-title">Fatura fora do período da tarefa ({vm.periodo})</p>
            <p className="alert-text">{vm.foraDoPeriodo.join(', ')}: fica de fora do arquivo. Ela entra quando a tarefa for desse período.</p>
          </div>
        </div>
      )}

      <div className="imp-lista">
        <div className="imp-bloco">
          <div className="imp-linha">
            <span className="imp-ico"><Icone nome="landmark" /></span>
            <div className="imp-txt"><span><b>Conta do cartão de crédito</b><span className="imp-conta">débito de cada compra · o crédito é o banco que pagou</span></span></div>
            <div className="imp-resumo">{vm.nomeContaCartao && <div><span>{vm.nomeContaCartao}</span></div>}</div>
            <div className="imp-grupos">
              <MenuDeConta valor={vm.contaCartao} contas={vm.opcoes} onEscolher={vm.escolherContaCartao} travado={!vm.cadastroCarregado} />
            </div>
          </div>
        </div>
        {vm.faturas.map(f => <Fatura key={f.id} f={f} vm={vm} />)}
      </div>

      {!vm.faturas.length && (
        <div className="gh-blank">
          <Icone nome="cartao" />
          <h4>Importe a fatura do cartão empresarial</h4>
          <p>O PDF do extrato do cartão de crédito. Cada compra vira um lançamento no razão do cartão (D Cartão de Crédito / C Banco), no dia em que o banco pagou a fatura.</p>
        </div>
      )}
    </section>
  );
}
