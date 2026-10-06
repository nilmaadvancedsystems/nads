// Etapa Conferência do Conversor: os números em cima, numa linha só, e a tabela padrão com as linhas do .xls
// (Data Lançamento, Valor Lançamento e Descrição Histórico; a Finalidade de operação vai vazia).
import { Stat } from '@nads/ui';
import { useConferencia } from './useConferencia';

export function Conferencia() {
  const vm = useConferencia();
  return (
    <section>
      <div className="stat-grid">
        <Stat rotulo="Lançamentos" valor={vm.qtd} grande={false} />
        <Stat rotulo="Entradas" valor={vm.entradas} grande={false} />
        <Stat rotulo="Saídas" valor={vm.saidas} grande={false} />
        <Stat rotulo="Movimento do período" valor={vm.movimento} grande={false} />
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table-compact">
            <thead><tr><th>Data Lançamento</th><th className="num">Valor Lançamento</th><th>Descrição Histórico</th></tr></thead>
            <tbody>
              {vm.linhas.map(l => (
                <tr key={l.id}><td>{l.data}</td><td className="num">{l.valor}</td><td>{l.historico}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
