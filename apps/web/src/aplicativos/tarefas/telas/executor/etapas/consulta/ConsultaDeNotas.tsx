// A Consulta de notas no fim das etapas Clientes, Fornecedores e Adiantamento (Vitor, 14/10/2026), com as peças do
// catálogo: a faixa que abre (FaixaQueAbre), o Segmentado do tipo, a busca com lupa e a tabela padrão (ordena no título
// da coluna). Clientes: Saídas e Prestados; Fornecedores: Entradas e Tomados.
import type { conferencia as c } from '@nads/core';
import { Icone, Segmentado } from '@nads/ui';
import { FaixaQueAbre } from '../../../../../../comum/FaixaQueAbre';
import { useConsultaDeNotas, type TipoConsultado } from './useConsultaDeNotas';

export function ConsultaDeNotas({ tipos }: { tipos: readonly [TipoConsultado, TipoConsultado] }) {
  const vm = useConsultaDeNotas(tipos);
  return (
    <div style={{ marginTop: 16 }}>
      <FaixaQueAbre titulo={vm.titulo} qtd={vm.total}>
        <div className="btn-row" style={{ justifyContent: 'flex-start', alignItems: 'center', marginBottom: 12 }}>
          <Segmentado<TipoConsultado> valor={vm.tipo} onMudar={vm.escolherTipo} opcoes={vm.tipos} />
          <label className="busca-curta">
            <Icone nome="search" />
            <input type="text" placeholder="Nome, número, CFOP ou lançamento" value={vm.busca} onChange={e => vm.buscar(e.target.value)} aria-label="Buscar nota" />
          </label>
          <span className="hint">{vm.qtd} {vm.qtd === 1 ? 'nota' : 'notas'} · {vm.soma}</span>
        </div>
        {vm.carregando ? null : !vm.linhas.length ? <p className="hint">Nenhuma nota{vm.busca ? ' com essa busca' : ' importada nos meses da etapa'}.</p> : (
          <div className="table-wrap">
            <table className="table-compact">
              <thead>
                <tr>
                  <Th o={vm.ordem} ordenar={vm.ordenar} campo="data" rotulo="Data" />
                  <Th o={vm.ordem} ordenar={vm.ordenar} campo="numero" rotulo="Nota" />
                  <Th o={vm.ordem} ordenar={vm.ordenar} campo="nome" rotulo="Participante" />
                  {vm.servico ? <Th o={vm.ordem} ordenar={vm.ordenar} campo="iss" rotulo="ISS" num /> : <Th o={vm.ordem} ordenar={vm.ordenar} campo="cfop" rotulo="CFOP" />}
                  <Th o={vm.ordem} ordenar={vm.ordenar} campo="lanc" rotulo="Lanç." />
                  <Th o={vm.ordem} ordenar={vm.ordenar} campo="valor" rotulo="Valor" num />
                </tr>
              </thead>
              <tbody>
                {vm.linhas.map(l => (
                  <tr key={l.chave}>
                    <td style={{ whiteSpace: 'nowrap' }}>{l.data}</td>
                    <td>{l.numero}</td>
                    <td className="wrap">{l.nome}</td>
                    {vm.servico ? <td className="num">{l.iss}</td> : <td>{l.cfop}</td>}
                    <td>{l.lanc}</td>
                    <td className="num">{l.valor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {vm.corte > 0 && <p className="hint">Mostrando as primeiras {vm.corte}: use a busca para achar a nota.</p>}
      </FaixaQueAbre>
    </div>
  );
}

/** O título da coluna que ordena (clicar: a mesma coluna inverte, outra começa crescente). */
function Th({ o, ordenar, campo, rotulo, num }: { o: Pick<c.FiltroConsulta, 'sortCol' | 'sortDir'>; ordenar: (campo: c.CampoOrdem) => void; campo: c.CampoOrdem; rotulo: string; num?: boolean }) {
  return (
    <th className={num ? 'num' : undefined} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => ordenar(campo)}
      aria-sort={o.sortCol === campo ? (o.sortDir === 'asc' ? 'ascending' : 'descending') : undefined}>
      {rotulo}{o.sortCol === campo && <Icone nome={o.sortDir === 'asc' ? 'arrowUp' : 'arrowDown'} />}
    </th>
  );
}
