// A etapa Caixa × bancos, no Fechamento (Vitor, 16/10/2026): a linha do razão do caixa (como a da folha: o importar; importado,
// o check que vira × e tira) e, embaixo, cada lançamento do caixa que está no extrato do banco, com o lançamento do banco
// logo abaixo (o logo, a data, a descrição, o valor e quantos dias de diferença), no desenho da sugestão de baixa do Clientes.
import { Icone, LogoBanco, fundoSuaveDoBanco } from '@nads/ui';
import { Fragment, useId } from 'react';
import { useCaixaNoBanco } from './useCaixaNoBanco';

export function CaixaNoBanco() {
  const vm = useCaixaNoBanco();
  const id = useId();
  return (
    <section>
      <header className="topbar"><div><h2 className="page-title">Caixa × bancos</h2></div></header>
      <div className={'imp-bloco' + (vm.temRazao ? ' imp-ok' : '')}>
        <div className="imp-linha">
          <span className="imp-ico"><Icone nome="dinheiro" /></span>
          <div className="imp-txt">
            <span><b>Razão do caixa</b>{vm.arquivo && <span className="imp-conta">{vm.arquivo}</span>}</span>
          </div>
          <div className="imp-resumo">{vm.resumo.length > 0 && <div>{vm.resumo.map(x => <span key={x}>{x}</span>)}</div>}</div>
          <div className="imp-grupos">
            <div className="imp-grupo" aria-label="Razão do caixa">
              <span className="imp-rotulo">Razão</span>
              {vm.temRazao ? (
                <button type="button" className="icon-btn icon-btn-sm imp-btn imp-feito" onClick={vm.remover} title="O razão do caixa: importado. Clique para excluir." aria-label="Excluir o razão do caixa">
                  <Icone nome="check" className="imp-feito-ok" /><Icone nome="x" className="imp-feito-x" />
                </button>
              ) : (
                <>
                  <label htmlFor={id} className="icon-btn icon-btn-sm imp-btn" title="Importar o razão do caixa (XLS da conciliação do Alterdata)" aria-label="Importar o razão do caixa"><Icone nome="upload" /></label>
                  <input id={id} type="file" accept=".xls,.xlsx,.ods" className="sr-only"
                    onChange={e => { const f = e.target.files?.[0] || null; e.target.value = ''; void vm.importar(f); }} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {!vm.temRazao ? (
        <div className="gh-blank">
          <Icone nome="dinheiro" />
          <h4>O caixa no banco</h4>
          <p>Importe o razão do caixa: procuro, para cada pagamento que saiu do caixa, o que saiu do banco com o mesmo valor, até 5 dias de diferença (pago pelo banco e lançado no caixa). A transferência entre o caixa e o banco fica de fora.</p>
        </div>
      ) : !vm.temExtrato ? (
        <p className="hint">Nenhum extrato de banco importado na Importação: não tem onde procurar.</p>
      ) : !vm.itens.length ? (
        <div className="gh-blank">
          <Icone nome="checkCircle" />
          <h4>Nada do caixa no banco</h4>
          <p>Nenhum pagamento do caixa com o mesmo valor saindo do banco.</p>
        </div>
      ) : (
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
                  {/* o lançamento do banco logo abaixo, no fundo da cor do banco (o desenho da sugestão de baixa) */}
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
      )}
    </section>
  );
}
