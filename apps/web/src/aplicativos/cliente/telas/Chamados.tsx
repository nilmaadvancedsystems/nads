// As Solicitações da Área do Cliente como lista + painel (12/11/2026: "refaz essa parte inteira"; a escolhida: "lista +
// painel ao lado"). À esquerda os filtros e a lista (a situação, o título, o assunto, a data e a prévia da última
// resposta); à direita o painel: a solicitação escolhida (as etapas, o pedido, a resposta do escritório, enviar arquivos
// e o WhatsApp) ou a nova (o assunto em cartões, depois o formulário). No celular, um de cada vez. Só desenha: o estado e
// as ações vêm de useChamados.ts.
import { Icone, type NomeIcone } from '@nads/ui';
import { useId } from 'react';
import type { areaCliente as ac } from '@nads/core';
import { AreaDeSoltar } from '../partes/AreaDeSoltar';
import { Avatar } from '../partes/Avatar';
import { WhatsAppContorno } from '../partes/WhatsAppContorno';
import { MarcaDoEscritorio } from '../partes/MarcaDoEscritorio';
import { Vazio } from '../partes/Vazio';
import { useChamados } from './useChamados';
import type { DaCasca } from './useAreaCliente';

const SELO: Record<string, string> = { respondido: 'badge badge-ok', concluido: 'badge badge-neutral', aberto: 'badge badge-warn', 'em andamento': 'badge badge-warn' };
const VAZIO_DO_FILTRO: Record<string, string> = { todas: 'Nenhuma solicitação.', abertas: 'Nada em andamento no escritório.', respondidas: 'Nenhuma resposta esperando você.', concluidas: 'Nenhuma solicitação concluída.' };
const ICONE_DO_ASSUNTO: Record<ac.TipoDeChamado, NomeIcone> = { admissao: 'usuario', ferias: 'calendar', demissao: 'logOut', duvida: 'ajuda', documento: 'arquivo', outro: 'mensagem' };

