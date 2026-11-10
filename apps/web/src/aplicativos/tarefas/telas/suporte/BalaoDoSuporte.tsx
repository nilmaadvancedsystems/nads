// O balão do suporte (Vitor, 20/10/2026: "um balãozinho no canto inferior direito, que o usuário, na tela que tem
// problema, fala o problema"), em forma de chat (21/10/2026: "faz em sistema de chat temporário, que depois de 1 dia é
// excluído"; "coloca uma animação, digitando, coloca o nome do usuário, deixe mais intuitivo"): o suporte cumprimenta pelo
// nome, "digita" antes de cada fala, as respostas da pessoa ficam à direita, as cápsulas são respostas rápidas (nas
// perguntas de várias respostas, marca e toca em Continuar) e o envio do arquivo fica no pé. As peças são as do app: o
// botão, a cápsula (badge), o fechar e o ícone.
import { Icone } from '@nads/ui';
import { useEffect, useId, useRef, useState } from 'react';
import { suporte } from '@nads/core';
import { useBalaoDoSuporte } from './useBalaoDoSuporte';

/** O tempo do "digitando" antes de cada fala do suporte. */
const DIGITANDO_MS = 650;

/** Uma fala do suporte (onde a pessoa está, a pergunta, as instruções numeradas ou o pedido do arquivo). */
function FalaDoSuporte({ passo }: { passo: suporte.PassoDoSuporte }) {
  const aviso = passo.aviso;
  return (
    <>
      {aviso && <div className="suporte-msg">{aviso}</div>}
      <div className="suporte-msg">
        {passo.tipo === 'instrucoes'
          ? <><span className="suporte-msg-titulo">Faça assim:</span><ol className="suporte-passos">{passo.passos.map(p => <li key={p}>{p}</li>)}</ol></>
          : passo.tipo === 'pergunta' && passo.multipla ? <>{passo.texto}<span className="suporte-msg-dica">Pode marcar mais de um.</span></> : passo.texto}
      </div>
    </>
  );
}

type Ticket = ReturnType<typeof useBalaoDoSuporte>['tickets'][number];

