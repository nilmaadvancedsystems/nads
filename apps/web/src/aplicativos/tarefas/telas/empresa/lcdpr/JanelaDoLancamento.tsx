// A janela de um lançamento do LCDPR (o "Ver/editar detalhes" da linha no lcdpr.html), no desenho das janelas de criar
// do nads (registro-novo): o fornecedor e o resumo da nota no cartão, cada campo numa linha (o ícone e o nome à esquerda)
// e, no rodapé, Cancelar e Salvar (Enter ou Ctrl+Enter). Esc fecha.
import { Icone, type NomeIcone } from '@nads/ui';
import { useEffect, type ReactNode } from 'react';
import { useJanelaDoLancamento } from './useJanelaDoLancamento';

function Propriedade({ icone, rotulo, children }: { icone: NomeIcone; rotulo: string; children: ReactNode }) {
  return (
    <div className="registro-prop">
      <span className="registro-prop-nome"><Icone nome={icone} />{rotulo}</span>
      <div className="registro-prop-valor">{children}</div>
    </div>
  );
}

export function JanelaDoLancamento({ id, fechar }: { id: number; fechar: () => void }) {
  const vm = useJanelaDoLancamento(id, fechar);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) fechar();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); vm.salvar(); }
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });
  const l = vm.lancamento;
  if (!l) return null;
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="modal registro-novo" role="dialog" aria-modal="true" aria-label={'Lançamento de ' + l.fornecedor}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="dinheiro" />LCDPR<Icone nome="chevronRight" /><b>Lançamento</b></span>
          <button type="button" className="icon-btn icon-btn-sm" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)"><Icone nome="x" /></button>
        </header>
        <div className="registro-corpo">
          <div className="registro-receita">
            <div className="registro-receita-topo">
              <b>{l.fornecedor}</b>
              {l.revisar ? <span className="badge badge-warn">REVISAR</span> : l.categoria && <span className="badge badge-neutral">{l.categoria}</span>}
            </div>
            <span className="fraco">{l.origem} · {l.resumo}</span>
          </div>
          <div className="registro-props">
            {vm.campos.map(c => (
              <Propriedade key={c.id} icone={c.icone} rotulo={c.rotulo}>
                <input type="text" value={c.valor} inputMode={c.numerico ? 'numeric' : undefined} aria-label={c.rotulo} placeholder="Vazio" autoComplete="off"
                  onChange={e => vm.mudar(c.id, e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); vm.salvar(); } }} />
              </Propriedade>
            ))}
          </div>
          <p className="registro-dica">A categoria muda na própria linha da lista. Corrigir aqui não tira o lançamento de REVISAR.</p>
        </div>
        <footer className="registro-pe">
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={vm.salvar} title="Salvar (Ctrl+Enter)"><Icone nome="check" />Salvar</button>
        </footer>
      </div>
    </div>
  );
}
