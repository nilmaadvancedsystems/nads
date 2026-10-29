// A tarefa aberta na Central, no lugar da lista (28/10/2026, o cadastro de tarefas do Toriba): "‹ Voltar", o número e o
// status, e as abas Tarefa / Parecer / Histórico. Em Tarefa, o formulário (título, descrição, cliente vinculado, "Delegar
// para", prioridade, prazo, status, as datas) e o painel Anexos; no pé, Excluir (só quem criou) e Cancelar / Salvar.
import { Alerta, BotaoAcao, CampoData, Esqueleto, Icone, MenuSuspenso, Segmentado, Vazio } from '@nads/ui';
import { useEffect, useId, type RefObject } from 'react';
import { EmpresaDaBarra } from '../fiscal/partes/EmpresaDaBarra';
import { AnexosDaTarefa } from './partes/AnexosDaTarefa';
import { LinhaDoTempoDaTarefa } from './partes/LinhaDoTempoDaTarefa';
import { SeloDoStatus } from './partes/SelosDaTarefa';
import { useTarefaAberta } from './useTarefaAberta';

type Vm = ReturnType<typeof useTarefaAberta>;

function FormularioDaTarefa({ vm }: { vm: Vm }) {
  const id = useId();
  const r = vm.rascunho;
  const so = !vm.podeMudar;
  return (
    <>
      <div className="tdl-form">
        <div className="field tdl-campo-largo">
          <label htmlFor={id + '-titulo'}>Título</label>
          <input id={id + '-titulo'} type="text" value={r.titulo} maxLength={vm.maiorTitulo} readOnly={so} autoFocus={vm.ehNova}
            placeholder="O que precisa ser feito" onChange={e => vm.setTitulo(e.target.value)} />
        </div>
        <div className="field tdl-campo-largo">
          <label htmlFor={id + '-descricao'}>Descrição detalhada</label>
          <textarea id={id + '-descricao'} rows={5} value={r.descricao} maxLength={vm.maiorDescricao} readOnly={so}
            placeholder="Os detalhes, o que já foi visto, onde estão os documentos" onChange={e => vm.setDescricao(e.target.value)} />
        </div>
        <div className="field tdl-campo-largo">
          <span className="tdl-rotulo">Cliente vinculado <span className="fraco">(opcional)</span></span>
          {so ? <span>{r.cliente ? (r.cliente.codigo != null ? r.cliente.codigo + ' · ' : '') + r.cliente.nome : '—'}</span>
            // com a lista de achadas aberta, o Esc só limpa a busca (não larga a tarefa)
            : <div onKeyDown={e => { if (e.key === 'Escape' && vm.empresa.achadas.length) e.preventDefault(); }}><EmpresaDaBarra vm={vm.empresa} id={id + '-empresas'} /></div>}
        </div>
        <div className="field">
          <span className="field-rotulo" id={id + '-responsavel'}>Delegar para</span>
          <EscolherPessoa vm={vm} so={so} rotuloId={id + '-responsavel'} />
        </div>
        <div className="field">
          <label htmlFor={id + '-prioridade'}>Prioridade</label>
          <select id={id + '-prioridade'} value={r.prioridade} disabled={so} onChange={e => vm.setPrioridade(e.target.value)}>
            {vm.prioridades.map(p => <option key={p.valor} value={p.valor}>{p.rotulo}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={id + '-prazo'}>Prazo</label>
          {so ? <span>{vm.prazoTexto || '—'}</span> : <CampoData id={id + '-prazo'} rotulo="Prazo" valor={vm.prazoTexto} onMudar={vm.setPrazo} />}
          {vm.prazoInvalido && <p className="hint tdl-atrasada">Data incompleta ou que não existe.</p>}
        </div>
        <div className="field tdl-campo-largo">
          <span className="tdl-rotulo">Status</span>
          {so ? <SeloDoStatus rotulo={vm.status?.rotulo || ''} tom={vm.status?.tom || 'neutral'} />
            : <Segmentado valor={r.status} opcoes={vm.opcoesDeStatus} onMudar={vm.setStatus} />}
        </div>
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
type Pessoa = ReturnType<typeof useTarefaAberta>['equipe'][number];

/** a foto de perfil (ou as iniciais) de uma pessoa da equipe, redonda */
function FotoDaPessoa({ p }: { p: Pessoa }) {
  return <span className="pessoa-foto" aria-hidden="true">{p.foto ? <img src={p.foto} alt="" /> : p.iniciais}</span>;
}

/** o "Delegar para": o menu do nads com a foto de cada pessoa (no celular, no lugar da lista do sistema) */
function EscolherPessoa({ vm, so, rotuloId }: { vm: ReturnType<typeof useTarefaAberta>; so: boolean; rotuloId: string }) {
  const atual = vm.equipe.find(p => p.uid === vm.rascunho.responsavel?.uid) || null;
  const rotulo = atual
    ? <span className="pessoa-escolhida"><FotoDaPessoa p={atual} /><span>{atual.nome}{atual.voce && <span className="fraco"> (você)</span>}</span></span>
    : <span className="pessoa-escolhida fraco">Escolha a pessoa</span>;
  if (so) return <div className="pessoa-escolhida-fixa" aria-labelledby={rotuloId}>{rotulo}</div>;
  return (
    <MenuSuspenso rotulo={rotulo} className="btn btn-outline pessoa-botao" titulo="Delegar para" dica="Escolher para quem delegar"
      conteudo={fechar => (
        <div className="pessoa-lista" role="listbox" aria-labelledby={rotuloId}>
          {vm.equipe.map(p => (
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
  if (vm.carregando) return <Esqueleto linhas={6} />;
  if (vm.sumiu) {
    return (
      <Vazio icone="checklist" titulo="Esta tarefa não está mais na sua lista" texto="Ela foi excluída ou delegada para outra pessoa.">
        <button type="button" className="btn btn-outline" onClick={voltar}><Icone nome="chevronLeft" width={16} height={16} />Voltar</button>
      </Vazio>
    );
  }
  return (
    <div className="tdl-tarefa">
      <div className="tdl-tarefa-topo">
        <button type="button" className="btn btn-ghost" onClick={vm.cancelar} title="Voltar para a lista"><Icone nome="chevronLeft" width={16} height={16} />Voltar</button>
        <h2 className="tdl-tarefa-titulo">{vm.titulo}</h2>
        {vm.status && <SeloDoStatus rotulo={vm.status.rotulo} tom={vm.status.tom} />}
        <span className="tarefas-barra-espaco" />
        <Segmentado valor={vm.aba} opcoes={vm.abas} onMudar={vm.setAba} />
      </div>
      {vm.erro && <Alerta naLinha titulo={vm.erro} />}
      {!vm.podeMudar && <p className="hint">Só quem criou a tarefa e o responsável mudam esta tarefa.</p>}
      {vm.aba === 'tarefa' && <FormularioDaTarefa vm={vm} />}
      {vm.aba === 'parecer' && <ParecerDaTarefa vm={vm} />}
      {vm.aba === 'historico' && (vm.ehNova ? <Vazio compacto icone="clock" titulo="O histórico começa quando a tarefa é salva" />
        : <LinhaDoTempoDaTarefa itens={vm.historico} vazio="Nada no histórico" />)}
      {vm.aba === 'tarefa' && vm.podeMudar && (
        <div className="tdl-tarefa-pe">
          {vm.podeExcluir && (
            <BotaoAcao className="btn btn-outline btn-danger" carregando={vm.excluindo} textoCarregando="Excluindo" onClick={() => { void vm.excluir(); }}>
              <Icone nome="lixeira" width={16} height={16} />Excluir
            </BotaoAcao>
          )}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={vm.cancelar}>Cancelar</button>
          <BotaoAcao className="btn btn-primary" carregando={vm.salvando} textoCarregando="Salvando" onClick={() => { void vm.salvar(); }}>
            <Icone nome="check" width={16} height={16} />{vm.ehNova ? 'Salvar e delegar' : 'Salvar'}
          </BotaoAcao>
        </div>
      )}
    </div>
  );
}
