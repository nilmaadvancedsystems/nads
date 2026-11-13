// A tarefa numa janela por cima da lista (09/11/2026: "em uma popup, ao invés de abrir uma nova tela"; clicar fora não
// fecha, só o ✕, o Esc ou o Cancelar). No topo, o título para escrever (na nova, "Nova tarefa" é a dica do campo), o status e
// as abas Tarefa / Parecer / Histórico (a nova só tem o formulário). Em Tarefa, "Já estava fazendo" (só na nova), a
// descrição, os clientes vinculados, o Delegar, a prioridade, o prazo com a hora, o status e o painel Anexos; no pé, Excluir
// (só quem criou), os botões de quem faz a tarefa (Iniciar, Pausar, Retomar, Concluir) e Cancelar / Salvar.
import { Alerta, BotaoAcao, BotaoFechar, CampoData, Esqueleto, Icone, Interruptor, MenuSuspenso, Segmentado, useJanela, Vazio } from '@nads/ui';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { AnexosDaTarefa } from './partes/AnexosDaTarefa';
import { Link } from 'react-router';
import { LinhaDoTempoDaTarefa } from './partes/LinhaDoTempoDaTarefa';
import { SeloDoStatus } from './partes/SelosDaTarefa';
import { useNovidade } from '../../../../comum/novidades';
import { useTarefaAberta } from './useTarefaAberta';

type Vm = ReturnType<typeof useTarefaAberta>;

