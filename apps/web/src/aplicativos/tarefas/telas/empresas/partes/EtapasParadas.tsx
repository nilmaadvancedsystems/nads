// As etapas paradas na competência, com o motivo (as Paradas do Contábil, trazidas para Minhas empresas; 27/10/2026:
// "coloque paradas e configuracoes tudo em uma so tela"). A competência é a da lista (o ?competencia= do endereço).
import { tarefas as t } from '@nads/core';
import { Vazio } from '@nads/ui';
import { useVisaoContabil } from '../../contabil/useVisaoContabil';

export function EtapasParadas({ dep }: { dep: 'contabil' | 'fiscal' | 'dp' }) {
  const vm = useVisaoContabil(dep);
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-head"><h3>Etapas paradas em {t.rotuloCompetencia(vm.competencia)}</h3></div>
      {vm.carregando ? null : vm.paradas.length === 0 ? <Vazio compacto icone="checkCircle" texto="Nenhuma etapa parada nesta competência." /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Empresa</th><th>Etapa</th><th>Motivo</th><th>Quem</th><th>Quando</th></tr></thead>
            <tbody>
              {vm.paradas.map(p => (
                <tr key={p.chave}>
                  <td>{p.codigo != null ? p.codigo + ' · ' : ''}{p.empresa}</td>
                  <td>{p.etapa}</td>
                  <td className="wrap">{p.motivo}{p.observacao && <span className="hint"> — {p.observacao}</span>}</td>
                  <td>{p.por}</td>
                  <td className="num">{p.em}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
