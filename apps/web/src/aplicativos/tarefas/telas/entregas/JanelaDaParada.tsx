// A janela da parada (16/10/2026, a entrega de documentos trazida do Entregas, "no visual igual para não destoar do app"):
// no topo, o cliente e o que vai (os documentos com o valor, a guia anexada); embaixo, como foi — Entregue (quem recebeu e a
// assinatura, ou a foto), Sem assinatura (a foto vale) ou Não entregue (o motivo num toque e a foto) — e, com mais paradas
// no mesmo lugar, "confirmar todas juntas". No rodapé: Tirar da rota (quem pôs, ou o admin), Cancelar e Confirmar.
import { BotaoAcao, BotaoIcone, CampoArquivos, CampoAssinatura, Icone, Interruptor, Segmentado, type NomeIcone } from '@nads/ui';
import { useEffect, type ReactNode } from 'react';
import { useJanelaDaParada } from './useJanelaDaParada';

function Propriedade({ icone, rotulo, children }: { icone: NomeIcone; rotulo: string; children: ReactNode }) {
  return (
    <div className="registro-prop">
      <span className="registro-prop-nome"><Icone nome={icone} />{rotulo}</span>
      <div className="registro-prop-valor">{children}</div>
    </div>
  );
}

export function JanelaDaParada({ id, fechar }: { id: string; fechar: () => void }) {
  const vm = useJanelaDaParada(id, fechar);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) fechar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });

  const p = vm.parada;
  if (!p) return null;
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="modal registro-novo ent-parada" role="dialog" aria-modal="true" aria-label={'Parada de ' + p.clienteNome}>
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="caminhao" />Rota<Icone nome="chevronRight" /><b>{p.clienteNome}</b></span>
          <span className="badge badge-warn">Na rota</span>
          <button type="button" className="icon-btn icon-btn-sm" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)"><Icone nome="x" /></button>
        </header>

        <div className="registro-corpo">
          <p className="registro-dica"><Icone nome="calendar" />{vm.competencia}{vm.regiao && ' · ' + vm.regiao}{p.entregadoPorNome && ' · pôs na rota: ' + p.entregadoPorNome}</p>
          {vm.aviso && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.aviso}</p>}

          <ul className="ent-docs ent-docs-ler" aria-label="Documentos">
            {p.itens.map((i, k) => (
              <li key={i.tipo + k} className="ent-doc">
                <span className="ent-doc-tipo">{i.tipo}{i.funcionario && <span className="fraco"> · {i.funcionario}</span>}</span>
                <span className="ent-doc-valor num">{i.valor != null ? vm.reais(i.valor) : <span className="fraco">sem valor</span>}</span>
              </li>
            ))}
            {vm.total > 0 && <li className="ent-doc ent-doc-total"><span className="ent-doc-tipo">Total</span><span className="ent-doc-valor num">{vm.reais(vm.total)}</span></li>}
          </ul>
          {vm.guia && <span className="ent-anexo"><img className="ent-miniatura" src={vm.guia} alt="A guia anexada" /><span className="fraco">{p.temGuia ? 'Guia anexada' : 'Foto anexada'}</span></span>}

          {vm.outras.length > 0 && (
            <div className="registro-prop ent-juntas">
              <Interruptor ligado={vm.juntas} rotulo="Confirmar juntas" onMudar={() => vm.setJuntas(!vm.juntas)} />
              <span className="registro-pe-rotulo">
                Confirmar também {vm.outras.length === 1 ? 'a outra parada' : 'as outras ' + vm.outras.length + ' paradas'} deste lugar ({vm.outras.map(o => o.clienteNome).filter((n, i, l) => l.indexOf(n) === i).join(', ')})
              </span>
            </div>
          )}

          <Segmentado valor={vm.como} opcoes={vm.maneiras} onMudar={vm.setComo} />

          <div className="registro-props">
            {vm.como !== 'falha' && (
              <Propriedade icone="usuario" rotulo="Quem recebeu">
                <input type="text" value={vm.recebedor} onChange={e => vm.setRecebedor(e.target.value)} placeholder="Quem assinou pelo cliente (opcional)" aria-label="Nome de quem recebeu" />
              </Propriedade>
            )}
            {vm.como !== 'entregue' && (
              <Propriedade icone="fileText" rotulo={vm.como === 'falha' ? 'O que aconteceu' : 'Por que não assinou'}>
                <textarea className="ent-texto" rows={2} value={vm.motivo} onChange={e => vm.setMotivo(e.target.value)}
                  placeholder={vm.como === 'falha' ? 'Ex.: Estabelecimento fechado, ninguém atendeu…' : 'Ex.: deixei na portaria (opcional)'} aria-label="O motivo" />
              </Propriedade>
            )}
          </div>
          {vm.como === 'falha' && (
            <div className="ent-motivos" aria-label="Motivos num toque">
              {vm.motivosRapidos.map(m => (
                <button key={m} type="button" className={'btn' + (vm.motivo.startsWith(m) ? ' btn-outline ativo' : ' btn-ghost')} onClick={() => vm.usarMotivo(m)}>{m}</button>
              ))}
            </div>
          )}

          {vm.como === 'entregue' && <CampoAssinatura valor={vm.assinatura} onMudar={vm.setAssinatura} rotulo="Assinatura de quem recebeu" />}

          <div className="registro-prop">
            <span className="registro-prop-nome"><Icone nome="camera" />Foto{vm.como === 'entregue' ? '' : ' (obrigatória)'}</span>
            <div className="registro-prop-valor">
              {vm.foto ? (
                <span className="ent-anexo">
                  <img className="ent-miniatura" src={vm.foto} alt="A foto anexada" />
                  <BotaoIcone icone="x" titulo="Tirar a foto" pequeno onClick={vm.tirarFoto} />
                </span>
              ) : vm.lendoFoto ? (
                <span className="fraco"><span className="btn-spinner" aria-hidden="true" /> Lendo a foto…</span>
              ) : (
                <CampoArquivos id="ent-parada-foto" aceitar="image/*" rotulo={vm.como === 'entregue' ? 'Tirar ou escolher uma foto (no lugar da assinatura)' : 'Tirar ou escolher a foto'} onEscolher={fs => void vm.anexarFoto(fs)} />
              )}
            </div>
          </div>
          {vm.como === 'entregue' && vm.dispensa && <p className="registro-dica"><Icone nome="checkCircle" />Só honorário em dinheiro ou só notas: não precisa de comprovante.</p>}
          {vm.como === 'sem_assinatura' && <p className="registro-dica"><Icone nome="camera" />Tire uma foto mostrando a entrega (na portaria, na mesa, na caixa de correio): ela vale como comprovante.</p>}

          {vm.erros.length > 0 && <ul className="registro-erros">{vm.erros.map(e => <li key={e}><Icone nome="alert" />{e}</li>)}</ul>}
        </div>

        <footer className="registro-pe">
          {vm.podeTirar && <button type="button" className="btn btn-danger" disabled={vm.salvando} onClick={() => void vm.tirarDaRota()}><Icone nome="x" />Tirar da rota</button>}
          <span className="tarefas-barra-espaco" />
          <button type="button" className="btn btn-outline" onClick={fechar}>Cancelar</button>
          <BotaoAcao className={'btn ' + (vm.como === 'falha' ? 'btn-danger' : 'btn-primary')} carregando={vm.salvando} textoCarregando="Salvando…" disabled={vm.lendoFoto} onClick={() => void vm.confirmar()}>
            <Icone nome={vm.como === 'falha' ? 'alert' : 'check'} />{vm.rotuloDoBotao}
          </BotaoAcao>
        </footer>
      </div>
    </div>
  );
}
