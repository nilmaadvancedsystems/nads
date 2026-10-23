// O painel do arquivador (Vitor, 05/10/2026: "quero uma tela flutuante assim como as outras"; desde 22/10/2026 só o
// progresso: "remova o botão de arquivar agora e transforme essa tela apenas um painel de progresso da tarefa"). Saíram
// o Organizar agora, o pedido e a lateral com um tópico só: fica o andamento da organização (a porcentagem, a fase e as
// 10 fases, feitas, a de agora e as que faltam) ou, parada, a última e a próxima rodada. No pé, só o Fechar (o link
// Tudo no Admin saiu também, 22/10/2026).
import { Icone, useJanela } from '@nads/ui';
import { useRef } from 'react';
import type { useArquivadorDoDrive } from './useArquivadorDoDrive';

type Vm = ReturnType<typeof useArquivadorDoDrive>;

function Progresso({ vm }: { vm: Vm }) {
  const r = vm.rotina;
  const p = vm.pedidoNoAgora ? vm.pedido : null;
  const rodando = r || (p && p.status === 'processando');
  if (rodando) {
    const pct = r ? r.pct : p!.pct;
    return (
      <div className="arquivador-hero">
        <span className="arquivador-hero-icone ativo"><Icone nome="girar" /></span>
        <h3>Organizando a pasta Claudio Secretario</h3>
        {pct != null && <b className="arquivador-hero-numero">{pct}%</b>}
        <span className="tarefas-barra larga andando arquivador-hero-barra"><span style={{ width: (pct ?? 8) + '%' }} /></span>
        {r?.lote && <p className="arquivador-hero-texto">{r.lote}</p>}
        <p className="arquivador-hero-nota">{r ? r.detalhe : p!.detalhe}</p>
        {vm.fases.length > 0 && (
          <ul className="arquivador-fases arquivador-progresso-fases">
            {vm.fases.map(f => (
              <li key={f.nome} className={f.estado}>
                <Icone nome={f.estado === 'feita' ? 'checkCircle' : f.estado === 'atual' ? 'girar' : 'clock'} width={15} height={15} />
                <span>{f.nome}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  // o pedido que deu erro continua aparecendo (para saber o que houve)
  if (p) {
    return (
      <div className="arquivador-hero">
        <span className={'arquivador-hero-icone ' + p.status}><Icone nome={p.status === 'erro' ? 'alert' : 'clock'} /></span>
        <h3>{p.titulo}</h3>
        <p className="arquivador-hero-nota">{p.detalhe}</p>
      </div>
    );
  }
  // o arquivador NOVO (contínuo): o que está fazendo agora, os números de hoje e o último arquivado
  const nv = vm.novo;
  if (nv) {
    return (
      <div className="arquivador-hero">
        <span className={'arquivador-hero-icone' + (nv.agora.tom === 'ok' ? ' em-dia' : nv.agora.tom === 'erro' ? ' erro' : '')}><Icone nome={nv.agora.icone} /></span>
        <h3>{nv.agora.texto}</h3>
        <p className="arquivador-hero-texto">{nv.nota}</p>
        <p className="arquivador-hero-nota">{nv.modo} · {nv.sinal}</p>
        <div className="arquivador-ultima">
          <p className="fraco">Hoje</p>
          <div className="arquivador-numeros">
            {nv.numeros.map(x => <div key={x.rotulo} className={'arquivador-numero' + (x.aviso ? ' aviso' : '')}><b>{x.valor.toLocaleString('pt-BR')}</b><span>{x.rotulo}</span></div>)}
          </div>
          {nv.ultimo && <p className="fraco">{nv.ultimo}</p>}
        </div>
        {vm.paraResolver && (
          <p className={'arquivador-hero-nota' + (vm.paraResolver.aviso ? ' aviso' : '')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
            <Icone nome={vm.paraResolver.aviso ? 'alert' : 'checkCircle'} width={16} height={16} />{vm.paraResolver.texto}
            {vm.paraResolver.aviso && vm.linkDoAdmin && <> · <a href={vm.linkDoAdmin}>abrir no Arquivador</a></>}
          </p>
        )}
      </div>
    );
  }
  const u = vm.ultimaRodada;
  return (
    <div className="arquivador-hero">
      <span className={'arquivador-hero-icone' + (vm.hoje ? ' em-dia' : '')}><Icone nome={vm.hoje ? 'checkCircle' : 'arquivo'} /></span>
      <h3>Nada rodando agora</h3>
      <p className="arquivador-hero-texto">Próxima organização {vm.proximaRodada}</p>
      {vm.paraResolver && (
        <p className={'arquivador-hero-nota' + (vm.paraResolver.aviso ? ' aviso' : '')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          <Icone nome={vm.paraResolver.aviso ? 'alert' : 'checkCircle'} width={16} height={16} />{vm.paraResolver.texto}
          {vm.paraResolver.aviso && vm.linkDoAdmin && <> · <a href={vm.linkDoAdmin}>abrir no Arquivador</a></>}
        </p>
      )}
      {u && (
        <div className="arquivador-ultima">
          <p className="fraco">Última rodada {u.quando}</p>
          <div className="arquivador-numeros">
            {u.numeros.map(n => <div key={n.rotulo} className={'arquivador-numero' + (n.aviso ? ' aviso' : '')}><b>{n.valor}</b><span>{n.rotulo}</span></div>)}
          </div>
        </div>
      )}
    </div>
  );
}

export function JanelaDoArquivador({ vm, fechar }: { vm: Vm; fechar: () => void }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar, true);
  return (
    <div className="modal-overlay" onMouseDown={ev => { if (ev.target === ev.currentTarget) fechar(); }}>
      <div ref={janela} className="modal arquivador-progresso" role="dialog" aria-modal="true" aria-labelledby="arquivadorTitulo">
        <h3 id="arquivadorTitulo">
          <Icone nome="arquivo" width={16} height={16} />Arquivador
          <span className={'arquivador-pc' + (vm.ligado ? ' ligado' : '')}><span className="arquivador-ponto" aria-hidden="true" />{vm.pc}</span>
        </h3>
        <Progresso vm={vm} />
        <div className="modal-actions">
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
