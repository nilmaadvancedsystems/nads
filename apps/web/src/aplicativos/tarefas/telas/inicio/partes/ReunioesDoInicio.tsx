// As reuniões nas Notificações do Início novo (Vitor, 13/11/2026). No alto, só na aba Notificações: o Sênior tem
// "Solicitações" (os pedidos dele) e "+ Solicitar reunião"; o Diretor e o Dono, "Solicitações" (as que esperam a decisão) e
// "+ Adicionar aviso" (Reunião, marcada direto, ou Aviso geral); os outros níveis ficam com Delegar documentos e Nova tarefa.
// À direita das Notificações, o detalhe da reunião escolhida: o status, quem vai (e quem confirmou), a decisão, a pauta, os
// arquivos do Problema e da Solução, os comentários e os botões do que a pessoa pode fazer agora (tarefas.reunioes.acoes).
import { tarefas } from '@nads/core';
import { BotaoFechar, CampoData, Icone, MenuSuspenso, useJanela, Vazio } from '@nads/ui';
import { useRef, useState, type ReactNode } from 'react';
import { Propriedade } from '../../financeiro/partes/Propriedade';
import type { useReunioesDoInicio } from '../useReunioesDoInicio';
import { NovoComunicado } from './NotificacoesDoInicio';

type Vm = ReturnType<typeof useReunioesDoInicio>;
type Item = Vm['lista'][number];
type Pessoa = { uid: string; nome: string };
const SELO = { warn: 'badge-warn', info: 'badge-info', ok: 'badge-ok', neutral: 'badge-neutral', bad: 'badge-bad' } as const;
const dataDoCampo = (br: string, hora: string) => { const d = tarefas.delegadas.prazoDaTela(br); return d && hora ? d + 'T' + hora : ''; };

export function SeloDaReuniao({ x }: { x: Pick<Item, 'rotulo' | 'tom'> }) {
  return <span className={'badge badge-suave ' + SELO[x.tom]}>{x.rotulo}</span>;
}

