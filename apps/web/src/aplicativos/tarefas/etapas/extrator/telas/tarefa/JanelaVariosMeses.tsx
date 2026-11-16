// A janela "Enviar vários meses" (Vitor, 12/11/2026): solta ou escolhe os extratos de uma vez; a lista mostra arquivo → mês, com
// os avisos; o Enviar põe cada um no seu mês (useEnviarVariosMeses). Na novidade 'importar-ao-soltar' (16/11/2026), sem o
// Enviar: o marcado já entra, a lista é o resumo e desmarcar ou o X desfaz.
import { demo, tarefas } from '@nads/core';
import { BotaoFechar, CampoArquivo, Icone, MenuSuspenso, useJanela } from '@nads/ui';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { VmVariosMeses } from './useEnviarVariosMeses';

/** O ⚡ da janela (modo desenvolvedor): arquivos OFX fictícios, soltos como se viessem do computador (não vão para o Drive). */
function DadosDeTesteDaJanela({ vm }: { vm: VmVariosMeses }) {
  const p = vm.periodo;
  const ofx = (meses: string[], nome: string) => new File([demo.ofxDeTeste(meses)], 'TESTE ' + nome + '.ofx', { type: 'text/plain' });
  const porMes = () => p.map(m => ofx([m], 'extrato ' + m));
  // o mesmo mês do ano anterior (o extrato do ano errado)
  const fora = () => [ofx([tarefas.somarMesesDaCompetencia(p[0], -12)], 'extrato do ano anterior')];
  const varios = () => [ofx([...p.slice(0, 2), tarefas.somarMesesDaCompetencia(p[p.length - 1], 1)], 'extrato de vários meses')];
  const naoE = () => [new File(['isso não é um extrato'], 'TESTE não é extrato.txt', { type: 'text/plain' })];
  const soltar = (fs: File[]) => { void vm.acrescentar(fs, true); };
  return (
    <MenuSuspenso rotulo="Dados de teste" icone="zap" className="btn btn-outline" flutuante direita largura={320} titulo="Modo desenvolvedor · não vai para o Drive"
      itens={[
        { rotulo: 'Tudo de exemplo', icone: 'zap', onClick: () => soltar([...porMes(), ...fora(), ...varios(), ...naoE()]) },
        'separador',
        { rotulo: 'Um extrato por mês do período', icone: 'upload', onClick: () => soltar(porMes()) },
        { rotulo: 'Um extrato do ano anterior (fora do período)', icone: 'calendar', onClick: () => soltar(fora()) },
        { rotulo: 'Um extrato de vários meses (um fora do período)', icone: 'calendar', onClick: () => soltar(varios()) },
        { rotulo: 'Um arquivo que não é extrato', icone: 'alert', onClick: () => soltar(naoE()) },
      ]} />
  );
}

