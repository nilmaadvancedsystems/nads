// As janelas do dock: Máquinas (as três, com os sinais e as ações de cada uma), Registros (a atividade de todos os robôs
// e o histórico dos pedidos) e Configurações (a conta e o papel de parede).
import { robos as r } from '@nads/core';
import { useState } from 'react';
import type { Central, useAcoes } from '../casca/useCentral';
import { IconeDoRobo } from '../partes/IconeDoRobo';
import { Janela } from '../partes/Janela';
import { Historico, Pilula } from './JanelaDoRobo';

type Acoes = ReturnType<typeof useAcoes>;

export function Barra({ rotulo, valor }: { rotulo: string; valor: number | null }) {
  const v = r.porcento(valor);
  return (
    <div className="cr-barra">
      <span className="cr-barra-rotulo">{rotulo}</span>
      <span className="cr-barra-trilho" aria-hidden="true"><span className={'cr-barra-cheio' + (v != null && v >= 85 ? ' alto' : '')} style={{ width: (v ?? 0) + '%' }} /></span>
      <span className="cr-barra-valor">{v == null ? '—' : v + '%'}</span>
    </div>
  );
}

export function PainelMaquinas({ central, acoes, aoFechar }: { central: Central; acoes: Acoes; aoFechar: () => void }) {
  return (
    <Janela rotulo="Máquinas" aoFechar={aoFechar} larga titulo={<h1 className="cr-titulo-simples">Máquinas</h1>}>
      <div className="cr-pilha">
        {acoes.erro && !acoes.pendente && <p className="cr-erro-linha" role="alert">{acoes.erro}</p>}
        {central.maquinas.map(m => {
          const robos = central.situacoes.filter(s => s.robo.maquina === m.maquina.id);
          return (
            <section key={m.maquina.id} className="cr-cartao">
              <div className="cr-maquina-topo">
                <span className="cr-maquina-icone"><IconeDoRobo nome={m.maquina.icone} tamanho={22} /></span>
                <div className="cr-maquina-nome"><b>{m.maquina.nome}</b><span>{m.host} · {m.maquina.onde}</span></div>
                <Pilula tom={m.tom}>{m.rotulo}</Pilula>
              </div>
              <div className="cr-barras">
                <Barra rotulo="CPU" valor={m.sinais?.cpu ?? null} />
                <Barra rotulo="Memória" valor={m.sinais?.memoria ?? null} />
                <Barra rotulo="Disco" valor={m.sinais?.disco ?? null} />
              </div>
              <p className="cr-fraco cr-pequeno">
                Último sinal {m.sinal}{m.sinais?.discoLivreGb != null ? ' · ' + m.sinais.discoLivreGb + ' GB livres' : ''}{m.sinais?.ligadaHa != null ? ' · ligada há ' + r.tempoLigado(m.sinais.ligadaHa) : ''}{m.versao ? ' · versão ' + m.versao : ''}
                {!m.sinais && ' · sem CPU/memória ainda (chega com o código novo do robô)'}
              </p>
              <div className="cr-robos-da-maquina">{robos.map(s => <Pilula key={s.robo.id} tom={s.tom}>{s.robo.nome}</Pilula>)}</div>
              <div className="cr-botoes">
                {r.ACOES.filter(a => a.alvo === 'maquina').map(a => (
                  <button key={a.id} type="button" className="cr-botao perigo-leve" disabled={acoes.enviando || m.semGancho.includes(a.id)}
                    title={m.semGancho.includes(a.id) ? 'Esta máquina ainda não sabe fazer isso' : a.descricao} onClick={() => acoes.pedir(a, m.maquina, null)}>{a.nome}</button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Janela>
  );
}

export function PainelRegistros({ central, aoFechar }: { central: Central; aoFechar: () => void }) {
  const [soErros, setSoErros] = useState(false);
  const lista = central.atividades.filter(a => !soErros || a.erro).slice(0, 80);
  return (
    <Janela rotulo="Registros" aoFechar={aoFechar} larga titulo={<h1 className="cr-titulo-simples">Registros</h1>}>
      <div className="cr-pilha">
        <section className="cr-cartao">
          <div className="cr-registros-barra">
            <h2>Atividade de todos os robôs</h2>
            <label className="cr-chave"><input type="checkbox" checked={soErros} onChange={e => setSoErros(e.target.checked)} /><span>Só erros</span></label>
          </div>
          {lista.length ? (
            <ul className="cr-atividades">
              {lista.map(a => {
                const robo = r.roboDaAtividade(a);
                return (
                  <li key={a.id} className={'cr-linha' + (a.erro ? ' erro' : '')}>
                    <span className="cr-linha-texto">{robo && <b className="cr-marca">{robo.nome}</b>}{a.texto}</span>
                    <span className="cr-linha-meta">{r.haQuantoTempo(a.em, central.agora)} · {a.maquina}{a.detalhe ? ' · ' + a.detalhe : ''}</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="cr-fraco">Nada por aqui.</p>}
        </section>
        <section className="cr-cartao">
          <h2>Pedidos pela central</h2>
          <Historico comandos={central.comandos.slice(0, 20)} agora={central.agora} />
        </section>
      </div>
    </Janela>
  );
}

export const PAPEIS = [
  { id: 'aurora', nome: 'Aurora' },
  { id: 'oceano', nome: 'Oceano' },
  { id: 'brasa', nome: 'Brasa' },
] as const;
export type IdPapel = (typeof PAPEIS)[number]['id'];

export function PainelConfiguracoes({ central, papel, trocarPapel, aoFechar }: { central: Central; papel: IdPapel; trocarPapel: (p: IdPapel) => void; aoFechar: () => void }) {
  return (
    <Janela rotulo="Configurações" aoFechar={aoFechar} titulo={<h1 className="cr-titulo-simples">Configurações</h1>}>
      <div className="cr-pilha">
        <section className="cr-cartao">
          <h2>Conta</h2>
          <div className="cr-acao">
            <div><b>{central.nome || 'Sem nome'}</b><span>{central.exemplos ? 'Dados de exemplo: nada vai para o banco nem para os robôs.' : 'Administrador, com a conta do Entregas.'}</span></div>
            <button type="button" className="cr-botao" onClick={central.sair}>{central.rotuloSair}</button>
          </div>
        </section>
        <section className="cr-cartao">
          <h2>Papel de parede</h2>
          <div className="cr-papeis" role="radiogroup" aria-label="Papel de parede">
            {PAPEIS.map(p => (
              <button key={p.id} type="button" role="radio" aria-checked={papel === p.id} className={'cr-papel papel-' + p.id + (papel === p.id ? ' ativo' : '')} onClick={() => trocarPapel(p.id)}>
                <span>{p.nome}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="cr-cartao">
          <h2>Como funciona</h2>
          <p className="cr-fraco">Cada ação vira um pedido no banco. O robô de cada máquina só lê os pedidos dela, só faz o que está na lista fechada (pausar, retomar, rodar uma tarefa conhecida, limpar a fila travada, reiniciar com calma e atualizar), recusa pedido com mais de 5 minutos ou repetido e responde no próprio pedido. Nenhum comando de sistema sai daqui.</p>
        </section>
      </div>
    </Janela>
  );
}
