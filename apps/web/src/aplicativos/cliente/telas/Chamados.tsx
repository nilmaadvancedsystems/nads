// As Solicitações da Área do Cliente como lista + painel (12/11/2026: "refaz essa parte inteira"; a escolhida: "lista +
// painel ao lado"). À esquerda os filtros e a lista (a situação, o título, o assunto, a data e a prévia da última
// resposta); à direita o painel: a solicitação escolhida (as etapas, o pedido, a resposta do escritório, enviar arquivos
// e o WhatsApp) ou a nova (o assunto em cartões, depois o formulário). No celular, um de cada vez. Só desenha: o estado e
// as ações vêm de useChamados.ts.
import { Icone, type NomeIcone } from '@nads/ui';
import { useId } from 'react';
import type { areaCliente as ac } from '@nads/core';
import { AreaDeSoltar } from '../partes/AreaDeSoltar';
import { Vazio } from '../partes/Vazio';
import { useChamados } from './useChamados';
import type { DaCasca } from './useAreaCliente';

const SELO: Record<string, string> = { respondido: 'badge badge-ok', concluido: 'badge badge-neutral', aberto: 'badge badge-warn', 'em andamento': 'badge badge-warn' };
const ICONE_DO_ASSUNTO: Record<ac.TipoDeChamado, NomeIcone> = { admissao: 'usuario', ferias: 'calendar', demissao: 'usuario', duvida: 'ajuda', documento: 'arquivo', outro: 'mensagem' };

