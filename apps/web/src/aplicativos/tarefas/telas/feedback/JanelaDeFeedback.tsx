// A janela "Enviar feedback": o print (Tirar print da tela, Escolher imagem ou Ctrl+V), o que melhorar e a prioridade
// (Baixa, Média, Alta; Vitor, 19/10/2026). Ao tirar o print, a janela some por um instante para não sair na foto.
import { BotaoFechar, BotaoIcone, CampoArquivo, Icone, Segmentado, useJanela } from '@nads/ui';
import { PRIORIDADES } from '../../dados/feedback';
import { useEffect, useRef, useState } from 'react';
import { capturarTela, imagemDoArquivo } from './capturaDeTela';
import { useEnviarFeedback } from './useEnviarFeedback';

export function JanelaDeFeedback({ fechar }: { fechar: () => void }) {
  const vm = useEnviarFeedback(fechar);
  const [escondida, setEscondida] = useState(false);
  const [falha, setFalha] = useState('');
  const arquivo = useRef<HTMLInputElement>(null);
  const anexos = useRef<HTMLInputElement>(null);
  const { setImagem } = vm;
  // revisão da UI, 16/10/2026: Esc, foco preso e o foco de volta pela peça useJanela (antes, um Esc à mão por janela)
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  useEffect(() => {
    // colar uma imagem (Ctrl+V) vira o print
    const colar = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
      const f = item?.getAsFile();
      if (f) { e.preventDefault(); void imagemDoArquivo(f).then(setImagem); }
    };
    document.addEventListener('paste', colar);
    return () => { document.removeEventListener('paste', colar); };
  }, [setImagem]);

  async function tirarPrint() {
    setFalha('');
    setEscondida(true);
    await new Promise(r => setTimeout(r, 200));
    try { setImagem(await capturarTela()); } catch { setFalha('O print foi cancelado.'); } finally { setEscondida(false); }
  }

  if (escondida) return null;
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div ref={janela} className="pessoal-janela feedback-janela" role="dialog" aria-modal="true" aria-label="Enviar feedback">
        <header className="pessoal-topo">
          <h2>Enviar feedback</h2>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="feedback-corpo">
          <div className="feedback-imagem">
            {vm.imagem ? (
              <>
                <img src={vm.imagem} alt="O print do feedback" />
                <BotaoIcone icone="x" className="feedback-tirar" titulo="Tirar a imagem" onClick={() => vm.setImagem('')} />
              </>
            ) : (
              <div className="feedback-vazio">
                <button type="button" className="btn btn-primary" onClick={() => void tirarPrint()}><Icone nome="monitor" />Tirar print da tela</button>
                <button type="button" className="btn btn-outline" onClick={() => arquivo.current?.click()}><Icone nome="upload" />Escolher imagem</button>
                <span className="hint">ou Ctrl+V</span>
                {falha && <span className="hint">{falha}</span>}
                <CampoArquivo semCaixa semFoco ref={arquivo} aceitar="image/*" onEscolher={f => { if (f) void imagemDoArquivo(f).then(vm.setImagem); }} />
              </div>
            )}
          </div>
          <label className="feedback-texto">
            <span className="hint">O que você quer melhorar?</span>
            <textarea rows={5} value={vm.texto} onChange={e => vm.setTexto(e.target.value)} autoFocus />
          </label>
          {/* os anexos além do print (26/10/2026): um ou mais arquivos; clicou num, ele sai */}
          <div className="feedback-prioridade">
            <span className="hint">Arquivos</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {vm.arquivos.map((f, i) => (
                <button key={f.name + i} type="button" className="btn btn-outline" title={'Tirar ' + f.name} aria-label={'Tirar ' + f.name} onClick={() => vm.tirarArquivo(i)}>
                  <Icone nome="clipe" />{f.name}<Icone nome="x" />
                </button>
              ))}
              <button type="button" className="btn btn-outline" onClick={() => anexos.current?.click()}><Icone nome="clipe" />{vm.arquivos.length ? 'Anexar mais' : 'Anexar arquivos'}</button>
              <CampoArquivo semCaixa semFoco multiplo ref={anexos} aceitar="*/*" onEscolherVarios={fs => { if (fs.length) vm.anexar(fs); }} />
            </div>
          </div>
          {/* a prioridade (19/10/2026), da mais baixa para a mais alta; começa em Média */}
          <div className="feedback-prioridade">
            <span className="hint">Prioridade</span>
            <Segmentado valor={vm.prioridade} onMudar={vm.setPrioridade} opcoes={[...PRIORIDADES].reverse()} />
          </div>
        </div>
        <footer className="usuario-pe">
          {vm.erro && <span className="feedback-erro">{vm.erro}</span>}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <button type="button" className="btn btn-primary" disabled={vm.enviando} onClick={() => void vm.enviar()}>
            {vm.enviando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="envelope" />}Enviar
          </button>
        </footer>
      </div>
    </div>
  );
}
