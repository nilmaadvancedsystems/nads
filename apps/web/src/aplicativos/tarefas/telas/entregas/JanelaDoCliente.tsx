// A janela do cliente no Painel (16/10/2026, a entrega de documentos trazida do Entregas, "no visual igual para não
// destoar do app"): em cima, as entregas do cliente (a mais nova primeiro, de todos os meses) na lista do Cadastro; embaixo,
// a escolhida — a situação, os documentos com o valor, quem recebeu, quem entregou, quando, o motivo e o comprovante (a
// assinatura e a foto). No rodapé: Excluir, Enviar pelo WhatsApp (a confirmada), Confirmar (a que está na rota) e Nova entrega.
import type { entregas } from '@nads/core';
import { BotaoFechar, Esqueleto, Icone, LogoWhatsApp, useJanela, type NomeIcone } from '@nads/ui';
import { useRef, type ReactNode } from 'react';
import { JanelaDaParada } from './JanelaDaParada';
import { JanelaNovaEntrega } from './JanelaNovaEntrega';
import { useJanelaDoCliente } from './useJanelaDoCliente';

function Propriedade({ icone, rotulo, children }: { icone: NomeIcone; rotulo: string; children: ReactNode }) {
  return (
    <div className="registro-prop">
      <span className="registro-prop-nome"><Icone nome={icone} />{rotulo}</span>
      <div className="registro-prop-valor">{children}</div>
    </div>
  );
}

