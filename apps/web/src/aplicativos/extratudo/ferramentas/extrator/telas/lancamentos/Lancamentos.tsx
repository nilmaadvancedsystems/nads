// Importação › Lançamentos: tabela do que foi lido do extrato e do sistema.
import { extrator as x } from '@nads/core';
import { Icone, Segmentado } from '@nads/ui';
import { LIMITE_LINHAS, useLancamentos } from './useLancamentos';

export function Lancamentos() {
  const vm = useLancamentos();
  return (
    <section>
      <Segmentado valor={vm.lado} opcoes={vm.abas} onMudar={vm.escolherLado} />
      <div className="gh-box">
        {vm.vazio ? (
          <div className="gh-blank">
            <Icone nome="list" />
            <h4>{vm.lado === 'banco' ? 'Nenhum extrato importado' : 'Nenhum lançamento do sistema importado'}</h4>
            <p><button type="button" className="link-btn" onClick={vm.importar}>Ir para a importação</button></p>
          </div>
        ) : (
          <>
            <div className="gh-box-head cons-head">
              <div className="gh-search cons-busca">
                <input type="text" id="extBuscaLanc" value={vm.busca} autoComplete="off" placeholder="Procurar por histórico, valor ou data" onChange={ev => vm.setBusca(ev.target.value)} />
                {vm.busca && <button type="button" className="gh-search-clear" title="Limpar busca" aria-label="Limpar busca" onClick={() => vm.setBusca('')}>&times;</button>}
              </div>
            </div>
            <p className="cons-resumo">
              <b>{vm.qtd}</b> {vm.qtd === 1 ? 'lançamento' : 'lançamentos'}{vm.qtd !== vm.qtdTotal && <> <span>de {vm.qtdTotal}</span></>}
              <span className="cons-sep">·</span>entradas <b className="ext-pos">{x.valorBR(vm.entradas)}</b>
              <span className="cons-sep">·</span>saídas <b className="ext-neg">{x.valorBR(vm.saidas)}</b>
            </p>
            {!vm.qtd ? (
              <div className="gh-blank"><Icone nome="search" /><h4>Nada bate com a busca</h4><p>Tente outro histórico, valor ou data.</p></div>
            ) : (
              <div className="table-wrap">
                <table className="table-compact">
                  <thead><tr><th>Data</th><th>Histórico</th><th className="num">Valor</th><th>Arquivo</th></tr></thead>
                  <tbody>
                    {vm.linhas.map(l => (
                      <tr key={l.id}>
                        <td style={{ whiteSpace: 'nowrap' }}>{l.data}</td>
                        <td className="wrap">{l.historico}</td>
                        <td className={'num ' + (l.valor < 0 ? 'ext-neg' : 'ext-pos')}>{x.valorBR(l.valor)}</td>
                        <td className="wrap ext-mut">{l.arquivo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {vm.cortado && <p className="hint" style={{ padding: '8px 16px' }}>Mostrando {LIMITE_LINHAS} de {vm.qtd}. Use a busca para achar o resto.</p>}
          </>
        )}
      </div>
    </section>
  );
}
