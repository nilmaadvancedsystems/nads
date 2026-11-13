// A janela da tarefa do Início novo (13/11/2026, só no modo desenvolvedor; o mesmo ViewModel da TarefaAberta). A tarefa nova
// (o print do New task) é uma coluna no desenho das janelas de registro: o título, as propriedades (o prazo com as pílulas
// Hoje e Amanhã, a prioridade, os clientes, para quem) e a descrição. A tarefa que existe (o print da tarefa aberta) tem duas
// colunas: à esquerda o título, a descrição e as informações; à direita os comentários (o parecer) ou o histórico, os anexos
// e, embaixo, a caixa de escrever. Clicar fora não fecha; o Esc e o ✕ perguntam antes de largar o que mudou.
import { tarefas } from '@nads/core';
import { Alerta, BotaoAcao, BotaoFechar, CampoData, Esqueleto, Icone, Interruptor, MenuSuspenso, Segmentado, useJanela, Vazio } from '@nads/ui';
import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router';
import { Propriedade } from '../financeiro/partes/Propriedade';
import { AnexosDaTarefa } from './partes/AnexosDaTarefa';
import { LinhaDoTempoDaTarefa } from './partes/LinhaDoTempoDaTarefa';
import { SeloDoStatus } from './partes/SelosDaTarefa';
import { ClientesDaTarefa, EscolherPessoa, FicaComVoce } from './TarefaAberta';
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
  const hoje = d.prazoParaTela(d.hojeIso());
  const amanha = d.prazoParaTela(tarefas.agenda.somarDias(d.hojeIso(), 1));
  const prioridade = vm.prioridades.find(p => p.valor === r.prioridade)?.rotulo || '';
  return (
    <div className="registro-props">
      <Propriedade icone="clock" rotulo="Prazo">
        {so ? <span>{vm.prazoTexto ? vm.prazoTexto + (vm.prazoHora ? ' ' + vm.prazoHora : '') : '—'}</span> : (
          <span className="ini-prazo">
            <span className="chip-row">
              <button type="button" className={'chip-f' + (vm.prazoTexto === hoje ? ' on' : '')} aria-pressed={vm.prazoTexto === hoje} onClick={() => vm.setPrazo(vm.prazoTexto === hoje ? '' : hoje)}>Hoje</button>
              <button type="button" className={'chip-f' + (vm.prazoTexto === amanha ? ' on' : '')} aria-pressed={vm.prazoTexto === amanha} onClick={() => vm.setPrazo(vm.prazoTexto === amanha ? '' : amanha)}>Amanhã</button>
            </span>
            <span className="tdl-prazo-campos">
              <CampoData id={id + '-prazo'} rotulo="Prazo" valor={vm.prazoTexto} onMudar={vm.setPrazo} />
              <input type="time" value={vm.prazoHora} aria-label="Hora do prazo" onChange={e => vm.setPrazoHora(e.target.value)} />
            </span>
          </span>
        )}
      </Propriedade>
      {vm.prazoInvalido && <p className="hint tdl-atrasada">Data incompleta ou que não existe.</p>}
      <Propriedade icone="alert" rotulo="Prioridade">
        {so ? <span>{prioridade}</span> : (
          <MenuSuspenso rotulo={prioridade} className={ESCOLHA} titulo="A prioridade" flutuante largura={200}
            itens={vm.prioridades.map(p => ({ rotulo: p.rotulo, marcado: p.valor === r.prioridade, onClick: () => vm.setPrioridade(p.valor) }))} />
        )}
      </Propriedade>
      <Propriedade icone="briefcase" rotulo="Clientes"><ClientesDaTarefa vm={vm} so={so} /></Propriedade>
      <Propriedade icone="usuario" rotulo={vm.delegar || so ? 'Para quem' : 'Fica com'}>
        <span className="ini-delegar">
          {so || vm.delegar ? <EscolherPessoa vm={vm} so={so} rotuloId={id + '-quem'} /> : <FicaComVoce vm={vm} />}
          {!so && <Interruptor ligado={vm.delegar} onMudar={vm.alternarDelegar} rotulo="Delegar para outra pessoa" />}
        </span>
      </Propriedade>
      {!vm.ehNova && (
        <Propriedade icone="checklist" rotulo="Situação">
          {so || !vm.mudaStatus ? <SeloDoStatus rotulo={vm.status?.rotulo || ''} tom={vm.status?.tom || 'neutral'} />
            : <Segmentado valor={r.status} opcoes={vm.opcoesDeStatus} onMudar={vm.setStatus} />}
        </Propriedade>
      )}
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
      <label htmlFor={id}>Descrição</label>
      <textarea id={id} rows={4} value={vm.rascunho.descricao} maxLength={vm.maiorDescricao} readOnly={!vm.podeMudar}
        placeholder="Os detalhes, o que já foi visto, onde estão os documentos" onChange={e => vm.setDescricao(e.target.value)} />
    </div>
  );
}

