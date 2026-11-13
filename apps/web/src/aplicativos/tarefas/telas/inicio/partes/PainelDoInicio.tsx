// O Painel do Início novo (o print do Dashboard), em duas colunas. À esquerda, o calendário do mês (os dias com prazo ou
// reunião têm a bolinha; clicar num dia mostra as tarefas dele) e o Quadro de avisos (as próximas reuniões, das Notificações;
// Vitor, 13/11/2026: "pode trocar o nome para Quadro de avisos"). O que pede confirmação (a presença na reunião, o Recebido
// do aviso) fica por cima do calendário, com ele embaçado, até a pessoa responder. À direita, as
// próximas tarefas (a caixinha conclui) e as delegadas por mim (no lugar do acompanhamento de tempo). O "Por cliente" e os
// "Comentários novos" saíram (Vitor, 13/11/2026: "Pode deletar essas duas sessoes").
import { CalendarioDoMes, Icone, Vazio } from '@nads/ui';
import { useEffect, useState, type ReactNode } from 'react';
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

/** O cronômetro da em andamento (horas:minutos trabalhados): se redesenha sozinho na virada de cada minuto, sem animação. */
function Cronometro({ minutos }: { minutos: (agora: Date) => number }) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = setTimeout(() => setAgora(new Date()), 60_000 - (Date.now() % 60_000) + 50);
    return () => clearTimeout(id);
  }, [agora]);
  const m = minutos(agora);
  return <span className="hint num" title="Tempo trabalhado desde que foi iniciada">{String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')}</span>;
}

export function PainelDoInicio({ vm }: { vm: Vm }) {
  const c = vm.calendario;
  const p = vm.paraConfirmar[0];
  const abrir = (id: string) => { vm.escolherComunicado(id); vm.mudarAba('notificacoes'); };
  return (
    <div className="ini-painel">
      <div className="ini-coluna">
        <Cartao titulo="Calendário">
          <div className="ini-calendario-caixa">
            <div className={p ? 'ini-calendario-embacado' : undefined} aria-hidden={p ? true : undefined}>
              <CalendarioDoMes mes={c.mes} hoje={c.hoje} marcados={c.marcados} escolhido={c.dia} onDia={c.escolher} onMes={c.setMes} dicaDoMarcado={n => quantas(n) + ' ou reuniões'} />
            </div>
            {p && (
              <div className="ini-calendario-aviso" role="alertdialog" aria-label={p.tipo === 'reuniao' ? 'Reunião: confirme a presença' : 'Aviso: confirme que leu'}>
                <div className="card ini-calendario-cartao">
                  <span className="badge badge-suave badge-warn">{p.tipo === 'reuniao' ? 'Reunião: confirme a presença' : 'Aviso: confirme que leu'}</span>
                  <b>{p.titulo}</b>
                  <span className="hint">{p.quem} · {p.quando}</span>
                  {p.texto && <p className="ini-calendario-texto">{p.texto}</p>}
                  <div className="ini-reuniao-linha">
                    {p.tipo === 'reuniao' ? <>
                      <button type="button" className="btn btn-primary" onClick={() => vm.reunioesVm.confirmar(p.id, true)}><Icone nome="check" />Confirmar presença</button>
                      <button type="button" className="btn btn-outline" onClick={() => vm.reunioesVm.confirmar(p.id, false)}>Não vou</button>
                    </> : <button type="button" className="btn btn-primary" onClick={() => void vm.marcarRecebido(p.id)}><Icone nome="check" />Recebido</button>}
                    <button type="button" className="btn btn-ghost" onClick={() => abrir(p.id)}>Abrir</button>
                    {vm.paraConfirmar.length > 1 && <span className="hint">+{vm.paraConfirmar.length - 1} esperando</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Cartao>
        <Cartao titulo="Quadro de avisos" acao={<button type="button" className="btn btn-ghost" onClick={() => vm.mudarAba('notificacoes')}>Notificações<Icone nome="chevronRight" /></button>}>
          {vm.reunioes.length ? vm.reunioes.map(r => (
            <button key={r.id} type="button" className="popover-item" onClick={() => abrir(r.id)}>
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
                <button type="button" className="ini-abrir" onClick={() => vm.abrir(t.id)}>{t.cliente || t.titulo}</button>
                {t.cliente && <><br /><span className="hint">{t.titulo}</span></>}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <SeloDoStatus rotulo={t.status.rotulo} tom={t.status.tom} />
                {t.minutos && <Cronometro minutos={t.minutos} />}
              </span>
            </div>
          )) : <Vazio compacto icone="aviao" titulo="Nada delegado em aberto" />}
        </Cartao>
      </div>
    </div>
  );
}
