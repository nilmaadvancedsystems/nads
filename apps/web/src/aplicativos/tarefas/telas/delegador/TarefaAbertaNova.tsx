// A janela da tarefa do Início novo (13/11/2026, só no modo desenvolvedor; o mesmo ViewModel da TarefaAberta). A tarefa nova
// em dois passos (Vitor, 13/11/2026: "To achando poluido"): primeiro "Qual cliente vai ser essa tarefa?" (o menu com a busca
// ou o Avulso, com o campo e o ✓); depois, no desenho das janelas de registro, o cliente no alto (com Trocar), o nome, as
// propriedades (o prazo com as pílulas Hoje e Amanhã, a prioridade, para quem), os Detalhes e o clipe e o link. A tarefa que existe
// numa coluna só: o título, a descrição, os anexos e as informações (Vitor, 13/11/2026: "APENAS QUEM CRIOU A TAREFA pode setar:
// Prazo, prioridade, cliuentes, fica com e remova situação"; "Remove comentários e remove históricos!"). Clicar fora não fecha;
// o Esc e o ✕ perguntam antes de largar o que mudou.
import { tarefas } from '@nads/core';
import { Alerta, BotaoAcao, BotaoFechar, BotaoIcone, CampoData, Esqueleto, Icone, Interruptor, MenuSuspenso, Segmentado, useJanela, Vazio } from '@nads/ui';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router';
import { Propriedade } from '../financeiro/partes/Propriedade';
import { SeloDoStatus } from './partes/SelosDaTarefa';
import { useModoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';
import { lembrarAgora } from './useLembreteDoRecebimento';
import { ClientesDaTarefa, EscolherPessoa, FicaComVoce, FotoDaPessoa } from './TarefaAberta';
import { useTarefaAberta } from './useTarefaAberta';

type Vm = ReturnType<typeof useTarefaAberta>;
const d = tarefas.delegadas;
const ESCOLHA = 'btn btn-ghost registro-escolha';
const ICONE = { iniciar: 'play', retomar: 'play', pausar: 'clock', concluir: 'check' } as const;

/** as propriedades da tarefa (a nova e a coluna da esquerda da que existe) */
function Propriedades({ vm }: { vm: Vm }) {
  const id = useId();
  const r = vm.rascunho;
  const so = !vm.podeMudar;
  // o prazo, a prioridade, os clientes e para quem: só quem criou a tarefa muda
  const travado = so || !vm.criouEu;
  const hoje = d.prazoParaTela(d.hojeIso());
  const amanha = d.prazoParaTela(tarefas.agenda.somarDias(d.hojeIso(), 1));
  const prioridade = vm.prioridades.find(p => p.valor === r.prioridade)?.rotulo || '';
  // os documentos (13/11/2026): o prazo sem hora, o envio sem prazo nem prioridade, e sem a chave do delegar
  const docs = vm.pedeDocumentos, envio = vm.documentos.ehEnvio;
  return (
    <div className="registro-props">
      {!envio && <Propriedade icone="clock" rotulo="Prazo">
        {travado ? <span>{vm.prazoTexto ? vm.prazoTexto + (vm.prazoHora ? ' ' + vm.prazoHora : '') : '—'}</span> : (
          <span className="ini-prazo">
            <span className="chip-row">
              <button type="button" className={'chip-f' + (vm.prazoTexto === hoje ? ' on' : '')} aria-pressed={vm.prazoTexto === hoje} onClick={() => vm.setPrazo(vm.prazoTexto === hoje ? '' : hoje)}>Hoje</button>
              <button type="button" className={'chip-f' + (vm.prazoTexto === amanha ? ' on' : '')} aria-pressed={vm.prazoTexto === amanha} onClick={() => vm.setPrazo(vm.prazoTexto === amanha ? '' : amanha)}>Amanhã</button>
            </span>
            <span className="tdl-prazo-campos">
              <CampoData id={id + '-prazo'} rotulo="Prazo" valor={vm.prazoTexto} onMudar={vm.setPrazo} />
              {!docs && <input type="time" value={vm.prazoHora} aria-label="Hora do prazo" onChange={e => vm.setPrazoHora(e.target.value)} />}
            </span>
          </span>
        )}
      </Propriedade>}
      {vm.prazoInvalido && <p className="hint tdl-atrasada">Data incompleta ou que não existe.</p>}
      {!envio && <Propriedade icone="alert" rotulo="Prioridade">
        {travado ? <span>{prioridade}</span> : (
          <MenuSuspenso rotulo={prioridade} className={ESCOLHA} titulo="A prioridade" flutuante largura={200}
            itens={vm.prioridades.map(p => ({ rotulo: p.rotulo, marcado: p.valor === r.prioridade, onClick: () => vm.setPrioridade(p.valor) }))} />
        )}
      </Propriedade>}
      {!vm.ehNova && <Propriedade icone="briefcase" rotulo="Clientes"><ClientesDaTarefa vm={vm} so={travado} /></Propriedade>}
      <Propriedade icone="usuario" rotulo={vm.delegar || travado ? 'Para quem' : 'Fica com'}>
        <span className="ini-delegar">
          {travado || vm.delegar ? <EscolherPessoa vm={vm} so={travado} rotuloId={id + '-quem'} /> : <FicaComVoce vm={vm} />}
          {!travado && !docs && <Interruptor ligado={vm.delegar} onMudar={vm.alternarDelegar} rotulo="Delegar para outra pessoa" />}
        </span>
      </Propriedade>
      {vm.ehNova && !vm.delegar && (
        <label className="tdl-ja-fazendo"><input type="checkbox" checked={vm.jaFazendo} onChange={e => vm.setJaFazendo(e.target.checked)} />Já estava fazendo</label>
      )}
    </div>
  );
}

function Descricao({ vm }: { vm: Vm }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>Detalhes</label>
      <textarea id={id} rows={4} value={vm.rascunho.descricao} maxLength={vm.maiorDescricao} readOnly={!vm.podeMudar}
        placeholder="Os detalhes, o que já foi visto, onde estão os documentos" onChange={e => vm.setDescricao(e.target.value)} />
    </div>
  );
}