export function JanelaDoCliente({ linha, competencia, fechar }: { linha: entregas.LinhaDoPainel; competencia: string; fechar: () => void }) {
  const vm = useJanelaDoCliente(linha, competencia, fechar);

  // revisão da UI, 16/10/2026: Esc, foco preso e o foco de volta pela peça useJanela (antes, um Esc à mão por janela) (com a confirmação ou a entrega nova abertas, o Esc é delas)
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, !vm.confirmando && !vm.nova ? fechar : null);

  const a = vm.atual;
  return (
    <>
      {vm.confirmando && <JanelaDaParada id={vm.confirmando} fechar={vm.fecharConfirmacao} />}
      {vm.nova && <JanelaNovaEntrega cliente={vm.cliente} fechar={() => vm.setNova(false)} />}
      {!vm.confirmando && !vm.nova && <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
        <div ref={janela} className="modal registro-novo ent-cliente" role="dialog" aria-modal="true" aria-label={'Entregas de ' + vm.titulo}>
          <header className="registro-topo">
            <span className="registro-caminho"><Icone nome="painel" />Painel<Icone nome="chevronRight" /><b>{vm.titulo}</b></span>
            <BotaoFechar onClick={fechar} />
          </header>

          <div className="registro-corpo">
            {!vm.todas.length ? (
              vm.carregandoHistorico ? <Esqueleto linhas={3} /> : <p className="empty">Nenhuma entrega registrada para este cliente.</p>
            ) : (
              <div className="table-wrap ent-historico">
                <table className="tabela-empresas cad-lista ent-lista">
                  <thead><tr><th>Competência</th><th>Quando</th><th>Documentos</th><th>Situação</th></tr></thead>
                  <tbody>
                    {vm.todas.map(x => (
                      <tr key={x.e.id} className={'linha-abre' + (x.e.id === a?.id ? ' ent-escolhida' : '')} tabIndex={0} aria-selected={x.e.id === a?.id}
                        onClick={() => vm.escolher(x.e.id)} onKeyDown={e => { if (e.key === 'Enter') vm.escolher(x.e.id); }}>
                        <td>{x.competencia}</td>
                        <td className="fraco">{x.quando}</td>
                        <td><span className="ent-corta" title={x.documentos}>{x.documentos || '—'}</span></td>
                        <td><span className={'badge badge-' + x.situacao.tom}>{x.situacao.rotulo}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {vm.carregandoHistorico && <p className="registro-dica">Lendo os outros meses…</p>}
              </div>
            )}

            {a && vm.situacaoDaAtual && (
              <div className="registro-props ent-detalhe">
                <Propriedade icone="checkCircle" rotulo="Situação">
                  <span className={'badge badge-' + vm.situacaoDaAtual.tom}>{vm.situacaoDaAtual.rotulo}</span>
                  <span className="fraco">{vm.competenciaDaAtual}{a.tentativa > 1 && ' · ' + a.tentativa + 'ª tentativa'}</span>
                </Propriedade>
                <Propriedade icone="fileText" rotulo="Documentos">
                  <span>
                    {a.itens.map((i, k) => <span key={i.tipo + k} className="ent-item">{i.tipo}{i.funcionario ? ' · ' + i.funcionario : ''}{i.valor != null && <b className="num"> {vm.reais(i.valor)}</b>}</span>)}
                    {vm.total > 0 && <span className="ent-item">Total <b className="num">{vm.reais(vm.total)}</b></span>}
                  </span>
                </Propriedade>
                {a.status === 'falha' && <Propriedade icone="alert" rotulo="O que aconteceu">{a.motivoFalha || 'não informado'}</Propriedade>}
                {a.semAssinatura && <Propriedade icone="alert" rotulo="Sem assinatura">{a.motivoSemAssinatura || 'motivo não informado'}</Propriedade>}
                {a.status === 'confirmada' && <Propriedade icone="usuario" rotulo="Recebido por">{a.recebedor || <span className="fraco">não informado</span>}</Propriedade>}
                <Propriedade icone="caminhao" rotulo={a.status === 'pendente' || a.status === 'link' ? 'Pôs na rota' : 'Entregue por'}>{a.entregadoPorNome || a.entregadoPor || '—'}</Propriedade>
                <Propriedade icone="clock" rotulo="Data e hora">{vm.quando}</Propriedade>
                {vm.temComprovante && (
                  <Propriedade icone="lapis" rotulo="Comprovante">
                    {!vm.comprovante ? <span className="fraco"><span className="btn-spinner" aria-hidden="true" /> Lendo…</span>
                      : !vm.comprovante.assinatura && !vm.comprovante.foto ? <span className="fraco">Sem comprovante anexado.</span>
                      : (
                        <span className="ent-comprovante">
                          {vm.comprovante.assinatura && <a href={vm.comprovante.assinatura} download={'assinatura-' + a.id + '.png'} title="Baixar a assinatura"><img src={vm.comprovante.assinatura} alt="A assinatura de recebimento" /></a>}
                          {vm.comprovante.foto && <a href={vm.comprovante.foto} download={'foto-' + a.id + '.jpg'} title="Baixar a foto"><img src={vm.comprovante.foto} alt="A foto anexada" /></a>}
                        </span>
                      )}
                  </Propriedade>
                )}
              </div>
            )}
          </div>

          <footer className="registro-pe">
            {vm.podeExcluir && <button type="button" className="btn btn-danger" disabled={vm.excluindo} onClick={() => void vm.excluir()}><Icone nome="x" />{vm.naRota ? 'Tirar da rota' : 'Excluir'}</button>}
            <span className="tarefas-barra-espaco" />
            {vm.linkDoWhatsApp && <a className="btn btn-outline" href={vm.linkDoWhatsApp} target="_blank" rel="noopener noreferrer"><LogoWhatsApp />Enviar comprovante</a>}
            {vm.naRota && <button type="button" className="btn" onClick={vm.abrirConfirmacao}><Icone nome="lapis" />Confirmar</button>}
            {vm.cliente && <button type="button" className="btn" onClick={() => vm.setNova(true)}><Icone nome="plus" />Nova entrega</button>}
            <button type="button" className="btn btn-outline" onClick={fechar}>Fechar</button>
          </footer>
        </div>
      </div>}
    </>
  );
}
