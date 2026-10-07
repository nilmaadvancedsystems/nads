// A janela "Enviar feedback": o print (Tirar print da tela, Escolher imagem ou Ctrl+V) e o que melhorar. Ao tirar o
// print, a janela some por um instante para não sair na foto.
import { Icone } from '@nads/ui';
import { useEffect, useRef, useState } from 'react';
import { capturarTela, imagemDoArquivo } from './capturaDeTela';
import { useEnviarFeedback } from './useEnviarFeedback';

export function JanelaDeFeedback({ fechar }: { fechar: () => void }) {
  const vm = useEnviarFeedback(fechar);
  const [escondida, setEscondida] = useState(false);
  const [falha, setFalha] = useState('');
  const arquivo = useRef<HTMLInputElement>(null);
  const { setImagem } = vm;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    // colar uma imagem (Ctrl+V) vira o print
    const colar = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
      const f = item?.getAsFile();
      if (f) { e.preventDefault(); void imagemDoArquivo(f).then(setImagem); }
    };
    document.addEventListener('keydown', esc);
    document.addEventListener('paste', colar);
    return () => { document.removeEventListener('keydown', esc); document.removeEventListener('paste', colar); };
  }, [fechar, setImagem]);

  async function tirarPrint() {
    setFalha('');
    setEscondida(true);
    await new Promise(r => setTimeout(r, 200));
    try { setImagem(await capturarTela()); } catch { setFalha('O print foi cancelado.'); } finally { setEscondida(false); }
  }

  if (escondida) return null;
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="pessoal-janela feedback-janela" role="dialog" aria-modal="true" aria-label="Enviar feedback">
        <header className="pessoal-topo">
          <h2>Enviar feedback</h2>
          <button type="button" className="drawer-x" aria-label="Fechar" onClick={fechar}><Icone nome="x" /></button>
        </header>
        <div className="feedback-corpo">
          <div className="feedback-imagem">
            {vm.imagem ? (
              <>
                <img src={vm.imagem} alt="O print do feedback" />
                <button type="button" className="icon-btn feedback-tirar" title="Tirar a imagem" aria-label="Tirar a imagem" onClick={() => vm.setImagem('')}><Icone nome="x" /></button>
              </>
            ) : (
              <div className="feedback-vazio">
                <button type="button" className="btn btn-primary" onClick={() => void tirarPrint()}><Icone nome="monitor" />Tirar print da tela</button>
                <button type="button" className="btn btn-outline" onClick={() => arquivo.current?.click()}><Icone nome="upload" />Escolher imagem</button>
                <span className="hint">ou Ctrl+V</span>
                {falha && <span className="hint">{falha}</span>}
                <input ref={arquivo} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) void imagemDoArquivo(f).then(vm.setImagem); e.target.value = ''; }} />
              </div>
            )}
          </div>
          <label className="feedback-texto">
            <span className="hint">O que você quer melhorar?</span>
            <textarea rows={5} value={vm.texto} onChange={e => vm.setTexto(e.target.value)} autoFocus />
          </label>
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