export function Chamados(props: DaCasca) {
  const vm = useChamados(props);
  const idAnexo = useId();
  const s = vm.atual;
  return (
    <>
      <div className="cli-titulo">
        <div>
          <h1 className="page-title">Solicitações</h1>
          {vm.resumo && <p className="cli-subtitulo">{vm.resumo}</p>}
        </div>
        <div className="cli-acoes">
          <button type="button" className="btn btn-primary" data-tutorial="nova-solicitacao" onClick={vm.nova}><Icone nome="plus" width={16} height={16} />Nova solicitação</button>
        </div>
      </div>

      {/* (13/11/2026: "essa tem que ficar impecável") os filtros viraram abas dentro da lista; cada item com o ponto da
          situação, o título, o assunto e a prévia de quem falou por último; a respondida (que espera você) em destaque */}
      <div className={'cli-sol cli-sc' + (vm.painelNoCelular ? ' painel-aberto' : '')}>
        <section className="card cli-sol-lista cli-sc-lista">
          <div className="cli-sc-filtros" role="tablist" aria-label="Filtrar as solicitações">
            {vm.filtros.map(f => (
              <button key={f.id} type="button" role="tab" aria-selected={f.ativo} className={'cli-sc-filtro' + (f.ativo ? ' ativo' : '')} onClick={() => vm.escolherFiltro(f.id)}>
                {f.rotulo}<span className={'cli-sc-conta' + (f.id === 'respondidas' && f.n ? ' alerta' : '') + (f.n ? '' : ' zero')}>{f.n}</span>
              </button>
            ))}
          </div>
          {vm.lista.length ? (
            <ul className="cli-sc-itens">
              {vm.lista.map(c => (
                <li key={c.id}>
                  <button type="button" className={'cli-sc-item s-' + c.situacao.replace(' ', '-') + (c.escolhida ? ' escolhida' : '')} aria-current={c.escolhida ? 'true' : undefined} onClick={() => vm.abrir(c.id)}>
                    <span className="cli-sc-ponto" aria-hidden="true" />
                    <span className="cli-sc-item-txt">
                      <span className="cli-sc-item-topo"><b>{c.titulo}</b><span className="cli-sc-data">{c.atualizada}</span></span>
                      <span className="cli-sc-item-meio"><span className="cli-sc-situacao">{c.rotulo}</span><span aria-hidden="true">·</span><span>{c.assunto}</span></span>
                      <span className="cli-sc-previa">{c.previaDoEscritorio && <b>{c.quemRespondeu}: </b>}{c.previa}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : vm.total ? (
            <div className="cli-sc-vazio"><Icone nome="check" width={18} height={18} /><span>{VAZIO_DO_FILTRO[vm.filtros.find(f => f.ativo)?.id ?? 'todas']}</span><button type="button" className="cli-link-mini" onClick={() => vm.escolherFiltro('todas')}>Ver todas</button></div>
          ) : <Vazio icone="mensagem" titulo="Nenhuma solicitação ainda" texto="Use a Nova solicitação para pedir o que precisar ao escritório." />}
        </section>

        {/* o painel */}
        <section className="card cli-sol-painel" aria-live="polite">
          <button type="button" className="cli-sc-voltar cli-sol-voltar" onClick={vm.voltar}><Icone nome="chevronLeft" width={16} height={16} />Solicitações</button>

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
                <div className="cli-sol-cabeca cli-sol-cabeca-nova">
                  <h2>Nova solicitação</h2>
                  {/* o assunto escolhido num selo, com o trocar ao lado (12/11/2026: "melhora isso também") */}
                  <span className="cli-sol-assunto-selo">
                    <span className="cli-sol-assunto-ico"><Icone nome={ICONE_DO_ASSUNTO[vm.tipo]} width={15} height={15} /></span>
                    {vm.rotuloDoTipo}
                    <button type="button" className="cli-link-mini" onClick={() => vm.escolherTipo('')}>Trocar</button>
                  </span>
                </div>
                <div className="cli-sol-form">
                  <div className="cli-sol-form-linha">
                    <div className="field">
                      <label htmlFor="cli-titulo-chamado">Título resumido</label>
                      <input id="cli-titulo-chamado" type="text" value={vm.titulo} onChange={e => vm.mudarTitulo(e.target.value)} placeholder="Ex.: certidão negativa estadual" />
                    </div>
                    <div className="field">
                      <span className="cli-sol-form-rotulo" id="cli-prioridade">Prioridade</span>
                      <span className="cli-sol-prioridade" role="radiogroup" aria-labelledby="cli-prioridade">
                        {vm.prioridades.map(p => <button key={p} type="button" role="radio" aria-checked={vm.prioridade === p} className={'p-' + p.toLowerCase() + (vm.prioridade === p ? ' on' : '')} onClick={() => vm.mudarPrioridade(p)}>{p}</button>)}
                      </span>
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="cli-texto">O que você precisa</label>
                    <textarea id="cli-texto" rows={4} value={vm.texto} onChange={e => vm.mudarTexto(e.target.value)} placeholder="Os dados, os nomes, os prazos ou o que mais for importante." />
                  </div>
                  {vm.anexo ? (
                    <div className="cli-sol-anexo tem">
                      <Icone nome="clipe" width={16} height={16} />
                      <span className="cli-sol-anexo-txt"><b>{vm.anexo.name}</b><span className="hint">anexado</span></span>
                      <button type="button" className="icon-btn" title="Tirar o anexo" aria-label="Tirar o anexo" onClick={() => vm.mudarAnexo(null)}><Icone nome="x" width={16} height={16} /></button>
                    </div>
                  ) : (
                    <label className="cli-sol-anexo" htmlFor={idAnexo}>
                      <Icone nome="clipe" width={16} height={16} />
                      <span className="cli-sol-anexo-txt"><b>Anexar um arquivo</b><span className="hint">opcional · PDF, imagem, XML ou ZIP até {vm.limite}</span></span>
                    </label>
                  )}
                  <input id={idAnexo} type="file" className="sr-only" accept={vm.aceitar} onChange={e => { vm.mudarAnexo(e.target.files?.[0] ?? null); e.target.value = ''; }} />
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
              {/* a solicitação como linha do tempo (12/11/2026: "refaz essa"): o título com a situação, as etapas numa
                  linha fina, o pedido e as respostas do escritório em ordem, e embaixo enviar arquivos e o WhatsApp */}
              <div className="cli-sol-cabeca">
                <h2>{s.titulo}</h2>
                <p className="cli-sol-meta"><span className={SELO[s.situacao]}>{s.rotulo}</span><span className="hint">{s.assunto} · aberta em {s.abertaEm}</span></p>
              </div>
              <ol className="cli-sol-passos" aria-label="Situação">
                {vm.passos.map((p, i) => (
                  <li key={p} className={i < s.passo || (i === s.passo && i === vm.passos.length - 1) ? 'feito' : i === s.passo ? 'atual' : ''} aria-current={i === s.passo ? 'step' : undefined}>
                    <span className="cli-sol-passo-ponto">{i < s.passo || (i === s.passo && i === vm.passos.length - 1) ? <Icone nome="check" width={11} height={11} /> : null}</span>
                    <span className="cli-sol-passo-nome">{i === vm.passos.length - 1 && s.passo === i ? s.rotulo : p}</span>
                  </li>
                ))}
              </ol>
              <ol className="cli-sol-tempo">
                <li className="cli-sol-evento voce">
                  <span className="cli-sol-quem cli-sc-voce" aria-hidden="true">{vm.empresa.logo ? <img src={vm.empresa.logo} alt="" /> : <Avatar nome={vm.empresa.nome} tamanho={30} />}</span>
                  <div className="cli-sol-fala">
                    <p className="cli-sol-fala-topo"><b>Você</b><span className="hint">{s.abertaEm}</span></p>
                    <p className="cli-sol-texto">{s.pedido}</p>
                    {s.complementos.map((t, i) => <p key={i} className="cli-sol-texto cli-sol-complemento">{t}</p>)}
                  </div>
                </li>
                {s.respostas.length ? s.respostas.map((r, i) => (
                  <li key={i} className="cli-sol-evento escritorio">
                    <span className="cli-sol-quem" aria-hidden="true"><MarcaDoEscritorio tamanho={30} /></span>
                    <div className="cli-sol-fala">
                      <p className="cli-sol-fala-topo"><b>{r.autor || 'Escritório'}</b>{r.autor && <span className="cli-sol-do-escritorio">Escritório</span>}<span className="hint">{r.quando}</span></p>
                      <p className="cli-sol-texto">{r.texto}</p>
                    </div>
                  </li>
                )) : (
                  <li className="cli-sol-evento esperando">
                    <span className="cli-sol-quem" aria-hidden="true"><Icone nome="clock" width={15} height={15} /></span>
                    <div className="cli-sol-fala"><p className="hint">Aguardando o escritório. Quando ele responder, aparece aqui e no sino.</p></div>
                  </li>
                )}
              </ol>
              {(s.aceitaArquivo || s.whatsapp) && (
                <div className="cli-sol-fim">
                  {s.aceitaArquivo && (
                    <div className="cli-sol-fim-envio">
                      <AreaDeSoltar compacta titulo={s.anexando ? 'Enviando…' : 'Enviar arquivos para esta solicitação'} aceitar={vm.aceitar} dica={'até ' + vm.limite + ' cada'} desabilitada={s.anexando} onArquivos={fs => vm.anexar(s.id, fs)} />
                      {s.erroDoAnexo && <p className="cli-erro" role="alert">{s.erroDoAnexo}</p>}
                    </div>
                  )}
                  {s.whatsapp && <a className="btn cli-sc-whats" href={s.whatsapp} target="_blank" rel="noreferrer"><span className="cli-st-logo" aria-hidden="true"><WhatsAppContorno /></span>Falar no WhatsApp</a>}
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
