// O balão do suporte (Vitor, 20/10/2026: "um balãozinho no canto inferior direito, que o usuário, na tela que tem
// problema, fala o problema"), em forma de chat (21/10/2026: "faz em sistema de chat temporário, que depois de 1 dia é
// excluído"): as falas do suporte à esquerda, as respostas da pessoa à direita, as cápsulas como respostas rápidas embaixo
// da última fala, e o envio do arquivo no pé. As peças são as do app: o botão, a cápsula (badge), o fechar e o ícone.
import { BotaoFechar, Icone } from '@nads/ui';
import { useEffect, useId, useRef } from 'react';
import type { suporte } from '@nads/core';
import { useBalaoDoSuporte } from './useBalaoDoSuporte';

/** Uma fala do suporte (a pergunta, as instruções numeradas ou o pedido do arquivo). */
function FalaDoSuporte({ passo }: { passo: suporte.PassoDoSuporte }) {
  return (
    <div className="suporte-msg">
      {passo.tipo === 'instrucoes'
        ? <ol className="suporte-passos">{passo.passos.map(p => <li key={p}>{p}</li>)}</ol>
        : passo.texto}
    </div>
  );
}

export function BalaoDoSuporte() {
  const vm = useBalaoDoSuporte();
  const idArquivo = useId();
  const corpo = useRef<HTMLDivElement>(null);
  // a última fala sempre à vista, como num chat
  const tamanho = vm.conversa.length + (vm.resolvido ? 1 : 0) + (vm.enviado ? 1 : 0);
  useEffect(() => { const c = corpo.current; if (c) c.scrollTop = c.scrollHeight; }, [tamanho, vm.aberto]);

  if (!vm.aberto) {
    return (
      <button type="button" className="btn btn-primary suporte-botao" title="Suporte: arquivo lido errado ou que travou" aria-label="Abrir o suporte" onClick={vm.abrir}>
        <Icone nome="mensagem" />
      </button>
    );
  }
  const p = vm.passo;
  return (
    <section className="card suporte-balao" role="dialog" aria-label="Suporte">
      <header className="suporte-topo">
        <span className="suporte-avatar"><Icone nome="ajuda" /></span>
        <span className="suporte-titulo">
          <b>Suporte</b>
          {vm.titulo && <span className="suporte-sub">{vm.titulo}</span>}
        </span>
        <BotaoFechar onClick={vm.fechar} />
      </header>

      <div className="suporte-corpo" ref={corpo}>
        {vm.conversa.map((f, i) => (
          <div key={i} className="suporte-troca">
            <FalaDoSuporte passo={f.passo} />
            <div className="suporte-msg suporte-eu">{f.escolhida}</div>
          </div>
        ))}
        {vm.enviado ? (
          <div className="suporte-msg">Encaminhado ao suporte. O Vitor ou o Gustavo vão olhar.</div>
        ) : vm.resolvido ? (
          <>
            <div className="suporte-msg suporte-eu">Resolveu</div>
            <div className="suporte-msg">Ótimo.</div>
          </>
        ) : (
          <>
            <FalaDoSuporte passo={p} />
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
          </>
        )}
      </div>

      {p.tipo === 'encaminhar' && !vm.enviado && !vm.resolvido && (
        <div className="suporte-envio">
          {vm.erro && <p className="hint ext-neg">{vm.erro}</p>}
          <div className="field suporte-frase">
            <textarea rows={2} placeholder="O que está errado (uma frase)" aria-label="O que está errado" value={vm.frase} onChange={e => vm.setFrase(e.target.value)} />
          </div>
          <div className="suporte-envio-linha">
            <label htmlFor={idArquivo} className="btn btn-outline" title={vm.arquivo ? vm.arquivo.name : 'Anexar o arquivo'}>
              <Icone nome="clipe" />{vm.arquivo ? <span className="suporte-arquivo">{vm.arquivo.name}</span> : 'Anexar'}
            </label>
            <input id={idArquivo} type="file" className="sr-only" onChange={e => { vm.setArquivo(e.target.files?.[0] || null); e.target.value = ''; }} />
            <button type="button" className="btn btn-primary" disabled={vm.enviando} onClick={vm.enviar}>{vm.enviando ? 'Enviando…' : 'Enviar'}</button>
          </div>
        </div>
      )}

      <footer className="suporte-pe">
        <span className="hint">A conversa some em 1 dia</span>
        {(vm.conversa.length > 0 || vm.resolvido || vm.enviado) && <button type="button" className="btn btn-ghost" onClick={vm.recomecar}>Nova conversa</button>}
      </footer>
    </section>
  );
}
