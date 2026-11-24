// O Painel do Início novo (o print do Dashboard), em duas colunas. À esquerda, o calendário do mês (os dias com prazo ou
// reunião têm a bolinha; clicar num dia mostra as tarefas dele) e o Quadro de avisos (as próximas reuniões, das Notificações;
// Vitor, 13/11/2026: "pode trocar o nome para Quadro de avisos"). O que pede confirmação (a presença na reunião, o Recebido
// do aviso) fica por cima do calendário, com ele embaçado, até a pessoa responder. À direita, as
// próximas tarefas (a caixinha conclui) e as delegadas por mim (no lugar do acompanhamento de tempo). O "Por cliente" e os
// "Comentários novos" saíram (Vitor, 13/11/2026: "Pode deletar essas duas sessoes").
import { BotaoIcone, CalendarioDoMes, Icone, Vazio } from '@nads/ui';
import { useEffect, useState, type ReactNode } from 'react';
import { useNovidade } from '../../../../../comum/novidades';
import { SeloDoStatus } from '../../delegador/partes/SelosDaTarefa';
import type { PessoaComFoto, useInicioNovo } from '../useInicioNovo';
import { JanelaDeRemarcar } from './ReunioesDoInicio';

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
  const abrir = (id: string) => { vm.escolherComunicado(id); vm.mudarAba('notificacoes'); };
  // a reunião sendo remarcada (ou cancelada) pelo card (24/11/2026)
  const [remarcando, setRemarcando] = useState<string | null>(null);
  const daJanela = remarcando ? vm.reunioesVm.lista.find(x => x.id === remarcando) : undefined;
  return (
    <div className="ini-painel">
      {daJanela && <JanelaDeRemarcar id={daJanela.id} titulo={daJanela.titulo} quando={daJanela.quandoTexto} podeCancelar={daJanela.acoes.includes('cancelar')}
        vm={vm.reunioesVm} fechar={() => setRemarcando(null)} />}
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
                  {p.tipo === 'reuniao' && <span className="badge badge-suave badge-warn">Reunião: confirme a presença</span>}
                  <b>{p.titulo}</b>
                  <span className="hint">{p.quem} · {p.quando}</span>
                  {p.texto && <p className="ini-calendario-texto">{p.texto}</p>}
                  <div className="ini-reuniao-linha">
                    {p.tipo === 'reuniao' ? <>
                      <button type="button" className="btn btn-primary" onClick={() => vm.reunioesVm.confirmar(p.id, true)}><Icone nome="check" />Confirmar presença</button>
                      <button type="button" className="btn btn-outline" onClick={() => vm.reunioesVm.confirmar(p.id, false)}>Não vou</button>
                    </> : <button type="button" className="btn btn-primary" onClick={() => void vm.marcarRecebido(p.id)}><Icone nome="check" />Recebido</button>}
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
      </div>
      <div className="ini-coluna">
        {/* o Quadro de avisos sem a caixa: só os cards, das reuniões e dos avisos (Vitor, 18/11/2026: "tira essa box e deixa so os
            cards, tanto de aviso quanto de reuniao"; publicado para todos em 18/11/2026) */}
        {(vm.reunioes.length + vm.avisosNoQuadro.length > 0) && (
          <div className="ini-quadro-lista ini-quadro-solto" aria-label="Quadro de avisos">
            {/* ao passar o mouse, o card embaça e aparece o botão (Vitor, 18/11/2026): a presença, o Recebido ou o Abrir */}
            {vm.reunioes.map(r => r.mudanca ? (
              // a cancelada e o dia de antes da remarcada, por 24 h (24/11/2026): o ícone no lugar da data
              <CardDoQuadro key={'m' + r.id + r.mudanca} abrir={() => abrir(r.id)} mudou={r.mudanca} acao={null}
                marca={<span className="ini-quadro-dia" aria-hidden="true"><Icone nome={r.mudanca === 'cancelada' ? 'x' : 'repeat'} /><small>{r.quando.slice(8, 10)} {r.quando ? MESES[Number(r.quando.slice(5, 7)) - 1] : ''}</small></span>}
                titulo={r.tituloNaLista} detalhe={r.mudanca === 'cancelada' ? 'Cancelada · era ' + r.reuniao : 'Remarcada para ' + r.quandoNovo} pendente={false} />
            ) : (
              <CardDoQuadro key={'r' + r.id} abrir={() => abrir(r.id)}
                extra={r.podeRemarcar ? { rotulo: 'Remarcar', fazer: () => setRemarcando(r.id) } : null}
                // o Recebido da reunião vale como "vou" (Vitor, 18/11/2026, a opção 2): só o nome do botão muda
                // quem criou inicia pelo card (24/11/2026): o vermelho piscando para
                acao={r.podeIniciar ? { rotulo: 'Iniciar reunião', fazer: () => vm.reunioesVm.iniciar(r.id) }
                  : r.espera === 'presenca' ? { rotulo: 'Recebido', fazer: () => vm.reunioesVm.confirmar(r.id, true) }
                  : r.espera === 'recebido' ? { rotulo: 'Recebido', fazer: () => void vm.marcarRecebido(r.id) } : null}
                marca={<span className="ini-quadro-dia" aria-hidden="true"><b>{r.quando ? r.quando.slice(8, 10) : '—'}</b><small>{r.quando ? MESES[Number(r.quando.slice(5, 7)) - 1] : ''}</small></span>}
                titulo={r.tituloNaLista} detalhe={'Reunião · ' + r.reuniao} pendente={!!r.espera} noDia={r.pisca} />
            ))}
            {vm.avisosNoQuadro.map(a => (
              <CardDoQuadro key={'a' + a.id} abrir={() => abrir(a.id)} aviso
                acao={a.precisaReceber ? { rotulo: 'Recebido', fazer: () => void vm.marcarRecebido(a.id) } : null}
                marca={<span className="ini-quadro-dia" aria-hidden="true"><Icone nome={a.fixado ? 'mapaPin' : 'sino'} /></span>}
                titulo={a.titulo} detalhe={a.detalhe} pendente={a.precisaReceber} />
            ))}
          </div>
        )}
        {/* a dica, só por enquanto (Vitor, 18/11/2026: "coloca embaixo... so por enquanto, depois tiramos") */}
        {(vm.reunioes.length + vm.avisosNoQuadro.length > 0) && <p className="hint ini-quadro-dica"><Icone nome="lampada" width={13} height={13} />Passe o mouse em cima do aviso e marque recebido</p>}
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

/**
 * Um card do Quadro de avisos (modo desenvolvedor): ao passar o mouse (ou com o foco) o conteúdo embaça e aparece o botão no
 * meio — o Recebido (no aviso; na reunião, vale como "vou") ou, sem pendência, Abrir. No toque, o card só abre.
 */
function CardDoQuadro({ marca, titulo, detalhe, pendente, aviso, noDia, mudou, acao, extra, abrir }: {
  marca: ReactNode; titulo: string; detalhe: string; pendente: boolean; aviso?: boolean; noDia?: boolean; mudou?: 'cancelada' | 'remarcada';
  acao: { rotulo: string; fazer: () => void } | null;
  /** o segundo botão ao passar o mouse (o Remarcar, 24/11/2026) */
  extra?: { rotulo: string; fazer: () => void } | null;
  abrir: () => void;
}) {
  return (
    // noDia: a reunião de hoje que quem criou ainda não iniciou fica vermelha e pisca (24/11/2026)
    <div className={'ini-quadro-item' + (aviso ? ' aviso' : '') + (pendente ? ' pendente' : '') + (noDia ? ' no-dia' : '') + (mudou ? ' mudou ' + mudou : '')} role="button" tabIndex={0}
      onClick={abrir} onKeyDown={e => { if (e.key === 'Enter') abrir(); }}>
      <span className="ini-quadro-conteudo">
        {marca}
        <span className="ini-quadro-texto"><b>{titulo}</b><span className="hint">{detalhe}</span></span>
        <Icone nome="chevronRight" />
      </span>
      <span className="ini-quadro-hover">
        {extra && <button type="button" className="btn btn-outline" onClick={e => { e.stopPropagation(); extra.fazer(); }}><Icone nome="repeat" />{extra.rotulo}</button>}
        {acao
          ? <button type="button" className="btn btn-primary" onClick={e => { e.stopPropagation(); acao.fazer(); }}><Icone nome="check" />{acao.rotulo}</button>
          : <button type="button" className="btn btn-outline" onClick={e => { e.stopPropagation(); abrir(); }}>Abrir<Icone nome="chevronRight" /></button>}
      </span>
    </div>
  );
}