export function Chamados(props: DaCasca) {
  const vm = useChamados(props);
  const idAnexo = useId();
  const s = vm.atual;
  return (
    <>
      <div className="cli-titulo">
        <div>
          <h1 className="page-title">Solicitações</h1>
          <p className="hint cli-titulo-sub">Peça o que precisar ao escritório e acompanhe a resposta aqui.</p>
        </div>
        <div className="cli-acoes">
          <button type="button" className="btn btn-primary" onClick={vm.nova}><Icone nome="plus" width={16} height={16} />Nova solicitação</button>
        </div>
      </div>

      <div className={'cli-sol' + (vm.painelNoCelular ? ' painel-aberto' : '')}>
        {/* a lista */}
        <section className="card cli-sol-lista">
          <div className="cli-sol-filtros" role="tablist" aria-label="Filtrar">
            {vm.filtros.map(f => (
              <button key={f.id} type="button" role="tab" aria-selected={f.ativo} className={'cli-sol-filtro' + (f.ativo ? ' ativo' : '')} onClick={() => vm.escolherFiltro(f.id)}>
                {f.rotulo}<b>{f.n}</b>
              </button>
            ))}
          </div>
          {vm.lista.length ? (
            <ul>
              {vm.lista.map(c => (
                <li key={c.id}>
                  <button type="button" className={'cli-sol-item s-' + c.situacao.replace(' ', '-') + (c.escolhida ? ' escolhida' : '')} aria-current={c.escolhida ? 'true' : undefined} onClick={() => vm.abrir(c.id)}>
                    <span className="cli-sol-item-topo"><b>{c.titulo}</b><span className="cli-sol-data">{c.atualizada}</span></span>
                    <span className="cli-sol-item-meio"><span className={SELO[c.situacao]}>{c.rotulo}</span><span className="hint">{c.assunto}</span></span>
                    <span className={'cli-sol-previa' + (c.previaDoEscritorio ? ' do-escritorio' : '')}>{c.previaDoEscritorio && <b>Escritório: </b>}{c.previa}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : vm.total ? <p className="hint cli-sol-vazio">Nenhuma solicitação neste filtro.</p>
            : <Vazio icone="mensagem" titulo="Nenhuma solicitação ainda" texto="Use a Nova solicitação para pedir o que precisar." />}
        </section>

        {/* o painel */}
        <section className="card cli-sol-painel" aria-live="polite">
          <button type="button" className="btn btn-ghost btn-sm cli-sol-voltar" onClick={vm.voltar}><Icone nome="chevronLeft" width={16} height={16} />Voltar à lista</button>

          {vm.modo === 'nova' ? (
            !vm.tipo ? (
              <>
                <div className="cli-sol-cabeca"><h2>Nova solicitação</h2><p className="hint">Sobre o que é?</p></div>
                <div className="cli-sol-assuntos">
                  {vm.tipos.map(t => (
                    <button key={t.valor} type="button" className="cli-sol-assunto" onClick={() => vm.escolherTipo(t.valor)}>
                      <span className="cli-sol-assunto-ico"><Icone nome={ICONE_DO_ASSUNTO[t.valor]} width={18} height={18} /></span>
                      <b>{t.rotulo}</b>
                      <span className="hint">{t.dica}</span>
                    </button>
                  ))}
                </div>
                <div className="cli-sol-rodape"><button type="button" className="btn btn-ghost" onClick={vm.cancelarNova}>Cancelar</button></div>
              </>
            ) : (
              <>
                <div className="cli-sol-cabeca">
                  <h2>Nova solicitação</h2>
                  <p className="hint">Assunto: <b>{vm.rotuloDoTipo}</b> · <button type="button" className="cli-link-mini" onClick={() => vm.escolherTipo('')}>trocar</button></p>
                </div>
                <div className="cli-sol-form">
                  <div className="field">
                    <label htmlFor="cli-titulo-chamado">Título resumido</label>
                    <input id="cli-titulo-chamado" type="text" value={vm.titulo} onChange={e => vm.mudarTitulo(e.target.value)} placeholder="Ex.: certidão negativa estadual" />
                  </div>
                  <div className="field">
                    <label htmlFor="cli-texto">O que você precisa</label>
                    <textarea id="cli-texto" rows={5} value={vm.texto} onChange={e => vm.mudarTexto(e.target.value)} placeholder="Os dados, os nomes, os prazos ou o que mais for importante." />
                  </div>
                  <div className="field">
                    <span className="cli-sol-rotulo">Prioridade</span>
                    <span className="chip-row" role="radiogroup" aria-label="Prioridade" style={{ margin: 0 }}>
                      {vm.prioridades.map(p => <button key={p} type="button" role="radio" aria-checked={vm.prioridade === p} className={'chip-f' + (vm.prioridade === p ? ' on' : '')} onClick={() => vm.mudarPrioridade(p)}>{p}</button>)}
                    </span>
                  </div>
                  <div className="cli-sol-anexo">
                    <label className="btn btn-ghost btn-sm" htmlFor={idAnexo}><Icone nome="clipe" width={16} height={16} />{vm.anexo ? vm.anexo.name : 'Anexar um arquivo'}</label>
                    <input id={idAnexo} type="file" className="sr-only" accept={vm.aceitar} onChange={e => { vm.mudarAnexo(e.target.files?.[0] ?? null); e.target.value = ''; }} />
                    {vm.anexo ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => vm.mudarAnexo(null)}>Tirar</button> : <span className="hint">até {vm.limite}</span>}
                  </div>
                  {vm.erro && <p className="cli-erro" role="alert">{vm.erro}</p>}
                </div>
                <div className="cli-sol-rodape">
                  <button type="button" className="btn btn-ghost" onClick={vm.cancelarNova}>Cancelar</button>
                  <button type="button" className="btn btn-primary" disabled={vm.enviando} onClick={vm.criar}><Icone nome="seta" width={16} height={16} />{vm.enviando ? 'Enviando…' : 'Enviar solicitação'}</button>
                </div>
              </>
            )
          ) : s ? (
            <>
              <div className="cli-sol-cabeca">
                <h2>{s.titulo}</h2>
                <p className="hint">{s.assunto} · aberta em {s.abertaEm}</p>
              </div>
              {/* as etapas: onde a solicitação está */}
              <ol className="cli-sol-etapas" aria-label="Situação">
                {vm.passos.map((p, i) => (
                  <li key={p} className={i < s.passo ? 'feito' : i === s.passo ? 'atual' : ''} aria-current={i === s.passo ? 'step' : undefined}>
                    <span className="cli-sol-etapa-ponto">{i < s.passo ? <Icone nome="check" width={12} height={12} /> : i + 1}</span>
                    <span>{i === vm.passos.length - 1 && s.passo === i ? s.rotulo : p}</span>
                  </li>
                ))}
              </ol>
              <div className="cli-sol-bloco">
                <p className="cli-sol-rotulo">Seu pedido</p>
                <p className="cli-sol-texto">{s.pedido}</p>
                {s.complementos.map((t, i) => <p key={i} className="cli-sol-texto cli-sol-complemento">{t}</p>)}
              </div>
              <div className={'cli-sol-bloco cli-sol-resposta' + (s.respostas.length ? ' tem' : '')}>
                <p className="cli-sol-rotulo">Resposta do escritório</p>
                {s.respostas.length
                  ? s.respostas.map((r, i) => <p key={i} className="cli-sol-texto">{r.texto}<span className="hint"> · {r.quando}</span></p>)
                  : <p className="hint">Ainda sem resposta. Quando o escritório responder, aparece aqui.</p>}
              </div>
              {s.aceitaArquivo && (
                <div className="cli-sol-bloco">
                  <p className="cli-sol-rotulo">Enviar arquivos para esta solicitação</p>
                  <AreaDeSoltar aceitar={vm.aceitar} dica={s.anexando ? 'Enviando…' : 'PDF, JPG, PNG, XML ou ZIP, até ' + vm.limite + ' cada'} desabilitada={s.anexando} onArquivos={fs => vm.anexar(s.id, fs)} />
                  {s.erroDoAnexo && <p className="cli-erro" role="alert">{s.erroDoAnexo}</p>}
                </div>
              )}
              {s.whatsapp && (
                <div className="cli-sol-rodape">
                  <span className="hint">Quer conversar sobre isso?</span>
                  <a className="btn" href={s.whatsapp} target="_blank" rel="noreferrer"><Icone nome="celular" width={16} height={16} />Falar no WhatsApp</a>
                </div>
              )}
            </>
          ) : (
            <Vazio icone="mensagem" titulo="Escolha uma solicitação" texto="Ou use a Nova solicitação para pedir algo ao escritório." />
          )}
        </section>
      </div>
    </>
  );
}
