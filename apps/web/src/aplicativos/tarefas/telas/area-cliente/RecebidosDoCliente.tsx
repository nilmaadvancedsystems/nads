// Área do Cliente › Recebidos (Vitor, 16/10/2026): o que os clientes mandaram pelo link da Área do Cliente: a empresa, o
// arquivo, o tipo, quando chegou e em que pasta do Drive ficou.
import { Alerta, Esqueleto, Icone, Segmentado, useCarregando } from '@nads/ui';
import { FILTROS_DOS_RECEBIDOS, rotuloDoEnvio, useRecebidosDoCliente } from './useRecebidosDoCliente';

export function RecebidosDoCliente() {
  const vm = useRecebidosDoCliente();
  useCarregando(vm.carregando);
  return (
    <section>
      {vm.exemplos && (
        <div className="alerta-linha">
          <Alerta titulo="Dados de exemplo" texto="Os arquivos recebidos são de mentira; nada foi para o Drive." />
        </div>
      )}
      {vm.erro && (
        <div className="alerta-linha">
          <Alerta titulo="O banco não deixou ler os recebidos" texto={vm.erro} />
        </div>
      )}
      <div className="tarefas-barra-topo" style={{ marginTop: 12 }}>
        <Segmentado valor={vm.filtro} onMudar={vm.setFiltro}
          opcoes={FILTROS_DOS_RECEBIDOS.map(f => ({ valor: f.valor, rotulo: f.rotulo + ' (' + vm.contagem(f.valor) + ')' }))} />
        <span className="tarefas-barra-espaco" />
        <label className="busca-curta">
          <Icone nome="search" />
          <input type="text" placeholder="Buscar empresa ou arquivo" aria-label="Buscar arquivo recebido" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
        </label>
      </div>
      {vm.carregando ? <Esqueleto linhas={6} /> : (
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Empresa</th><th>Arquivo</th><th>Tipo</th><th className="num">Tamanho</th><th>Recebido</th><th>Pasta no Drive</th></tr></thead>
            <tbody>
              {vm.linhas.map(r => (
                <tr key={r.id}>
                  <td className="wrap"><span className="num">{r.codigo}</span> · {r.empresa}</td>
                  <td className="wrap"><Icone nome="fileText" width={16} height={16} /> {r.nome}</td>
                  <td><span className="badge badge-neutral">{rotuloDoEnvio(r.tipo)}</span></td>
                  <td className="num">{vm.tamanho(r.tamanho)}</td>
                  <td className="fraco">{vm.data(r.recebidoEm)}</td>
                  <td className="wrap fraco"><Icone nome="pasta" width={16} height={16} /> {r.pastaDrive || '—'}</td>
                </tr>
              ))}
              {!vm.linhas.length && <tr><td colSpan={6} className="hint">Nada recebido{vm.total ? ' neste filtro' : ' ainda'}.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
