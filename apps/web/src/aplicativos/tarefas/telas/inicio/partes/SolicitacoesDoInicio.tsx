// Os botões e as janelas das solicitações de reunião, no alto da aba Notificações do Início novo (Vitor, 13/11/2026). O
// Sênior: "Solicitações" (as suas, com a situação e a observação) e "+ Solicitar reunião". O Diretor e o Dono: "Solicitações"
// (as dos sêniores, com Aprovar ou Recusar e a observação) e "+ Adicionar aviso" (Reunião ou Aviso geral, marcados direto).
import { BotaoFechar, CampoData, Icone, MenuSuspenso, useJanela, Vazio } from '@nads/ui';
import { tarefas } from '@nads/core';
import { useRef, useState } from 'react';
import { Propriedade } from '../../financeiro/partes/Propriedade';
import type { useSolicitacoesDoInicio } from '../useSolicitacoesDoInicio';
import { NovoComunicado } from './NotificacoesDoInicio';

type Vm = ReturnType<typeof useSolicitacoesDoInicio>;
const SELO = { pendente: 'badge-warn', aprovada: 'badge-ok', recusada: 'badge-neutral' } as const;

function Janela({ titulo, fechar, children, pe }: { titulo: string; fechar: () => void; children: React.ReactNode; pe?: React.ReactNode }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, fechar);
  return (
    <div className="modal-overlay">
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="sino" />Notificações<Icone nome="chevronRight" /><b>{titulo}</b></span>
          <BotaoFechar onClick={fechar} />
        </header>
        <div className="registro-corpo">{children}</div>
        {pe && <footer className="registro-pe">{pe}</footer>}
      </div>
    </div>
  );
}

/** uma solicitação: o título, o dia pedido, quem e quando, a pauta; decidida, quem decidiu e a observação; para quem aprova, a decisão */
function Solicitacao({ x, vm }: { x: Vm['lista'][number]; vm: Vm }) {
  const [obs, setObs] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const decidir = async (aprovar: boolean) => { setOcupado(true); await vm.decidir(x.id, aprovar, obs); setOcupado(false); };
  return (
    <section className="card ini-solicitacao">
      <div className="ini-solicitacao-topo">
        <b>{x.titulo}</b>
        <span className={'badge badge-suave ' + SELO[x.situacao]}>{x.rotulo}</span>
      </div>
      <p className="hint"><Icone nome="calendar" width={12} height={12} /> {x.quandoTexto} · pedida por {x.por} em {x.pedidaEm}</p>
      <p className="ini-detalhe-texto">{x.texto}</p>
      {x.link && <a href={x.link} target="_blank" rel="noopener noreferrer">{x.link}</a>}
      {x.situacao !== 'pendente' && <p className="hint">{x.rotulo} por {x.decisao}{x.observacao && <><br /><b>Observação:</b> {x.observacao}</>}</p>}
      {vm.papel === 'aprova' && x.situacao === 'pendente' && (
        <div className="ini-solicitacao-decidir">
          <input type="text" value={obs} maxLength={vm.maiorObservacao} placeholder="Observação (opcional)" aria-label={'Observação para ' + x.por} onChange={e => setObs(e.target.value)} />
          <button type="button" className="btn btn-outline" disabled={ocupado} onClick={() => void decidir(false)}><Icone nome="x" />Recusar</button>
          <button type="button" className="btn btn-primary" disabled={ocupado} onClick={() => void decidir(true)}><Icone nome="check" />Aprovar</button>
        </div>
      )}
    </section>
  );
}

function JanelaDasSolicitacoes({ vm, fechar }: { vm: Vm; fechar: () => void }) {
  return (
    <Janela titulo="Solicitações" fechar={fechar}>
      {vm.papel === 'aprova' && <p className="registro-dica"><Icone nome="lampada" />A aprovada vira a reunião nas Notificações, em nome de quem pediu.</p>}
      {vm.lista.length ? vm.lista.map(x => <Solicitacao key={x.id} x={x} vm={vm} />)
        : <Vazio compacto icone="calendar" titulo={vm.papel === 'aprova' ? 'Nenhuma solicitação' : 'Você ainda não pediu reunião'} />}
    </Janela>
  );
}

