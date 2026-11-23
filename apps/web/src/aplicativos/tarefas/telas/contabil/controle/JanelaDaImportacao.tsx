// A prévia da planilha do Controle contábil (23/11/2026: "como trazer os dados atuais da planilha"): antes de gravar, o que
// vai mudar — quantas empresas entram ou mudam, as que já estão iguais, as que o nads tem um mês mais à frente (fica o do
// nads), as que não estão no Cadastro (ficam de fora), o regime diferente do Cadastro (só o aviso) e as linhas ignoradas.
import { tarefas as t } from '@nads/core';
import { Icone, useJanela } from '@nads/ui';
import { useRef } from 'react';
import type { VmControleDoContabil } from './useControleDoContabil';

const MOSTRAR = 8;

function Lista({ titulo, itens, tom }: { titulo: string; itens: string[]; tom?: 'aviso' }) {
  if (!itens.length) return null;
  return (
    <details className={'cc-previa-lista' + (tom ? ' cc-previa-' + tom : '')} open={itens.length <= MOSTRAR}>
      <summary><b>{itens.length}</b> {titulo}</summary>
      <ul>{itens.map(i => <li key={i}>{i}</li>)}</ul>
    </details>
  );
}

export function JanelaDaImportacao({ vm }: { vm: VmControleDoContabil }) {
  const p = vm.previa as NonNullable<VmControleDoContabil['previa']>;
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fecharPrevia);
  const pl = p.plano;
  const mes = (m: number | null) => (m ? t.rotuloDoMesFeito(m) : '—');
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) vm.fecharPrevia(); }}>
      <div ref={janela} className="modal cc-previa" role="dialog" aria-modal="true" aria-labelledby="ccPreviaTitulo">
        <h3 id="ccPreviaTitulo"><Icone nome="fileUp" width={16} height={16} />Importar a planilha no controle de {vm.ano}</h3>
        <p className="hint">{p.arquivo}: {p.lidas} {p.lidas === 1 ? 'empresa lida' : 'empresas lidas'}. O mês nunca volta para trás e a célula em branco não apaga o que o nads já tem.</p>
        <Lista titulo={pl.gravar.length === 1 ? 'empresa entra ou muda' : 'empresas entram ou mudam'}
          itens={pl.gravar.map(l => {
            const antes = p.antes.get(l.codigo);
            const mudouMes = !antes || antes.feitaAte !== l.feitaAte;
            return l.codigo + ' — ' + p.nomeDe(l.codigo) + ': feita até ' + mes(l.feitaAte) + (antes && mudouMes ? ' (era ' + mes(antes.feitaAte) + ')' : !antes ? ' (nova no controle)' : '') + (l.observacao && l.observacao !== antes?.observacao ? ' · obs.: ' + l.observacao : '');
          })} />
        {pl.iguais > 0 && <p className="cc-previa-linha"><b>{pl.iguais}</b> {pl.iguais === 1 ? 'não muda' : 'não mudam'} nada no nads</p>}
        <Lista tom="aviso" titulo="com o mês do nads mais à frente (fica o do nads)" itens={pl.mantidas.map(m => m.codigo + ' — ' + m.nome + ': nads ' + mes(m.noNads) + ', planilha ' + mes(m.naPlanilha))} />
        <Lista tom="aviso" titulo="com o regime diferente do Cadastro (o Cadastro não muda)" itens={pl.regimeDiferente.map(r => r.codigo + ' — ' + r.nome + ': planilha ' + r.naPlanilha + ', Cadastro ' + r.noCadastro)} />
        <Lista tom="aviso" titulo="não estão no Cadastro (ficam de fora)" itens={pl.naoAchadas.map(l => l.codigo + ' — ' + l.nome)} />
        <Lista tom="aviso" titulo="linhas ignoradas" itens={p.ignoradas.map(i => 'Linha ' + i.linha + ': ' + i.motivo)} />
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={vm.fecharPrevia} disabled={vm.importando}>Voltar</button>
          <button type="button" className="btn btn-primary" onClick={() => void vm.confirmarImportacao()} disabled={vm.importando}>
            {vm.importando ? 'Gravando…' : pl.gravar.length ? 'Gravar ' + pl.gravar.length + (pl.gravar.length === 1 ? ' empresa' : ' empresas') : 'Fechar'}
          </button>
        </div>
      </div>
    </div>
  );
}
