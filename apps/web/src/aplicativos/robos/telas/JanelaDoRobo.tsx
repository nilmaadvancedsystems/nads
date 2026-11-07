// A janela de um robô (clicou no ícone): Visão geral, Registros (o log ao vivo), Ações e Configurações.
import { robos as r } from '@nads/core';
import { useEffect, useRef } from 'react';
import { atividadesDoRobo, comandosDoRobo, type Central, type useAcoes } from '../casca/useCentral';
import { IconeDoRobo } from '../partes/IconeDoRobo';
import { Janela } from '../partes/Janela';
import { useRegistros } from './useRegistros';

export type AbaDoRobo = 'geral' | 'registros' | 'acoes' | 'config';
export const ABAS: { id: AbaDoRobo; nome: string }[] = [
  { id: 'geral', nome: 'Visão geral' }, { id: 'registros', nome: 'Registros' }, { id: 'acoes', nome: 'Ações' }, { id: 'config', nome: 'Configurações' },
];

type Acoes = ReturnType<typeof useAcoes>;

export function Pilula({ tom, children }: { tom: r.Tom; children: React.ReactNode }) {
  return <span className={'cr-pilula ' + tom}><span className="cr-ponto" aria-hidden="true" />{children}</span>;
}

export function AppIcone({ robo, tamanho = 64 }: { robo: r.RoboDaCentral; tamanho?: number }) {
  return (
    <span className="cr-app-icone" style={{ width: tamanho, height: tamanho, background: 'linear-gradient(145deg, ' + robo.cor[0] + ', ' + robo.cor[1] + ')' }} aria-hidden="true">
      <IconeDoRobo nome={robo.icone} tamanho={Math.round(tamanho * 0.46)} />
    </span>
  );
}

export function JanelaDoRobo({ central, s, aba, irPara, aoFechar, acoes }: {
  central: Central; s: r.SituacaoDoRoboNaCentral; aba: AbaDoRobo; irPara: (a: AbaDoRobo) => void; aoFechar: () => void; acoes: Acoes;
}) {
  const maquina = central.maquinas.find(m => m.maquina.id === s.robo.maquina)!;
  return (
    <Janela rotulo={s.robo.nome} aoFechar={aoFechar} larga titulo={
      <div className="cr-cabeca">
        <AppIcone robo={s.robo} tamanho={52} />
        <div className="cr-cabeca-texto">
          <h1>{s.robo.nome}</h1>
          <p>{maquina.maquina.nome} · <Pilula tom={s.tom}>{s.rotulo}</Pilula></p>
        </div>
      </div>
    }>
      <div className="cr-abas" role="tablist" aria-label="Partes do robô">
        {ABAS.map(a => (
          <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={'cr-aba' + (aba === a.id ? ' ativa' : '')} onClick={() => irPara(a.id)}>{a.nome}</button>
        ))}
      </div>
      <div className="cr-aba-corpo" role="tabpanel">
        {aba === 'geral' && <VisaoGeral central={central} s={s} maquina={maquina} />}
        {aba === 'registros' && <Registros robo={s.robo} agora={central.agora} />}
        {aba === 'acoes' && <Acoes central={central} s={s} maquina={maquina} acoes={acoes} />}
        {aba === 'config' && <Configuracoes s={s} maquina={maquina} acoes={acoes} />}
      </div>
    </Janela>
  );
}

