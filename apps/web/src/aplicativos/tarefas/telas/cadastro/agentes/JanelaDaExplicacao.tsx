// A janela "Como está funcionando" de Cadastro › Agentes (Vitor, 13/10/2026: "quando eu clique, abra uma janela
// flutuante explicando"; depois: "quero essa tela flutuante bem trabalhada… algo bem mais trabalhado"). De cima para
// baixo: o cabeçalho na cor do estado (o projeto, o modelo, a máquina); o que o Claude faz agora, com o tempo correndo;
// o pedido e a régua do porteiro (fácil · normal · difícil, com o modelo de cada um); o caminho do trabalho (você → o
// porteiro → o Claude principal → os ajudantes, cada um na cor do seu modelo); e a linha do tempo dos últimos passos.
// Ao vivo enquanto aberta. Fecha no ×, no Fechar, clicando fora ou no Esc.
import { Icone } from '@nads/ui';
import { useEffect } from 'react';
import type { AgenteExplicado, ExplicacaoDaSessao } from './useAgentesNoPainel';

const NIVEIS = [
  { id: 'rapido', rotulo: 'Fácil', modelo: 'Haiku', tom: 'ok' },
  { id: 'padrao', rotulo: 'Normal', modelo: 'Sonnet', tom: 'info' },
  { id: 'forte', rotulo: 'Difícil', modelo: 'Opus', tom: 'roxo' },
] as const;

function Agente({ a }: { a: AgenteExplicado }) {
  return (
    <li className={'aj-no aj-tom-' + a.tom + (a.status === 'trabalhando' ? ' aj-vivo' : '')}>
      <span className="aj-no-marca" aria-hidden="true">{a.chave === 'principal' ? <Icone nome="robo" /> : a.nome.slice(0, 1).toUpperCase()}</span>
      <div className="aj-no-corpo">
        <div className="aj-no-topo">
          <b>{a.nome}</b>
          <span className="aj-chip">{a.modelo}</span>
          <span className={'badge ' + a.badge}>{a.rotulo}</span>
        </div>
        <span className="aj-no-papel">{a.papel}</span>
        {a.agora ? (
          <span className="aj-no-agora"><Icone nome={a.agora.icone} />{a.agora.verbo}{a.agora.alvo && <code>{a.agora.alvo}</code>}</span>
        ) : a.resposta ? <span className="aj-no-resposta">“{a.resposta}”</span> : null}
      </div>
    </li>
  );
}

