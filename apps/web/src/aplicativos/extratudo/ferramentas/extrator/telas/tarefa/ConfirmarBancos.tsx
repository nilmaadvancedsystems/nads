// O "Confirme os bancos da empresa" na Importação (Vitor, 21/10/2026), no lugar do "peça a um administrador": a lista dos
// bancos que já se conhece (cada um marcado, com agência, conta e a conta contábil do plano), o Adicionar banco ▾ e o
// Confirmar bancos, que grava no Cadastro da empresa. Só com as peças do catálogo (card, tabela, campos, MenuSuspenso).
import { BotaoIcone, Icone, LogoBanco, MenuSuspenso } from '@nads/ui';
import { useId } from 'react';
import { useConfirmarBancos } from './useConfirmarBancos';

export function ConfirmarBancos() {
  const vm = useConfirmarBancos();
  const lista = useId();
  return (
    <div className="card" data-destaque="confirmar-bancos">
      <div className="card-head"><h3>Confirme os bancos da empresa</h3></div>
      <p className="hint" style={{ padding: '0 16px' }}>
        Os bancos desta empresa ainda não estão no Cadastro. Confira a lista (veio do que o Extrator já usava e do que o Entregas sabe),
        desmarque o que a empresa não tem, informe a conta contábil de cada um e confirme. Vai para o Cadastro da empresa.
      </p>
      <div className="table-wrap" style={{ margin: '0 16px' }}>
        <table className="table-compact">
          <thead><tr><th style={{ width: 36 }}><span className="sr-only">Tem</span></th><th>Banco</th><th>Agência</th><th>Conta</th><th>Conta contábil</th><th style={{ width: 40 }} /></tr></thead>
          <tbody>
            {vm.linhas.map(l => (
              <tr key={(l.id || 'nova') + '-' + l.i} style={l.marcado ? undefined : { opacity: 0.55 }}>
                <td><input type="checkbox" checked={l.marcado} onChange={e => vm.mudar(l.i, { marcado: e.target.checked })} aria-label={'A empresa tem o ' + l.nome} /></td>
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span className="imp-ico imp-logo"><LogoBanco banco={l.marca} cor /></span><b>{l.nome}</b>
                  </span>
                </td>
                <td><input type="text" value={l.agencia} placeholder={l.nova ? 'Agência' : '—'} style={{ width: 90 }} disabled={!l.marcado}
                  onChange={e => vm.mudar(l.i, { agencia: e.target.value })} aria-label={'Agência do ' + l.nome} /></td>
                <td><input type="text" value={l.conta} placeholder={l.nova ? 'Conta' : '—'} style={{ width: 120 }} disabled={!l.marcado}
                  onChange={e => vm.mudar(l.i, { conta: e.target.value })} aria-label={'Conta do ' + l.nome} /></td>
                <td>
                  <input type="text" inputMode="numeric" list={lista} value={l.contaContabil} placeholder="Ex.: 10501" style={{ width: 110 }} disabled={!l.marcado}
                    onChange={e => vm.mudar(l.i, { contaContabil: e.target.value })} aria-label={'Conta contábil do ' + l.nome} />
                  {l.marcado && (l.avisoContabil
                    ? <span className={'hint' + (l.avisoLeve ? '' : ' ext-neg')} style={{ display: 'block' }}>{l.avisoContabil}</span>
                    : l.nomeContabil ? <span className="hint" style={{ display: 'block' }}>{l.nomeContabil}</span>
                    : !l.contaContabil.trim() && <span className="hint" style={{ display: 'block' }}>{vm.temPlano ? 'A conta do banco no plano de contas' : 'Sem plano de contas importado: confira o código'}</span>)}
                </td>
                <td>{l.nova && <BotaoIcone icone="x" titulo={'Tirar o ' + l.nome} onClick={() => vm.tirar(l.i)} />}</td>
              </tr>
            ))}
            {!vm.linhas.length && <tr><td colSpan={6} className="hint">Nenhum banco conhecido: adicione os bancos da empresa.</td></tr>}
          </tbody>
        </table>
        <datalist id={lista}>{vm.contasDoPlano.map(k => <option key={k.codigo} value={k.codigo}>{k.nome}</option>)}</datalist>
      </div>
      <div className="btn-row" style={{ padding: 16, alignItems: 'center' }}>
        <MenuSuspenso icone="plus" rotulo="Adicionar banco" className="btn btn-outline" largura={220} dica="Um banco que não está na lista"
          itens={vm.bancosParaAdicionar.map(b => ({ rotulo: b.nome, onClick: () => vm.adicionar(b.id) }))} />
        <span className="tarefas-barra-espaco" />
        {vm.erro && <span className="feedback-erro">{vm.erro}</span>}
        <button type="button" className="btn btn-primary" disabled={vm.carregando || !vm.marcadas} onClick={vm.confirmar}>
          <Icone nome="check" />Confirmar {vm.marcadas === 1 ? 'o banco' : vm.marcadas + ' bancos'}
        </button>
      </div>
    </div>
  );
}
