// A janela "Enviar vários meses" (Vitor, 12/11/2026): solta ou escolhe os extratos de uma vez; a lista mostra arquivo → mês, com
// os avisos; o Enviar põe cada um no seu mês (useEnviarVariosMeses).
import { tarefas } from '@nads/core';
import { BotaoFechar, CampoArquivo, Icone, MenuSuspenso, useJanela } from '@nads/ui';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { VmVariosMeses } from './useEnviarVariosMeses';

export function JanelaVariosMeses({ vm, aceitar }: { vm: VmVariosMeses; aceitar: string }) {
  const janela = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  useJanela(janela, vm.fechar);
  const e = vm.aberta;
  if (!e) return null;
  const mm = tarefas.rotuloNumericoCompetencia;
  const ocupado = e.enviando || e.lendo > 0;
  return createPortal(
    <div className="modal-overlay pessoal-fundo" onMouseDown={ev => { if (ev.target === ev.currentTarget) vm.fechar(); }}>
      <div ref={janela} className="pessoal-janela" role="dialog" aria-modal="true" aria-label={'Enviar vários meses · ' + e.conta.nome}
        style={{ flexDirection: 'column', width: 'min(820px, 96vw)', height: 'auto', maxHeight: '88vh' }}>
        <header className="pessoal-topo"><h2>Enviar vários meses · {e.conta.nome}</h2><BotaoFechar onClick={vm.fechar} disabled={e.enviando} /></header>
        <div style={{ padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CampoArquivo semCaixa semFoco multiplo ref={input} aceitar={aceitar} onEscolherVarios={fs => { void vm.acrescentar(fs); }} desabilitado={e.enviando} />
          <button type="button" className={'cert-soltar compacto' + (sobre ? ' sobre' : '')} disabled={e.enviando} onClick={() => input.current?.click()}
            onDragOver={ev => { ev.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)}
            onDrop={ev => { ev.preventDefault(); setSobre(false); void vm.acrescentar(ev.dataTransfer.files); }}>
            <span className="cert-soltar-icone"><Icone nome="upload" /></span>
            <b>Solte aqui os extratos de {e.conta.nome}</b>
            <span className="fraco">ou clique para escolher (vários de uma vez; cada um vai para o seu mês)</span>
          </button>
          {(e.arquivos.length > 0 || e.lendo > 0) && (
            <div className="table-wrap">
              <table className="table-compact">
                <thead><tr><th style={{ width: 32 }} /><th>Arquivo</th><th style={{ width: 170 }}>Mês</th><th style={{ width: 40 }} /></tr></thead>
                <tbody>
                  {e.arquivos.map(a => (
                    <tr key={a.chave}>
                      <td><input type="checkbox" checked={a.marcado} disabled={a.bloqueado || !a.meses.length || e.enviando} onChange={() => vm.marcar(a.chave)} aria-label={'Enviar ' + a.arquivo.name} /></td>
                      <td>
                        <span style={{ wordBreak: 'break-word' }}>{a.arquivo.name}</span>
                        {a.avisos.map(v => <div key={v.texto} className={'hint' + (v.tom === 'erro' ? ' ext-neg' : '')}>{v.texto}</div>)}
                      </td>
                      <td>
                        {a.escolherMes ? (
                          <MenuSuspenso flutuante className="btn btn-outline" rotulo={a.meses[0] ? mm(a.meses[0]) : 'Escolha o mês'} dica="De que mês é este extrato"
                            conteudo={fechar => (
                              <>
                                {vm.periodo.map(m => (
                                  <button key={m} type="button" className="popover-item" role="menuitem" onClick={() => { vm.escolherMes(a.chave, m); fechar(); }}>
                                    <span className="popover-texto">{tarefas.rotuloCompetencia(m)}</span>
                                    {a.meses[0] === m && <Icone nome="check" width={16} height={16} />}
                                  </button>
                                ))}
                              </>
                            )} />
                        ) : a.meses.length ? a.meses.map(mm).join(', ') : <span className="fraco">—</span>}
                      </td>
                      <td><button type="button" className="icon-btn icon-btn-sm" disabled={e.enviando} title="Tirar da lista" aria-label={'Tirar ' + a.arquivo.name + ' da lista'} onClick={() => vm.tirar(a.chave)}><Icone nome="x" /></button></td>
                    </tr>
                  ))}
                  {e.lendo > 0 && <tr><td /><td colSpan={3} className="hint"><span className="btn-spinner" /> Lendo {e.lendo === 1 ? '1 arquivo' : e.lendo + ' arquivos'}…</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="btn-row" style={{ justifyContent: 'flex-end', padding: 16 }}>
          <button type="button" className="btn btn-outline" disabled={e.enviando} onClick={vm.fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={!vm.prontos || ocupado} onClick={() => { void vm.confirmar(); }}>
            {e.enviando ? <><span className="btn-spinner" />Enviando…</> : <><Icone nome="upload" />{vm.prontos > 1 ? 'Enviar ' + vm.prontos + ' arquivos' : 'Enviar'}</>}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
