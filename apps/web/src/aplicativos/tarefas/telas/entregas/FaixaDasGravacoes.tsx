// As faixas do alto das telas da entrega (16/10/2026, a cópia fiel do Entregas): "Sem conexão…" / "Sincronizando…" com
// quantas gravações esperam o servidor, e a gravação que o servidor recusou depois do "salvo" (fica até alguém ler).
import { Alerta } from '@nads/ui';
import { useFaixaDasGravacoes } from './useFaixaDasGravacoes';

export function FaixaDasGravacoes() {
  const vm = useFaixaDasGravacoes();
  return (
    <>
      {vm.conexao && <Alerta naLinha titulo={vm.conexao.titulo} texto={vm.conexao.texto} />}
      {vm.perdidas && <Alerta naLinha titulo="Uma gravação não subiu" texto={vm.perdidas} onFechar={vm.limpar} />}
    </>
  );
}