/**
 * os anexos e os links, curtos (Vitor, 13/11/2026: "Anexos a box tá muito grande, deixa só o icone do clip, tambem coloque o
 * icone de link, para fixar o link"): o clipe escolhe os arquivos, a corrente abre o campo do link; a lista só com algum
 */
function Anexos({ vm }: { vm: Vm }) {
  const id = useId();
  const [link, setLink] = useState<string | null>(null);
  const fixar = async () => { if (link != null && await vm.fixarLink(link)) setLink(null); };
  const tem = vm.anexos.length > 0 || vm.links.length > 0;
  return (
    <section className="ini-anexos" aria-label="Anexos e links">
      {vm.podeMudar && (
        <div className="ini-anexos-botoes">
          <label className={'icon-btn' + (vm.anexando ? ' is-disabled' : '')} title="Anexar arquivos" htmlFor={id}>
            <Icone nome="clipe" />
            <input id={id} type="file" multiple className="sr-only" disabled={vm.anexando} onChange={e => { const fs = Array.from(e.target.files || []); e.target.value = ''; if (fs.length) void vm.anexar(fs); }} />
          </label>
          <BotaoIcone icone="link" titulo="Fixar um link" aria-pressed={link != null} onClick={() => setLink(link == null ? '' : null)} />
          {link != null && (
            <span className="ini-anexos-link">
              <input type="url" value={link} autoFocus placeholder="Cole o link (https://…)" aria-label="O link" onChange={e => setLink(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void fixar(); } if (e.key === 'Escape') { e.stopPropagation(); setLink(null); } }} />
              <BotaoIcone icone="check" titulo="Fixar o link" onClick={() => void fixar()} />
            </span>
          )}
          {vm.anexando && <span className="hint">Anexando…</span>}
        </div>
      )}
      {tem && (
        <ul className="ini-anexos-lista">
          {vm.anexos.map(a => (
            <li key={a.id}>
              <Icone nome="clipe" />
              <button type="button" className="ini-abrir" title="Baixar" onClick={() => void vm.baixarAnexo(a.id)}>{a.nome}</button>
              <span className="hint">{a.detalhe}</span>
              {vm.podeMudar && <BotaoIcone pequeno icone="x" titulo={'Tirar ' + a.nome} onClick={() => void vm.tirarAnexo(a.id)} />}
            </li>
          ))}
          {vm.links.map(l => (
            <li key={l.url}>
              <Icone nome="link" />
              <a href={l.url} target="_blank" rel="noopener noreferrer">{l.url}</a>
              <span className="hint">{l.detalhe}</span>
              {vm.podeMudar && <BotaoIcone pequeno icone="x" titulo="Tirar o link" onClick={() => void vm.tirarLink(l.url)} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** o passo 1 da tarefa nova: o cliente do menu (com a busca) ou o Avulso (o nome e o ✓); ou sem cliente */
function QualCliente({ vm, seguir }: { vm: Vm; seguir: () => void }) {
  return (
    <div className="registro-corpo ini-qual-cliente">
      <h2 className="ini-passo-titulo">Qual cliente vai ser essa tarefa?</h2>
      <EscolherCliente vm={vm} depois={seguir} />
      <button type="button" className="btn btn-ghost ini-sem-cliente" onClick={seguir}>Tarefa sem cliente<Icone nome="chevronRight" /></button>
    </div>
  );
}

/** o cliente do menu (com a busca) ou o Avulso (o nome e o ✓) */
function EscolherCliente({ vm, depois }: { vm: Vm; depois: () => void }) {
  const [q, setQ] = useState('');
  const [avulso, setAvulso] = useState(false);
  const [nome, setNome] = useState('');
  const achadas = vm.achadasPara(q);
  const escolher = (fechar: () => void, e: { codigo: number | null; nome: string }) => { fechar(); vm.adicionarCliente(e); setQ(''); depois(); };
  const doAvulso = () => { const n = nome.trim(); if (!n) return; vm.adicionarCliente({ codigo: null, nome: n }); depois(); };
  return (
    <>
      <MenuSuspenso rotulo="Escolher o cliente" className="btn btn-outline ini-qual-menu" titulo="O cliente da tarefa" flutuante largura={420}
        conteudo={fechar => (
          <>
            <label className="busca-curta larga">
              <Icone nome="search" />
              <input type="text" placeholder="Buscar pelo nome ou código" aria-label="Buscar o cliente" value={q} onChange={e => setQ(e.target.value)}
                ref={el => { if (el && document.activeElement !== el) setTimeout(() => el.focus(), 0); }}
                onKeyDown={e => { if (e.key === 'Enter' && achadas[0]) escolher(fechar, achadas[0]); }} />
            </label>
            <div className="menu-busca-lista">
              {achadas.map(e => (
                <button key={String(e.codigo) + e.nome} type="button" className="popover-item" onClick={() => escolher(fechar, e)}>
                  <span className="popover-texto"><b className="num">{e.codigo ?? '—'}</b> {e.nome}</span>
                </button>
              ))}
              {!achadas.length && <p className="hint">Nenhuma empresa com isso.</p>}
            </div>
          </>
        )} />
      <label className="tdl-ja-fazendo"><input type="checkbox" checked={avulso} onChange={e => setAvulso(e.target.checked)} />Avulso (não está no cadastro)</label>
      {avulso && (
        <span className="ini-avulso">
          <input type="text" value={nome} autoFocus maxLength={150} placeholder="O nome do cliente" aria-label="O nome do cliente avulso" onChange={e => setNome(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doAvulso(); } }} />
          <BotaoIcone icone="check" titulo="Usar este nome" disabled={!nome.trim()} onClick={doAvulso} />
        </span>
      )}
    </>
  );
}

// ---- delegar documentos (Vitor, 13/11/2026: "Primeira tela, pedir ou enviar?", "selecionar o cliente (Pode selecionar
// avulso)", "as pessoas"; "na próxima tela… não tem prazo… nem prioridade… descrição e anexos em link e arquivo")

const nomeDoCliente = (c: { codigo: number | null; nome: string }) => (c.codigo != null ? c.codigo + ' · ' : '') + c.nome;

/** o cliente dos documentos (obrigatório, um só): escolhido, o nome com Trocar */
function ClienteDosDocumentos({ vm }: { vm: Vm }) {
  const c = vm.clientes[0];
  if (!c) return <span className="ini-qual-cliente"><EscolherCliente vm={vm} depois={() => undefined} /></span>;
  return (
    <span className="ini-cliente-escolhido">
      <span>{nomeDoCliente(c)}{c.codigo == null && <span className="fraco"> · avulso</span>}</span>
      <button type="button" className="btn btn-ghost" onClick={() => vm.tirarCliente(0)}><Icone nome="repeat" />Trocar</button>
    </span>
  );
}

/** para quem: no envio, uma ou mais pessoas (cada uma recebe a sua tarefa); no requerer, uma só */
function PessoasDosDocumentos({ vm }: { vm: Vm }) {
  const varias = vm.documentos.modo === 'enviar';
  const escolhidas = vm.equipe.filter(p => vm.documentos.pessoas.includes(p.uid));
  const rotulo = escolhidas.length
    ? <span className="pessoa-escolhida">{escolhidas.length === 1 && <FotoDaPessoa p={escolhidas[0]} />}<span>{escolhidas.map(p => p.nome).join(', ')}</span></span>
    : <span className="pessoa-escolhida fraco">{varias ? 'Escolha as pessoas' : 'Escolha a pessoa'}</span>;
  return (
    <MenuSuspenso rotulo={rotulo} flutuante className="btn btn-outline pessoa-botao" titulo="Para quem" dica={varias ? 'Uma ou mais pessoas' : 'Uma pessoa'}
      conteudo={fechar => (
        <div className="pessoa-lista" role="listbox" aria-multiselectable={varias} aria-label="Para quem">
          {vm.equipe.filter(p => !p.voce).map(p => {
            const sim = vm.documentos.pessoas.includes(p.uid);
            return (
              <button key={p.uid} type="button" className="popover-item" role="option" aria-selected={sim} onClick={() => { vm.documentos.alternarPessoa(p.uid); if (!varias) fechar(); }}>
                <FotoDaPessoa p={p} />
                <span className="popover-texto">{p.nome}</span>
                {sim && <Icone nome="check" width={16} height={16} />}
              </button>
            );
          })}
        </div>
      )} />
  );
}

/** o passo 1 dos documentos: enviar ou requerer, e o cliente (ou avulso) */
function DocumentosPasso1({ vm }: { vm: Vm }) {
  const m = vm.documentos.modo;
  return (
    <div className="registro-corpo ini-qual-cliente">
      <h2 className="ini-passo-titulo">Enviar ou requerer documentos?</h2>
      <Segmentado<'' | tarefas.delegadas.ModoDosDocumentos> valor={m ?? ''} onMudar={v => { if (v) vm.documentos.escolherModo(v); }}
        opcoes={[{ valor: 'enviar', rotulo: 'Enviar documentos' }, { valor: 'requerer', rotulo: 'Requerer documentos' }]} />
      {m && <p className="registro-dica"><Icone nome="clipe" />{m === 'requerer' ? 'Quem recebe anexa os arquivos e envia; você confere e conclui, ou contesta o que faltou.' : 'Quem recebe baixa os arquivos e confirma o recebimento.'}</p>}
      <div className="registro-props">
        <Propriedade icone="briefcase" rotulo="Cliente"><ClienteDosDocumentos vm={vm} /></Propriedade>
      </div>
    </div>
  );
}

/** o passo 2 dos documentos: para quem e, no requerer, o prazo (sem hora) e a prioridade */
function PropriedadesDosDocumentos({ vm }: { vm: Vm }) {
  const id = useId();
  const hoje = d.prazoParaTela(d.hojeIso());
  const amanha = d.prazoParaTela(tarefas.agenda.somarDias(d.hojeIso(), 1));
  const prioridade = vm.prioridades.find(p => p.valor === vm.rascunho.prioridade)?.rotulo || '';
  return (
    <div className="registro-props">
      <Propriedade icone="usuario" rotulo="Para quem"><PessoasDosDocumentos vm={vm} /></Propriedade>
      {vm.documentos.modo === 'requerer' && (
        <>
          <Propriedade icone="clock" rotulo="Prazo">
            <span className="ini-prazo">
              <span className="chip-row">
                <button type="button" className={'chip-f' + (vm.prazoTexto === hoje ? ' on' : '')} aria-pressed={vm.prazoTexto === hoje} onClick={() => vm.setPrazo(vm.prazoTexto === hoje ? '' : hoje)}>Hoje</button>
                <button type="button" className={'chip-f' + (vm.prazoTexto === amanha ? ' on' : '')} aria-pressed={vm.prazoTexto === amanha} onClick={() => vm.setPrazo(vm.prazoTexto === amanha ? '' : amanha)}>Amanhã</button>
              </span>
              <CampoData id={id + '-prazo'} rotulo="Prazo" valor={vm.prazoTexto} onMudar={vm.setPrazo} />
            </span>
          </Propriedade>
          {vm.prazoInvalido && <p className="hint tdl-atrasada">Data incompleta ou que não existe.</p>}
          <Propriedade icone="alert" rotulo="Prioridade">
            <MenuSuspenso rotulo={prioridade} className={ESCOLHA} titulo="A prioridade" flutuante largura={200}
              itens={vm.prioridades.map(p => ({ rotulo: p.rotulo, marcado: p.valor === vm.rascunho.prioridade, onClick: () => vm.setPrioridade(p.valor) }))} />
          </Propriedade>
        </>
      )}
    </div>
  );
}

/** os botões da tarefa de documentos que já existe: confirmar o recebimento, enviar, repassar, contestar, confirmar que veio tudo */
function AcoesDosDocumentos({ vm }: { vm: Vm }) {
  return (
    <>
      {vm.documentos.acoes.map(a => (a.id === 'repassar' ? (
        <MenuSuspenso key={a.id} rotulo="Repassar" icone="repeat" className="btn btn-outline" flutuante titulo="Repassar para" dica="Quem pode ter o documento"
          conteudo={fechar => (
            <div className="pessoa-lista" role="listbox" aria-label="Repassar para">
              {vm.documentos.paraRepassar.map(p => (
                <button key={p.uid} type="button" className="popover-item" role="option" aria-selected={false} onClick={() => { fechar(); void vm.documentos.repassarPara(p.uid); }}>
                  <FotoDaPessoa p={p} /><span className="popover-texto">{p.nome}</span>
                </button>
              ))}
            </div>
          )} />
      ) : (
        <button key={a.id} type="button" className={'btn ' + (a.id === 'contestar' ? 'btn-outline' : 'btn-primary')} onClick={() => { void vm.documentos.fazer(a.id); }}>
          <Icone nome={a.id === 'contestar' ? 'alert' : 'check'} />{a.rotulo}
        </button>
      )))}
    </>
  );
}

/**
 * o ⚡ Dados de teste da janela (só no modo desenvolvedor): preenche o envio ou o requerer de exemplo (e o Criar não grava
 * nada) e mostra o lembrete de confirmar o recebimento sem esperar os 10 minutos. Os casos já andando (enviado esperando a
 * confirmação, requerido contestado e repassado) vêm no "Tarefas de exemplo" do ⚡ do Início.
 */
function TesteDosDocumentos({ vm }: { vm: Vm }) {
  const [dev] = useModoDesenvolvedor();
  if (!dev) return null;
  return (
    <MenuSuspenso rotulo="Dados de teste" icone="zap" className="btn btn-outline" direita largura={300} titulo="Modo desenvolvedor · nada vai para o banco"
      itens={[
        { rotulo: 'Exemplo de envio', icone: 'zap', marcado: vm.documentos.deTeste && vm.documentos.modo === 'enviar', onClick: () => vm.documentos.preencherExemplo('enviar') },
        { rotulo: 'Exemplo de requerer', icone: 'zap', marcado: vm.documentos.deTeste && vm.documentos.modo === 'requerer', onClick: () => vm.documentos.preencherExemplo('requerer') },
        'separador',
        { rotulo: 'Mostrar o lembrete de confirmar', icone: 'clock', onClick: lembrarAgora },
      ]} />
  );
}

export function TarefaAbertaNova({ alvo, voltar, criada, saida }: {
  alvo: string; voltar: () => void; criada: (paraMim: boolean) => void; saida: RefObject<((depois: () => void) => void) | null>;
}) {
  const vm = useTarefaAberta(alvo, voltar, criada, true);
  useEffect(() => {
    saida.current = depois => { void vm.largar(depois); };
    return () => { saida.current = null; };
  });
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.cancelar);
  const so = !vm.podeMudar;
  // a tarefa nova começa pelo cliente (o passo 1); com o cliente escolhido (ou sem cliente), vai para o resto
  const [passo, setPasso] = useState<'cliente' | 'tarefa'>('cliente');
  // os documentos no Início novo: a janela própria em dois passos (sem o título, o prazo e a prioridade)
  const docs = vm.ehNova && vm.pedeDocumentos;
  // a tarefa de documentos que já existe: o fluxo dela no lugar do Iniciar, Pausar e Concluir
  const deDocumentos = !vm.ehNova && vm.pedeDocumentos;
  const trocarCliente = () => { vm.clientes.forEach(() => vm.tirarCliente(0)); setPasso('cliente'); };
  const nome = vm.ehNova ? (vm.pedeDocumentos ? 'Delegar documentos' : 'Nova tarefa') : 'Tarefa ' + (vm.numero || '');

  const titulo = so ? <h2 className="tdl-tarefa-titulo">{vm.rascunho.titulo}</h2> : (
    <input className="tdl-janela-titulo" type="text" value={vm.rascunho.titulo} maxLength={vm.maiorTitulo} autoFocus={vm.ehNova}
      placeholder={vm.ehNova ? 'O nome da tarefa' : 'Título'} aria-label="Título da tarefa" onChange={e => vm.setTitulo(e.target.value)} />
  );
  const pe = vm.podeMudar && (
    <footer className="registro-pe">
      {!vm.ehNova && vm.podeExcluir && (
        <BotaoAcao className="btn btn-outline btn-danger" carregando={vm.excluindo} textoCarregando="Excluindo" onClick={() => { void vm.excluir(); }}>
          <Icone nome="lixeira" />Excluir
        </BotaoAcao>
      )}
      {deDocumentos ? <AcoesDosDocumentos vm={vm} /> : vm.acoes.map(a => (
        <button key={a.id} type="button" className="btn btn-outline" onClick={() => { void vm.fazerAcao(a.status); }}><Icone nome={ICONE[a.id]} />{a.rotulo}</button>
      ))}
      <span className="tarefas-barra-espaco" />
      <button type="button" className="btn btn-outline" onClick={vm.cancelar}>Cancelar</button>
      <BotaoAcao className="btn btn-primary" carregando={vm.salvando} textoCarregando="Salvando" onClick={() => { void vm.salvar(); }}>
        <Icone nome="check" />{vm.ehNova ? (vm.delegar ? 'Criar e delegar' : 'Criar tarefa') : 'Salvar'}
      </BotaoAcao>
    </footer>
  );

  return (
    <div className="modal-overlay">
      <div ref={janela} className="modal registro-novo" role="dialog" aria-modal="true" aria-label={nome}>
        <header className="registro-topo">
          <span className="registro-caminho"><b>{nome}</b></span>
          {vm.status && <SeloDoStatus rotulo={vm.status.rotulo} tom={vm.status.tom} />}
          {docs && <TesteDosDocumentos vm={vm} />}
          <BotaoFechar onClick={vm.cancelar} />
        </header>
        {vm.carregando ? <div className="registro-corpo"><Esqueleto linhas={6} /></div> : vm.sumiu ? (
          <div className="registro-corpo"><Vazio icone="checklist" titulo="Esta tarefa não está mais na sua lista" texto="Ela foi excluída ou delegada para outra pessoa." /></div>
        ) : docs && passo === 'cliente' ? (
          <>
            <DocumentosPasso1 vm={vm} />
            <footer className="registro-pe">
              <span className="tarefas-barra-espaco" />
              <button type="button" className="btn btn-outline" onClick={vm.cancelar}>Cancelar</button>
              <button type="button" className="btn btn-primary" disabled={!!vm.documentos.faltaNoPasso1} title={vm.documentos.faltaNoPasso1 || undefined} onClick={() => setPasso('tarefa')}>
                Continuar<Icone nome="chevronRight" />
              </button>
            </footer>
          </>
        ) : docs ? (
          <>
            <div className="registro-corpo">
              <p className="registro-dica"><Icone nome="clipe" />{vm.documentos.modo === 'enviar' ? 'Anexe os arquivos ou cole o link do que vai enviar.' : 'Diga quais documentos precisa; quem receber anexa e envia.'}</p>
              <div className="ini-cliente-escolhido">
                <Icone nome="briefcase" />
                <span>{vm.clientes.map(nomeDoCliente).join(', ')}</span>
                <button type="button" className="btn btn-ghost" onClick={() => setPasso('cliente')}><Icone nome="chevronLeft" />Voltar</button>
              </div>
              <PropriedadesDosDocumentos vm={vm} />
              <Descricao vm={vm} />
              <Anexos vm={vm} />
              {vm.erro && <Alerta naLinha titulo={vm.erro} />}
            </div>
            <footer className="registro-pe">
              <span className="tarefas-barra-espaco" />
              <button type="button" className="btn btn-outline" onClick={vm.cancelar}>Cancelar</button>
              <BotaoAcao className="btn btn-primary" carregando={vm.salvando} textoCarregando="Delegando" onClick={() => { void vm.salvar(); }}>
                <Icone nome="check" />{vm.documentos.modo === 'enviar' ? 'Enviar documentos' : 'Requerer documentos'}
              </BotaoAcao>
            </footer>
          </>
        ) : vm.ehNova && passo === 'cliente' ? (
          <>
            <QualCliente vm={vm} seguir={() => setPasso('tarefa')} />
            <footer className="registro-pe"><span className="tarefas-barra-espaco" /><button type="button" className="btn btn-outline" onClick={vm.cancelar}>Cancelar</button></footer>
          </>
        ) : vm.ehNova ? (
          <>
            <div className="registro-corpo">
              {vm.pedeDocumentos && <p className="registro-dica"><Icone nome="clipe" />Quem receber anexa os arquivos e confirma; a tarefa fica concluída.</p>}
              <div className="ini-cliente-escolhido">
                <Icone nome="briefcase" />
                <span>{vm.clientes.length ? vm.clientes.map(c => (c.codigo != null ? c.codigo + ' · ' : '') + c.nome).join(', ') : 'Sem cliente'}{vm.clientes.some(c => c.codigo == null) && <span className="fraco"> · avulso</span>}</span>
                <button type="button" className="btn btn-ghost" onClick={trocarCliente}><Icone nome="repeat" />Trocar</button>
              </div>
              {titulo}
              <Propriedades vm={vm} />
              <Descricao vm={vm} />
              <Anexos vm={vm} />
              {vm.erro && <Alerta naLinha titulo={vm.erro} />}
            </div>
            {pe}
          </>
        ) : (
          <>
            <div className="registro-corpo">
              {deDocumentos && <p className="registro-dica"><Icone nome="clipe" />{vm.documentos.situacao}</p>}
              {vm.caminhoDaEtapa && <Link className="btn btn-primary" to={vm.caminhoDaEtapa}><Icone nome="play" />Abrir a etapa</Link>}
              {titulo}
              <Descricao vm={vm} />
              <Anexos vm={vm} />
              <h3 className="ini-tarefa-sub">Informações</h3>
              <Propriedades vm={vm} />
              {vm.datas.length > 0 && <dl className="ent-dados">{vm.datas.map(x => <div key={x.rotulo}><dt>{x.rotulo}</dt><dd>{x.valor}</dd></div>)}</dl>}
              {so ? <p className="hint">Só quem criou a tarefa e o responsável mudam esta tarefa.</p>
                : !vm.criouEu && <p className="hint">O prazo, a prioridade, os clientes e para quem só quem criou a tarefa muda.</p>}
              {vm.erro && <Alerta naLinha titulo={vm.erro} />}
            </div>
            {pe}
          </>
        )}
      </div>
    </div>
  );
}
