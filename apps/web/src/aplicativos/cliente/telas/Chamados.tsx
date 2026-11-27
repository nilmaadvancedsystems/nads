// As Solicitações da Área do Cliente como lista + painel (12/11/2026: "refaz essa parte inteira"; a escolhida: "lista +
// painel ao lado"). À esquerda os filtros e a lista (o título, a data, a situação e a prévia da última
// resposta); à direita o painel: a solicitação escolhida (a situação, o pedido, a resposta do escritório, enviar arquivos
// e o WhatsApp) ou a nova (o assunto em cartões, depois o formulário). No celular, um de cada vez. Só desenha: o estado e
// as ações vêm de useChamados.ts.
import { CampoData, CampoEscolha, Icone, MenuSuspenso, formatoPeloNome, type NomeIcone } from '@nads/ui';
import { IconeDoArquivo } from '../partes/IconeDoArquivo';
import { useEffect, useId, useRef } from 'react';
import type { areaCliente as ac } from '@nads/core';
import { AreaDeSoltar } from '../partes/AreaDeSoltar';
import { Avatar } from '../partes/Avatar';
import { WhatsAppContorno } from '../partes/WhatsAppContorno';
import { MarcaDoEscritorio } from '../partes/MarcaDoEscritorio';
import { Vazio } from '../partes/Vazio';
import { useChamados } from './useChamados';
import { FormDoPedido } from './DepartamentoPessoal';
import type { DaCasca } from './useAreaCliente';
import { AjudaDaTela } from '../partes/AjudaDaTela';
import { MarcaDaTela } from '../partes/MarcaDaTela';
import './solicitacoes.css';

const SELO: Record<string, string> = { respondido: 'badge badge-ok', concluido: 'badge badge-neutral', aberto: 'badge badge-warn', 'em andamento': 'badge badge-warn' };
const VAZIO_DO_FILTRO: Record<string, string> = { todas: 'Nenhuma solicitação.', abertas: 'Nada em andamento no escritório.', respondidas: 'Nenhuma resposta esperando você.', concluidas: 'Nenhuma solicitação concluída.' };
const ICONE_DO_ASSUNTO: Record<ac.TipoDeChamado, NomeIcone> = { admissao: 'usuario', ferias: 'calendar', demissao: 'logOut', duvida: 'ajuda', documento: 'arquivo', outro: 'mensagem' };

