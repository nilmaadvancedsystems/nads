// Solicitações e chamados da Área do Cliente (Vitor, 16/10/2026), no layout do protótipo com as peças do nads: o título com
// Novo chamado; o card da abertura rápida (assunto, prioridade, título, o pedido, um anexo e Enviar chamado); e o card do
// histórico, cada chamado com o selo da situação, o assunto, a última mensagem e "Ver conversa", que abre ali mesmo com o
// responder. Versão D: só o selo da situação (o assunto vai na linha de baixo), a conversa num fundo suave e o
// formulário com o fio fino antes do Enviar. Com o banco (17/10/2026), sem a Central de documentos, o "Enviar documento"
// fica aqui, ao lado do Novo chamado.
import { Icone } from '@nads/ui';
import { useId, useRef } from 'react';
import { ConversaDoChamado } from '../partes/ConversaDoChamado';
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
  const novo = (
    <button type="button" className="btn" onClick={() => { form.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); document.getElementById('cli-titulo-chamado')?.focus(); }}>
      <Icone nome="plus" width={16} height={16} />Novo chamado
    </button>
  );
  return (
    <>
      <div className="cli-titulo">
        <div>
          <h1 className="page-title">Solicitações e chamados</h1>
          <p className="page-desc">Peça certidões, admissões, alterações ou tire dúvidas com a equipe Nilma.</p>
        </div>
        {props.area.secoes.documentos ? novo : (
          <div className="cli-acoes">
            <button type="button" className="btn" onClick={abrirEnvio}><Icone nome="upload" width={16} height={16} />Enviar documento</button>
            {novo}
          </div>
        )}
      </div>

      <section className="card" ref={form}>
        <div className="card-head"><h3>Abertura rápida de chamado</h3></div>
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
          <button type="button" className="btn btn-primary" disabled={vm.enviando} onClick={() => void vm.criar()}><Icone nome="seta" width={16} height={16} />Enviar chamado</button>
        </div>
      </section>

      <section className="card cli-card-tabela">
        <div className="card-head"><h3>Histórico de chamados</h3><span className="card-head-ctl">Atualizado sozinho</span></div>
        {vm.chamados.length ? (
          <ul className="cli-lista">
            {vm.chamados.map(c => {
              const ultima = vm.ultimaMensagem(c);
              const aberta = vm.aberto?.id === c.id;
              return (
                <li key={c.id} className="cli-chamado">
                  <div className="cli-linha">
                    <div className="cli-linha-txt">
                      <div className="cli-chamado-topo"><b>{c.titulo}</b><span className={SELO[c.situacao]}>{vm.rotuloDaSituacao[c.situacao]}</span></div>
                      {ultima && <p className="cli-previa">{ultima.de === 'escritorio' ? 'Escritório: ' : 'Você: '}{ultima.texto.split('\n')[0]}</p>}
                      <p className="hint">{vm.rotuloDoTipo(c.tipo)} · aberto em {vm.abertoEm(c)}{ultima ? ' · última mensagem ' + vm.quando(ultima.em) : ''}</p>
                    </div>
                    <button type="button" className="btn" aria-expanded={aberta} onClick={() => vm.alternar(c.id)}>{aberta ? 'Fechar conversa' : 'Ver conversa (' + c.mensagens.length + ')'}</button>
                  </div>
                  {aberta && vm.aberto && (
                    <div className="cli-conversa-aberta">
                      <ConversaDoChamado mensagens={vm.aberto.mensagens} />
                      {vm.aceitaResposta ? (
                        <>
                          <div className="field" style={{ margin: '12px 0 0' }}>
                            <label htmlFor="cli-resposta">Responder</label>
                            <textarea id="cli-resposta" rows={2} value={vm.resposta} onChange={e => vm.mudarResposta(e.target.value)} />
                          </div>
                          <div className="cli-acoes" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                            <button type="button" className="btn btn-primary" disabled={vm.enviando || !vm.resposta.trim()} onClick={() => void vm.responder()}>Responder</button>
                          </div>
                        </>
                      ) : <p className="hint" style={{ marginTop: 12 }}>Chamado concluído. Para outro assunto, abra um novo.</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : <Vazio icone="mensagem" titulo="Nenhum chamado ainda" texto="Os pedidos que você abrir aparecem aqui, com as respostas do escritório." />}
      </section>
    </>
  );
}
