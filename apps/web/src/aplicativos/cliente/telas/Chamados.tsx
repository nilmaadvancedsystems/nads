// Solicitações da Área do Cliente (Vitor, 16/10/2026), no layout do protótipo com as peças do nads: o título com Nova
// solicitação; o card da abertura rápida (assunto, prioridade, título, o pedido, um anexo e Enviar); e a lista, cada
// solicitação com o selo da situação e o assunto. Com o banco (17/10/2026), sem a Central de documentos, o "Enviar
// documento" fica aqui. "Melhora mais" de 17/10/2026: a respondida vem primeiro, com o fundo suave e o "Ver resposta" (a
// primeira em carmim); vindo da Visão geral, ela já abre (ou o formulário já vem com o assunto e o título).
// Sem chat (11/11/2026: "o chat só fica bom no PC, no celular fica ruim"): aberta, a solicitação mostra os passos
// (Recebida › Em andamento › Pronta), o pedido e a resposta do escritório, um embaixo do outro, e o "Falar no WhatsApp".
import { Icone } from '@nads/ui';
import { useEffect, useId, useRef } from 'react';
import { useJanelaDeEnvio } from './JanelaDeEnvio';
import { Vazio } from '../partes/Vazio';
import { useChamados } from './useChamados';
import type { DaCasca } from './useAreaCliente';

const SELO: Record<string, string> = { respondido: 'badge badge-ok', concluido: 'badge badge-neutral', aberto: 'badge badge-warn', 'em andamento': 'badge badge-warn' };

