// Fiscal › SINTEGRA (Vitor, 15/10/2026: "montar um leitor de sintegra"): sobe o arquivo e o leitor acha sozinho a empresa
// (o CNPJ do registro 10 no cadastro de clientes) e o mês (o período do registro 10).
import { LeitorSintegra } from './LeitorSintegra';
import { useLeitorSintegra } from './useLeitorSintegra';

export function PaginaSintegra() {
  const vm = useLeitorSintegra();
  return (
    <section className="dp-painel">
      <section className="card sintegra-cartao">
        <div className="dp-lista-topo">
          <h3 className="dp-titulo">{vm.empresa || 'Leitor do SINTEGRA'}</h3>
          {vm.rotuloCompetencia && <span className="badge badge-neutral">{vm.rotuloCompetencia}</span>}
        </div>
        <div className="sintegra-corpo"><LeitorSintegra vm={vm} id="sintegra-pagina" /></div>
      </section>
    </section>
  );
}
