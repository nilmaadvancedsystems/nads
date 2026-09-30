// Cadastro sem empresa aberta (/tarefas/cadastro/<página>): escolher a empresa, que abre na página pedida.
import { Icone } from '@nads/ui';
import { ListaDeEmpresas } from '../partes/ListaDeEmpresas';
import { useEscolherNoCadastro } from '../partes/useEscolherNoCadastro';

export function EscolherEmpresaCadastro({ pagina }: { pagina: string }) {
  const vm = useEscolherNoCadastro(pagina);
  return (
    <section className="cad-escolher-pagina">
      <div className="gh-blank">
        <Icone nome="landmark" />
        <h4>Cadastro da empresa</h4>
        <p>Contas bancárias, plano de contas e contas padrão, num lugar só. O Extrator e o Creditor leem daqui.</p>
      </div>
      <div className="cad-escolher-caixa">
        <ListaDeEmpresas vm={vm} focar />
      </div>
    </section>
  );
}
