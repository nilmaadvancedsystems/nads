// Cadastro › Empresa: as regras da empresa. "Presta serviços?" com Sim / Não (clicar de novo no marcado volta
// para "não informado").
import { useCarregando } from '@nads/ui';
import { useDadosDaEmpresa } from './useDadosDaEmpresa';

export function DadosDaEmpresa({ rota }: { rota: string }) {
  const vm = useDadosDaEmpresa(rota);
  useCarregando(vm.carregando);
  if (vm.carregando) return null;
  const opcao = (sim: boolean, rotulo: string) => (
    <button type="button" className={'btn ' + (vm.prestaServico === sim ? 'btn-primary' : 'btn-outline')} aria-pressed={vm.prestaServico === sim}
      onClick={() => vm.definirPrestaServico(sim)}>{rotulo}</button>
  );
  return (
    <section>
      <div className="cad-regra">
        <div className="cad-regra-txt">
          <span className="cad-campo-rotulo">Presta serviços</span>
          <span className="hint">
            Mostra a aba Prestados na Importação e os serviços prestados na Conferência.
            {vm.prestaServico == null && ' Ainda não informado.'}
          </span>
        </div>
        <div className="cad-regra-opcoes" role="group" aria-label="Presta serviços">
          {opcao(true, 'Sim')}
          {opcao(false, 'Não')}
        </div>
      </div>
    </section>
  );
}
