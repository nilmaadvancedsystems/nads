// A janela flutuante do Arquivar agora (Vitor, 05/10/2026: "quero uma tela flutuante assim como as outras" e "um
// relatório com as mensagens de resposta do Claude"), no desenho das outras (a JanelaLateral): à esquerda o estado e os
// tópicos; desde 22/10/2026 só o Agora (a organização em andamento com as 10 fases, ou o pedido): a Conversa do Claude,
// o Relatório e o Histórico saíram ("deixe apenas o agora"); no pé, Organizar agora.
import { Icone, type NomeIcone } from '@nads/ui';
import { useState } from 'react';
import { JanelaLateral, type TopicoDaJanela } from '../janela/JanelaLateral';
import type { useArquivadorDoDrive } from './useArquivadorDoDrive';

type Vm = ReturnType<typeof useArquivadorDoDrive>;
export type Topico = 'agora';

const ICONES: Record<string, NomeIcone> = { pendente: 'clock', aguardando: 'clock', processando: 'girar', concluido: 'checkCircle', erro: 'alert', cancelado: 'x' };

function Agora({ vm }: { vm: Vm }) {
  const r = vm.rotina;
  const p = vm.pedidoNoAgora ? vm.pedido : null;
  const ab = p && p.status === 'processando';
  if (r || ab) {
    const pct = r ? r.pct : p!.pct;
    const fazendo = r ? r.etapa.replace(/^Fase (\d+) de (\d+): (.*)$/, '$3 · fase $1 de $2') : p!.etapa;
    return (
      <div className="arquivador-hero">
        <span className="arquivador-hero-icone ativo"><Icone nome="girar" /></span>
        <h3>Organizando</h3>
        {pct != null && <b className="arquivador-hero-numero">{pct}%</b>}
        {fazendo && <p className="arquivador-hero-texto">{fazendo}</p>}
        <span className="tarefas-barra larga andando arquivador-hero-barra"><span style={{ width: (pct ?? 8) + '%' }} /></span>
        {r?.lote && <p className="arquivador-hero-texto">{r.lote}</p>}
        <p className="arquivador-hero-nota">{r ? r.detalhe : p!.detalhe}</p>
        {r && r.etapas.length > 0 && (
          <ul className="arquivador-etapas">
            {r.etapas.map(e => <li key={e.chave} className={e.estado}><Icone nome={e.estado === 'feita' ? 'checkCircle' : e.estado === 'erro' ? 'alert' : 'girar'} /><span>{e.nome}</span></li>)}
          </ul>
        )}
      </div>
    );
  }
  if (p) {
    return (
      <div className="arquivador-hero">
        <span className={'arquivador-hero-icone ' + p.status}><Icone nome={ICONES[p.status] || 'arquivo'} /></span>
        <h3>{p.titulo}</h3>
        <p className="arquivador-hero-nota">{p.detalhe}</p>
      </div>
    );
  }
  const n = vm.hoje?.numeros;
  return (
    <div className="arquivador-hero">
      <span className={'arquivador-hero-icone' + (vm.hoje ? ' em-dia' : '')}><Icone nome={vm.hoje ? 'checkCircle' : 'arquivo'} /></span>
      <h3>{vm.hoje ? 'Tudo em dia' : 'Nada rodando agora'}</h3>
      {vm.ultimaRodada && <p className="arquivador-hero-texto">Última rodada {vm.ultimaRodada.quando}</p>}
      {n && (
        <>
          <b className="arquivador-hero-numero">{n[0].valor}</b>
          <p className="arquivador-hero-texto">arquivos arquivados hoje</p>
          <p className="arquivador-hero-nota">{n[1].valor} {n[1].valor === 1 ? 'cliente' : 'clientes'}{n[2].valor ? ' · ' + n[2].valor + ' sem cliente' : ''}</p>
        </>
      )}
      {!n && <p className="arquivador-hero-nota">A organização das 9h roda sozinha todo dia.</p>}
    </div>
  );
}

export function JanelaDoArquivador({ vm, fechar, inicio }: { vm: Vm; fechar: () => void; inicio?: Topico }) {
  const [topico, setTopico] = useState<Topico>(inicio || 'agora');
  const topicos: TopicoDaJanela<Topico>[] = [
    { id: 'agora', rotulo: 'Agora', icone: vm.ocupado ? 'girar' : 'arquivo' },
  ];
  const p = vm.pedido;
  return (
    <JanelaLateral rotulo="Arquivar" topicos={topicos} topico={topico} mudar={setTopico} fechar={fechar} classe="arquivador-janela"
      resumo={(
        <div className="usuario-quem arquivador-quem">
          <span className={'arquivador-selo' + (vm.ocupado ? ' ativo' : '')}><Icone nome={vm.ocupado ? 'girar' : 'arquivo'} /></span>
          <b>Arquivador</b>
          <span className={'arquivador-pc' + (vm.ligado ? ' ligado' : '')}><span className="arquivador-ponto" aria-hidden="true" />{vm.pc}</span>
        </div>
      )}
      pe={(
        <>
          {vm.podePedir && <p className="arquivador-nota">{vm.notaAoPedir}{vm.exemplos ? ' (Exemplo: nada sai daqui.)' : ''}</p>}
          <span className="tarefas-barra-espaco" />
          {p?.podeCancelar && <button type="button" className="btn btn-outline" onClick={() => vm.cancelar(p.id)}>Cancelar o pedido</button>}
          {vm.podeParar && (
            <button type="button" className="btn btn-danger" disabled={vm.parando} onClick={() => void vm.parar()}>
              {vm.parando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="x" />}{vm.parando ? 'Parando…' : 'Cancelar a organização'}
            </button>
          )}
          {vm.podePedir && (
            <button type="button" className="btn btn-primary" disabled={vm.pedindo} onClick={() => void vm.pedir()}>
              {vm.pedindo ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="arquivo" />}Organizar agora
            </button>
          )}
        </>
      )}>
      {topico === 'agora' && <Agora vm={vm} />}
    </JanelaLateral>
  );
}
