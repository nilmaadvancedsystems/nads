// A aba Fila de um robô: cada pedido que espera ou anda, com "Passar na frente" e "Cancelar" onde a fila deixa, e o
// "Pedir para um cliente". A tela só pede (um comando, como toda ação da central): quem confere e toca a fila é o robô.
import { robos as r } from '@nads/core';
import { useState } from 'react';
import type { Central, useAcoes } from '../casca/useCentral';
import { Estado } from './JanelaDoRobo';
import { useFila } from './useFila';

type Acoes = ReturnType<typeof useAcoes>;

export function FilaDoRobo({ central, s, maquina, acoes }: { central: Central; s: r.SituacaoDoRoboNaCentral; maquina: r.SituacaoDaMaquina; acoes: Acoes }) {
  const pedidos = s.robo.pedidos || [];
  const { fila, clientes } = useFila(s.robo.id, pedidos.length > 0);
  const mexe = !!s.robo.itens && (s.robo.itens.cancelar || s.robo.itens.naFrente);
  return (
    <div>
      {acoes.erro && !acoes.pendente && <p className="cr-erro-linha" role="alert" style={{ marginBottom: 16 }}>{acoes.erro}</p>}
      {pedidos.length > 0 && <PedirParaCliente s={s} maquina={maquina} acoes={acoes} pedidos={pedidos} clientes={clientes} agora={central.agora} />}
      <section className="cr-secao">
        <h2>Na fila agora</h2>
        {fila.erro ? <p className="cr-erro-linha" role="alert">{fila.erro}</p>
          : !fila.carregada ? <p className="cr-fraco">Lendo a fila…</p>
          : fila.itens.length ? (
            <ul className="cr-acoes">
              {fila.itens.map(i => {
                const extras = { item: i.id, rotulo: i.titulo };
                return (
                  <li key={i.id} className="cr-acao">
                    <div>
                      <b>{i.titulo}</b>
                      <span>{[i.detalhe, i.criadoPor, r.haQuantoTempo(i.criadoEm, central.agora)].filter(Boolean).join(', ')}</span>
                    </div>
                    {i.podeCancelar || i.podePassarNaFrente ? (
                      <span className="cr-botoes cr-botoes-item">
                        {i.podePassarNaFrente && <button type="button" className="cr-botao" disabled={acoes.enviando || !!i.naFrenteEm} onClick={() => acoes.pedir(r.acaoPorId('na-frente')!, maquina.maquina, s.robo, null, extras)}>{i.naFrenteEm ? 'Na frente' : 'Passar na frente'}</button>}
                        {i.podeCancelar && <button type="button" className="cr-botao perigo-leve" disabled={acoes.enviando} onClick={() => acoes.pedir(r.acaoPorId('cancelar-item')!, maquina.maquina, s.robo, null, extras)}>Cancelar</button>}
                      </span>
                    ) : <Estado tom={i.emAndamento ? 'ok' : 'neutro'}>{i.rotulo}</Estado>}
                  </li>
                );
              })}
            </ul>
          ) : <p className="cr-fraco">Nenhum pedido esperando.</p>}
      </section>
      <p className="cr-nota">{mexe ? 'O que já está em andamento termina; só dá para mexer no que ainda espera. Cancelado não é apagado: fica marcado, com quem cancelou.' : 'Nesta fila só dá para ver: mexer num pedido daqui não é seguro.'}</p>
    </div>
  );
}

function PedirParaCliente({ s, maquina, acoes, pedidos, clientes, agora }: { s: r.SituacaoDoRoboNaCentral; maquina: r.SituacaoDaMaquina; acoes: Acoes; pedidos: r.TarefaDoRobo[]; clientes: readonly { codigo: string; nome: string }[]; agora: number }) {
  const [tarefa, setTarefa] = useState(pedidos[0].id);
  const [campo, setCampo] = useState('');
  const [competencia, setCompetencia] = useState(() => r.competenciaAnterior(agora));
  const codigo = r.codigoDoCampo(campo);
  const cliente = clientes.find(c => c.codigo === codigo);
  const listaId = 'cr-clientes-' + s.robo.id;
  const pronto = !!codigo && !!competencia;
  const enviar = () => {
    if (!pronto) return;
    acoes.pedir(r.acaoPorId('pedir-cliente')!, maquina.maquina, s.robo, pedidos.find(p => p.id === tarefa) || null, { cliente: codigo, competencia, rotulo: cliente ? cliente.codigo + ' ' + cliente.nome : codigo });
  };
  return (
    <section className="cr-secao">
      <h2>Pedir para um cliente</h2>
      <form className="cr-pedir" onSubmit={e => { e.preventDefault(); enviar(); }}>
        {pedidos.length > 1 && (
          <label className="cr-campo">
            <span>O quê</span>
            <span className="cr-busca"><select value={tarefa} onChange={e => setTarefa(e.target.value)}>{pedidos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></span>
          </label>
        )}
        <label className="cr-campo">
          <span>Cliente</span>
          <span className="cr-busca"><input list={listaId} value={campo} onChange={e => setCampo(e.target.value)} placeholder="Código ou nome" autoComplete="off" /></span>
          <datalist id={listaId}>{clientes.map(c => <option key={c.codigo} value={c.codigo + ' ' + c.nome} />)}</datalist>
        </label>
        <label className="cr-campo">
          <span>Competência</span>
          <span className="cr-busca"><input type="month" value={competencia} onChange={e => setCompetencia(e.target.value)} /></span>
        </label>
        <button type="submit" className="cr-botao primario" disabled={!pronto || acoes.enviando}>Pedir</button>
      </form>
      {campo.trim() && !codigo && <p className="cr-nota">Escolha da lista ou comece pelo código do cliente.</p>}
    </section>
  );
}