function FormularioDaTarefa({ vm }: { vm: Vm }) {
  const id = useId();
  const r = vm.rascunho;
  const so = !vm.podeMudar;
  const semSituacao = useNovidade('tarefa-sem-situacao');
  return (
    <>
      <div className="tdl-form">
        {/* o pedido de documentos (12/11/2026): quem recebe anexa no painel Anexos e confirma que anexou tudo */}
        {vm.pedeDocumentos && <p className="hint tdl-campo-largo">{vm.souQuemFaz ? 'Anexe os documentos no painel Anexos. Quando terminar, confirme em "Anexei tudo, concluir".' : 'Documentos delegados: quem receber anexa os arquivos aqui e confirma, e a tarefa fica concluída.'}</p>}
        {vm.caminhoDaEtapa && <div className="tdl-campo-largo"><Link className="btn btn-primary" to={vm.caminhoDaEtapa}><Icone nome="play" />Abrir a etapa</Link></div>}
        {vm.ehNova && !vm.delegar && (
          <label className="tdl-ja-fazendo tdl-campo-largo">
            <input type="checkbox" checked={vm.jaFazendo} onChange={e => vm.setJaFazendo(e.target.checked)} />Já estava fazendo
          </label>
        )}
        <div className="field tdl-campo-largo">
          <label htmlFor={id + '-descricao'}>Descrição detalhada</label>
          <textarea id={id + '-descricao'} rows={5} value={r.descricao} maxLength={vm.maiorDescricao} readOnly={so}
            placeholder="Os detalhes, o que já foi visto, onde estão os documentos" onChange={e => vm.setDescricao(e.target.value)} />
        </div>
        <div className="field tdl-campo-largo">
          <span className="tdl-rotulo">Clientes vinculados <span className="fraco">(opcional)</span></span>
          <ClientesDaTarefa vm={vm} so={so} />
        </div>
        <div className="field">
          {so ? <span className="field-rotulo" id={id + '-responsavel'}>Delegar para</span> : (
            <div className="tdl-delegar-topo">
              <span className="field-rotulo" id={id + '-responsavel'}>Delegar</span>
              <Interruptor ligado={vm.delegar} onMudar={vm.alternarDelegar} rotulo="Delegar para outra pessoa" />
            </div>
          )}
          {so || vm.delegar ? <EscolherPessoa vm={vm} so={so} rotuloId={id + '-responsavel'} /> : <FicaComVoce vm={vm} />}
        </div>
        <div className="field">
          <label htmlFor={id + '-prioridade'}>Prioridade</label>
          <select id={id + '-prioridade'} value={r.prioridade} disabled={so} onChange={e => vm.setPrioridade(e.target.value)}>
            {vm.prioridades.map(p => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={id + '-prazo'}>Prazo</label>
          {so ? <span>{vm.prazoTexto ? vm.prazoTexto + (vm.prazoHora ? ' ' + vm.prazoHora : '') : '—'}</span> : (
            <div className="tdl-prazo-campos">
              <CampoData id={id + '-prazo'} rotulo="Prazo" valor={vm.prazoTexto} onMudar={vm.setPrazo} />
              <input type="time" value={vm.prazoHora} aria-label="Hora do prazo" onChange={e => vm.setPrazoHora(e.target.value)} />
            </div>
          )}
          {vm.prazoInvalido && <p className="hint tdl-atrasada">Data incompleta ou que não existe.</p>}
        </div>
        {!vm.ehNova && !semSituacao && (
          <div className="field tdl-campo-largo">
            <span className="tdl-rotulo">Status</span>
            {so || !vm.mudaStatus ? <SeloDoStatus rotulo={vm.status?.rotulo || ''} tom={vm.status?.tom || 'neutral'} />
              : <Segmentado valor={r.status} opcoes={vm.opcoesDeStatus} onMudar={vm.setStatus} />}
          </div>
        )}
        {vm.datas.length > 0 && (
          <dl className="ent-dados tdl-campo-largo">
            {vm.datas.map(x => <div key={x.rotulo}><dt>{x.rotulo}</dt><dd>{x.valor}</dd></div>)}
          </dl>
        )}
      </div>
      <AnexosDaTarefa id={id + '-anexos'} anexos={vm.anexos} limite={vm.limiteDosAnexos} podeMudar={vm.podeMudar} anexando={vm.anexando}
        anexar={fs => { void vm.anexar(fs); }} baixar={a => { void vm.baixarAnexo(a); }} tirar={a => { void vm.tirarAnexo(a); }} />
    </>
  );
}

function ParecerDaTarefa({ vm }: { vm: Vm }) {
  const id = useId();
  if (vm.ehNova) return <Vazio compacto icone="mensagem" titulo="Salve a tarefa para escrever o parecer" />;
  return (
    <div className="tdl-parecer">
      {vm.podeMudar && (
        <div className="field">
          <label htmlFor={id}>Escrever um parecer</label>
          <textarea id={id} rows={3} value={vm.parecer} maxLength={vm.maiorParecer} placeholder="O que foi feito, o que falta, o que achou"
            onChange={e => vm.setParecer(e.target.value)} />
          <div className="tdl-parecer-pe">
            <BotaoAcao className="btn btn-primary" carregando={vm.escrevendo} textoCarregando="Gravando" disabled={!vm.parecer.trim()} onClick={() => { void vm.escreverParecer(); }}>
              <Icone nome="mensagem" width={16} height={16} />Gravar parecer
            </BotaoAcao>
          </div>
        </div>
      )}
      <LinhaDoTempoDaTarefa itens={vm.pareceres} vazio="Nenhum parecer ainda" comentario />
    </div>
  );
}

/**
 * saida: a Central pergunta por aqui antes de largar a tarefa (o Esc, o ×, clicar fora, trocar de aba): se mudou algo,
 * a janela "Descartar as mudanças?".
 */
export type Pessoa = ReturnType<typeof useTarefaAberta>['equipe'][number];

/** a foto de perfil (ou as iniciais) de uma pessoa da equipe, redonda */
export function FotoDaPessoa({ p }: { p: Pessoa }) {
  return <span className="pessoa-foto" aria-hidden="true">{p.foto ? <img src={p.foto} alt="" /> : p.iniciais}</span>;
}

/** os clientes vinculados: um selo para cada um (o × tira) e o "+", que abre a busca */
export function ClientesDaTarefa({ vm, so }: { vm: Vm; so: boolean }) {
  const nome = (c: { codigo: number | null; nome: string }) => <>{c.codigo != null && <><b>{c.codigo}</b> · </>}{c.nome}</>;
  if (so) return vm.clientes.length ? <div className="tdl-clientes">{vm.clientes.map(c => <span key={String(c.codigo) + c.nome}>{nome(c)}</span>)}</div> : <span>—</span>;
  return (
    <div className="tdl-clientes">
      {vm.clientes.map((c, i) => (
        <button key={String(c.codigo) + c.nome} type="button" className="btn btn-outline empresa-da-barra" title="Tirar este cliente" onClick={() => vm.tirarCliente(i)}>
          <Icone nome="briefcase" width={16} height={16} />
          <span className="empresa-da-barra-nome">{nome(c)}</span>
          <Icone nome="x" width={14} height={14} />
        </button>
      ))}
      {vm.podeMaisClientes && <MenuSuspenso rotulo="" icone="plus" semSeta flutuante largura={360} className="btn btn-outline" dica="Vincular um cliente" titulo="Vincular um cliente" conteudo={() => <BuscaDeCliente vm={vm} />} />}
    </div>
  );
}

/** a busca do "+": fica aberta para vincular mais de um; o Enter pega o primeiro achado */
function BuscaDeCliente({ vm }: { vm: Vm }) {
  const [q, setQ] = useState('');
  const campo = useRef<HTMLInputElement>(null);
  // o menu flutuante só aparece depois de medir o lugar: o autoFocus chegaria antes
  useEffect(() => { const t = window.setTimeout(() => campo.current?.focus(), 0); return () => window.clearTimeout(t); }, []);
  const achadas = vm.achadasPara(q);
  const escolher = (e: (typeof achadas)[number]) => { vm.adicionarCliente(e); setQ(''); campo.current?.focus(); };
  return (
    <div className="tdl-busca-cliente">
      <label className="busca-curta">
        <Icone nome="search" width={16} height={16} />
        <input ref={campo} type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="Empresa: código ou nome" aria-label="Buscar a empresa por código ou nome" autoComplete="off"
          onKeyDown={e => { if (e.key === 'Enter' && achadas[0]) { e.preventDefault(); escolher(achadas[0]); } }} />
      </label>
      <div role="listbox" aria-label="Empresas encontradas">
        {achadas.map(e => (
          <button key={String(e.codigo) + e.nome} type="button" className="popover-item" role="option" aria-selected={false} onClick={() => escolher(e)}>
            <span className="nf-achado-codigo">{e.codigo ?? '—'}</span>
            <span className="popover-texto">{e.nome}</span>
          </button>
        ))}
        {!achadas.length && <p className="hint">Nenhuma empresa com isso.</p>}
      </div>
    </div>
  );
}

/** o Delegar desligado: a tarefa fica com quem está escrevendo */
export function FicaComVoce({ vm }: { vm: ReturnType<typeof useTarefaAberta> }) {
  const eu = vm.equipe.find(p => p.voce);
  return <div className="pessoa-escolhida-fixa"><span className="pessoa-escolhida">{eu && <FotoDaPessoa p={eu} />}<span>{eu ? eu.nome : 'Você'}{eu && <span className="fraco"> (você)</span>}</span></span></div>;
}

/** o "Delegar para": o menu do nads com a foto de cada pessoa (no celular, no lugar da lista do sistema) */
export function EscolherPessoa({ vm, so, rotuloId }: { vm: ReturnType<typeof useTarefaAberta>; so: boolean; rotuloId: string }) {
  const atual = vm.equipe.find(p => p.uid === vm.rascunho.responsavel?.uid) || null;
  const rotulo = atual
    ? <span className="pessoa-escolhida"><FotoDaPessoa p={atual} /><span>{atual.nome}{atual.voce && <span className="fraco"> (você)</span>}</span></span>
    : <span className="pessoa-escolhida fraco">Escolha a pessoa</span>;
  if (so) return <div className="pessoa-escolhida-fixa" aria-labelledby={rotuloId}>{rotulo}</div>;
  return (
    <MenuSuspenso rotulo={rotulo} flutuante className="btn btn-outline pessoa-botao" titulo="Delegar para" dica="Escolher para quem delegar"
      conteudo={fechar => (
        <div className="pessoa-lista" role="listbox" aria-labelledby={rotuloId}>
          {vm.equipe.filter(p => !p.voce).map(p => (
            <button key={p.uid} type="button" className="popover-item" role="option" aria-selected={p.uid === atual?.uid}
              onClick={() => { vm.setResponsavel(p.uid); fechar(); }}>
              <FotoDaPessoa p={p} />
              <span className="popover-texto">{p.nome}{p.voce && <span className="fraco"> (você)</span>}</span>
              {p.uid === atual?.uid && <Icone nome="check" width={16} height={16} />}
            </button>
          ))}
        </div>
      )} />
  );
}

export function TarefaAberta({ alvo, voltar, criada, saida }: {
  alvo: string; voltar: () => void; criada: (paraMim: boolean) => void; saida: RefObject<((depois: () => void) => void) | null>;
}) {
  const vm = useTarefaAberta(alvo, voltar, criada);
  useEffect(() => {
    saida.current = depois => { void vm.largar(depois); };
    return () => { saida.current = null; };
  });
  // revisão da UI: o Esc pergunta antes de largar o que mudou, como o Cancelar; clicar fora não fecha
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.cancelar);
  const so = !vm.podeMudar;
  const ICONE = { iniciar: 'play', retomar: 'play', pausar: 'clock', concluir: 'check' } as const;
  return (
    <div className="modal-overlay">
      <div ref={janela} className="modal tdl-janela" role="dialog" aria-modal="true" aria-label={vm.ehNova ? (vm.pedeDocumentos ? 'Delegar documentos' : 'Nova tarefa') : 'Tarefa'}>
        <header className="tdl-janela-topo">
          {vm.numero && <span className="fraco num">{vm.numero}</span>}
          {so ? <h2 className="tdl-tarefa-titulo">{vm.rascunho.titulo}</h2> : (
            <input className="tdl-janela-titulo" type="text" value={vm.rascunho.titulo} maxLength={vm.maiorTitulo} autoFocus={vm.ehNova}
              placeholder="Nova tarefa" aria-label="Título da tarefa" onChange={e => vm.setTitulo(e.target.value)} />
          )}
          {vm.status && <SeloDoStatus rotulo={vm.status.rotulo} tom={vm.status.tom} />}
          <BotaoFechar onClick={vm.cancelar} />
        </header>
        {vm.carregando ? <div className="tdl-janela-corpo"><Esqueleto linhas={6} /></div> : vm.sumiu ? (
          <div className="tdl-janela-corpo"><Vazio icone="checklist" titulo="Esta tarefa não está mais na sua lista" texto="Ela foi excluída ou delegada para outra pessoa." /></div>
        ) : (
          <>
            <div className="tdl-janela-corpo tdl-tarefa">
              {!vm.ehNova && <Segmentado valor={vm.aba} opcoes={vm.abas} onMudar={vm.setAba} />}
              {/* na aba Tarefa, o erro fica junto do Salvar (29/10/2026: no alto do formulário, longe do botão, ninguém via e
                  parecia que o Salvar não gravava) */}
              {vm.erro && vm.aba !== 'tarefa' && <Alerta naLinha titulo={vm.erro} />}
              {so && <p className="hint">Só quem criou a tarefa e o responsável mudam esta tarefa.</p>}
              {vm.aba === 'tarefa' && <FormularioDaTarefa vm={vm} />}
              {vm.aba === 'parecer' && <ParecerDaTarefa vm={vm} />}
              {vm.aba === 'historico' && <LinhaDoTempoDaTarefa itens={vm.historico} vazio="Nada no histórico" />}
              {vm.erro && vm.aba === 'tarefa' && <Alerta naLinha titulo={vm.erro} />}
            </div>
            {vm.podeMudar && (
              <div className="tdl-tarefa-pe tdl-janela-pe">
                {vm.aba === 'tarefa' && vm.podeExcluir && (
                  <BotaoAcao className="btn btn-outline btn-danger" carregando={vm.excluindo} textoCarregando="Excluindo" onClick={() => { void vm.excluir(); }}>
                    <Icone nome="lixeira" width={16} height={16} />Excluir
                  </BotaoAcao>
                )}
                {vm.acoes.map(a => (
                  <button key={a.id} type="button" className="btn btn-outline" onClick={() => { void vm.fazerAcao(a.status); }}>
                    <Icone nome={ICONE[a.id]} width={16} height={16} />{a.rotulo}
                  </button>
                ))}
                <span className="tarefas-barra-espaco" />
                {vm.aba === 'tarefa' && <>
                  <button type="button" className="btn btn-outline" onClick={vm.cancelar}>Cancelar</button>
                  <BotaoAcao className="btn btn-primary" carregando={vm.salvando} textoCarregando="Salvando" onClick={() => { void vm.salvar(); }}>
                    <Icone nome="check" width={16} height={16} />{vm.ehNova && vm.delegar ? 'Salvar e delegar' : 'Salvar'}
                  </BotaoAcao>
                </>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