/** O ticket no chat (09/11/2026): o que a pessoa pediu, a barra de andamento, a resposta pronta e, em Testando, a confirmação. */
function TicketNoChat({ t, responder }: { t: Ticket; responder: (funcionou: boolean) => void }) {
  return (
    <div className="suporte-troca">
      <div className="suporte-msg suporte-eu suporte-pedido">{t.resumo}</div>
      <div className="suporte-ticket">
        <b className="suporte-ticket-numero">{t.pedido}</b>
        <ol className="suporte-progresso" aria-label="Andamento do pedido">
          {t.etapas.map(e => <li key={e.rotulo} className={e.estado} aria-current={e.estado === 'atual' ? 'step' : undefined}><span aria-hidden="true" />{e.rotulo}</li>)}
        </ol>
        <p>{t.fala}</p>
        {t.testando && (
          <div className="suporte-capsulas">
            <button type="button" className="badge badge-ok" onClick={() => responder(true)}><Icone nome="check" />Funcionou</button>
            <button type="button" className="badge badge-neutral" onClick={() => responder(false)}>Ainda com problema</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Os três pontinhos do "digitando". */
function Digitando() {
  return <div className="suporte-msg suporte-digitando" aria-label="Suporte digitando"><span /><span /><span /></div>;
}

export function BalaoDoSuporte() {
  const vm = useBalaoDoSuporte();
  const idArquivo = useId();
  const corpo = useRef<HTMLDivElement>(null);
  // a cada resposta (e ao abrir), o suporte "digita" um instante antes de falar
  const tamanho = vm.conversa.length + (vm.resolvido ? 1 : 0) + vm.tickets.length;
  const [digitando, setDigitando] = useState(false);
  useEffect(() => {
    if (!vm.aberto) return;
    setDigitando(true);
    const t = setTimeout(() => setDigitando(false), DIGITANDO_MS);
    return () => clearTimeout(t);
  }, [tamanho, vm.aberto]);
  // a última fala sempre à vista, como num chat
  useEffect(() => { const c = corpo.current; if (c) c.scrollTop = c.scrollHeight; }, [tamanho, vm.aberto, digitando]);
  // o Ctrl+V do print em qualquer ponto da página; o que vem com texto (o Excel manda texto e imagem) cola como texto
  const { podeColar, colarImagens } = vm;
  useEffect(() => {
    if (!podeColar) return;
    const colou = (ev: ClipboardEvent) => {
      const d = ev.clipboardData;
      if (!d || d.getData('text/plain').trim()) return;
      const imagens = Array.from(d.files).filter(f => f.type.startsWith('image/'));
      if (!imagens.length) return;
      ev.preventDefault();
      colarImagens(imagens);
    };
    document.addEventListener('paste', colou);
    return () => document.removeEventListener('paste', colou);
  }, [podeColar, colarImagens]);

  // o botão fica sempre no canto (Vitor, 21/10/2026: "deixe o botão de suporte como aberto"): aberto, o chat fica apoiado logo
  // acima dele. Com ticket em aberto ele só oculta, com a setinha (09/11/2026: "até o feedback for resolvido")
  const fecha = vm.emAberto > 0 ? 'Ocultar o suporte' : 'Fechar o suporte';
  const botao = (
    <button type="button" className="btn btn-primary suporte-botao" aria-expanded={vm.aberto}
      title={vm.aberto ? fecha : vm.paraTestar ? 'Suporte: tem pedido para você testar' : 'Suporte: arquivo lido errado ou que travou'} aria-label={vm.aberto ? fecha : 'Abrir o suporte'}
      onClick={vm.aberto ? vm.fechar : vm.abrir}>
      <Icone nome={vm.aberto ? (vm.emAberto > 0 ? 'chevronDown' : 'x') : 'mensagem'} />
      {!vm.aberto && vm.emAberto > 0 && <span className={'suporte-botao-qtd' + (vm.paraTestar ? ' testar' : '')} aria-hidden="true">{vm.emAberto}</span>}
    </button>
  );
  if (!vm.aberto) return botao;
  const p = vm.passo;
  return (
    <>
      {botao}
      <section className="card suporte-balao" role="dialog" aria-label="Suporte">
        {/* sem o "Suporte / digitando…" (Vitor, 09/11/2026): a barra de cima só existe na conversa, com as ações dela */}
        {vm.conversando && (
          <div className="suporte-topo">
            {vm.tickets.length > 0 && <button type="button" className="btn btn-ghost suporte-acao" onClick={vm.voltarAosTickets}>Voltar aos pedidos</button>}
            {!vm.tickets.length && <button type="button" className="btn btn-ghost suporte-acao" title="Começar uma conversa nova" onClick={vm.novaConversa}>Nova conversa</button>}
            {!vm.tickets.length && <button type="button" className="btn btn-ghost suporte-acao" title="Abandonar a conversa e fechar" onClick={vm.sair}>Sair</button>}
          </div>
        )}

        <div className="suporte-corpo" ref={corpo}>
          <div className="suporte-msg">
            {vm.nomeDaPessoa ? 'Oi, ' + vm.nomeDaPessoa + '!' : 'Oi!'} {vm.tickets.length ? 'Aqui ficam os seus pedidos até serem resolvidos.' : 'Me diga o que aconteceu que eu te guio.'}
          </div>
          {vm.tickets.map(t => <TicketNoChat key={t.id} t={t} responder={funcionou => vm.responderTeste(t.id, funcionou)} />)}
          {vm.erro && !vm.conversando && <p className="hint ext-neg">{vm.erro}</p>}
          {!vm.conversando && (
            <div className="suporte-capsulas">
              <button type="button" className="badge badge-neutral" onClick={vm.abrirOutro}><Icone nome="plus" />Abrir outro ticket</button>
            </div>
          )}
          {vm.conversando && vm.conversa.map((f, i) => (
            <div key={i} className="suporte-troca">
              <FalaDoSuporte passo={f.passo} />
              <div className="suporte-msg suporte-eu">{f.escolhida}</div>
            </div>
          ))}
          {!vm.conversando ? null : vm.resolvido ? (
            <>
              <div className="suporte-msg suporte-eu">Resolveu</div>
              {digitando ? <Digitando /> : <div className="suporte-msg">Que bom! Se precisar, é só chamar.</div>}
            </>
          ) : digitando ? <Digitando /> : (
            <>
              <FalaDoSuporte passo={p} />
              {p.tipo === 'pergunta' && (
                <div className="suporte-capsulas">
                  {p.opcoes.map(o => {
                    // na pergunta de várias, marca e desmarca; o "Todos" e o "Outro" respondem na hora
                    const direta = !p.multipla || o.id.endsWith(':' + suporte.TODOS) || o.id.endsWith(':' + suporte.OUTRO);
                    const marcada = vm.marcadas.includes(o.id);
                    return (
                      <button key={o.id} type="button" className={'badge ' + (marcada ? 'badge-ok' : 'badge-neutral')} aria-pressed={direta ? undefined : marcada}
                        onClick={() => (direta ? vm.escolher(o.id) : vm.marcar(o.id))}>
                        {marcada && <Icone nome="check" />}{o.rotulo}
                      </button>
                    );
                  })}
                  {p.multipla && vm.marcadas.length > 0 && (
                    <button type="button" className="btn btn-primary suporte-continuar" onClick={vm.confirmar}>Continuar</button>
                  )}
                </div>
              )}
              {p.tipo === 'instrucoes' && (
                <div className="suporte-capsulas">
                  <button type="button" className="badge badge-ok" onClick={vm.resolveu}><Icone nome="check" />Resolveu</button>
                  <button type="button" className="badge badge-neutral" onClick={vm.naoResolveu}>Não resolveu</button>
                </div>
              )}
            </>
          )}
        </div>

        {vm.conversando && p.tipo === 'encaminhar' && !vm.resolvido && !digitando && (
          <div className="suporte-envio">
            {vm.erro && <p className="hint ext-neg">{vm.erro}</p>}
            <div className="field suporte-frase">
              <textarea rows={p.livre ? 4 : 2} placeholder={p.livre ? 'Escreva o que aconteceu' : 'Comentário (opcional)'} aria-label={p.livre ? 'O que aconteceu' : 'Comentário'} value={vm.frase} onChange={e => vm.setFrase(e.target.value)} />
            </div>
            {/* os anexados (Vitor, 26/10/2026: "só tá dando para anexar somente 1"): clicou num, ele sai */}
            {vm.arquivos.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {vm.arquivos.map((f, i) => (
                  <button key={f.name + i} type="button" className="btn btn-outline" title={'Tirar ' + f.name} aria-label={'Tirar ' + f.name} onClick={() => vm.tirarArquivo(i)}>
                    <Icone nome="clipe" /><span className="suporte-arquivo">{f.name}</span><Icone nome="x" />
                  </button>
                ))}
              </div>
            )}
            <div className="suporte-envio-linha">
              <label htmlFor={idArquivo} className="btn btn-outline" title="Anexar um ou mais arquivos">
                <Icone nome="clipe" />{vm.arquivos.length ? 'Anexar mais' : 'Anexar arquivos'}
              </label>
              <input id={idArquivo} type="file" multiple className="sr-only" onChange={e => { vm.anexar(Array.from(e.target.files || [])); e.target.value = ''; }} />
              <button type="button" className="btn btn-outline" title="Colar o print copiado (ou aperte Ctrl+V)" onClick={vm.colarPrint}><Icone nome="imagem" />Colar print</button>
              <button type="button" className="btn btn-primary" disabled={vm.enviando} onClick={vm.enviar}>{vm.enviando ? 'Enviando…' : 'Enviar'}</button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