export function JanelaVariosMeses({ vm, aceitar, teste }: { vm: VmVariosMeses; aceitar: string; teste?: boolean }) {
  const janela = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [sobre, setSobre] = useState(false);
  useJanela(janela, vm.fechar);
  const e = vm.aberta;
  if (!e) return null;
  const mm = tarefas.rotuloNumericoCompetencia;
  const ocupado = e.enviando || e.lendo > 0 || vm.entrando;
  return createPortal(
    <div className="modal-overlay pessoal-fundo" onMouseDown={ev => { if (ev.target === ev.currentTarget) vm.fechar(); }}>
      <div ref={janela} className="pessoal-janela" role="dialog" aria-modal="true" aria-label={'Enviar vários meses · ' + e.conta.nome}
        style={{ flexDirection: 'column', width: 'min(820px, 96vw)', height: 'auto', maxHeight: '88vh' }}>
        <header className="pessoal-topo">
          <h2>Enviar vários meses · {e.conta.nome}</h2>
          <div className="btn-row">
            {teste && vm.naHora && <DadosDeTesteDaJanela vm={vm} />}
            <BotaoFechar onClick={vm.fechar} disabled={vm.naHora ? ocupado : e.enviando} />
          </div>
        </header>
        <div style={{ padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CampoArquivo semCaixa semFoco multiplo ref={input} aceitar={aceitar} onEscolherVarios={fs => { void vm.acrescentar(fs); }} desabilitado={e.enviando} />
          <button type="button" className={'cert-soltar compacto' + (sobre ? ' sobre' : '')} disabled={e.enviando} onClick={() => input.current?.click()}
            onDragOver={ev => { ev.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)}
            onDrop={ev => { ev.preventDefault(); setSobre(false); void vm.acrescentar(ev.dataTransfer.files); }}>
            <span className="cert-soltar-icone"><Icone nome="upload" /></span>
            <b>Solte aqui os extratos de {e.conta.nome}</b>
            <span className="fraco">ou clique para escolher (vários de uma vez; cada um {vm.naHora ? 'já entra no' : 'vai para o'} seu mês)</span>
          </button>
          {(e.arquivos.length > 0 || e.lendo > 0) && (
            <div className="table-wrap">
              <table className="table-compact">
                <thead><tr><th style={{ width: 32 }} /><th>Arquivo</th><th style={{ width: 170 }}>Mês</th><th style={{ width: 40 }} /></tr></thead>
                <tbody>
                  {e.arquivos.map(a => {
                    // naHora: o check é "entrou"; o que não entrou (fora do período, cancelou o sobrepor) diz que dá para marcar
                    const escolhe = a.escolherMes && !(vm.naHora && (a.entrou || a.entrando));
                    const naoEntrou = vm.naHora && !a.bloqueado && !a.entrou && !a.entrando && a.meses.length > 0;
                    return (
                      <tr key={a.chave}>
                        <td><input type="checkbox" checked={vm.naHora ? !!(a.entrou || a.entrando) : a.marcado} disabled={a.bloqueado || !a.meses.length || e.enviando || a.entrando}
                          onChange={() => vm.marcar(a.chave)} aria-label={(vm.naHora ? 'Importar ' : 'Enviar ') + a.arquivo.name} /></td>
                        <td>
                          <span style={{ wordBreak: 'break-word' }}>{a.arquivo.name}</span>
                          {a.avisos.map(v => <div key={v.texto} className={'hint' + (v.tom === 'erro' ? ' ext-neg' : '')}>{v.texto}</div>)}
                          {naoEntrou && <div className="hint">Não entrou: marque para importar</div>}
                        </td>
                        <td>
                          {a.entrando && <span className="btn-spinner" />}
                          {escolhe ? (
                            // o extrato de vários meses: todos (cada lançamento no seu mês) ou um só; o sem movimento sem o mês: os do período
                            <MenuSuspenso flutuante className="btn btn-outline" dica="Em que mês entra este extrato"
                              rotulo={!a.meses.length ? 'Escolha o mês' : a.doArquivo.length > 1 && a.meses.length === a.doArquivo.length ? 'Todos os meses' : a.meses.map(mm).join(', ')}
                              conteudo={fechar => (
                                <>
                                  {a.doArquivo.length > 1 && (
                                    <button type="button" className="popover-item" role="menuitem" onClick={() => { vm.escolherMes(a.chave, a.doArquivo); fechar(); }}>
                                      <span className="popover-texto">Todos ({a.doArquivo.map(mm).join(', ')})</span>
                                      {a.meses.length === a.doArquivo.length && <Icone nome="check" width={16} height={16} />}
                                    </button>
                                  )}
                                  {(a.doArquivo.length > 1 ? a.doArquivo : vm.periodo).map(m => (
                                    <button key={m} type="button" className="popover-item" role="menuitem" onClick={() => { vm.escolherMes(a.chave, [m]); fechar(); }}>
                                      <span className="popover-texto">Só {tarefas.rotuloCompetencia(m)}</span>
                                      {a.meses.length === 1 && a.meses[0] === m && a.doArquivo.length !== 1 && <Icone nome="check" width={16} height={16} />}
                                    </button>
                                  ))}
                                </>
                              )} />
                          ) : a.meses.length ? a.meses.map(mm).join(', ') : <span className="fraco">—</span>}
                        </td>
                        <td>
                          <button type="button" className="icon-btn icon-btn-sm" disabled={e.enviando || a.entrando}
                            title={vm.naHora && a.entrou ? 'Desfazer (tira o que entrou)' : 'Tirar da lista'}
                            aria-label={(vm.naHora && a.entrou ? 'Desfazer ' : 'Tirar da lista ') + a.arquivo.name} onClick={() => vm.tirar(a.chave)}><Icone nome="x" /></button>
                        </td>
                      </tr>
                    );
                  })}
                  {e.lendo > 0 && <tr><td /><td colSpan={3} className="hint"><span className="btn-spinner" /> Lendo {e.lendo === 1 ? '1 arquivo' : e.lendo + ' arquivos'}…</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {vm.naHora ? (
          // o resumo: quantos entraram e o mês do período que ainda está sem extrato (o período à risca avisa o que falta)
          <div className="btn-row" style={{ justifyContent: 'space-between', padding: 16 }}>
            <div className="hint">
              {e.arquivos.length > 0 && <div>{vm.entraram === 1 ? '1 arquivo entrou' : vm.entraram + ' arquivos entraram'}</div>}
              {e.arquivos.length > 0 && vm.faltam.length > 0 && <div>Ainda sem extrato no período: {vm.faltam.map(mm).join(', ')}</div>}
            </div>
            <button type="button" className="btn btn-primary" disabled={ocupado} onClick={vm.fechar}>Fechar</button>
          </div>
        ) : (
          <div className="btn-row" style={{ justifyContent: 'flex-end', padding: 16 }}>
            <button type="button" className="btn btn-outline" disabled={e.enviando} onClick={vm.fechar}>Cancelar</button>
            <button type="button" className="btn btn-primary" disabled={!vm.prontos || ocupado} onClick={() => { void vm.confirmar(); }}>
              {e.enviando ? <><span className="btn-spinner" />Enviando…</> : <><Icone nome="upload" />{vm.prontos > 1 ? 'Enviar ' + vm.prontos + ' arquivos' : 'Enviar'}</>}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
