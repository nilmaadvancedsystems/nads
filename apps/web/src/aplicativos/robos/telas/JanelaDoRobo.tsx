// A ficha de um robô (clicou no ícone): Visão geral, Registros (o log ao vivo), Ações e Configurações.
import { robos as r } from '@nads/core';
import { useEffect, useRef } from 'react';
import { atividadesDoRobo, comandosDoRobo, type Central, type useAcoes } from '../casca/useCentral';
import { IconeDoRobo } from '../partes/IconeDoRobo';
import { Janela } from '../partes/Janela';
import { urlDoLogo } from '../partes/logos';
import { useRegistros } from './useRegistros';

export type AbaDoRobo = 'geral' | 'registros' | 'acoes' | 'config';
export const ABAS: { id: AbaDoRobo; nome: string }[] = [
  { id: 'geral', nome: 'Visão geral' }, { id: 'registros', nome: 'Registros' }, { id: 'acoes', nome: 'Ações' }, { id: 'config', nome: 'Configurações' },
];

type Acoes = ReturnType<typeof useAcoes>;

/** A palavra do estado (Trabalhando, Atrasada, Parado…): cinza quando está tudo bem, cor só quando pede atenção. */
export function Estado({ tom, children, forte = false }: { tom: r.Tom; children: React.ReactNode; /** o "ok" em verde (Feito) */ forte?: boolean }) {
  const classe = tom === 'erro' ? (children === 'Parado' || children === 'Parada' ? ' parado' : ' erro') : tom === 'aviso' ? ' aviso' : tom === 'ok' && forte ? ' ok-forte' : '';
  return <span className={'cr-estado' + classe}>{children}</span>;
}

/**
 * O ícone de app do robô, como nos lançadores (Umbrel, Homarr): o mesmo quadrado claro para todos e, no meio, o símbolo
 * do serviço com que ele trabalha (SIEG, FGTS Digital, Alterdata, Gmail, NFS-e) nas cores originais; os robôs nossos
 * (e a SEFAZ, sem logo bom) levam o desenho próprio na cor do robô.
 */
export function AppIcone({ robo, tamanho, children }: { robo: r.RoboDaCentral; /** em px; sem ele, o tamanho da grade (--cr-tile) */ tamanho?: number; children?: React.ReactNode }) {
  const lado = tamanho ?? 'var(--cr-tile)';
  const logo = urlDoLogo(robo.logo);
  const glifo = tamanho ? Math.round(tamanho * (logo ? 0.62 : 0.48)) : logo ? 36 : 28;
  return (
    <span className={'cr-app-icone' + (logo ? ' com-logo' : '')} style={{ width: lado, height: lado, color: robo.cor[1] }} aria-hidden="true">
      {logo ? <img className="cr-app-glifo" src={logo} alt="" width={glifo} height={glifo} draggable={false} />
        : <IconeDoRobo nome={robo.icone} tamanho={glifo} traco={2} className="cr-app-glifo" />}
      {children}
    </span>
  );
}

export function JanelaDoRobo({ central, s, aba, irPara, aoFechar, acoes }: {
  central: Central; s: r.SituacaoDoRoboNaCentral; aba: AbaDoRobo; irPara: (a: AbaDoRobo) => void; aoFechar: () => void; acoes: Acoes;
}) {
  const maquina = central.maquinas.find(m => m.maquina.id === s.robo.maquina)!;
  return (
    <Janela rotulo={s.robo.nome} aoFechar={aoFechar}
      titulo={
        <div className="cr-cabeca">
          <AppIcone robo={s.robo} tamanho={44} />
          <div className="cr-cabeca-texto">
            <h1>{s.robo.nome}</h1>
            <p><span><Estado tom={s.tom}>{s.pausa ? 'Pausado' : s.rotulo}</Estado> {maquina.maquina.em}</span></p>
          </div>
        </div>
      }
      abas={
        <div className="cr-abas" role="tablist" aria-label="Partes do robô">
          {ABAS.map(a => (
            <button key={a.id} type="button" role="tab" aria-selected={aba === a.id} className={'cr-aba' + (aba === a.id ? ' ativa' : '')} onClick={() => irPara(a.id)}>{a.nome}</button>
          ))}
        </div>
      }>
      <div role="tabpanel">
        {aba === 'geral' && <VisaoGeral central={central} s={s} maquina={maquina} />}
        {aba === 'registros' && <Registros robo={s.robo} agora={central.agora} />}
        {aba === 'acoes' && <Acoes central={central} s={s} maquina={maquina} acoes={acoes} />}
        {aba === 'config' && <Configuracoes s={s} maquina={maquina} acoes={acoes} />}
      </div>
    </Janela>
  );
}

function Numero({ valor, rotulo, ruim = false }: { valor: number | null; rotulo: string; ruim?: boolean }) {
  const classe = !valor ? ' zero' : ruim ? ' ruim' : '';
  return <div className={'cr-numero' + classe}><b>{valor ?? '—'}</b><span>{rotulo}</span></div>;
}