function Janela({ titulo, fechar, children, pe }: { titulo: string; fechar: () => void; children: ReactNode; pe?: ReactNode }) {
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

/** escolher várias pessoas da equipe (o menu fica aberto; cada clique marca ou desmarca) */
export function EscolherPessoas({ equipe, escolhidas, alternar, vazio = 'Escolher as pessoas' }: { equipe: readonly Pessoa[]; escolhidas: readonly Pessoa[]; alternar: (p: Pessoa) => void; vazio?: string }) {
  const rotulo = escolhidas.length ? (escolhidas.length <= 2 ? escolhidas.map(p => p.nome).join(' e ') : escolhidas.length + ' pessoas') : vazio;
  return (
    <MenuSuspenso rotulo={rotulo} className={'btn btn-ghost registro-escolha' + (escolhidas.length ? '' : ' vazio')} titulo="As pessoas" flutuante largura={260}
      conteudo={() => (
        <div className="menu-busca-lista">
          {equipe.map(p => {
            const marcada = escolhidas.some(x => x.uid === p.uid);
            return (
              <button key={p.uid} type="button" className="popover-item" role="menuitemcheckbox" aria-checked={marcada} onClick={() => alternar(p)}>
                <span className="popover-marca">{marcada && <Icone nome="check" />}</span><span className="popover-texto">{p.nome}</span>
              </button>
            );
          })}
          {!equipe.length && <p className="hint">Ninguém na equipe.</p>}
        </div>
      )} />
  );
}

/** pedir (o Sênior) ou marcar (o Diretor e o Dono: entra aprovada e todos veem) a reunião */
function NovaReuniao({ vm, fechar }: { vm: Vm; fechar: () => void }) {
  const direta = vm.papel === 'aprova';
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState('');
  const [hora, setHora] = useState('');
  const [link, setLink] = useState('');
  const [pauta, setPauta] = useState('');
  const [participantes, setParticipantes] = useState<Pessoa[]>([]);
  const [comDiretor, setComDiretor] = useState(false);
  const pedido = { titulo, pauta, link, quando: dataDoCampo(data, hora), participantes, comDiretor };
  const problema = vm.problemaDoPedido(pedido);
  const enviar = async () => { if (!problema && await vm.pedir(pedido)) fechar(); };
  const alternar = (p: Pessoa) => setParticipantes(x => (x.some(y => y.uid === p.uid) ? x.filter(y => y.uid !== p.uid) : [...x, p]));
  return (
    <Janela titulo={direta ? 'Marcar reunião' : 'Solicitar reunião'} fechar={fechar}
      pe={<><span className="tarefas-barra-espaco" /><button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
        <button type="button" className="btn btn-primary" disabled={!!problema} title={problema || undefined} onClick={() => void enviar()}><Icone nome={direta ? 'check' : 'envelope'} />{direta ? 'Marcar' : 'Solicitar'}</button></>}>
      <p className="registro-dica"><Icone nome="lampada" />{direta ? 'Marcada por você, a reunião já aparece para todos.' : 'O Diretor ou o Dono aprova ou não; aprovada, os convidados confirmam a presença.'}</p>
      <input className="tdl-janela-titulo" type="text" value={titulo} autoFocus maxLength={tarefas.MAIOR_TITULO_DO_COMUNICADO} placeholder="O assunto da reunião" aria-label="O assunto da reunião" onChange={e => setTitulo(e.target.value)} />
      <div className="registro-props">
        <Propriedade icone="calendar" rotulo="Dia e hora">
          <span className="tdl-prazo-campos">
            <CampoData rotulo="Dia da reunião" valor={data} onMudar={setData} />
            <input type="time" value={hora} aria-label="Hora da reunião" onChange={e => setHora(e.target.value)} />
          </span>
        </Propriedade>
        <Propriedade icone="usuario" rotulo="Quem vai"><EscolherPessoas equipe={vm.equipe} escolhidas={participantes} alternar={alternar} vazio="Escolher os convidados" /></Propriedade>
        {!direta && <label className="tdl-ja-fazendo"><input type="checkbox" checked={comDiretor} onChange={e => setComDiretor(e.target.checked)} />O Diretor ou o Dono participa</label>}
        <Propriedade icone="link" rotulo="Link"><input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="Opcional (https://…)" aria-label="Link da reunião" /></Propriedade>
      </div>
      <div className="field">
        <label htmlFor="ini-pauta">Pauta</label>
        <textarea id="ini-pauta" rows={4} value={pauta} onChange={e => setPauta(e.target.value)} placeholder="O que vai ser tratado" />
      </div>
    </Janela>
  );
}

/** as solicitações: para o Diretor e o Dono, as que esperam a decisão; para o Sênior, os pedidos dele. Clicar abre o detalhe. */
function Solicitacoes({ vm, fechar, escolher }: { vm: Vm; fechar: () => void; escolher: (id: string) => void }) {
  return (
    <Janela titulo="Solicitações" fechar={fechar}>
      {vm.solicitacoes.length ? vm.solicitacoes.map(x => (
        <button key={x.id} type="button" className="popover-item ini-comunicado" onClick={() => { escolher(x.id); fechar(); }}>
          <Icone nome="calendar" />
          <span className="popover-texto"><b>{x.titulo}</b><br /><span className="hint">{x.quandoTexto} · pedida por {x.criadaPor.nome}</span></span>
          <SeloDaReuniao x={x} />
        </button>
      )) : <Vazio compacto icone="calendar" titulo={vm.papel === 'aprova' ? 'Nenhuma reunião esperando a decisão' : 'Você ainda não pediu reunião'} />}
    </Janela>
  );
}

/** os botões do alto na aba Notificações; null para quem só participa (ficam os de sempre) */
export function BotoesDasNotificacoes({ vm, escolher }: { vm: Vm; escolher: (id: string) => void }) {
  const [aberta, setAberta] = useState<'' | 'lista' | 'reuniao' | 'aviso'>('');
  const fechar = () => setAberta('');
  if (vm.papel === 'participa') return null;
  return (
    <>
      <button type="button" className="btn btn-outline" onClick={() => setAberta('lista')}>
        <Icone nome="caixaEntrada" />Solicitações{vm.pendentes > 0 && <span className="tdl-aba-qtd">{vm.pendentes}</span>}
      </button>
      {vm.papel === 'pede'
        ? <button type="button" className="btn btn-primary" onClick={() => setAberta('reuniao')}><Icone nome="plus" />Solicitar reunião</button>
        : <MenuSuspenso rotulo="Adicionar aviso" icone="plus" className="btn btn-primary" direita largura={220} titulo="Adicionar aviso"
            itens={[
              { rotulo: 'Reunião', icone: 'calendar', onClick: () => setAberta('reuniao') },
              { rotulo: 'Aviso geral', icone: 'alert', onClick: () => setAberta('aviso') },
            ]} />}
      {aberta === 'lista' && <Solicitacoes vm={vm} fechar={fechar} escolher={escolher} />}
      {aberta === 'reuniao' && <NovaReuniao vm={vm} fechar={fechar} />}
      {aberta === 'aviso' && <NovoComunicado tipo="aviso" fechar={fechar} />}
    </>
  );
}

/** um arquivo do fim da reunião: baixar o que tem; anexar (ou trocar) quando pode */
function Arquivo({ x, vm, qual, rotulo }: { x: Item; vm: Vm; qual: 'problema' | 'solucao'; rotulo: string }) {
  const a = x[qual];
  const pode = x.acoes.includes('anexar');
  return (
    <ul className="ini-anexos-lista ini-reuniao-arquivo">
      <li>
        <Icone nome="clipe" />
        <b>{rotulo}:</b>
        {a ? <button type="button" className="ini-abrir" title="Baixar" onClick={() => void vm.baixar(x.id, qual)}>{a.nome}</button> : <span className="fraco">ainda não anexado</span>}
        {pode && (
          <label className="btn btn-outline ini-reuniao-anexar">
            <Icone nome="upload" />{a ? 'Trocar' : 'Anexar'}
            <input type="file" accept={vm.aceita} className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void vm.anexar(x.id, qual, f); }} />
          </label>
        )}
      </li>
    </ul>
  );
}