export function JanelaDaExplicacao({ e, fechar }: { e: ExplicacaoDaSessao; fechar: () => void }) {
  useEffect(() => {
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape') fechar(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [fechar]);
  const tomDoEstado = e.status === 'trabalhando' ? 'ok' : e.status === 'esperando' ? 'aviso' : 'neutro';
  const subs = e.agentes.filter(a => a.chave !== 'principal');
  const principal = e.agentes.find(a => a.chave === 'principal');
  const nivel = NIVEIS.find(n => n.id === e.nivel);
  return (
    <div className="modal-overlay" role="presentation" onClick={fechar}>
      <div className={'modal aj aj-estado-' + tomDoEstado} role="dialog" aria-modal="true" aria-labelledby="ajTitulo" onClick={ev => ev.stopPropagation()}>
        {/* o cabeçalho, na cor do estado */}
        <header className="aj-topo">
          <div className="aj-topo-linha">
            <span className="aj-topo-icone" aria-hidden="true"><Icone nome="robo" /></span>
            <div className="aj-topo-titulo">
              <span className="aj-sobre">Como está funcionando</span>
              <h3 id="ajTitulo">{e.titulo}</h3>
            </div>
            <button type="button" className="modal-x" aria-label="Fechar" title="Fechar" onClick={fechar} autoFocus><Icone nome="x" /></button>
          </div>
          <div className="aj-topo-meta">
            <span className="aj-estado"><i aria-hidden="true" />{e.rotulo}</span>
            {e.modelo && <span className="aj-chip">{e.modelo}</span>}
            {e.maquina && <span className="aj-chip"><Icone nome="monitor" />{e.maquina}</span>}
            <span className="aj-atualizado"><Icone nome="clock" />{e.atualizado}</span>
          </div>
          <p className="aj-resumo">{e.resumo}</p>
        </header>

        <div className="aj-corpo">
          {/* esperando você, em destaque */}
          {e.status === 'esperando' && e.aviso && (
            <div className="aj-cartao aj-espera">
              <span className="aj-agora-icone" aria-hidden="true"><Icone nome="alert" /></span>
              <div className="aj-agora-texto"><span className="aj-sobre">Precisa de você</span><b>{e.aviso}</b></div>
            </div>
          )}

          {/* o agora */}
          {e.agora ? (
            <div className="aj-cartao aj-agora">
              <span className="aj-agora-icone" aria-hidden="true"><Icone nome={e.agora.icone} /></span>
              <div className="aj-agora-texto">
                <span className="aj-sobre">Agora</span>
                <b>{e.agora.verbo}</b>
                {e.agora.alvo && <code>{e.agora.alvo}</code>}
              </div>
              <span className="aj-agora-tempo">{e.agora.desde}</span>
            </div>
          ) : e.resposta ? (
            <div className="aj-cartao aj-resposta">
              <span className="aj-sobre">A última resposta</span>
              <p>“{e.resposta}”</p>
            </div>
          ) : null}

          {/* o pedido e o porteiro */}
          <div className="aj-grade">
            <section className="aj-cartao">
              <h4><Icone nome="mensagem" />O seu pedido</h4>
              <p className="aj-pedido">{e.pedido ? '“' + e.pedido + '”' : 'Ainda sem pedido nesta sessão.'}</p>
            </section>
            <section className="aj-cartao">
              <h4><Icone nome="scale" />O porteiro</h4>
              <div className="aj-regua" role="img" aria-label={'Nível: ' + (nivel?.rotulo || 'sem nível')}>
                {NIVEIS.map(n => (
                  <span key={n.id} className={'aj-regua-passo aj-tom-' + n.tom + (n.id === e.nivel ? ' aceso' : '')}>
                    <b>{n.rotulo}</b><small>{n.modelo}</small>
                  </span>
                ))}
              </div>
              <p className="aj-nota">{e.porteiro}</p>
            </section>
          </div>

          {/* o caminho do trabalho */}
          <section className="aj-cartao">
            <h4><Icone nome="repeat" />Quem está trabalhando</h4>
            <ol className="aj-fluxo">
              <li className="aj-no aj-tom-neutro">
                <span className="aj-no-marca" aria-hidden="true"><Icone nome="usuario" /></span>
                <div className="aj-no-corpo"><div className="aj-no-topo"><b>Você</b></div><span className="aj-no-papel">fez o pedido</span></div>
              </li>
              <li className={'aj-no aj-tom-' + (nivel?.tom || 'neutro')}>
                <span className="aj-no-marca" aria-hidden="true"><Icone nome="scale" /></span>
                <div className="aj-no-corpo">
                  <div className="aj-no-topo"><b>Porteiro</b>{nivel && <span className="aj-chip">{nivel.rotulo}</span>}</div>
                  <span className="aj-no-papel">classifica o pedido e sugere quem faz</span>
                </div>
              </li>
              {principal && <Agente a={principal} />}
              {subs.map(a => <Agente key={a.chave} a={a} />)}
              {!subs.length && (
                <li className="aj-no aj-tom-neutro aj-no-vazio">
                  <span className="aj-no-marca" aria-hidden="true"><Icone nome="mais" /></span>
                  <div className="aj-no-corpo"><span className="aj-no-papel">nenhum ajudante nesta sessão: o principal está fazendo sozinho</span></div>
                </li>
              )}
            </ol>
          </section>

          {/* a linha do tempo */}
          {e.passos.length > 0 && (
            <section className="aj-cartao">
              <h4><Icone nome="clock" />Os últimos passos</h4>
              <ol className="aj-tempo">
                {e.passos.map((p, i) => (
                  <li key={i} className={p.falhou ? 'falhou' : undefined}>
                    <span className="aj-tempo-ponto" aria-hidden="true"><Icone nome={p.falhou ? 'alert' : p.icone} /></span>
                    <div className="aj-tempo-texto">
                      <b>{p.falhou ? 'Falhou: ' + p.verbo.toLowerCase() : p.verbo}</b>
                      {p.alvo && <code>{p.alvo}</code>}
                    </div>
                    <span className="aj-tempo-hora">{p.hora}{p.dur && <small>{p.dur}</small>}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <footer className="aj-pe">
          <span className="aj-ao-vivo"><i aria-hidden="true" />Atualiza sozinho enquanto está aberta</span>
          <button type="button" className="btn btn-outline" onClick={fechar}>Fechar</button>
        </footer>
      </div>
    </div>
  );
}