function VisaoGeral({ central, s, maquina }: { central: Central; s: r.SituacaoDoRoboNaCentral; maquina: r.SituacaoDaMaquina }) {
  const antes = atividadesDoRobo(central.atividades, s.robo).filter(a => a.id !== s.ultimo?.id && a.id !== s.ultimoErro?.id).slice(0, 5);
  return (
    <div>
      {s.motivo && <p className={'cr-aviso ' + s.tom} style={{ marginBottom: 16 }}>{s.motivo}</p>}
      <div className="cr-numeros">
        <Numero valor={s.fila ? s.fila.esperando : null} rotulo="na fila" />
        <Numero valor={s.fila ? s.fila.andamento : s.agora.length} rotulo="em andamento" />
        <Numero valor={s.errosHoje} rotulo={s.errosHoje === 1 ? 'erro hoje' : 'erros hoje'} ruim />
      </div>
      <section className="cr-secao">
        <h2>Agora</h2>
        {s.agora.length ? <ul className="cr-lista">{s.agora.map(t => <li key={t}>{t}</li>)}</ul> : <p className="cr-fraco">Nada em andamento.</p>}
        {s.fila && s.fila.espera && <p className="cr-fraco cr-pequeno">O pedido mais antigo da fila chegou {s.fila.espera}.</p>}
      </section>
      <section className="cr-secao">
        <h2>Último trabalho</h2>
        {s.ultimo ? <Linha a={s.ultimo} agora={central.agora} /> : <p className="cr-fraco">Nada registrado nos últimos dias.</p>}
        {s.ultimoErro && <><h3>Último erro</h3><Linha a={s.ultimoErro} agora={central.agora} /></>}
      </section>
      {antes.length > 0 && (
        <section className="cr-secao">
          <h2>Antes disso</h2>
          <ul className="cr-atividades">{antes.map(a => <li key={a.id}><Linha a={a} agora={central.agora} /></li>)}</ul>
        </section>
      )}
      <section className="cr-secao">
        <h2>Máquina</h2>
        <dl className="cr-dl">
          <dt>Onde</dt><dd>{maquina.maquina.onde} ({maquina.host})</dd>
          <dt>Sinal</dt><dd><Estado tom={maquina.tom}>{maquina.rotulo}</Estado>, {maquina.sinal}</dd>
          {maquina.versao && <><dt>Versão</dt><dd className="num">{maquina.versao}</dd></>}
        </dl>
      </section>
    </div>
  );
}

function Linha({ a, agora }: { a: { texto: string; detalhe: string; em: string; erro: boolean }; agora: number }) {
  return (
    <div className={'cr-linha' + (a.erro ? ' erro' : '')}>
      <span className="cr-linha-texto">{a.texto}</span>
      <span className="cr-linha-meta">{r.haQuantoTempo(a.em, agora)}{a.detalhe ? ', ' + a.detalhe : ''}</span>
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
    <div>
      <div className="cr-registros-barra">
        <span className={'cr-ao-vivo' + (v.aoVivo ? ' sim' : '')}>{v.aoVivo ? 'Ao vivo, a cada 10 s' : v.atualizado ? 'Atualizado ' + v.atualizado : 'Esperando o robô'}</span>
        <label className="cr-chave">
          <input type="checkbox" checked={v.soErros} onChange={e => v.setSoErros(e.target.checked)} />
          <span>Só erros <span className="num">({v.erros})</span></span>
        </label>
      </div>
      <div className="cr-terminal" ref={caixa} onScroll={e => { const c = e.currentTarget; noFim.current = c.scrollHeight - c.scrollTop - c.clientHeight < 24; }}
        role="log" aria-live="polite" aria-label={'Registros do ' + robo.nome}>
        {v.linhas.length ? v.linhas.map(l => (
          <div key={l.chave} className={'cr-terminal-linha' + (l.nivel === 'erro' ? ' erro' : '')}>
            <time>{l.hora}</time><span className="cr-terminal-nivel">{l.nivel === 'erro' ? 'erro' : 'info'}</span><span>{l.texto}</span>
          </div>
        )) : <p className="cr-fraco">{v.total ? 'Nenhum erro nas últimas linhas.' : 'O robô ainda não mandou registros. Eles chegam quando a máquina estiver com o código novo.'}</p>}
      </div>
      <p className="cr-nota">As últimas {r.LINHAS_DO_REGISTRO} linhas do log. Com esta aba aberta o robô manda a cada 10 s; fechada, a cada 2 min.</p>
    </div>
  );
}

