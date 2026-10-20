// O balão do suporte (Vitor, 20/10/2026: "um balãozinho no canto inferior direito, que o usuário, na tela que tem
// problema, fala o problema"): o botão redondo e, aberto, a conversa guiada por cápsulas, as instruções (Resolveu / Não
// resolveu) e o envio do arquivo ao suporte. As peças são as do app: o botão, a cápsula (badge), o fechar.
import { BotaoFechar, Icone } from '@nads/ui';
import { useId } from 'react';
import type { suporte } from '@nads/core';
import { useBalaoDoSuporte } from './useBalaoDoSuporte';

function Fala({ passo }: { passo: suporte.PassoDoSuporte }) {
  if (passo.tipo === 'pergunta') return <p className="suporte-fala">{passo.texto}</p>;
  if (passo.tipo === 'instrucoes') return <ol className="suporte-passos">{passo.passos.map(p => <li key={p}>{p}</li>)}</ol>;
  return <p className="suporte-fala">{passo.texto}</p>;
}

export function BalaoDoSuporte() {
  const vm = useBalaoDoSuporte();
  const idArquivo = useId();
  if (!vm.aberto) {
    return (
      <button type="button" className="btn btn-primary suporte-botao" title="Suporte: arquivo lido errado ou que travou" aria-label="Abrir o suporte" onClick={vm.abrir}>
        <Icone nome="ajuda" />
      </button>
    );
  }
  const p = vm.passo;
  return (
    <section className="card suporte-balao" role="dialog" aria-label="Suporte">
      <header className="suporte-topo">
        <Icone nome="ajuda" />
        <span className="suporte-titulo"><b>Suporte</b>{vm.titulo && <span className="fraco"> · {vm.titulo}</span>}</span>
        <BotaoFechar onClick={vm.fechar} />
      </header>
      <div className="suporte-corpo">
        {vm.conversa.map((f, i) => (
          <div key={i} className="suporte-troca">
            <Fala passo={f.passo} />
            <span className="badge badge-neutral suporte-eu">{f.escolhida}</span>
          </div>
        ))}
        {vm.enviado ? (
          <p className="suporte-fala">Encaminhado ao suporte. O Vitor ou o Gustavo vão olhar.</p>
        ) : vm.resolvido ? (
          <p className="suporte-fala">Resolvido.</p>
        ) : (
          <>
            <Fala passo={p} />
            {p.tipo === 'pergunta' && (
              <div className="suporte-capsulas">
                {p.opcoes.map(o => <button key={o.id} type="button" className="badge badge-neutral" onClick={() => vm.escolher(o.id)}>{o.rotulo}</button>)}
              </div>
            )}
            {p.tipo === 'instrucoes' && (
              <div className="suporte-capsulas">
                <button type="button" className="badge badge-ok" onClick={vm.resolveu}>Resolveu</button>
                <button type="button" className="badge badge-neutral" onClick={vm.naoResolveu}>Não resolveu</button>
              </div>
            )}
            {p.tipo === 'encaminhar' && (
              <div className="suporte-envio">
                <label htmlFor={idArquivo} className="btn btn-outline"><Icone nome="upload" />{vm.arquivo ? vm.arquivo.name : 'Anexar o arquivo'}</label>
                <input id={idArquivo} type="file" className="sr-only" onChange={e => { vm.setArquivo(e.target.files?.[0] || null); e.target.value = ''; }} />
                <div className="field suporte-frase"><textarea rows={3} placeholder="O que está errado (uma frase)" aria-label="O que está errado" value={vm.frase} onChange={e => vm.setFrase(e.target.value)} /></div>
                {vm.erro && <p className="hint ext-neg">{vm.erro}</p>}
                <button type="button" className="btn btn-primary" disabled={vm.enviando} onClick={vm.enviar}>{vm.enviando ? 'Enviando…' : 'Enviar ao suporte'}</button>
              </div>
            )}
          </>
        )}
      </div>
      {(vm.conversa.length > 0 || vm.resolvido || vm.enviado) && (
        <footer className="suporte-pe"><button type="button" className="btn btn-ghost" onClick={vm.recomecar}>Recomeçar</button></footer>
      )}
    </section>
  );
}