function SolicitarReuniao({ vm, fechar }: { vm: Vm; fechar: () => void }) {
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [link, setLink] = useState('');
  const [texto, setTexto] = useState('');
  const dia = tarefas.delegadas.prazoDaTela(data);
  const pedido = { titulo, texto, link, quando: dia && hora ? dia + 'T' + hora : '' };
  const problema = vm.problemaDoPedido(pedido);
  const pedir = async () => { if (!problema && await vm.solicitar(pedido)) fechar(); };
  return (
    <Janela titulo="Solicitar reunião" fechar={fechar}
      pe={<><span className="tarefas-barra-espaco" /><button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
        <button type="button" className="btn btn-primary" disabled={!!problema} title={problema || 'Pedir ao Diretor'} onClick={() => void pedir()}><Icone nome="envelope" />Solicitar</button></>}>
      <p className="registro-dica"><Icone nome="lampada" />O Diretor aprova ou não; aprovada, a reunião aparece nas Notificações.</p>
      <input className="tdl-janela-titulo" type="text" value={titulo} autoFocus maxLength={tarefas.MAIOR_TITULO_DO_COMUNICADO} placeholder="O assunto da reunião" aria-label="O assunto da reunião" onChange={e => setTitulo(e.target.value)} />
      <div className="registro-props">
        <Propriedade icone="calendar" rotulo="Dia e hora">
          <span className="tdl-prazo-campos">
            <CampoData rotulo="Dia da reunião" valor={data} onMudar={setData} />
            <input type="time" value={hora} aria-label="Hora da reunião" onChange={e => setHora(e.target.value)} />
          </span>
        </Propriedade>
        <Propriedade icone="link" rotulo="Link">
          <input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="Opcional (https://…)" aria-label="Link da reunião" />
        </Propriedade>
      </div>
      <div className="field">
        <label htmlFor="ini-pauta">Pauta</label>
        <textarea id="ini-pauta" rows={4} value={texto} onChange={e => setTexto(e.target.value)} placeholder="O que vai ser tratado" />
      </div>
    </Janela>
  );
}

/** os botões do alto na aba Notificações (null: os de sempre, Delegar documentos e Nova tarefa) */
export function BotoesDasNotificacoes({ vm }: { vm: Vm }) {
  const [aberta, setAberta] = useState<'' | 'lista' | 'pedir' | 'reuniao' | 'aviso'>('');
  const fechar = () => setAberta('');
  if (vm.papel === 'nenhum') return null;
  return (
    <>
      <button type="button" className="btn btn-outline" onClick={() => setAberta('lista')}>
        <Icone nome="caixaEntrada" />Solicitações{vm.papel === 'aprova' && vm.pendentes > 0 && <span className="tdl-aba-qtd">{vm.pendentes}</span>}
      </button>
      {vm.papel === 'pede'
        ? <button type="button" className="btn btn-primary" onClick={() => setAberta('pedir')}><Icone nome="plus" />Solicitar reunião</button>
        : <MenuSuspenso rotulo="Adicionar aviso" icone="plus" className="btn btn-primary" direita largura={220} titulo="Adicionar aviso"
            itens={[
              { rotulo: 'Reunião', icone: 'calendar', onClick: () => setAberta('reuniao') },
              { rotulo: 'Aviso geral', icone: 'alert', onClick: () => setAberta('aviso') },
            ]} />}
      {aberta === 'lista' && <JanelaDasSolicitacoes vm={vm} fechar={fechar} />}
      {aberta === 'pedir' && <SolicitarReuniao vm={vm} fechar={fechar} />}
      {aberta === 'reuniao' && <NovoComunicado tipo="reuniao" fechar={fechar} />}
      {aberta === 'aviso' && <NovoComunicado tipo="aviso" fechar={fechar} />}
    </>
  );
}
