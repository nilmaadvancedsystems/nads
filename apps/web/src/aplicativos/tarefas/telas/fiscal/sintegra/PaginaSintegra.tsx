// Fiscal › SINTEGRA (Vitor, 15/10/2026: "montar um leitor de sintegra"): sobe o arquivo e o leitor acha sozinho a empresa
// (o CNPJ do registro 10 no cadastro de clientes) e o mês (o período do registro 10). O título da página é o da casca;
// a empresa e o mês ficam na ficha do arquivo (30/10/2026: sem o cartão dentro do cartão).
import { LeitorSintegra } from './LeitorSintegra';
import { useLeitorSintegra } from './useLeitorSintegra';

export function PaginaSintegra() {
  const vm = useLeitorSintegra();
  return (
    <section className="fs-pagina">
      <LeitorSintegra vm={vm} id="sintegra-pagina" />
    </section>
  );
}
