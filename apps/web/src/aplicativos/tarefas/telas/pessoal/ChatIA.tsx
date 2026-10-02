// View do chat com a IA do escritório (a Minha página › Perguntar à IA): a mesma conversa do "Perguntar à IA" do
// Entregas — quem responde é o robô (o Claude no PC do escritório ou o Gemini na nuvem), que conhece o Entregas, a
// Tarefas (as Perguntas frequentes estão no guia dele) e consulta os dados do escritório.
import { Icone } from '@nads/ui';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { FAQ } from '../../ajuda/faq';
import { useChatIA } from './useChatIA';

/** Negrito (**assim**) dentro de uma linha. */
function Linha({ t }: { t: string }) {
  const partes = t.split(/(\*\*[^*]+\*\*)/g);
  return <>{partes.map((p, i) => (p.startsWith('**') && p.endsWith('**') && p.length > 4 ? <b key={i}>{p.slice(2, -2)}</b> : p))}</>;
}

/** O texto da IA (ou do FAQ) com o markdown simples que ela usa: parágrafos, listas (- ou 1.), títulos (#) e negrito. */
export function TextoIA({ texto }: { texto: string }) {
  const blocos: ReactNode[] = [];
  let lista: { ordenada: boolean; itens: string[] } | null = null;
  let paragrafo: string[] = [];
  const fecharParagrafo = () => {
    if (paragrafo.length) blocos.push(<p key={blocos.length}>{paragrafo.map((l, i) => <span key={i}>{i > 0 && <br />}<Linha t={l} /></span>)}</p>);
    paragrafo = [];
  };
  const fecharLista = () => {
    if (lista) {
      const itens = lista.itens.map((l, i) => <li key={i}><Linha t={l} /></li>);
      blocos.push(lista.ordenada ? <ol key={blocos.length}>{itens}</ol> : <ul key={blocos.length}>{itens}</ul>);
    }
    lista = null;
  };
  for (const bruta of texto.replace(/\r\n/g, '\n').split('\n')) {
    const l = bruta.trim();
    const marcador = /^[-*•]\s+(.*)$/.exec(l);
    const numero = /^\d+[.)]\s+(.*)$/.exec(l);
    if (marcador || numero) {
      fecharParagrafo();
      const ordenada = !!numero;
      if (!lista || lista.ordenada !== ordenada) { fecharLista(); lista = { ordenada, itens: [] }; }
      lista.itens.push((marcador || numero)![1]);
    } else if (!l) {
      fecharParagrafo(); fecharLista();
    } else if (/^#{1,6}\s/.test(l)) {
      fecharParagrafo(); fecharLista();
      blocos.push(<p key={blocos.length}><b>{l.replace(/^#+\s*/, '')}</b></p>);
    } else {
      fecharLista();
      paragrafo.push(l);
    }
  }
  fecharParagrafo(); fecharLista();
  return <div className="ia-texto">{blocos}</div>;
}

/** Algumas perguntas para começar: a primeira de cada seção do FAQ. */
const SUGESTOES = FAQ.filter((f, i) => i === 0 || FAQ[i - 1].secao !== f.secao).slice(0, 4).map(f => f.pergunta);

export function ChatIA({ rascunho, limparRascunho, irParaFaq }: { rascunho: string; limparRascunho: () => void; irParaFaq: () => void }) {
  const vm = useChatIA();
  const [texto, setTexto] = useState('');
  const lista = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const { nova } = vm;

  // veio das Perguntas frequentes ("Perguntar à IA"): uma conversa nova com a pergunta já escrita
  useEffect(() => {
    if (!rascunho) return;
    nova();
    setTexto(rascunho.trim() ? rascunho : '');
    limparRascunho();
    campo.current?.focus();
  }, [rascunho, limparRascunho, nova]);

  // a conversa desce sozinha conforme a resposta chega
  const ultima = vm.mensagens[vm.mensagens.length - 1];
  useEffect(() => {
    const el = lista.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [vm.mensagens.length, ultima?.texto, ultima?.consultando]);

  const desligada = !vm.carregando && !vm.ligada;
  const enviar = (t: string) => {
    if (desligada) return;
    void vm.perguntar(t).then(ok => { if (ok) setTexto(''); });
  };

  return (
    <div className="ia-chat">
      <div className="ia-barra">
        <button type="button" className="btn btn-outline" onClick={() => { vm.nova(); setTexto(''); campo.current?.focus(); }}><Icone nome="plus" />Nova conversa</button>
        {vm.conversas.length > 0 && (
          <select className="pessoal-select ia-conversas" aria-label="Conversas anteriores" value={vm.conversa || ''}
            onChange={ev => (ev.target.value ? vm.abrir(ev.target.value) : vm.nova())}>
            <option value="">Conversas anteriores ({vm.conversas.length})</option>
            {vm.conversas.map(c => <option key={c.id} value={c.id}>{c.titulo}</option>)}
          </select>
        )}
        {vm.conversa && (
          <button type="button" className="icon-btn" title="Apagar esta conversa" aria-label="Apagar esta conversa" onClick={() => vm.apagar(vm.conversa!)}><Icone nome="x" /></button>
        )}
        <span className={'ia-estado fraco' + (desligada ? ' desligada' : '')}>
          {vm.carregando ? 'Vendo se a IA está de pé…' : vm.ligada ? 'IA ligada' + (vm.motor ? ' (' + vm.motor + ')' : '') : 'IA desligada agora'}
        </span>
      </div>

      <div className="ia-mensagens" ref={lista} aria-live="polite">
        {!vm.mensagens.length ? (
          <div className="ia-boas-vindas">
            <Icone nome="robo" />
            <h4>Pergunte à IA do escritório</h4>
            <p className="fraco">Como usar a Tarefas e o Entregas, onde está um documento, o andamento de uma empresa… É a mesma IA do "Perguntar à IA" do Entregas, e as conversas aparecem nos dois.</p>
            {desligada && <p className="ia-aviso">A IA está desligada agora (o robô que responde não está de pé). Enquanto isso, veja as <button type="button" className="link-btn" onClick={irParaFaq}>Perguntas frequentes</button>.</p>}
            <div className="ia-sugestoes">
              {SUGESTOES.map(s => <button key={s} type="button" className="chip-f" disabled={desligada || vm.esperando} onClick={() => enviar(s)}>{s}</button>)}
            </div>
          </div>
        ) : vm.mensagens.map(m => (
          <div key={m.id} className={'ia-msg ' + (m.papel === 'user' ? 'eu' : 'ia') + (m.estado === 'erro' ? ' erro' : '')}>
            {m.papel === 'user' ? <TextoIA texto={m.texto} /> : (
              <>
                {m.texto ? <TextoIA texto={m.texto} /> : m.estado !== 'erro' && (
                  <p className="fraco ia-pensando"><span className="btn-spinner" aria-hidden="true" />{m.consultando ? 'Consultando ' + m.consultando + '…' : 'Pensando…'}</p>
                )}
                {m.texto && m.estado === 'gerando' && m.consultando && <p className="fraco ia-pensando"><span className="btn-spinner" aria-hidden="true" />Consultando {m.consultando}…</p>}
                {m.estado === 'erro' && <p className="ia-aviso">Não consegui responder{m.erro ? ' (' + m.erro + ')' : ''}. Tente de novo.</p>}
                {m.temAcoes && <p className="fraco">A IA sugeriu uma ação (salvar, mandar, mudar algo): confirme pelo "Perguntar à IA" do Entregas — a Tarefas ainda não executa ações.</p>}
              </>
            )}
          </div>
        ))}
        {vm.esperando && ultima?.papel === 'user' && !vm.semResposta && (
          <div className="ia-msg ia"><p className="fraco ia-pensando"><span className="btn-spinner" aria-hidden="true" />Esperando a IA…</p></div>
        )}
        {vm.semResposta && <p className="ia-aviso">A IA não respondeu em 2 minutos: ela pode estar desligada. Tente de novo daqui a pouco, ou veja as <button type="button" className="link-btn" onClick={irParaFaq}>Perguntas frequentes</button>.</p>}
      </div>

      <form className="ia-pergunta" onSubmit={ev => { ev.preventDefault(); enviar(texto); }}>
        <textarea ref={campo} rows={2} value={texto} onChange={ev => setTexto(ev.target.value)} disabled={desligada}
          placeholder={desligada ? 'A IA está desligada agora' : 'Escreva a sua pergunta… (Enter manda; Shift+Enter quebra a linha)'} aria-label="Pergunta para a IA"
          onKeyDown={ev => { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); enviar(texto); } }} />
        <button type="submit" className="btn btn-primary" disabled={desligada || vm.esperando || !texto.trim()}>Perguntar</button>
      </form>
    </div>
  );
}