export function Chamados(props: DaCasca) {
  const vm = useChamados(props);
  const idAnexo = useId();
  const form = useRef<HTMLElement>(null);
  const abrirEnvio = useJanelaDeEnvio(props);
  // vindo da Visão geral: a solicitação pedida aparece na tela; o formulário já preenchido leva o foco ao "O que você precisa"
  const { pedido } = vm;
  useEffect(() => {
    if (pedido.chamado) document.getElementById('cli-chamado-' + pedido.chamado)?.scrollIntoView({ block: 'start' });
    else if (pedido.novoChamado) document.getElementById('cli-texto')?.focus();
  }, [pedido]);
  const novo = (
    <button type="button" className="btn" onClick={() => { form.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); document.getElementById('cli-titulo-chamado')?.focus(); }}>
      <Icone nome="plus" width={16} height={16} />Nova solicitação
    </button>
  );
  return (
    <>
      <div className="cli-titulo">
        <div>
          <h1 className="page-title">Solicitações</h1>
        </div>
        {props.area.secoes.documentos ? novo : (
          <div className="cli-acoes">
            <button type="button" className="btn" onClick={abrirEnvio}><Icone nome="upload" width={16} height={16} />Enviar documento</button>
            {novo}
          </div>
        )}
      </div>

      <section className="card" ref={form}>
        <div className="card-head"><h3>Nova solicitação</h3></div>
        <div className="cli-form tres">
          <div className="field">
            <label htmlFor="cli-tipo">Assunto</label>
            <select id="cli-tipo" value={vm.tipo} onChange={e => vm.mudarTipo(e.target.value)}>
              <option value="" disabled>Escolha</option>
              {vm.tipos.map(t => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="cli-prio">Prioridade</label>
            <select id="cli-prio" value={vm.prioridade} onChange={e => vm.mudarPrioridade(e.target.value)}>{vm.prioridades.map(p => <option key={p}>{p}</option>)}</select>
          </div>
          <div className="field">
            <label htmlFor="cli-titulo-chamado">Título resumido</label>
            <input id="cli-titulo-chamado" type="text" value={vm.titulo} onChange={e => vm.mudarTitulo(e.target.value)} placeholder="Ex.: certidão negativa estadual" />
          </div>
          <div className="field cli-largo">
            <label htmlFor="cli-texto">O que você precisa</label>
            <textarea id="cli-texto" rows={3} value={vm.texto} onChange={e => vm.mudarTexto(e.target.value)} placeholder="Os dados, os nomes, os prazos ou o que mais for importante." />
          </div>
        </div>
        {vm.erro && <p className="cli-erro" role="alert">{vm.erro}</p>}
        <div className="cli-barra">
          <div className="cli-anexo">
            <label className="file-picker" htmlFor={idAnexo}><Icone nome="clipe" width={16} height={16} />{vm.anexo ? vm.anexo.name : 'Anexar arquivo'}</label>
            <input id={idAnexo} type="file" className="sr-only" accept={vm.aceitar} onChange={e => { vm.mudarAnexo(e.target.files?.[0] ?? null); e.target.value = ''; }} />
            {vm.anexo ? <button type="button" className="btn btn-ghost" onClick={() => vm.mudarAnexo(null)}>Tirar</button> : <span className="hint" style={{ margin: 0 }}>Até {vm.limite}</span>}
          </div>
          <button type="button" className="btn btn-primary" disabled={vm.enviando} onClick={() => void vm.criar()}><Icone nome="seta" width={16} height={16} />Enviar solicitação</button>
        </div>
      </section>

      <section className="card cli-card-tabela">
        <div className="card-head"><h3>Suas solicitações</h3><span className="card-head-ctl hint">Atualiza sozinho</span></div>
        {vm.solicitacoes.length ? (
          <ul className="cli-lista">
            {vm.solicitacoes.map(c => (
              <li key={c.id} id={'cli-chamado-' + c.id} className={'cli-chamado' + (c.situacao === 'respondido' ? ' cli-chamado-esperando' : '')}>
                <div className="cli-linha">
                  <div className="cli-linha-txt">
                    <div className="cli-chamado-topo"><b>{c.titulo}</b><span className={SELO[c.situacao]}>{c.rotulo}</span></div>
                    <p className="hint">{c.assunto} · aberta em {c.abertaEm}</p>
                  </div>
                  <button type="button" className={'btn' + (c.id === vm.primeiraRespondida && !c.aberta ? ' btn-primary' : '')} aria-expanded={c.aberta} onClick={() => vm.alternar(c.id)}>
                    {c.aberta ? 'Fechar' : c.situacao === 'respondido' ? 'Ver resposta' : 'Ver solicitação'}
                  </button>
                </div>
                {c.aberta && (
                  <div className="cli-solicitacao">
                    {/* os passos: onde a solicitação está */}
                    <ol className="cli-passos" aria-label="Situação">
                      {vm.passos.map((p, i) => (
                        <li key={p} className={i < c.passo ? 'feito' : i === c.passo ? 'atual' : ''} aria-current={i === c.passo ? 'step' : undefined}>
                          {i === vm.passos.length - 1 && c.passo === i ? c.rotulo : p}
                        </li>
                      ))}
                    </ol>
                    <div>
                      <h4>Seu pedido</h4>
                      <p>{c.pedido}</p>
                      {c.complementos.map((t, i) => <p key={i} className="cli-complemento">{t}</p>)}
                    </div>
                    <div>
                      <h4>Resposta do escritório</h4>
                      {c.respostas.length
                        ? c.respostas.map((r, i) => <p key={i}>{r.texto}<span className="hint"> · {r.quando}</span></p>)
                        : <p className="hint">Ainda sem resposta. Quando o escritório responder, aparece aqui.</p>}
                    </div>
                    {/* para conversar, o WhatsApp do escritório, já com o assunto */}
                    {c.whatsapp && (
                      <div className="cli-acoes">
                        <a className="btn" href={c.whatsapp} target="_blank" rel="noreferrer"><Icone nome="celular" width={16} height={16} />Falar no WhatsApp</a>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <Vazio icone="mensagem" titulo="Nenhuma solicitação ainda" texto="Os pedidos que você fizer aparecem aqui, com a resposta do escritório." />}
      </section>
    </>
  );
}
