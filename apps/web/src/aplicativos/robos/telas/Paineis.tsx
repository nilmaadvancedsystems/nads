// As fichas da navegação: Máquinas (as três, com os sinais e as ações de cada uma) e Registros (a atividade de todos os
// robôs e o histórico dos pedidos). Os Ajustes estão em Configuracoes.tsx.
import { robos as r } from '@nads/core';
import { useState } from 'react';
import type { Central, useAcoes } from '../casca/useCentral';
import { IconeDoRobo } from '../partes/IconeDoRobo';
import { Janela } from '../partes/Janela';
import { Estado, Historico, Refazer } from './JanelaDoRobo';

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

const Titulo = ({ icone, texto }: { icone: string; texto: string }) => (
  <div className="cr-cabeca"><IconeDoRobo nome={icone} tamanho={22} /><h1 className="cr-titulo-simples">{texto}</h1></div>
);

export function PainelMaquinas({ central, acoes, aoFechar }: { central: Central; acoes: Acoes; aoFechar: () => void }) {
  return (
    <Janela rotulo="Máquinas" aoFechar={aoFechar} titulo={<Titulo icone="servidor" texto="Máquinas" />}>
      {acoes.erro && !acoes.pendente && <p className="cr-erro-linha" role="alert" style={{ marginBottom: 16 }}>{acoes.erro}</p>}
      {central.maquinas.map(m => {
        const robos = central.situacoes.filter(s => s.robo.maquina === m.maquina.id);
        return (
          <section key={m.maquina.id} className="cr-maquina-ficha">
            <div className="cr-maquina-ficha-topo">
              <h2>{m.maquina.nome}</h2>
              <Estado tom={m.tom}>{m.rotulo}</Estado>
            </div>
            <p className="cr-fraco cr-pequeno">{m.maquina.onde}, <span className="num">{m.host}</span></p>
            <div className="cr-barras">
              <Barra rotulo="CPU" valor={m.sinais?.cpu ?? null} />
              <Barra rotulo="Memória" valor={m.sinais?.memoria ?? null} />
              <Barra rotulo="Disco" valor={m.sinais?.disco ?? null} />
            </div>
            <dl className="cr-dl">
              <dt>Último sinal</dt><dd>{m.sinal}</dd>
              {m.sinais?.discoLivreGb != null && <><dt>Disco livre</dt><dd className="num">{m.sinais.discoLivreGb} GB</dd></>}
              {m.sinais?.ligadaHa != null && <><dt>Ligada há</dt><dd>{r.tempoLigado(m.sinais.ligadaHa)}</dd></>}
              {m.versao && <><dt>Versão</dt><dd className="num">{m.versao}</dd></>}
              <dt>Robôs</dt><dd>{robos.map(s => s.robo.nome).join(', ')}</dd>
            </dl>
            {!m.sinais && <p className="cr-nota">Sem CPU e memória ainda: chegam com o código novo do robô.</p>}
            {central.administra && <div className="cr-botoes">
              {r.ACOES.filter(a => a.alvo === 'maquina' && !a.interna).map(a => (
                <button key={a.id} type="button" className="cr-botao perigo-leve" disabled={acoes.enviando || m.semGancho.includes(a.id)}
                  title={m.semGancho.includes(a.id) ? 'Esta máquina ainda não sabe fazer isso' : a.descricao} onClick={() => acoes.pedir(a, m.maquina, null)}>{a.id === 'reiniciar' ? 'Reiniciar' : 'Atualizar'}</button>
              ))}
            </div>}
          </section>
        );
      })}
    </Janela>
  );
}

const horaDe = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };

export function PainelRegistros({ central, acoes, aoFechar }: { central: Central; acoes: Acoes; aoFechar: () => void }) {
  const [soErros, setSoErros] = useState(false);
  const lista = central.atividades.filter(a => !soErros || a.erro).slice(0, 80);
  return (
    <Janela rotulo="Registros" aoFechar={aoFechar} titulo={<Titulo icone="terminal" texto="Registros" />}>
      {acoes.erro && !acoes.pendente && <p className="cr-erro-linha" role="alert" style={{ marginBottom: 16 }}>{acoes.erro}</p>}
      <section className="cr-secao">
        <div className="cr-registros-barra">
          <h2 style={{ margin: 0 }}>O que os robôs fizeram</h2>
          <label className="cr-chave"><input type="checkbox" checked={soErros} onChange={e => setSoErros(e.target.checked)} /><span>Só erros</span></label>
        </div>
        {lista.length ? (
          <ul className="cr-ocorrencias">
            {lista.map(a => {
              const robo = r.roboDaAtividade(a);
              return (
                <li key={a.id} className="cr-com-refazer">
                  <div className="cr-ocorrencia" style={{ cursor: 'default' }}>
                    <time className="num">{horaDe(a.em)}</time>
                    <span className="cr-ocorrencia-corpo">
                      <span className="cr-ocorrencia-quem"><span>{robo?.nome || a.tipo}</span>{a.erro && <span className="cr-estado erro">erro</span>}</span>
                      <span className="cr-ocorrencia-texto">{a.texto}{a.detalhe ? ', ' + a.detalhe : ''}</span>
                    </span>
                  </div>
                  <Refazer a={a} central={central} acoes={acoes} />
                </li>
              );
            })}
          </ul>
        ) : <p className="cr-fraco">Nada por aqui.</p>}
      </section>
      <section className="cr-secao">
        <h2>Pedidos feitos pela central</h2>
        <Historico comandos={central.comandos.slice(0, 20)} agora={central.agora} />
      </section>
    </Janela>
  );
}