function Anexos({ vm }: { vm: Vm }) {
  const id = useId();
  return (
    <AnexosDaTarefa id={id} anexos={vm.anexos} limite={vm.limiteDosAnexos} podeMudar={vm.podeMudar} anexando={vm.anexando}
      anexar={fs => { void vm.anexar(fs); }} baixar={a => { void vm.baixarAnexo(a); }} tirar={a => { void vm.tirarAnexo(a); }} />
  );
}

/** a coluna da direita: os comentários (o parecer) ou o histórico, os anexos e a caixa de escrever */
function Conversa({ vm }: { vm: Vm }) {
  const [qual, setQual] = useState<'comentarios' | 'historico'>('comentarios');
  return (
    <div className="ini-tarefa-direita">
      <Segmentado valor={qual} onMudar={setQual} opcoes={[{ valor: 'comentarios', rotulo: vm.abas[1].rotulo.replace('Parecer', 'Comentários') }, { valor: 'historico', rotulo: 'Histórico' }]} />
      <div className="ini-tarefa-rola">
        {qual === 'comentarios'
          ? <LinhaDoTempoDaTarefa itens={vm.pareceres} vazio="Nenhum comentário ainda" comentario />
          : <LinhaDoTempoDaTarefa itens={vm.historico} vazio="Nada no histórico" />}
        <Anexos vm={vm} />
      </div>
      {vm.podeMudar && qual === 'comentarios' && (
        <div className="ini-escrever">
          <textarea rows={2} value={vm.parecer} maxLength={vm.maiorParecer} placeholder="Escrever um comentário" aria-label="Escrever um comentário"
            onChange={e => vm.setParecer(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && vm.parecer.trim()) { e.preventDefault(); void vm.escreverParecer(); } }} />
          <BotaoAcao className="btn btn-primary" carregando={vm.escrevendo} textoCarregando="Gravando" disabled={!vm.parecer.trim()} onClick={() => { void vm.escreverParecer(); }}>
            <Icone nome="mensagem" />Comentar
          </BotaoAcao>
        </div>
      )}
    </div>
  );
}

export function TarefaAbertaNova({ alvo, voltar, criada, saida }: {
  alvo: string; voltar: () => void; criada: (paraMim: boolean) => void; saida: RefObject<((depois: () => void) => void) | null>;
}) {
  const vm = useTarefaAberta(alvo, voltar, criada);
  useEffect(() => {
    saida.current = depois => { void vm.largar(depois); };
    return () => { saida.current = null; };
  });
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.cancelar);
  const so = !vm.podeMudar;
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
      {vm.acoes.map(a => (
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
      <div ref={janela} className={'modal registro-novo' + (vm.ehNova ? '' : ' ini-tarefa')} role="dialog" aria-modal="true" aria-label={nome}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="checklist" />Início<Icone nome="chevronRight" /><b>{nome}</b></span>
          {vm.status && <SeloDoStatus rotulo={vm.status.rotulo} tom={vm.status.tom} />}
          <BotaoFechar onClick={vm.cancelar} />
        </header>
        {vm.carregando ? <div className="registro-corpo"><Esqueleto linhas={6} /></div> : vm.sumiu ? (
          <div className="registro-corpo"><Vazio icone="checklist" titulo="Esta tarefa não está mais na sua lista" texto="Ela foi excluída ou delegada para outra pessoa." /></div>
        ) : vm.ehNova ? (
          <>
            <div className="registro-corpo">
              {vm.pedeDocumentos && <p className="registro-dica"><Icone nome="clipe" />Quem receber anexa os arquivos e confirma; a tarefa fica concluída.</p>}
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
            <div className="ini-tarefa-corpo">
              <div className="ini-tarefa-esquerda">
                {vm.pedeDocumentos && <p className="registro-dica"><Icone nome="clipe" />{vm.souQuemFaz ? 'Anexe os documentos e confirme em "Anexei tudo, concluir".' : 'Documentos delegados: quem recebe anexa e confirma.'}</p>}
                {vm.caminhoDaEtapa && <Link className="btn btn-primary" to={vm.caminhoDaEtapa}><Icone nome="play" />Abrir a etapa</Link>}
                {titulo}
                <Descricao vm={vm} />
                <h3 className="ini-tarefa-sub">Informações</h3>
                <Propriedades vm={vm} />
                {vm.datas.length > 0 && <dl className="ent-dados">{vm.datas.map(x => <div key={x.rotulo}><dt>{x.rotulo}</dt><dd>{x.valor}</dd></div>)}</dl>}
                {so && <p className="hint">Só quem criou a tarefa e o responsável mudam esta tarefa.</p>}
                {vm.erro && <Alerta naLinha titulo={vm.erro} />}
              </div>
              <Conversa vm={vm} />
            </div>
            {pe}
          </>
        )}
      </div>
    </div>
  );
}
