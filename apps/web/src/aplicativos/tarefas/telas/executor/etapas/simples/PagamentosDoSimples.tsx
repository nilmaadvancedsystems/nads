// O pagamento do Simples pelo banco na etapa Simples Nacional a recolher (Vitor, 16/10/2026): embaixo da linha do razão, cada
// DAS com o pagamento (no razão, no banco ou em aberto), as baixas sugeridas com a contrapartida de cada uma e o .xls do
// Alterdata, e o fechamento do saldo. Só peças que já existem: o imp-bloco, a tabela compacta, o menu de conta, a barra.
import { Icone } from '@nads/ui';
import { MenuDeConta } from '../../../../../extratudo/ferramentas/creditor/partes/MenuDeConta';
import type { PagamentosDoSimples as Vm } from './usePagamentosDoSimples';

const SITUACAO: Record<Vm['obrigacoes'][number]['situacao'], { rotulo: string; classe: string }> = {
  ok: { rotulo: 'Pago', classe: 'badge badge-ok' },
  banco: { rotulo: 'Pago no banco · falta baixar', classe: 'badge badge-warn' },
  aberto: { rotulo: 'Vencido sem pagamento', classe: 'badge badge-bad' },
  depois: { rotulo: 'Vence depois do período', classe: 'badge badge-neutral' },
};

export function PagamentosDoSimples({ vm }: { vm: Vm }) {
  if (!vm.pronto) return null;
  return (
    <div className="imp-bloco">
      <div className="imp-linha">
        <span className="imp-ico"><Icone nome="landmark" /></span>
        <div className="imp-txt"><span><b>Pagamentos do DAS</b><span className="imp-conta">{vm.temExtrato ? 'pelo extrato dos bancos' : 'importe os extratos na Importação para achar os pagamentos'}</span></span></div>
      </div>
      <div className="imp-periodo-linha">
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Competência</th><th className="num">DAS</th><th>Vencimento</th><th>Pagamento</th><th>Onde</th><th className="num">Juros</th><th>Situação</th></tr></thead>
            <tbody>
              {vm.obrigacoes.map(o => (
                <tr key={o.chave}>
                  <td>{o.rotulo}</td><td className="num">{o.valor}</td><td>{o.vencimento}</td><td>{o.pagamento || '—'}</td>
                  <td className="wrap hint">{o.onde || '—'}</td><td className="num">{o.juros || '—'}</td>
                  <td><span className={SITUACAO[o.situacao].classe}>{SITUACAO[o.situacao].rotulo}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {vm.sugestoes.length > 0 && (
          <>
            <div className="tarefas-barra-topo" style={{ marginTop: 12 }}>
              <span className="hint">Simples a recolher</span>
              <MenuDeConta valor={vm.contaSimples} contas={vm.contas} onEscolher={() => undefined} travado />
              {vm.nomeDaContaSimples && <span className="hint">{vm.nomeDaContaSimples}</span>}
              {vm.temJuros && (
                <>
                  <span className="hint">Juros e multa</span>
                  <MenuDeConta valor={vm.contaJuros} contas={vm.contas} onEscolher={vm.setContaJuros} />
                  {vm.nomeDaContaJuros && <span className="hint">{vm.nomeDaContaJuros}</span>}
                </>
              )}
              <span className="tarefas-barra-espaco" />
              {vm.faltaConta > 0 && <span className="hint">Falta a contrapartida de {vm.faltaConta} {vm.faltaConta === 1 ? 'lançamento' : 'lançamentos'}</span>}
              {vm.baixado && <span className="badge badge-ok" title="A planilha foi baixada">Baixado</span>}
              <button type="button" className="btn btn-primary" disabled={!vm.podeBaixar} onClick={vm.baixar}
                title={vm.podeBaixar ? 'Baixar o .xls de importação do Alterdata com as baixas do DAS pago pelo banco' : 'Escolha a contrapartida de cada lançamento (e a conta de juros)'}>
                <Icone nome="download" />Importar no meu Sistema
              </button>
            </div>
            <div className="table-wrap" style={{ marginTop: 8 }}>
              <table className="table-compact">
                <thead><tr><th>Data</th><th>Crédito (contrapartida)</th><th className="num">Valor</th><th>Histórico</th></tr></thead>
                <tbody>
                  {vm.sugestoes.map(x => (
                    <tr key={x.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{x.data}</td>
                      <td>
                        <MenuDeConta valor={x.contra} contas={vm.contas} onEscolher={k => vm.escolherContra(x.chave, k)} />
                        <span className="hint" style={{ display: 'block', marginTop: 2 }}>{x.nomeDaContra || 'Sugerido: ' + x.contraSugerida}{x.tipo === 'juros' ? ' · débito nos juros' : ' · débito no Simples a recolher'}</span>
                      </td>
                      <td className="num">{x.valor}</td>
                      <td className="wrap">{x.historico}<span className="hint" style={{ display: 'block', marginTop: 2 }}>{x.motivo}</span></td>
                    </tr>
                  ))}
                  <tr className="imp-mov-anterior"><td colSpan={2}>Total</td><td className="num">{vm.total}</td><td /></tr>
                </tbody>
              </table>
            </div>
          </>
        )}
        {vm.fechamento && (
          <p className="hint" style={{ marginTop: 12 }}>
            O razão está em {vm.fechamento.razao}; com as baixas sugeridas, fica em {vm.fechamento.ajustado}. O certo é {vm.fechamento.esperado} (o DAS vencido sem pagamento e o que vence depois do período).
            {vm.fechamento.diferenca ? ' Sobram ' + vm.fechamento.diferenca + ' sem explicação.' : ' Fecha.'}
          </p>
        )}
        {!vm.temCaixa && vm.sugestoes.length > 0 && <p className="hint">Sem o razão do Caixa na Importação, a baixa é sugerida contra o banco; se o DAS entrou no Caixa Geral, escolha o caixa.</p>}
        {vm.dasSemObrigacao.length > 0 && <p className="hint">DAS no extrato sem provisão para casar: {vm.dasSemObrigacao.join(' · ')}</p>}
      </div>
    </div>
  );
}
