// ViewModel do "Ok" da linha do banco (Vitor, 01/10/2026): quando o extrato e o razão do banco batem no
// período (core: extrator.bancoOkNoPeriodo), a linha troca os botões pelo selo Ok e a setinha não abre mais.
// Quando um banco fica Ok depois de importar (não ao abrir a tela já Ok), aparece o mesmo "Tudo certo!" do
// Verificar por conta, que fecha sozinho.
import { extrator as x } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef } from 'react';
import type { usePonteDaTarefa } from '../../../../../../comum/ponte';
import { useSessao } from '../../casca/sessao';
import type { useImportacao } from '../importacao/useImportacao';

type Vm = ReturnType<typeof useImportacao>;
type Ponte = ReturnType<typeof usePonteDaTarefa>;

const escapar = (t: string) => t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));

/** ocupado: alguma importação ou busca no Drive rodando (o "Tudo certo!" só vem depois de uma) */
export function useBancosOk(vm: Vm, ponte: Ponte, ocupado: boolean): Record<string, boolean> {
  const s = useSessao();
  const { modal } = useRetorno();
  const emLote = vm.periodo.length > 1;
  const meses = emLote ? vm.periodo : [vm.competencia];
  const ok: Record<string, boolean> = {};
  for (const b of vm.bancos) {
    const semMovimento = emLote
      ? meses.filter(m => (ponte.semMovimentoPorMes[m] || []).includes(b.id))
      : ponte.semMovimento.includes(b.id) ? meses : [];
    ok[b.id] = x.bancoOkNoPeriodo(s.empresa, b.id, vm.primeiro, meses, semMovimento);
  }

  const antes = useRef<Record<string, boolean> | null>(null);
  const mexeu = useRef(false);
  if (ocupado) mexeu.current = true;
  const chave = vm.bancos.map(b => b.id + ':' + (ok[b.id] ? 1 : 0)).join(',');
  useEffect(() => {
    // compara com o que era antes da importação (no meio dela, ainda não)
    if (ocupado) return;
    const anterior = antes.current;
    antes.current = ok;
    if (!anterior || !mexeu.current) return;
    const novos = vm.bancos.filter(b => ok[b.id] && anterior[b.id] === false);
    if (!novos.length) return;
    mexeu.current = false;
    void modal({
      tom: 'ok', icone: 'checkCircle', titulo: 'Tudo certo!',
      html: novos.map(b => '<b>' + escapar(b.nome) + '</b>' + (b.conta ? ' ' + escapar(b.conta) : '')).join('<br>') + '<br>extrato e razão batem · Ok',
      botoes: [{ rotulo: 'Ok', valor: true, variante: 'btn-primary' }],
      fecharEm: { ms: 3500, valor: true },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, ocupado]);

  return ok;
}