export function Chamados(props: DaCasca) {
  const vm = useChamados(props);
  const idAnexo = useId();
  const s = vm.atual;
  // como num chat (23/11/2026: "deve descer para baixo assim que eu enviar um documento"): quando a conversa aberta ganha
  // uma mensagem, a tela desce até o fim dela; abrir outra solicitação não mexe
  const fim = useRef<HTMLDivElement>(null);
  const visto = useRef({ id: '', n: 0 });
  const idAberta = s?.id ?? '';
  const nMensagens = s ? s.conversa.length : 0;
  useEffect(() => {
    const antes = visto.current;
    visto.current = { id: idAberta, n: nMensagens };
    if (idAberta && antes.id === idAberta && nMensagens > antes.n) fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [idAberta, nMensagens]);
  return (
    <>
      <div className="cli-titulo">
        <div>
          <MarcaDaTela /><h1 className="page-title">Solicitações</h1><AjudaDaTela />
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
                      {/* 16/11/2026 ("muita informação"): a situação e a prévia numa linha só; o assunto saiu da linha
                          (repetia o título e continua no painel) */}
                      <span className="cli-sc-linha-previa"><span className="cli-sc-situacao">{c.rotulo}</span><span aria-hidden="true">·</span><span className="cli-sc-previa">{c.previaDoEscritorio && <b>{c.quemRespondeu}: </b>}{c.previa}</span></span>
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
                    {/* (23/11/2026: "ao apertar em trocar aparece um dropdown") */}
                    <MenuSuspenso className="cli-link-mini cli-sol-trocar" rotulo="Trocar" semSeta direita flutuante titulo="Trocar o assunto"
                      itens={vm.tipos.map(t => ({ rotulo: t.rotulo, icone: ICONE_DO_ASSUNTO[t.valor], marcado: t.valor === vm.tipo, onClick: () => vm.escolherTipo(t.valor) }))} />
                  </span>
                </div>
                {/* cada assunto com a sua tela (23/11/2026: "cada solicitacao tenha uma tela diferente"): os do DP com o
                    formulário do RH; o documento com a lista; a dúvida e o outro assunto com o texto livre */}
                {vm.doDp && vm.dadosDp ? (
                  <div className="cli-sol-form cli-sol-form-dp">
                    <FormDoPedido key={vm.tipo} pedido={vm.tipo as 'admissao' | 'ferias' | 'demissao'} inicial={vm.dadosDp} erro={vm.erro} nomes={vm.nomes} cargos={vm.cargos} equipe={vm.equipe} hoje={vm.hoje} aoMudar={vm.mudarDadosDp} />
                  </div>
                ) : (
                  <div className="cli-sol-form">
                    <div className="cli-sol-form-linha">
                      {vm.tipo === 'documento' ? (
                        <div className="field">
                          <label>Qual documento</label>
                          <CampoEscolha rotulo="Qual documento" valor={vm.documento} opcoes={vm.documentos} onMudar={vm.mudarDocumento} />
                        </div>
                      ) : (
                        <div className="field">
                          <label htmlFor="cli-titulo-chamado">{vm.tipo === 'duvida' ? 'Sobre o que é a dúvida' : 'Assunto'}</label>
                          <input id="cli-titulo-chamado" type="text" value={vm.titulo} onChange={e => vm.mudarTitulo(e.target.value)} placeholder={vm.tipo === 'duvida' ? 'Ex.: pró-labore, nota fiscal, imposto' : 'Ex.: mudança de endereço da empresa'} />
                        </div>
                      )}
                      <div className="field">
                        <span className="cli-sol-form-rotulo" id="cli-prioridade">Prioridade</span>
                        <span className="cli-sol-prioridade" role="radiogroup" aria-labelledby="cli-prioridade">
                          {vm.prioridades.map(p => <button key={p} type="button" role="radio" aria-checked={vm.prioridade === p} className={'p-' + p.toLowerCase() + (vm.prioridade === p ? ' on' : '')} onClick={() => vm.mudarPrioridade(p)}>{p}</button>)}
                        </span>
                      </div>
                    </div>
                    {vm.tipo === 'documento' && (
                      <div className="field cli-sol-prazo">
                        <label htmlFor="cli-prazo">Preciso até <span className="cli-pf-opc">opcional</span></label>
                        <CampoData id="cli-prazo" rotulo="Preciso até" valor={vm.prazo} onMudar={vm.mudarPrazo} />
                      </div>
                    )}
                    <div className="field">
                      <label htmlFor="cli-texto">{vm.tipo === 'documento' ? <>Detalhes {vm.documento !== 'Outro documento' && <span className="cli-pf-opc">opcional</span>}</> : vm.tipo === 'duvida' ? 'Sua dúvida' : 'O que você precisa'}</label>
                      <textarea id="cli-texto" rows={4} value={vm.texto} onChange={e => vm.mudarTexto(e.target.value)}
                        placeholder={vm.tipo === 'documento' ? 'Ex.: para a licitação da prefeitura; a guia do DAS de outubro' : vm.tipo === 'duvida' ? 'Escreva a pergunta do jeito que vier. O escritório responde aqui.' : 'Os dados, os nomes, os prazos ou o que mais for importante.'} />
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
                )}
                <div className="cli-sol-rodape">
                  <button type="button" className="btn btn-ghost" onClick={vm.cancelarNova}>Cancelar</button>
                  <button type="button" className="btn btn-primary" disabled={vm.enviando} onClick={vm.criar}><Icone nome="seta" width={16} height={16} />{vm.enviando ? 'Enviando…' : vm.tipo === 'admissao' ? 'Liberar admissão preliminar' : 'Enviar solicitação'}</button>
                </div>
              </>
            )
          ) : s ? (
            <>
              {/* a solicitação como linha do tempo (12/11/2026: "refaz essa"): o título com a situação, as etapas numa
                  linha fina, o pedido e as respostas do escritório em ordem, e embaixo enviar arquivos e o WhatsApp */}
              <div className="cli-sol-cabeca">
                <h2>{s.titulo}</h2>
                {/* 16/11/2026 ("muita informação"): só o selo e o assunto; os passos Recebida › Em andamento ›
                    Respondida repetiam o selo e a data de abertura já está no "Você" logo abaixo */}
                <p className="cli-sol-meta"><span className={SELO[s.situacao]}>{s.rotulo}</span><span className="hint">{s.assunto}</span></p>
                {/* o passo atual do pedido do DP (23/11/2026: "Faz, só o passo atual"): um só, dentro da solicitação aberta */}
                {s.passo && <p className="cli-sol-passo"><span className="hint">Passo {s.passo.n} de {s.passo.total}:</span> <b>{s.passo.nome}</b></p>}
              </div>
              <ol className="cli-sol-tempo">
                <li className="cli-sol-evento voce">
                  <span className="cli-sol-quem cli-sc-voce" aria-hidden="true">{vm.empresa.logo ? <img src={vm.empresa.logo} alt="" /> : <Avatar nome={vm.empresa.nome} tamanho={30} />}</span>
                  <div className="cli-sol-fala">
                    <p className="cli-sol-fala-topo"><b>Você</b><span className="hint">{s.abertaEm}</span></p>
                    <p className="cli-sol-texto">{s.pedido}</p>
                  </div>
                </li>
                {s.conversa.map(m => m.deVoce ? (
                  <li key={m.chave} className="cli-sol-evento voce">
                    <span className="cli-sol-quem cli-sc-voce" aria-hidden="true">{vm.empresa.logo ? <img src={vm.empresa.logo} alt="" /> : <Avatar nome={vm.empresa.nome} tamanho={30} />}</span>
                    <div className="cli-sol-fala">
                      <p className="cli-sol-fala-topo"><b>Você</b><span className="hint">{m.quando}</span></p>
                      <p className="cli-sol-texto">{m.texto}</p>
                    </div>
                  </li>
                ) : (
                  <li key={m.chave} className="cli-sol-evento escritorio">
                    <span className="cli-sol-quem" aria-hidden="true"><MarcaDoEscritorio tamanho={30} /></span>
                    <div className="cli-sol-fala">
                      <p className="cli-sol-fala-topo"><b>{m.autor || 'Escritório'}</b>{m.autor && <span className="cli-sol-do-escritorio">Escritório</span>}<span className="hint">{m.quando}</span></p>
                      {m.texto && <p className="cli-sol-texto">{m.texto}</p>}
                      {/* o arquivo que o escritório mandou na resposta, com o Baixar (26/11/2026) */}
                      {m.anexo && (
                        <div className="cli-sol-anexo">
                          <IconeDoArquivo formato={formatoPeloNome(m.anexo.nome)} tamanho={28} />
                          <span className="cli-sol-anexo-nome" title={m.anexo.nome}>{m.anexo.nome}</span>
                          <button type="button" className="btn btn-sm" disabled={m.anexo.baixando} onClick={m.anexo.baixar}><Icone nome="download" width={15} height={15} />{m.anexo.baixando ? 'Baixando…' : 'Baixar'}</button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
                {!s.respostas.length && (
                  <li className="cli-sol-evento esperando">
                    <span className="cli-sol-quem" aria-hidden="true"><Icone nome="clock" width={15} height={15} /></span>
                    <div className="cli-sol-fala"><p className="hint">Aguardando a resposta do escritório.</p></div>
                  </li>
                )}
              </ol>
              {/* a avaliação da concluída (ficha avaliacao-do-atendimento, 18/11/2026): só o escritório vê; não é conversa */}
              {s.avaliar && (
                <div className="cli-sol-avaliar">
                  {s.notaDada && !vm.reavaliar ? (
                    <p className="cli-sol-avaliar-feito">
                      <span className="cli-sol-estrelas-fixas" aria-label={s.notaDada + ' de 5'}>{'★'.repeat(s.notaDada)}<span className="apagada">{'★'.repeat(5 - s.notaDada)}</span></span>
                      Obrigado pela avaliação.
                      <button type="button" className="cli-link-mini" onClick={vm.mudarNota}>Mudar</button>
                    </p>
                  ) : (
                    <>
                      <p className="cli-sol-avaliar-titulo"><b>Como foi o atendimento?</b>{vm.nota > 0 && <span className="hint">{vm.rotuloDaNota(vm.nota)}</span>}</p>
                      <div className="cli-sol-estrelas" role="radiogroup" aria-label="Nota de 1 a 5">
                        {[1, 2, 3, 4, 5].map(n => (
                          <button key={n} type="button" role="radio" aria-checked={vm.nota === n} aria-label={n + ' de 5'} className={n <= vm.nota ? 'on' : ''} onClick={() => vm.escolherNota(n)}>★</button>
                        ))}
                      </div>
                      {vm.nota > 0 && (
                        <>
                          <textarea className="cli-sol-comentario" rows={2} maxLength={vm.maiorComentario} aria-label="Comentário (opcional)" value={vm.comentario} onChange={e => vm.mudarComentario(e.target.value)} placeholder="Quer contar mais alguma coisa? (opcional, só o escritório vê)" />
                          <div className="cli-sol-rodape">
                            <button type="button" className="btn btn-primary" disabled={vm.avaliando} onClick={() => vm.avaliar(s.id)}>{vm.avaliando ? 'Enviando…' : 'Enviar avaliação'}</button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
              <div ref={fim} aria-hidden="true" />
              {/* (26/11/2026: "libera o cliente para digitar o que quer") o cliente escreve na própria solicitação */}
              {s.aceitaArquivo && (
                <div className="cli-sol-escrever">
                  <textarea rows={2} maxLength={2000} aria-label="Escrever para o escritório" placeholder="Escreva para o escritório…" value={s.escrito}
                    disabled={s.escrevendo} onChange={e => vm.mudarEscrito(s.id, e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); vm.escrever(s.id); } }} />
                  <button type="button" className="btn btn-primary" disabled={s.escrevendo || !s.escrito.trim()} onClick={() => vm.escrever(s.id)}>{s.escrevendo ? 'Enviando…' : 'Enviar'}</button>
                </div>
              )}
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
