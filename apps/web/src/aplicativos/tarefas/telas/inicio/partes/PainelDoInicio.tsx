// O Painel do Início novo (o print do Dashboard), em duas colunas. À esquerda, o calendário do mês (os dias com prazo ou
// reunião têm a bolinha; clicar num dia mostra as tarefas dele) e o Quadro de avisos (as próximas reuniões, das Notificações;
// Vitor, 13/11/2026: "pode trocar o nome para Quadro de avisos"). O que pede confirmação (a presença na reunião, o Recebido
// do aviso) fica por cima do calendário, com ele embaçado, até a pessoa responder. À direita, as
// próximas tarefas (a caixinha conclui) e as delegadas por mim (no lugar do acompanhamento de tempo). O "Por cliente" e os
// "Comentários novos" saíram (Vitor, 13/11/2026: "Pode deletar essas duas sessoes").
import { BotaoIcone, CalendarioDoMes, Icone, Vazio } from '@nads/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { useModoDesenvolvedor } from '../../../../../comum/modoDesenvolvedor';
import { useNovidade } from '../../../../../comum/novidades';
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

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const quantas = (n: number) => n + (n === 1 ? ' tarefa' : ' tarefas');

/** O tempo por extenso: "24 min", "6h", "6h 24min" (Vitor, 13/11/2026: o "06:24" sozinho não dizia o que era). */
function tempoPorExtenso(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (!h) return m + ' min';
  return m ? h + 'h ' + m + 'min' : h + 'h';
}

/**
 * O cronômetro da em andamento ou pausada (horas e minutos trabalhados, por extenso, com o relógio pequeno numa linha só): o
 * número se redesenha sozinho na virada de cada minuto; o relógio pisca enquanto anda e para quando ela pausa (Vitor,
 * 13/11/2026: "Icone relogio buugado, deixa ele animado, em progresso o icone fica piscando, se ela pausar, para de piscar").
 */
function Cronometro({ minutos, andando }: { minutos: (agora: Date) => number; andando: boolean }) {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    if (!andando) return;
    const id = setTimeout(() => setAgora(new Date()), 60_000 - (Date.now() % 60_000) + 50);
    return () => clearTimeout(id);
  }, [agora, andando]);
  const tempo = tempoPorExtenso(minutos(agora));
  return (
    <span className={'hint num ini-cronometro' + (andando ? ' andando' : '')}
      title={(andando ? 'Em andamento: ' : 'Pausada: ') + tempo + ' de trabalho desde que foi iniciada (conta só o horário de expediente)'}>
      <Icone nome="clock" />{tempo + ' de trabalho'}
    </span>
  );
}