function VisaoGeral({ central, s, maquina }: { central: Central; s: r.SituacaoDoRoboNaCentral; maquina: r.SituacaoDaMaquina }) {
  const atividades = atividadesDoRobo(central.atividades, s.robo).slice(0, 6);
  return (
    <div className="cr-pilha">
      {s.motivo && <div className={'cr-aviso ' + s.tom}>{s.motivo}</div>}
      <div className="cr-numeros">
        <div className="cr-numero"><b>{s.fila ? s.fila.esperando : '—'}</b><span>na fila</span></div>
        <div className="cr-numero"><b>{s.fila ? s.fila.andamento : s.agora.length}</b><span>em andamento</span></div>
        <div className={'cr-numero' + (s.errosHoje ? ' ruim' : '')}><b>{s.errosHoje}</b><span>{s.errosHoje === 1 ? 'erro hoje' : 'erros hoje'}</span></div>
      </div>
      <section className="cr-cartao">
        <h2>Agora</h2>
        {s.agora.length ? <ul className="cr-lista">{s.agora.map(t => <li key={t}>{t}</li>)}</ul> : <p className="cr-fraco">Nada em andamento.</p>}
        {s.fila && s.fila.espera && <p className="cr-fraco">O pedido mais antigo está esperando {s.fila.espera.replace(/^há /, 'há ')}.</p>}
      </section>
      <section className="cr-cartao">
        <h2>Último trabalho</h2>
        {s.ultimo ? <Linha a={s.ultimo} agora={central.agora} /> : <p className="cr-fraco">Nada registrado nos últimos dias.</p>}
        {s.ultimoErro && <><h3>Último erro</h3><Linha a={s.ultimoErro} agora={central.agora} /></>}
      </section>
      {atividades.some(a => a.id !== s.ultimo?.id) && (
        <section className="cr-cartao">
          <h2>Atividade recente</h2>
          <ul className="cr-atividades">{atividades.map(a => <li key={a.id}><Linha a={a} agora={central.agora} /></li>)}</ul>
        </section>
      )}
      <section className="cr-cartao">
        <h2>Máquina</h2>
        <dl className="cr-dl">
          <dt>Onde</dt><dd>{maquina.maquina.onde} ({maquina.host})</dd>
          <dt>Sinal</dt><dd><Pilula tom={maquina.tom}>{maquina.rotulo}</Pilula> {maquina.sinal}</dd>
          {maquina.versao && <><dt>Versão</dt><dd>{maquina.versao}</dd></>}
        </dl>
      </section>
    </div>
  );
}

function Linha({ a, agora }: { a: { texto: string; detalhe: string; em: string; erro: boolean }; agora: number }) {
  return (
    <div className={'cr-linha' + (a.erro ? ' erro' : '')}>
      <span className="cr-linha-texto">{a.texto}</span>
      <span className="cr-linha-meta">{r.haQuantoTempo(a.em, agora)}{a.detalhe ? ' · ' + a.detalhe : ''}</span>
    </div>
  );
}

function Registros({ robo, agora }: { robo: r.RoboDaCentral; agora: number }) {
  const v = useRegistros(robo.id, true, agora);
  const caixa = useRef<HTMLDivElement>(null);
  const noFim = useRef(true);
  useEffect(() => {
    const c = caixa.current;
    if (c && noFim.current) c.scrollTop = c.scrollHeight;
  }, [v.linhas.length]);
  return (
    <div className="cr-pilha">
      <div className="cr-registros-barra">
        <span className={'cr-ao-vivo' + (v.aoVivo ? ' sim' : '')}><span className="cr-ponto" aria-hidden="true" />{v.aoVivo ? 'Ao vivo' : v.atualizado ? 'Atualizado ' + v.atualizado : 'Esperando o robô'}</span>
        <label className="cr-chave">
          <input type="checkbox" checked={v.soErros} onChange={e => v.setSoErros(e.target.checked)} />
          <span>Só erros ({v.erros})</span>
        </label>
      </div>
      <div className="cr-terminal" ref={caixa} onScroll={e => { const c = e.currentTarget; noFim.current = c.scrollHeight - c.scrollTop - c.clientHeight < 24; }}
        role="log" aria-live="polite" aria-label={'Registros do ' + robo.nome}>
        {v.linhas.length ? v.linhas.map(l => (
          <div key={l.chave} className={'cr-terminal-linha' + (l.nivel === 'erro' ? ' erro' : '')}>
            <time>{l.hora}</time><span>{l.texto}</span>
          </div>
        )) : <p className="cr-fraco">{v.total ? 'Nenhum erro nas últimas linhas.' : 'O robô ainda não mandou registros. Eles chegam quando a máquina estiver com o código novo e as regras publicadas.'}</p>}
      </div>
      <p className="cr-fraco cr-pequeno">As últimas {r.LINHAS_DO_REGISTRO} linhas do log. Com esta aba aberta, o robô manda a cada 10 s; fechada, a cada 2 min.</p>
    </div>
  );
}

