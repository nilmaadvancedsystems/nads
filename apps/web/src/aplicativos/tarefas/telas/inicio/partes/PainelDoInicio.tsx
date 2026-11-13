// O Painel do Início novo (o print do Dashboard), em duas colunas. À esquerda, o calendário do mês (os dias com prazo ou
// reunião têm a bolinha; clicar num dia mostra as tarefas dele) e as próximas reuniões (das Notificações). À direita, as
// próximas tarefas (a caixinha conclui) e as delegadas por mim (no lugar do acompanhamento de tempo). O "Por cliente" e os
// "Comentários novos" saíram (Vitor, 13/11/2026: "Pode deletar essas duas sessoes").
import { CalendarioDoMes, Icone, Vazio } from '@nads/ui';
import type { ReactNode } from 'react';
import { SeloDoStatus } from '../../delegador/partes/SelosDaTarefa';
import type { PessoaComFoto, useInicioNovo } from '../useInicioNovo';

type Vm = ReturnType<typeof useInicioNovo>;

/** a foto de perfil (ou as iniciais), redonda */
export function Foto({ p }: { p: PessoaComFoto }) {
  return <span className="pessoa-foto" title={p.nome} aria-hidden="true">{p.foto ? <img src={p.foto} alt="" /> : p.iniciais}</span>;
}

function Cartao({ titulo, acao, children }: { titulo: ReactNode; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="card ini-cartao">
      <div className="card-head"><h3>{titulo}</h3>{acao}</div>
      {children}
    </section>
  );
}

const quantas = (n: number) => n + (n === 1 ? ' tarefa' : ' tarefas');

export function PainelDoInicio({ vm }: { vm: Vm }) {
  const c = vm.calendario;
  return (
    <div className="ini-painel">
      <div className="ini-coluna">
        <Cartao titulo="Calendário">
          <CalendarioDoMes mes={c.mes} hoje={c.hoje} marcados={c.marcados} escolhido={c.dia} onDia={c.escolher} onMes={c.setMes} dicaDoMarcado={n => quantas(n) + ' ou reuniões'} />
        </Cartao>
        <Cartao titulo="Próximas reuniões" acao={<button type="button" className="btn btn-ghost" onClick={() => vm.mudarAba('notificacoes')}>Notificações<Icone nome="chevronRight" /></button>}>
          {vm.reunioes.length ? vm.reunioes.map(r => (
            <button key={r.id} type="button" className="popover-item" onClick={() => { vm.escolherComunicado(r.id); vm.mudarAba('notificacoes'); }}>
              <Icone nome="calendar" />
              <span className="popover-texto"><b>{r.tituloNaLista}</b><br /><span className="hint">{r.reuniao}</span></span>
            </button>
          )) : <Vazio compacto icone="calendar" titulo="Nenhuma reunião marcada" />}
        </Cartao>
      </div>
      <div className="ini-coluna">
        <Cartao titulo={<>{vm.proximas.titulo} <span className="fraco num">({vm.proximas.total})</span></>}
          acao={c.dia ? <button type="button" className="btn btn-ghost" onClick={() => c.escolher(null)}><Icone nome="x" />Todas</button>
            : <button type="button" className="btn btn-ghost" onClick={() => vm.mudarAba('tarefas')}>Ver todas<Icone nome="chevronRight" /></button>}>
          {vm.proximas.linhas.length ? vm.proximas.linhas.map(t => (
            <div key={t.id} className="ini-linha">
              <span className="ini-marca"><button type="button" className="subnav-caixa vazia" title="Concluir" aria-label={'Concluir ' + t.titulo} onClick={t.concluir} /></span>
              <button type="button" className="ini-linha-texto ini-abrir" onClick={() => vm.abrir(t.id)}>{t.titulo}</button>
              <span className={'hint' + (t.atrasada ? ' tdl-atrasada' : '')}>{t.prazo}</span>
            </div>
          )) : <Vazio compacto icone="checkCircle" titulo={c.dia ? 'Nada com prazo neste dia' : 'Tudo em dia'} />}
        </Cartao>
        <Cartao titulo="Delegadas por mim">
          {vm.delegadasPorMim.length ? vm.delegadasPorMim.map(t => (
            <div key={t.id} className="ini-linha">
              <Foto p={t.responsavel} />
              <span className="ini-linha-texto">
                <button type="button" className="ini-abrir" onClick={() => vm.abrir(t.id)}>{t.titulo}</button>
                <br /><span className="hint">{t.responsavel.nome} · {t.movimento}</span>
              </span>
              <SeloDoStatus rotulo={t.status.rotulo} tom={t.status.tom} />
            </div>
          )) : <Vazio compacto icone="aviao" titulo="Nada delegado em aberto" />}
        </Cartao>
      </div>
    </div>
  );
}