export function PainelDoInicio({ vm }: { vm: Vm }) {
  const c = vm.calendario;
  // o sino de cobrar (a novidade 'cobrar-tarefa', aprovada para todos em 13/11/2026)
  const cobrarLigado = useNovidade('cobrar-tarefa');
  // com a janela grande da cobrança (16/11/2026), o Cobrada da lista fica só o sino
  const discreta = useNovidade('cobranca-notificada');
  const p = vm.paraConfirmar[0];
  // o que mudou em 18/11/2026 (o Quadro no alto e destacado, o aviso enxuto, a reunião do dia nos prazos): só no modo desenvolvedor
  const [dev] = useModoDesenvolvedor();
  const abrir = (id: string) => { vm.escolherComunicado(id); vm.mudarAba('notificacoes'); };
  return (
    <div className="ini-painel">
      <div className="ini-coluna">
        <Cartao titulo="Calendário">
          <div className="ini-calendario-caixa">
            <div className={p ? 'ini-calendario-embacado' : undefined} aria-hidden={p ? true : undefined}>
              <CalendarioDoMes mes={c.mes} hoje={c.hoje} marcados={c.marcados} feriados={c.feriados} escolhido={c.dia} onDia={c.escolher} onMes={c.setMes} dicaDoMarcado={n => quantas(n) + ' ou reuniões'} />
            </div>
            {p && (
              <div className="ini-calendario-aviso" role="alertdialog" aria-label={p.tipo === 'reuniao' ? 'Reunião: confirme a presença' : 'Aviso: confirme que leu'}>
                <div className="card ini-calendario-cartao">
                  {/* sem o "Aviso: confirme que leu", o Abrir e o "+1 esperando" (Vitor, 18/11/2026); a reunião mantém o selo */}
                  {(p.tipo === 'reuniao' || !dev) && <span className="badge badge-suave badge-warn">{p.tipo === 'reuniao' ? 'Reunião: confirme a presença' : 'Aviso: confirme que leu'}</span>}
                  <b>{p.titulo}</b>
                  <span className="hint">{p.quem} · {p.quando}</span>
                  {p.texto && <p className="ini-calendario-texto">{p.texto}</p>}
                  <div className="ini-reuniao-linha">
                    {p.tipo === 'reuniao' ? <>
                      <button type="button" className="btn btn-primary" onClick={() => vm.reunioesVm.confirmar(p.id, true)}><Icone nome="check" />Confirmar presença</button>
                      <button type="button" className="btn btn-outline" onClick={() => vm.reunioesVm.confirmar(p.id, false)}>Não vou</button>
                    </> : <button type="button" className="btn btn-primary" onClick={() => void vm.marcarRecebido(p.id)}><Icone nome="check" />Recebido</button>}
                    {!dev && <button type="button" className="btn btn-ghost" onClick={() => abrir(p.id)}>Abrir</button>}
                    {!dev && vm.paraConfirmar.length > 1 && <span className="hint">+{vm.paraConfirmar.length - 1} esperando</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
          {c.feriadosDoMes.length > 0 && (
            <ul className="ini-feriados" aria-label="Feriados do mês">
              {c.feriadosDoMes.map(f => (
                <li key={f.data} className={'ini-feriado ' + f.tipo + (f.passou ? ' passou' : '')}>
                  <span className="ini-feriado-dia">{f.dia}</span>
                  <span className="ini-feriado-nome">{f.nome === f.rotulo ? f.rotulo : f.nome}</span>
                  {f.nome !== f.rotulo && <span className="hint">{f.rotulo}</span>}
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        {!dev && (
          <Cartao titulo="Quadro de avisos" acao={<button type="button" className="btn btn-ghost" onClick={() => vm.mudarAba('notificacoes')}>Notificações<Icone nome="chevronRight" /></button>}>
            {vm.reunioes.length ? vm.reunioes.map(r => (
              <button key={r.id} type="button" className="popover-item" onClick={() => abrir(r.id)}>
                <Icone nome="calendar" />
                <span className="popover-texto"><b>{r.tituloNaLista}</b><br /><span className="hint">{r.reuniao}</span></span>
              </button>
            )) : <Vazio compacto icone="calendar" titulo="Nenhuma reunião marcada" />}
          </Cartao>
        )}
      </div>
      <div className="ini-coluna">
        {/* o Quadro de avisos no alto da coluna da direita e destacado (Vitor, 18/11/2026: "muito apagado da tela inicial... seja
            mais superior"): cada reunião com o dia em destaque à esquerda */}
        {dev && <section className="card ini-cartao ini-quadro">
          <div className="card-head"><h3><Icone nome="sino" />Quadro de avisos</h3>
            <button type="button" className="btn btn-ghost" onClick={() => vm.mudarAba('notificacoes')}>Notificações<Icone nome="chevronRight" /></button></div>
          {vm.reunioes.length ? (
            <div className="ini-quadro-lista">
              {vm.reunioes.map(r => (
                <button key={r.id} type="button" className="ini-quadro-item" onClick={() => abrir(r.id)}>
                  <span className="ini-quadro-dia" aria-hidden="true">
                    <b>{r.quando ? r.quando.slice(8, 10) : '—'}</b>
                    <small>{r.quando ? MESES[Number(r.quando.slice(5, 7)) - 1] : ''}</small>
                  </span>
                  <span className="ini-quadro-texto"><b>{r.tituloNaLista}</b><span className="hint">{r.reuniao}</span></span>
                  <Icone nome="chevronRight" />
                </button>
              ))}
            </div>
          ) : <Vazio compacto icone="calendar" titulo="Nenhuma reunião marcada" />}
        </section>}
        <Cartao titulo={<>{vm.proximas.titulo} <span className="fraco num">({vm.proximas.total})</span></>}
          acao={c.dia ? <button type="button" className="btn btn-ghost" onClick={() => c.escolher(null)}><Icone nome="x" />Todas</button>
            : <button type="button" className="btn btn-ghost" onClick={() => vm.mudarAba('tarefas')}>Ver todas<Icone nome="chevronRight" /></button>}>
          {vm.proximas.reunioes.map(r => (
            <div key={'reuniao-' + r.id} className="ini-linha ini-reuniao-do-dia">
              <span className="ini-marca"><Icone nome="calendar" /></span>
              <button type="button" className="ini-linha-texto ini-abrir" onClick={() => abrir(r.id)}><b>{r.titulo}</b><span className="hint"> · Reunião</span></button>
              <span className="hint num">{[r.hora, r.duracao].filter(Boolean).join(' · ')}</span>
            </div>
          ))}
          {vm.proximas.linhas.length ? vm.proximas.linhas.map(t => (
            <div key={t.id} className="ini-linha">
              <span className="ini-marca"><button type="button" className="subnav-caixa vazia" title="Concluir" aria-label={'Concluir ' + t.titulo} onClick={t.concluir} /></span>
              <button type="button" className="ini-linha-texto ini-abrir" onClick={() => vm.abrir(t.id)}>{t.titulo}</button>
              {cobrarLigado && t.cobrada && <span className="ini-sino" title={t.dicaDaCobranca}><Icone nome="sino" />{!discreta && 'Cobrada'}</span>}
              <span className={'hint' + (t.atrasada ? ' tdl-atrasada' : '')}>{t.prazo}</span>
            </div>
          )) : vm.proximas.reunioes.length ? null : <Vazio compacto icone="checkCircle" titulo={c.dia ? 'Nada com prazo neste dia' : 'Tudo em dia'} />}
        </Cartao>
        <Cartao titulo="Delegadas por mim">
          {vm.delegadasPorMim.length ? vm.delegadasPorMim.map(t => (
            <div key={t.id} className="ini-linha">
              <Foto p={t.responsavel} />
              <span className="ini-linha-texto">
                <button type="button" className="ini-abrir" onClick={() => vm.abrir(t.id)}>{t.cliente ? <span className="ini-empresa">{t.cliente}</span> : t.titulo}</button>
                {t.cliente && <><br /><span className="hint">{t.titulo}</span></>}
              </span>
              {cobrarLigado && t.cobranca === 'cobrar' && <BotaoIcone pequeno className="ini-sino-cobrar" icone="sino" titulo={'Cobrar uma atualização de ' + t.responsavel.nome} onClick={() => { void t.cobrar(); }} />}
              {cobrarLigado && t.cobranca === 'esperando' && <span className="ini-sino" title="Você cobrou uma atualização: esperando a resposta"><Icone nome="sino" /></span>}
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                <SeloDoStatus rotulo={t.status.rotulo} tom={t.status.tom} />
                {t.minutos && <Cronometro minutos={t.minutos} andando={t.andando} />}
              </span>
            </div>
          )) : <Vazio compacto icone="aviao" titulo="Nada delegado em aberto" />}
        </Cartao>
      </div>
    </div>
  );
}
