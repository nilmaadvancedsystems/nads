// O popup do Delegar (Vitor, 10/11/2026): para quem; todos ou específicos, num grid de colunas iguais; a observação, se
// precisar, pelo lápis.
import { BotaoFechar, Icone, MenuSuspenso, Segmentado, useJanela } from '@nads/ui';
import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FotoDaPessoa } from '../../../cadastro/responsaveis/FotoDaPessoa';
import type { VmDelegacao } from './useDelegacaoDaEtapa';

export function JanelaDelegar({ vm }: { vm: VmDelegacao }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fechar);
  const id = useId();
  const rotulo = vm.pessoa
    ? <span className="pessoa-escolhida"><FotoDaPessoa foto={vm.pessoa.foto} iniciais={vm.pessoa.iniciais} /><span>{vm.pessoa.nome}</span></span>
    : <span className="pessoa-escolhida fraco">Escolha a pessoa</span>;
  return createPortal(
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) vm.fechar(); }}>
      <div ref={janela} className="pessoal-janela" role="dialog" aria-modal="true" aria-label={'Delegar ' + vm.rotulo}
        style={{ flexDirection: 'column', width: 'min(960px, 96vw)', height: 'auto', maxHeight: '88vh' }}>
        <header className="pessoal-topo"><h2>Delegar {vm.rotulo}</h2><BotaoFechar onClick={vm.fechar} /></header>
        <div style={{ padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <span className="field-rotulo" id={id}>Delegar para</span>
            <MenuSuspenso rotulo={rotulo} flutuante className="btn btn-outline pessoa-botao" titulo="Delegar para" dica="Escolher para quem delegar"
              conteudo={fechar => (
                <div className="pessoa-lista" role="listbox" aria-labelledby={id}>
                  {vm.equipe.map(p => (
                    <button key={p.uid} type="button" className="popover-item" role="option" aria-selected={p.uid === vm.pessoa?.uid} onClick={() => { vm.escolher(p.uid); fechar(); }}>
                      <FotoDaPessoa foto={p.foto} iniciais={p.iniciais} />
                      <span className="popover-texto">{p.nome}</span>
                      {p.uid === vm.pessoa?.uid && <Icone nome="check" width={16} height={16} />}
                    </button>
                  ))}
                </div>
              )} />
          </div>
          <div className="tarefas-barra-topo" style={{ margin: 0 }}>
            <Segmentado<'todos' | 'especificos'> valor={vm.modo} onMudar={vm.setModo} opcoes={[{ valor: 'todos', rotulo: 'Todos (' + vm.total + ')' }, { valor: 'especificos', rotulo: 'Específicos' + (vm.qtdEscolhidas ? ' (' + vm.qtdEscolhidas + ')' : '') }]} />
            <span className="tarefas-barra-espaco" />
            {vm.modo === 'especificos' && (
              <label className="busca-curta">
                <Icone nome="search" />
                <input type="text" placeholder="Buscar" aria-label="Buscar" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} />
              </label>
            )}
          </div>
          {vm.modo === 'especificos' && (
            <div className="delegar-grade">
              {vm.contas.map(c => (
                <label key={c.codigo} className={'delegar-conta' + (vm.comCodigo ? '' : ' sem-codigo')} title={vm.comCodigo ? c.codigo + ' — ' + c.nome : c.nome}>
                  <input type="checkbox" checked={c.marcada} onChange={() => vm.marcar(c.codigo)} />
                  {vm.comCodigo && <span className="num">{c.codigo}</span>}
                  <span className="delegar-conta-nome">{c.nome}</span>
                </label>
              ))}
            </div>
          )}
          <div className="field">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="field-rotulo">Observação</span>
              <button type="button" className="icon-btn icon-btn-sm" aria-expanded={vm.comObservacao} title="Escrever uma observação (se precisar)" aria-label="Escrever uma observação" onClick={vm.alternarObservacao}><Icone nome="lapis" /></button>
            </span>
            {vm.comObservacao && <textarea rows={3} aria-label="Observação" value={vm.observacao} onChange={e => vm.setObservacao(e.target.value)} placeholder="O que a pessoa precisa saber" />}
          </div>
        </div>
        <div className="btn-row" style={{ justifyContent: 'flex-end', padding: 16 }}>
          <button type="button" className="btn btn-outline" onClick={vm.fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={!vm.pode} onClick={() => { void vm.delegar(); }}><Icone nome="aviao" />{vm.gravando ? 'Delegando…' : 'Delegar'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
