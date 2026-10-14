// Etapa Contas do Creditor (Vitor, 14/10/2026): os clientes do relatório que não estão no balancete, um por linha, com a conta
// (as filiais de nome igual com um clique, ou o menu de conta com as de clientes do balancete) e o Excluir títulos. Com todas
// informadas, o Próximo segue para o Relatório de Recebimento.
import { Alerta } from '@nads/ui';
import { MenuDeConta } from '../../partes/MenuDeConta';
import { useContas } from './useContas';

export function Contas() {
  const vm = useContas();
  return (
    <section>
      {vm.semBalancete ? (
        <Alerta titulo="Esta empresa não tem balancete" texto="Importe o balancete no contábil para as contas dos clientes virem sozinhas. Até lá, informe a conta de cada cliente (fica aprendida)." />
      ) : vm.faltam > 0 && (
        <Alerta titulo={vm.faltam === 1 ? '1 cliente sem conta no balancete' : vm.faltam + ' clientes sem conta no balancete'}
          texto="Informe a conta de cada um (fica aprendida para os próximos meses) ou exclua os títulos dele do arquivo." />
      )}
      <div className="card">
        <div className="table-wrap" style={{ maxHeight: 'none' }}>
          <table className="table-compact">
            <thead><tr><th>Cliente</th><th>Títulos</th><th className="num">Valor</th><th>Conta</th><th /></tr></thead>
            <tbody>
              {vm.linhas.map(l => (
                <tr key={l.chave} className={l.excluido ? 'linha-excluida' : l.resolvido ? '' : 'bad'}>
                  <td className="wrap"><b>{l.nome}</b></td>
                  <td className="wrap" title={'NF ' + l.nfs}>{l.qtd === 1 ? 'NF ' + l.nfs : l.qtd + ' títulos · NF ' + l.nfs}</td>
                  <td className="num">{l.valor}</td>
                  <td>
                    {l.excluido ? <span className="hint">Fica fora do arquivo</span> : (
                      <span className="decisao">
                        {l.opcoes.map(o => (
                          <button key={o.codigo} type="button" title={o.nome} className={'btn ' + (l.conta === o.codigo ? 'btn-primary' : 'btn-outline')} onClick={() => l.escolher(o.codigo)}>
                            {o.codigo}
                          </button>
                        ))}
                        <MenuDeConta valor={l.conta} contas={vm.contasClientes} onEscolher={l.escolher} />
                      </span>
                    )}
                  </td>
                  <td className="num">
                    {l.excluido
                      ? <button className="btn" type="button" onClick={l.desfazer}>Desfazer</button>
                      : <button className="btn" type="button" onClick={l.excluir}>{l.qtd === 1 ? 'Excluir título' : 'Excluir títulos'}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
