// A janela "Enviar para o Claudio Secretário": escolher (ou arrastar) os arquivos, o cliente e o mês; mostra para
// onde vai (Claudio Secretario › mês › cliente). Os arquivos sobem e o robô grava; a próxima rodada do
// arquivamento põe cada um na pasta certa do cliente. O andamento aparece no canto (EnviosEmAndamento).
import { CampoArquivos, Icone, SeletorMes } from '@nads/ui';
import { useEffect, useState, type DragEvent } from 'react';
import type { VmEnvio } from './useEnvioAoSecretario';

export function EnviarAoSecretario({ vm }: { vm: VmEnvio }) {
  const [soltando, setSoltando] = useState(false);
  useEffect(() => {
    if (!vm.aberto) return;
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && !ev.defaultPrevented) { ev.preventDefault(); vm.fechar(); } };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  }, [vm.aberto, vm]);
  if (!vm.aberto) return null;
  const soltar = (ev: DragEvent) => { ev.preventDefault(); setSoltando(false); vm.adicionar(Array.from(ev.dataTransfer.files || [])); };

  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) vm.fechar(); }}>
      <div className="modal envio-janela" role="dialog" aria-modal="true" aria-labelledby="envioTitulo">
        <h3 id="envioTitulo"><Icone nome="upload" />Enviar para o Claudio Secretário</h3>
        <div className="envio-corpo">
          <p className="envio-dica">Os arquivos vão para a pasta <b>Claudio Secretario</b> do Drive. Na próxima rodada do arquivamento, cada um vai para a pasta do cliente.</p>
          <div className={'envio-soltar' + (soltando ? ' on' : '')}
            onDragOver={ev => { ev.preventDefault(); setSoltando(true); }} onDragLeave={() => setSoltando(false)} onDrop={soltar}>
            <CampoArquivos id="envioArquivos" aceitar="" rotulo={vm.arquivos.length ? 'Escolher mais arquivos' : 'Escolher arquivos (ou arraste para cá)'} onEscolher={vm.adicionar} />
          </div>
          {vm.arquivos.length > 0 && (
            <ul className="envio-lista">
              {vm.arquivos.map((a, i) => (
                <li key={a.nome + i} className={a.problema ? 'com-problema' : undefined}>
                  <Icone nome="arquivo" className="drive-ico" />
                  <span className="envio-nome" title={a.nome}>{a.nome}</span>
                  <span className="fraco">{a.problema ? a.problema : a.tamanho}</span>
                  <button type="button" className="explorador-btn" aria-label={'Tirar ' + a.nome} title="Tirar" onClick={() => vm.tirarArquivo(i)}><Icone nome="x" /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="envio-campos">
            <label className="envio-campo">
              <span>Cliente</span>
              <select value={vm.clienteId} onChange={ev => vm.setClienteId(ev.target.value)}>
                <option value="">Sem cliente (a rotina descobre pelo arquivo)</option>
                {vm.clientes.map(c => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
              </select>
            </label>
            <div className="envio-campo">
              <span>Mês</span>
              <SeletorMes valor={vm.competencia} onMudar={vm.setCompetencia} rotulo="Mês" />
            </div>
          </div>
          <p className="envio-onde"><Icone nome="pasta" className="drive-ico pasta" />{vm.onde}</p>
          {vm.exemplos && <p className="hint">Dados de exemplo: o envio é de mentira, nada vai para o Drive.</p>}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={vm.fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={!vm.podeEnviar} onClick={() => void vm.enviar()}>
            <Icone nome="upload" />Enviar{vm.quantos > 1 ? ' ' + vm.quantos + ' arquivos' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
