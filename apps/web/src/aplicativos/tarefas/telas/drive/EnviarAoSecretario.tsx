// A janela "Enviar para o Claudio Secretário": escolher (ou arrastar) os arquivos e, em "Ajudar o Claude", os clientes e os meses; mostra para
// onde vai (Claudio Secretario › mês › cliente). Os arquivos sobem e o robô grava; a próxima rodada do
// arquivamento põe cada um na pasta certa do cliente. O andamento aparece no canto (EnviosEmAndamento).
import { CampoArquivos, Icone, Segmentado, SeletorMes, useJanela } from '@nads/ui';
import { useRef, useState, type DragEvent } from 'react';
import type { VmEnvio } from './useEnvioAoSecretario';

export function EnviarAoSecretario({ vm }: { vm: VmEnvio }) {
  const [soltando, setSoltando] = useState(false);
  // revisão da UI, 16/10/2026: Esc, foco preso e o foco de volta pela peça useJanela (antes, um Esc à mão por janela)
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fechar, vm.aberto);
  if (!vm.aberto) return null;
  const soltar = (ev: DragEvent) => { ev.preventDefault(); setSoltando(false); vm.adicionar(Array.from(ev.dataTransfer.files || [])); };

  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) vm.fechar(); }}>
      <div ref={janela} className="modal envio-janela" role="dialog" aria-modal="true" aria-labelledby="envioTitulo">
        <h3 id="envioTitulo"><Icone nome="upload" />Enviar para o Claudio Secretário</h3>
        <div className="envio-corpo">
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
          <Segmentado valor={vm.modo} onMudar={vm.setModo} opcoes={[
            { valor: 'automatico', rotulo: 'Arquivar 100% automático (demora mais)' },
            { valor: 'ajuda', rotulo: 'Ajudar o Claude' },
          ]} />
          {vm.modo === 'ajuda' && (
            <div className="envio-campos">
              <label className="envio-campo">
                <span>Clientes</span>
                <select value="" onChange={ev => vm.adicionarCliente(ev.target.value)}>
                  <option value="">Adicionar cliente</option>
                  {vm.clientes.map(c => <option key={c.id} value={c.id}>{c.rotulo}</option>)}
                </select>
              </label>
              {vm.clientesEscolhidos.length > 0 && (
                <ul className="envio-lista">
                  {vm.clientesEscolhidos.map(c => (
                    <li key={c.id}>
                      <span className="envio-nome" title={c.rotulo}>{c.rotulo}</span>
                      <button type="button" className="explorador-btn" aria-label={'Tirar ' + c.rotulo} title="Tirar" onClick={() => vm.tirarCliente(c.id)}><Icone nome="x" /></button>
                    </li>
                  ))}
                </ul>
              )}
              {/* o calendário abre dentro da área que rola: rola até ele aparecer inteiro */}
              <div className="envio-campo" onClick={ev => { const campo = ev.currentTarget; setTimeout(() => campo.querySelector('.seletor-mes-pop')?.scrollIntoView({ block: 'nearest' })); }}>
                <span>Meses (opcional)</span>
                <SeletorMes valor="" onMudar={vm.adicionarMes} rotulo="Mês" semValor="Adicionar mês" />
              </div>
              {vm.meses.length > 0 && (
                <ul className="envio-lista">
                  {vm.meses.map(m => (
                    <li key={m.valor}>
                      <span className="envio-nome">{m.rotulo}</span>
                      <button type="button" className="explorador-btn" aria-label={'Tirar ' + m.rotulo} title="Tirar" onClick={() => vm.tirarMes(m.valor)}><Icone nome="x" /></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
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
