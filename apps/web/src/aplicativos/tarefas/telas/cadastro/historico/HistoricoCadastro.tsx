// Cadastro › Histórico: a lista do que mudou no cadastro da empresa.
import { Icone, useCarregando } from '@nads/ui';
import { TrocarEmpresa } from '../partes/TrocarEmpresa';
import { useHistoricoCadastro } from './useHistoricoCadastro';

export function HistoricoCadastro({ rota }: { rota: string }) {
  const vm = useHistoricoCadastro(rota);
  useCarregando(vm.carregando);
  return (
    <section>
      <div className="tarefas-barra-topo">
        <TrocarEmpresa empresa={vm.empresa} rota={rota} pagina="historico" />
      </div>
      {!vm.carregando && !vm.linhas.length ? (
        <div className="gh-blank">
          <Icone nome="clock" />
          <h4>Nada mudou ainda</h4>
          <p>Cada conta incluída, plano importado ou conta padrão trocada aparece aqui, com quem fez e quando.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="cad-tabela">
            <thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Detalhe</th></tr></thead>
            <tbody>
              {vm.linhas.map(l => (
                <tr key={l.chave}>
                  <td className="num fraco">{l.quando}</td>
                  <td>{l.por}</td>
                  <td>{l.acao}</td>
                  <td className="wrap">{l.detalhe}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
