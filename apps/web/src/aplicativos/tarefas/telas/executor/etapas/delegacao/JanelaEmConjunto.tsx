// A janela da tarefa em conjunto (Vitor, 12/11/2026: "aí você coloca todas as boxes"): as etapas que faltam, cada uma com a
// caixinha e quem faz; as já delegadas mostram com quem estão e o Remover. A observação, se precisar, pelo lápis (como no Delegar).
import { BotaoFechar, Icone, MenuSuspenso, useJanela } from '@nads/ui';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { FotoDaPessoa } from '../../../cadastro/responsaveis/FotoDaPessoa';
import type { VmEmConjunto } from './useDelegarEmConjunto';

export function JanelaEmConjunto({ vm }: { vm: VmEmConjunto }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fechar);
  return createPortal(
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) vm.fechar(); }}>
      <div ref={janela} className="pessoal-janela" role="dialog" aria-modal="true" aria-label="Tarefa em conjunto"
        style={{ flexDirection: 'column', width: 'min(760px, 96vw)', height: 'auto', maxHeight: '88vh' }}>
        <header className="pessoal-topo"><h2>Tarefa em conjunto</h2><BotaoFechar onClick={vm.fechar} /></header>
        <div style={{ padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p className="hint" style={{ margin: 0 }}>Marque as etapas e escolha quem faz cada uma. Quem recebe, ao entrar na empresa, vê só as etapas dele. As que você não marcar ficam com você.</p>
          {vm.etapas.length ? (
            <div className="table-wrap">
              <table className="table-compact">
                <thead><tr><th style={{ width: 32 }} /><th>Etapa</th><th style={{ width: 260 }}>Quem faz</th></tr></thead>
                <tbody>
                  {vm.etapas.map(e => (
                    <tr key={e.id}>
                      <td>{!e.delegada && <input type="checkbox" checked={e.marcada} onChange={() => vm.marcar(e.id)} aria-label={'Delegar ' + e.nome} />}</td>
                      <td>{e.nome}{e.secao && <span className="hint"> · {e.secao}</span>}</td>
                      <td>
                        {e.delegada ? (
                          <span className="btn-row" style={{ alignItems: 'center' }}>
                            <span className={'badge ' + (e.delegada.feita ? 'badge-ok' : 'badge-neutral')}>{(e.delegada.feita ? 'Feito por ' : 'Com ') + e.delegada.para}</span>
                            {!e.delegada.feita && <button type="button" className="btn btn-outline" onClick={() => { void vm.remover(e.delegada!.id, e.delegada!.para, e.nome); }}>Remover</button>}
                          </span>
                        ) : e.marcada ? (
                          <MenuSuspenso flutuante className="btn btn-outline pessoa-botao" titulo="Quem faz" dica={'Quem faz ' + e.nome}
                            rotulo={e.pessoa
                              ? <span className="pessoa-escolhida"><FotoDaPessoa foto={e.pessoa.foto} iniciais={e.pessoa.iniciais} /><span>{e.pessoa.nome}</span></span>
                              : <span className="pessoa-escolhida fraco">Escolha a pessoa</span>}
                            conteudo={fechar => (
                              <div className="pessoa-lista" role="listbox" aria-label={'Quem faz ' + e.nome}>
                                {vm.equipe.map(p => (
                                  <button key={p.uid} type="button" className="popover-item" role="option" aria-selected={p.uid === e.pessoa?.uid} onClick={() => { vm.escolher(e.id, p.uid); fechar(); }}>
                                    <FotoDaPessoa foto={p.foto} iniciais={p.iniciais} />
                                    <span className="popover-texto">{p.nome}</span>
                                    {p.uid === e.pessoa?.uid && <Icone nome="check" width={16} height={16} />}
                                  </button>
                                ))}
                              </div>
                            )} />
                        ) : <span className="fraco">Com você</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="hint">Todas as etapas do período já estão feitas.</p>}
          <div className="field">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="field-rotulo">Observação</span>
              <button type="button" className="icon-btn icon-btn-sm" aria-expanded={vm.comObservacao} title="Escrever uma observação (se precisar)" aria-label="Escrever uma observação" onClick={vm.alternarObservacao}><Icone nome="lapis" /></button>
            </span>
            {vm.comObservacao && <textarea rows={3} aria-label="Observação" value={vm.observacao} onChange={e => vm.setObservacao(e.target.value)} placeholder="O que a equipe precisa saber" />}
          </div>
        </div>
        <div className="btn-row" style={{ justifyContent: 'flex-end', padding: 16 }}>
          <button type="button" className="btn btn-outline" onClick={vm.fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={!vm.pode} onClick={() => { void vm.delegar(); }}>
            <Icone nome="aviao" />{vm.gravando ? 'Delegando…' : vm.qtd > 1 ? 'Delegar ' + vm.qtd + ' etapas' : 'Delegar'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