function Acoes({ central, s, maquina, acoes }: { central: Central; s: r.SituacaoDoRoboNaCentral; maquina: r.SituacaoDaMaquina; acoes: Acoes }) {
  const lista = r.acoesDoRobo(s.robo, !!s.pausa);
  const doRobo = lista.filter(a => a.alvo === 'robo');
  const daMaquina = lista.filter(a => a.alvo === 'maquina');
  const comandos = comandosDoRobo(central.comandos, s.robo).slice(0, 8);
  return (
    <div>
      {acoes.erro && !acoes.pendente && <p className="cr-erro-linha" role="alert" style={{ marginBottom: 16 }}>{acoes.erro}</p>}
      {doRobo.length > 0 && (
        <section className="cr-secao">
          <h2>No robô</h2>
          <ul className="cr-acoes">
            {doRobo.flatMap((a): { a: r.AcaoDaCentral; t: r.TarefaDoRobo | null }[] => (a.id === 'rodar-agora' ? s.robo.tarefas.map(t => ({ a, t })) : [{ a, t: null }])).map(({ a, t }) => (
              <li key={a.id + (t ? ':' + t.id : '')} className="cr-acao">
                <div><b>{t ? t.nome : a.nome}</b><span>{a.descricao}</span></div>
                <button type="button" className={'cr-botao' + (a.destrutiva ? ' perigo-leve' : '')} disabled={acoes.enviando}
                  onClick={() => acoes.pedir(a, maquina.maquina, s.robo, t)}>{t ? 'Rodar' : a.id === 'limpar-fila' ? 'Limpar' : a.nome}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="cr-secao">
        <h2>Na máquina ({maquina.maquina.nome})</h2>
        <ul className="cr-acoes">
          {daMaquina.map(a => {
            const sem = maquina.semGancho.includes(a.id);
            return (
              <li key={a.id} className="cr-acao">
                <div><b>{a.nome}</b><span>{sem ? 'Esta máquina ainda não sabe fazer isso; chega com o código novo do robô.' : a.descricao}</span></div>
                <button type="button" className="cr-botao perigo-leve" disabled={acoes.enviando || sem} onClick={() => acoes.pedir(a, maquina.maquina, s.robo)}>{a.id === 'reiniciar' ? 'Reiniciar' : 'Atualizar'}</button>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="cr-secao">
        <h2>Pedidos recentes</h2>
        <Historico comandos={comandos} agora={central.agora} />
      </section>
    </div>
  );
}

export function Historico({ comandos, agora }: { comandos: readonly r.Comando[]; agora: number }) {
  if (!comandos.length) return <p className="cr-fraco cr-pequeno">Nenhum pedido ainda.</p>;
  return (
    <ul className="cr-historico">
      {comandos.map(c => {
        const sem = r.comandoSemResposta(c, agora);
        return (
          <li key={c.id}>
            <b>{r.textoDoComando(c)}</b>
            <Estado tom={sem ? 'erro' : r.TOM_DO_STATUS[c.status]} forte>{sem ? 'Sem resposta' : r.ROTULO_DO_STATUS[c.status]}</Estado>
            <span className="cr-linha-meta">{c.porNome || 'alguém'}, {r.haQuantoTempo(c.em, agora)}{c.mensagem ? '. ' + c.mensagem : ''}</span>
          </li>
        );
      })}
    </ul>
  );
}

function Configuracoes({ s, maquina, acoes }: { s: r.SituacaoDoRoboNaCentral; maquina: r.SituacaoDaMaquina; acoes: Acoes }) {
  const pausar = r.acaoPorId(s.pausa ? 'retomar' : 'pausar')!;
  return (
    <div>
      {s.robo.pausavel && (
        <section className="cr-secao">
          <div className="cr-acao">
            <div><b>Pausado</b><span>{s.pausa ? 'Pausado por ' + (s.pausa.por || 'alguém') + '. Retome para voltar a pegar trabalho.' : 'Pausado, o robô não pega trabalho novo.'}</span></div>
            <button type="button" role="switch" aria-checked={!!s.pausa} aria-label="Pausado" className={'cr-interruptor' + (s.pausa ? ' ligado' : '')} disabled={acoes.enviando}
              onClick={() => acoes.pedir(pausar, maquina.maquina, s.robo)}><span /></button>
          </div>
        </section>
      )}
      <section className="cr-secao">
        <h2>Sobre</h2>
        <p className="cr-fraco" style={{ marginBottom: 12 }}>{s.robo.descricao}</p>
        <dl className="cr-dl">
          <dt>Máquina</dt><dd>{maquina.maquina.nome} ({maquina.host})</dd>
          <dt>Fila</dt><dd>{s.robo.fila || 'sem fila'}</dd>
          <dt>No log</dt><dd className="num">{s.robo.tags.map(t => (t ? '[' + t + ']' : 'sem marca')).join(' ')}</dd>
          <dt>Tarefas</dt><dd>{s.robo.tarefas.map(t => t.nome).join(', ') || 'nenhuma para rodar à mão'}</dd>
        </dl>
      </section>
      <p className="cr-nota">Os ajustes do trabalho de cada robô (regras do arquivador, empresas do SIEG, horários) continuam no nads. Daqui só saem as ações da lista fechada.</p>
    </div>
  );
}
