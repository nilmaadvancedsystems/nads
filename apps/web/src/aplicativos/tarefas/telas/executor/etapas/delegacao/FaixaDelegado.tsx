// O que já foi delegado nesta etapa (Vitor, 10/11/2026: "traz um feedback de delegado, e que eu posso remover"): para quem,
// quantas contas e quantas a pessoa já marcou, com o Remover. Só para quem delegou.
import { Alerta } from '@nads/ui';
import type { VmDelegacao } from './useDelegacaoDaEtapa';

export function FaixaDelegado({ vm }: { vm: VmDelegacao }) {
  if (!vm.delegadas.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      {vm.delegadas.map(x => (
        <Alerta key={x.id} naLinha tom="ok" titulo={'Delegado para ' + x.para} texto={x.resumo}>
          <div className="btn-row"><button type="button" className="btn btn-outline" onClick={() => { void vm.remover(x.id, x.para); }}>Remover delegação</button></div>
        </Alerta>
      ))}
    </div>
  );
}
