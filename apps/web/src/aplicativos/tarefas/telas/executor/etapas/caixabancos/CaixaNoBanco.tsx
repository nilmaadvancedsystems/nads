// O que saiu do caixa e também saiu do banco, dentro da etapa Caixa (Vitor, 16/10/2026): cada pagamento do caixa com o
// lançamento do banco logo abaixo (o logo, a data, a descrição, o valor e quantos dias de diferença), no fundo da cor do
// banco — o desenho da sugestão de baixa do Clientes.
import { LogoBanco, fundoSuaveDoBanco } from '@nads/ui';
import { Fragment } from 'react';
import type { CaixaNoBancoDoRazao } from './useCaixaNoBanco';

export function TabelaCaixaNoBanco({ vm }: { vm: CaixaNoBancoDoRazao }) {
  if (!vm.temExtrato) return <p className="hint">Nenhum extrato de banco importado na Importação: não tem onde procurar.</p>;
  if (!vm.itens.length) return <p className="hint">Nenhum pagamento do caixa com o mesmo valor saindo do banco.</p>;
  return (
    <div className="table-wrap" style={{ maxHeight: 'none' }}>
      <table className="table-compact">
        <thead><tr><th>Data</th><th>Saiu do caixa</th><th>Contrapartida</th><th className="num">Valor</th><th>Saiu do banco</th></tr></thead>
        <tbody>
          {vm.itens.map(i => (
            <Fragment key={i.id}>
              <tr>
                <td style={{ whiteSpace: 'nowrap' }}>{i.data}</td>
                <td className="wrap">{i.historico}</td>
                <td className="wrap hint">{i.contrapartida || '—'}</td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>{i.valor}</td>
                <td className="hint">{i.noBanco.length === 1 ? '1 lançamento' : i.noBanco.length + ' lançamentos'}</td>
              </tr>
              <tr>
                <td colSpan={5} style={{ padding: 0 }}>
                  <table className="table-compact" aria-label={'No banco: ' + i.historico}>
                    <tbody>
                      {i.noBanco.map((b, j) => (
                        <tr key={j} style={fundoSuaveDoBanco(b.marca) ? { background: fundoSuaveDoBanco(b.marca) } : undefined}>
                          <td title={b.banco} style={{ width: 56 }}><span className="drive-candidato-logo" style={{ display: 'inline-flex' }} aria-label={b.banco}><LogoBanco banco={b.marca} cor /></span></td>
                          <td style={{ whiteSpace: 'nowrap', width: 96 }}>{b.data}</td>
                          <td title={b.historico} style={{ fontSize: 12, maxWidth: 0, width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.curto}</td>
                          <td className="num" style={{ whiteSpace: 'nowrap' }}>{b.valor}</td>
                          <td style={{ whiteSpace: 'nowrap' }}><span className={'badge ' + (b.mesmoDia ? 'badge-ok' : 'badge-neutral')}>{b.dias}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** O conciliador das notas em aberto no caixa: a nota (o fornecedor ou o cliente, a NF, quanto falta e como bateu) e, embaixo, os lançamentos do caixa. */
export function TabelaNotasNoCaixa({ vm }: { vm: CaixaNoBancoDoRazao }) {
  if (!vm.qtdNotas) return <p className="hint">Nenhuma nota em aberto para procurar: importe os razões de Fornecedores e de Clientes (na Importação ou nas etapas).</p>;
  if (!vm.notas.length) return <p className="hint">Nenhuma das {vm.qtdNotas} notas em aberto está no caixa.</p>;
  return (
    <div className="table-wrap" style={{ maxHeight: 'none' }}>
      <table className="table-compact">
        <thead><tr><th>Lado</th><th>Conta</th><th>Nome</th><th>NF</th><th className="num">Em aberto</th><th>Como bateu</th></tr></thead>
        <tbody>
          {vm.notas.map(n => (
            <Fragment key={n.id}>
              <tr>
                <td>{n.lado}</td>
                <td>{n.conta}</td>
                <td className="wrap">{n.nome}</td>
                <td>{n.nf}</td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>{n.aberto}</td>
                <td style={{ whiteSpace: 'nowrap' }}><span className={'badge ' + (n.pelaNf ? 'badge-ok' : 'badge-neutral')}>{n.como}</span></td>
              </tr>
              <tr>
                <td colSpan={6} style={{ padding: 0 }}>
                  <table className="table-compact" aria-label={'No caixa: NF ' + n.nf}>
                    <tbody>
                      {n.lancamentos.map(l => (
                        <tr key={l.id} style={{ background: 'var(--surface-2)' }}>
                          <td style={{ whiteSpace: 'nowrap', width: 96 }}>{l.data}</td>
                          <td className="hint" style={{ whiteSpace: 'nowrap' }}>{l.contrapartida || '—'}</td>
                          <td title={l.historico} style={{ fontSize: 12, maxWidth: 0, width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.historico}</td>
                          <td className="num" style={{ whiteSpace: 'nowrap' }}>{l.valor}</td>
                          <td style={{ whiteSpace: 'nowrap' }}><span className="badge badge-neutral">{l.sentido}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </td>
              </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
