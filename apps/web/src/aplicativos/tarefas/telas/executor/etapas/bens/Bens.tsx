// A etapa Bens da Tarefa (Vitor, 07/10/2026), com as peças do catálogo (o período e os bancos ficam na linha de cima, a do executor): o que entra e o que sai do
// imobilizado (Stat); as compras de bem (1551, 2551 e os CFOPs ligados), as saídas que baixam bem e o uso e consumo com
// item de bem, cada um num card com a tabela padrão. Só olhar.
import { Alerta, Stat } from '@nads/ui';
import { useBens } from './useBens';

type VM = ReturnType<typeof useBens>;
type Linha = VM['entradas'][number];

export function Bens() {
  const vm = useBens();
  return (
    <section>
      <header className="topbar"><div><h2 className="page-title">Bens</h2></div></header>
      {vm.deTeste && (
        <div className="imp-topo">
          <span className="badge badge-neutral" title="Notas do ⚡: só nesta tela">Notas de teste</span>
          <span className="imp-topo-meio" />
          <button type="button" className="btn btn-outline" onClick={vm.tirarTeste}>Voltar às notas da empresa</button>
        </div>
      )}
      {!vm.carregado ? null : vm.nenhuma ? (
        <Alerta tom="ok" titulo="Nenhuma nota de bem no período" texto="Nenhuma entrada 1551, 2551 ou de CFOP ligado a bem, nenhuma saída de bem e nenhum uso e consumo com item de bem nas notas importadas." />
      ) : (
        <>
          <div className="dash-grid" style={{ marginBottom: 16 }}>
            <Stat rotulo="Entram no imobilizado" valor={vm.entram} cor="entrada" grande={false} />
            <Stat rotulo="Saem do imobilizado" valor={vm.saem} cor="saida" grande={false} />
            <Stat rotulo="Notas de bem" valor={vm.entradas.length + vm.saidas.length} grande={false} />
          </div>
          <Tabela titulo="Compras e entradas de bens" vazio="Nenhuma entrada de bem no período." linhas={vm.entradas} quem="Fornecedor" />
          <Tabela titulo="Vendas e saídas de bens" vazio="Nenhuma saída de bem no período." linhas={vm.saidas} quem="Cliente"
            dica="O bem vendido ou devolvido sai do imobilizado junto com a depreciação dele." />
          {vm.usoEConsumo.length > 0 && (
            <Tabela titulo="Uso e consumo com item de bem" vazio="" linhas={vm.usoEConsumo} quem="Fornecedor"
              dica="Item com NCM de veículo, máquina, equipamento, computador ou móvel lançado como uso e consumo: confira se não foi para a despesa." />
          )}
          {!vm.temNcm && <p className="hint">O relatório de entradas não trouxe o NCM dos itens: sem ele, não dá para achar bem lançado como uso e consumo.</p>}
        </>
      )}
    </section>
  );
}

function Tabela({ titulo, vazio, linhas, quem, dica }: { titulo: string; vazio: string; linhas: Linha[]; quem: string; dica?: string }) {
  return (
    <div className="card">
      <div className="card-head"><h3>{titulo}</h3><span className="badge badge-neutral">{linhas.length}</span></div>
      {dica && <p className="hint" style={{ marginTop: 0 }}>{dica}</p>}
      {linhas.length === 0 ? <p className="hint">{vazio}</p> : (
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Data</th><th>NF</th><th>{quem}</th><th>CFOP</th><th>NCM</th><th className="num">Valor</th></tr></thead>
            <tbody>
              {linhas.map(l => (
                <tr key={l.chave}>
                  <td>{l.data}</td>
                  <td>{l.numero}</td>
                  <td className="wrap">{l.nome}{l.conta && <span className="hint" style={{ display: 'block', marginTop: 2 }}>Conta {l.conta}</span>}</td>
                  <td className="wrap" title={l.tipo}>
                    <b>{l.cfop}</b> <span className="hint">{l.tipo}</span>
                    {l.naoMexe && <> <span className="badge badge-neutral" title="Não é compra nem venda: o bem não entra nem sai do imobilizado">Não mexe no imobilizado</span></>}
                  </td>
                  <td>{l.ncms || '—'}</td>
                  <td className="num">{l.valor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
