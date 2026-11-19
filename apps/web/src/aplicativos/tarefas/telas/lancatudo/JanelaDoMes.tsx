// O extrato, o razão e os comprovantes do mês numa janela só (18/11/2026: "comprovantes e extratos na mesma tela"): as abas
// Extrato e razão (a tela da etapa Importação) e Comprovantes (lidos aqui, dizem o cliente ou o fornecedor da linha).
import { Segmentado } from '@nads/ui';
import { ComprovantesDoMes } from './ComprovantesDoMes';
import { ExtratoDoMes } from './ExtratoDoMes';
import { Janela } from './Janelas';
import type { useComprovantesDoLancatudo } from './useComprovantesDoLancatudo';
import type { useRegistroDoLancatudo } from './useRegistroDoLancatudo';

export type AbaDoMes = 'extrato' | 'comprovantes';

export function JanelaDoMes({ vm, c, empresa, aba, setAba, fechar }: {
  vm: ReturnType<typeof useRegistroDoLancatudo>; c: ReturnType<typeof useComprovantesDoLancatudo>; empresa: { codigo: number; nome: string };
  aba: AbaDoMes; setAba: (a: AbaDoMes) => void; fechar: () => void;
}) {
  return (
    <Janela titulo={'Extrato e comprovantes de ' + vm.rotuloDoMes.toLowerCase()} fechar={fechar} className="lt-janela-mes">
      <div className="lt-mes-abas">
        <Segmentado valor={aba} onMudar={setAba} opcoes={[
          { valor: 'extrato', rotulo: 'Extrato e razão' },
          { valor: 'comprovantes', rotulo: 'Comprovantes' + (vm.comprovantes.length ? ' · ' + vm.comprovantes.length : '') },
        ]} />
        {aba === 'comprovantes' && <span className="badge badge-neutral">{vm.banco.nome}{vm.banco.conta ? ' ' + vm.banco.conta : ''}</span>}
      </div>
      <div className="registro-corpo lt-extrato-corpo">
        {aba === 'extrato' ? <ExtratoDoMes empresa={empresa} competencia={vm.competencia} /> : <ComprovantesDoMes vm={vm} c={c} />}
      </div>
    </Janela>
  );
}
