// ViewModel do "Ok" da linha do banco (Vitor, 01/10/2026): quando o extrato e o razão do banco batem no
// período (core: extrator.bancoOkNoPeriodo), a linha troca os botões pelo selo Ok e a setinha não abre mais.
// Quando um banco fica Ok depois de importar (não ao abrir a tela já Ok), aparece o mesmo "Tudo certo!" do
// Verificar por conta, que fecha sozinho. Enquanto não bate, "O que corrigir no razão" (core: extrator.correcoesDoRazao).
// Batendo, mas com dia que fecha negativo e sem o cheque especial no razão: "Conferido" no lugar do Ok; o clique abre a
// janela que explica (o saldo negativo de cada dia e o que fazer: o Cheque especial, lançar e importar o razão de novo).
import { extrator as x } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useMemo, useRef } from 'react';
import type { usePonteDaTarefa } from '../../../../../../comum/ponte';
import { caminhoNaFerramenta } from '../../../../casca/caminho';
import { useSessao } from '../../casca/sessao';
import type { useImportacao } from '../importacao/useImportacao';

type Vm = ReturnType<typeof useImportacao>;
type Ponte = ReturnType<typeof usePonteDaTarefa>;

const escapar = (t: string) => t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));

/** ocupado: alguma importação ou busca no Drive rodando (o "Tudo certo!" só vem depois de uma) */
export function useBancosOk(vm: Vm, ponte: Ponte, ocupado: boolean): {
  ok: Record<string, boolean>; correcoes: Record<string, x.CorrecaoDoRazao[]>; situacoes: Record<string, x.SituacaoDoBanco>;
  explicarCheque: (banco: { nome: string; conta?: string }, sit: x.SituacaoDoBanco) => void;
} {
  const s = useSessao();
  const { modal } = useRetorno();
  const emLote = vm.periodo.length > 1;
  const meses = emLote ? vm.periodo : [vm.competencia];
  const semMovimentoDe = (banco: string) => emLote
    ? meses.filter(m => (ponte.semMovimentoPorMes[m] || []).includes(banco))
    : ponte.semMovimento.includes(banco) ? meses : [];
  const chaveSemMov = vm.bancos.map(b => b.id + ':' + semMovimentoDe(b.id).join('.')).join(',');
  // a conferência de todos os meses de cada banco: só quando os arquivos, os meses ou os "sem movimento" mudam
  const { ok, correcoes, situacoes } = useMemo(() => {
    const ok: Record<string, boolean> = {};
    const correcoes: Record<string, x.CorrecaoDoRazao[]> = {};
    const situacoes: Record<string, x.SituacaoDoBanco> = {};
    for (const b of vm.bancos) {
      situacoes[b.id] = x.situacaoDoBancoNoPeriodo(s.empresa, b.id, vm.primeiro, meses, semMovimentoDe(b.id));
      ok[b.id] = situacoes[b.id].tipo === 'ok';
      correcoes[b.id] = situacoes[b.id].tipo === 'pendente' ? x.correcoesDoRazao(s.empresa, b.id, vm.primeiro, meses, semMovimentoDe(b.id)) : [];
    }
    return { ok, correcoes, situacoes };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.empresa, vm.primeiro, meses.join(','), chaveSemMov]);

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
      html: novos.map(b => '<b>' + escapar(b.nome) + '</b>' + (b.conta ? ' ' + escapar(b.conta) : '')).join('<br>'),
      botoes: [{ rotulo: 'Ok', valor: true, variante: 'btn-primary' }],
      fecharEm: { ms: 3500, valor: true },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, ocupado]);

  /** O clique no "Conferido": o saldo negativo de cada dia e o que fazer. */
  function explicarCheque(banco: { nome: string; conta?: string }, sit: x.SituacaoDoBanco) {
    if (sit.tipo !== 'falta-cheque') return;
    // (Vitor, 02/10/2026) só os dias: "Dias negativos: → 03/09/2026: -R$ 150,00"
    const dias = sit.faltam.map(d => '→ ' + x.dataBR(d.data) + ': <b>-R$ ' + x.valorBR(Math.abs(d.saldo)) + '</b>').join('<br>');
    void modal({
      icone: 'alert', titulo: 'Saldo negativo no banco',
      html: '<b>' + escapar(banco.nome) + '</b>' + (banco.conta ? ' ' + escapar(banco.conta) : '') + '<br>Dias negativos:<br>' + dias,
      // abre o Cheque especial numa aba nova (Vitor, 02/10/2026: no lugar do "Entendi")
      botoes: [{ rotulo: 'Fazer Cheque Especial', valor: true, variante: 'btn-primary', aoClicar: () => { window.open(caminhoNaFerramenta('cheque-especial', s.rota), '_blank', 'noopener'); } }],
    });
  }

  return { ok, correcoes, situacoes, explicarCheque };
}