/** o detalhe da reunião escolhida, com as ações de quem está vendo */
export function DetalheDaReuniao({ x, vm }: { x: Item; vm: Vm }) {
  const [obs, setObs] = useState('');
  const [prazo, setPrazo] = useState('');
  const [nova, setNova] = useState({ data: '', hora: '' });
  const [comentario, setComentario] = useState('');
  const pode = (a: tarefas.reunioes.AcaoDaReuniao) => x.acoes.includes(a);
  const presenca = (p: Pessoa) => { const r = x.presencas.find(y => y.uid === p.uid); return r ? (r.vai ? ' · vai' : ' · não vai') : ' · sem resposta'; };
  return (
    <section className="card ini-detalhe ini-reuniao">
      <div className="ini-detalhe-topo">
        <h2>{x.titulo}</h2>
        <SeloDaReuniao x={x} />
      </div>
      <div className="registro-props">
        <Propriedade icone="calendar" rotulo="Quando"><b>{x.quandoTexto}</b></Propriedade>
        <Propriedade icone="usuario" rotulo={x.origem === 'direta' ? 'Marcada por' : 'Pedida por'}><span>{x.criadaPor.nome} · {x.pedidaEm}</span></Propriedade>
        <Propriedade icone="usuario" rotulo="Quem vai">
          <span>{x.participantes.length ? x.participantes.map(p => p.nome + presenca(p)).join(', ') : (x.origem === 'direta' ? 'Todos' : '—')}{x.comDiretor && x.origem === 'pedido' && <span className="fraco"> · com o Diretor</span>}</span>
        </Propriedade>
        {x.link && <Propriedade icone="link" rotulo="Link"><a href={x.link} target="_blank" rel="noopener noreferrer">{x.link}</a></Propriedade>}
        {x.status === 'revisando' && x.prazoDaRevisao && <Propriedade icone="clock" rotulo="Resposta até"><span>{x.prazoDaRevisao.split('-').reverse().join('/')}</span></Propriedade>}
        {x.decididoPor && <Propriedade icone="check" rotulo={x.status === 'recusada' ? 'Recusada por' : 'Aprovada por'}><span>{x.decididoPor}{x.observacao && <><br /><b>Observação:</b> {x.observacao}</>}</span></Propriedade>}
      </div>
      <p className="ini-detalhe-texto">{x.pauta}</p>

      {(x.statusAgora === 'em-andamento' || x.problema || x.solucao) && (
        <>
          <h3 className="ini-tarefa-sub">O fim da reunião</h3>
          <Arquivo x={x} vm={vm} qual="problema" rotulo="Problema identificado" />
          <Arquivo x={x} vm={vm} qual="solucao" rotulo="Solução proposta" />
        </>
      )}
      {(x.comentarios.length > 0 || x.status === 'finalizada') && (
        <>
          <h3 className="ini-tarefa-sub">Comentários</h3>
          {x.comentarios.map(c => <p key={c.uid} className="ini-reuniao-comentario"><b>{c.nome}:</b> {c.texto}</p>)}
          {x.faltaComentar.length > 0 && <p className="hint">Falta comentar: {x.faltaComentar.join(', ')}</p>}
        </>
      )}
      {x.souResponsavel && x.semResposta.length > 0 && (x.status === 'aprovada' || x.status === 'remarcada') && <p className="hint">Ainda não responderam se vão: {x.semResposta.join(', ')}</p>}

      <div className="ini-reuniao-acoes">
        {pode('confirmar') && (
          <div className="ini-reuniao-linha">
            <span>Você vai?{x.minhaPresenca != null && <span className="fraco"> (respondeu: {x.minhaPresenca ? 'vou' : 'não vou'})</span>}</span>
            <button type="button" className={'btn ' + (x.minhaPresenca === true ? 'btn-primary' : 'btn-outline')} onClick={() => void vm.confirmar(x.id, true)}><Icone nome="check" />Vou</button>
            <button type="button" className={'btn ' + (x.minhaPresenca === false ? 'btn-primary' : 'btn-outline')} onClick={() => void vm.confirmar(x.id, false)}><Icone nome="x" />Não vou</button>
          </div>
        )}
        {pode('revisar') && (
          <div className="ini-reuniao-linha">
            <span>Revisar, com resposta até</span>
            <CampoData rotulo="Prazo da resposta" valor={prazo} onMudar={setPrazo} />
            <button type="button" className="btn btn-outline" disabled={!tarefas.delegadas.prazoDaTela(prazo)} onClick={() => { const p = tarefas.delegadas.prazoDaTela(prazo); if (p) void vm.revisar(x.id, p); }}><Icone nome="clock" />Revisando</button>
          </div>
        )}
        {pode('aprovar') && (
          <div className="ini-reuniao-linha">
            <input type="text" value={obs} maxLength={tarefas.reunioes.MAIOR_OBSERVACAO} placeholder="Observação (opcional)" aria-label="Observação" onChange={e => setObs(e.target.value)} />
            <button type="button" className="btn btn-outline" onClick={() => void vm.decidir(x.id, false, obs)}><Icone nome="x" />Recusar</button>
            <button type="button" className="btn btn-primary" onClick={() => void vm.decidir(x.id, true, obs)}><Icone nome="check" />Aprovar</button>
          </div>
        )}
        {pode('remarcar') && (
          <div className="ini-reuniao-linha">
            <span>Remarcar para</span>
            <CampoData rotulo="Novo dia" valor={nova.data} onMudar={v => setNova(n => ({ ...n, data: v }))} />
            <input type="time" value={nova.hora} aria-label="Nova hora" onChange={e => setNova(n => ({ ...n, hora: e.target.value }))} />
            <button type="button" className="btn btn-outline" disabled={!dataDoCampo(nova.data, nova.hora)} onClick={() => void vm.remarcar(x.id, dataDoCampo(nova.data, nova.hora))}><Icone nome="repeat" />Remarcar</button>
          </div>
        )}
        {pode('finalizar') && (
          <div className="ini-reuniao-linha">
            <span>{x.origem === 'direta' ? 'Com os dois arquivos, a reunião fica Encerrada.' : 'Com os dois arquivos, quem participou comenta o que achou.'}</span>
            <button type="button" className="btn btn-primary" onClick={() => void vm.finalizar(x.id)}><Icone nome="check" />Finalizar</button>
          </div>
        )}
        {pode('comentar') && (
          <div className="ini-reuniao-linha">
            <textarea rows={2} value={comentario} maxLength={tarefas.reunioes.MAIOR_COMENTARIO} placeholder="O que achou da reunião (ou algum comentário a mais)" aria-label="O seu comentário" onChange={e => setComentario(e.target.value)} />
            <button type="button" className="btn btn-primary" disabled={!comentario.trim()} onClick={() => { void vm.comentar(x.id, comentario); setComentario(''); }}><Icone nome="mensagem" />Comentar</button>
          </div>
        )}
        {pode('encerrar') && (
          <div className="ini-reuniao-linha">
            <span>Os arquivos e os comentários estão completos.</span>
            <button type="button" className="btn btn-primary" onClick={() => void vm.encerrar(x.id)}><Icone nome="check" />Encerrar</button>
          </div>
        )}
      </div>
      {x.historico.length > 0 && <p className="hint ini-reuniao-historico">{x.historico.slice(-4).map(h => h.por + ': ' + h.texto).join(' · ')}</p>}
    </section>
  );
}