function Acoes({ central, s, maquina, acoes }: { central: Central; s: r.SituacaoDoRoboNaCentral; maquina: r.SituacaoDaMaquina; acoes: Acoes }) {
  const lista = r.acoesDoRobo(s.robo, !!s.pausa);
  const doRobo = lista.filter(a => a.alvo === 'robo');
  const daMaquina = lista.filter(a => a.alvo === 'maquina');
  const comandos = comandosDoRobo(central.comandos, s.robo).slice(0, 8);
  return (
    <div className="cr-pilha">
      {acoes.erro && !acoes.pendente && <p className="cr-erro-linha" role="alert">{acoes.erro}</p>}
      {doRobo.length > 0 && (
        <section className="cr-cartao">
          <h2>Este robô</h2>
          <ul className="cr-acoes">
            {doRobo.flatMap((a): { a: r.AcaoDaCentral; t: r.TarefaDoRobo | null }[] => (a.id === 'rodar-agora' ? s.robo.tarefas.map(t => ({ a, t })) : [{ a, t: null }])).map(({ a, t }) => (
              <li key={a.id + (t ? ':' + t.id : '')} className="cr-acao">
                <div><b>{t ? t.nome : a.nome}</b><span>{a.descricao}</span></div>
                <button type="button" className={'cr-botao' + (a.destrutiva ? ' perigo-leve' : '')} disabled={acoes.enviando}
                  onClick={() => acoes.pedir(a, maquina.maquina, s.robo, t)}>{t ? 'Rodar' : a.nome}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="cr-cartao">
        <h2>A máquina ({maquina.maquina.nome})</h2>
        <ul className="cr-acoes">
          {daMaquina.map(a => {
            const sem = maquina.semGancho.includes(a.id);
            return (
              <li key={a.id} className="cr-acao">
                <div><b>{a.nome}</b><span>{sem ? 'Esta máquina ainda não sabe fazer isso (chega com o código novo do robô).' : a.descricao}</span></div>
                <button type="button" className="cr-botao perigo-leve" disabled={acoes.enviando || sem} onClick={() => acoes.pedir(a, maquina.maquina, s.robo)}>{a.id === 'reiniciar' ? 'Reiniciar' : 'Atualizar'}</button>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="cr-cartao">
        <h2>Pedidos recentes</h2>
        <Historico comandos={comandos} agora={central.agora} />
      </section>
    </div>
  );
}

export function Historico({ comandos, agora }: { comandos: readonly r.Comando[]; agora: number }) {
  if (!comandos.length) return <p className="cr-fraco">Nenhum pedido ainda.</p>;
  return (
    <ul className="cr-historico">
      {comandos.map(c => {
        const sem = r.comandoSemResposta(c, agora);
        return (
          <li key={c.id}>
            <div className="cr-historico-topo">
              <b>{r.textoDoComando(c)}</b>
              <Pilula tom={sem ? 'erro' : r.TOM_DO_STATUS[c.status]}>{sem ? 'Sem resposta' : r.ROTULO_DO_STATUS[c.status]}</Pilula>
            </div>
            <span className="cr-linha-meta">{c.porNome || 'alguém'} · {r.haQuantoTempo(c.em, agora)}{c.mensagem ? ' · ' + c.mensagem : ''}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Configuracoes({ s, maquina, acoes }: { s: r.SituacaoDoRoboNaCentral; maquina: r.SituacaoDaMaquina; acoes: Acoes }) {
  const pausar = r.acaoPorId(s.pausa ? 'retomar' : 'pausar')!;
  return (
    <div className="cr-pilha">
      {s.robo.pausavel && (
        <section className="cr-cartao">
          <div className="cr-acao">
            <div><b>Pausado</b><span>{s.pausa ? 'Pausado por ' + (s.pausa.por || 'alguém') + '. Retome para voltar a pegar trabalho.' : 'Pausado, o robô não pega trabalho novo.'}</span></div>
            <button type="button" role="switch" aria-checked={!!s.pausa} aria-label="Pausado" className={'cr-interruptor' + (s.pausa ? ' ligado' : '')} disabled={acoes.enviando}
              onClick={() => acoes.pedir(pausar, maquina.maquina, s.robo)}><span /></button>
          </div>
        </section>
      )}
      <section className="cr-cartao">
        <h2>Sobre</h2>
        <p className="cr-fraco">{s.robo.descricao}</p>
        <dl className="cr-dl">
          <dt>Máquina</dt><dd>{maquina.maquina.nome} ({maquina.host})</dd>
          <dt>Fila</dt><dd>{s.robo.fila || 'sem fila'}</dd>
          <dt>No log</dt><dd>{s.robo.tags.map(t => (t ? '[' + t + ']' : 'linhas sem marca')).join(', ')}</dd>
          <dt>Tarefas</dt><dd>{s.robo.tarefas.map(t => t.nome).join(', ') || 'nenhuma para rodar à mão'}</dd>
        </dl>
      </section>
      <p className="cr-fraco cr-pequeno">Os ajustes do trabalho de cada robô (regras do arquivador, empresas do SIEG, horários) continuam no nads. Daqui só saem as ações da lista fechada.</p>
    </div>
  );
}
