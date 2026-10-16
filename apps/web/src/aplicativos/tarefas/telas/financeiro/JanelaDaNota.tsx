// A janela da nota (15/10/2026: "vamos criar um emissor de notas fiscais para o financeiro"): a situação, os dados da nota
// (número, chave de acesso, DPS, tomador, valor, data, descrição, quem pediu), os erros que a prefeitura devolveu e as ações:
// Corrigir e reenviar (recusada), Baixar XML e Baixar DANFSe (autorizada) e Cancelar nota (autorizada, com o motivo e a justificativa).
// Enviar por e-mail (autorizada, 15/10/2026): na linha "E-mail", o botão (abre o campo com o e-mail do tomador) e como foi o último envio.
import { formatos, nfse } from '@nads/core';
import { BotaoAcao, Icone, MenuSuspenso } from '@nads/ui';
import { useEffect, type ReactNode } from 'react';
import { dataBr, dataHoraBr, documentoFormatado, foneSoDigitos } from './formatosDaNota';
import { MINIMO_DA_JUSTIFICATIVA, useJanelaDaNota } from './useJanelaDaNota';
import { useRelogio } from './useRelogio';

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <div className="nf-dado"><span className="nf-dado-nome">{rotulo}</span><div className="nf-dado-valor">{children}</div></div>;
}

export function JanelaDaNota({ id, fechar, corrigir }: { id: string; fechar: () => void; corrigir: (n: nfse.NotaFiscal) => void }) {
  const vm = useJanelaDaNota(id);
  const n = vm.nota;

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented && !document.querySelector('.nf-janela .popover')) fechar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  });

  // o andamento ao vivo (o que o robô grava: enviada, consultas, a última)
  const agora = useRelogio(!!n && nfse.andando(n.status));
  if (!n || !vm.rotulo) return null;
  const andamento = nfse.andamentoDaNota(n, agora);
  const motivo = vm.motivos.find(m => m.id === vm.cMotivo)?.rotulo || '';
  const fone = foneSoDigitos(n.tomador.fone || '');
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className="modal registro-novo nf-janela" role="dialog" aria-modal="true" aria-label="Nota fiscal">
        <header className="registro-topo">
          <span className="registro-caminho"><Icone nome="recibo" />Notas fiscais<Icone nome="chevronRight" /><b>{n.numeroNfse ? 'NFS-e ' + n.numeroNfse : 'Nota sem número'}</b></span>
          <span className={'badge badge-' + vm.rotulo.tom}>{vm.andando && <span className="btn-spinner nf-roda" aria-hidden="true" />}{vm.rotulo.rotulo}</span>
          <button type="button" className="icon-btn icon-btn-sm" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)"><Icone nome="x" /></button>
        </header>

        <div className="registro-corpo">
          {andamento && <p className="nf-andamento"><Icone nome="clock" />{andamento}</p>}
          {n.ambiente === 'homologacao' && <p className="registro-dica"><Icone nome="alert" />Nota de homologação: sem valor fiscal.</p>}

          <div className="nf-dados">
            <Dado rotulo="Tomador"><b>{n.tomador.nome}</b><span className="fraco"> · {documentoFormatado(n.tomador.documento)}</span></Dado>
            {n.tomador.endereco && (
              <Dado rotulo="Endereço">
                {n.tomador.endereco.logradouro}, {n.tomador.endereco.numero} · {n.tomador.endereco.bairro}
                <span className="fraco"> · CEP {n.tomador.endereco.cep} · IBGE {n.tomador.endereco.cMun}</span>
              </Dado>
            )}
            <Dado rotulo="Valor">{formatos.reais(n.servico.valor)}</Dado>
            <Dado rotulo="Data do serviço">{dataBr(n.servico.competencia)}</Dado>
            <Dado rotulo="Descrição"><span className="nf-descricao">{n.servico.descricao}</span></Dado>
            {(n.tomador.email || vm.envioDoEmail || vm.podeEnviarEmail) && (
              <Dado rotulo="E-mail">
                <span className="nf-chave">
                  {n.tomador.email || <span className="fraco">Sem e-mail na nota</span>}
                  {vm.podeEnviarEmail && !vm.mandandoEmail && <button type="button" className="btn btn-ghost" onClick={vm.abrirEmail}><Icone nome="envelope" />Enviar por e-mail</button>}
                </span>
                {vm.envioDoEmail && (
                  <div className={vm.envioDoEmail.erro ? 'registro-dica-erro' : 'fraco'}>
                    {vm.envioDoEmail.andando && <span className="btn-spinner nf-roda" aria-hidden="true" />}{vm.envioDoEmail.texto}
                  </div>
                )}
              </Dado>
            )}
            {fone && <Dado rotulo="Telefone">{fone}</Dado>}
            <Dado rotulo="Número da NFS-e">{n.numeroNfse || '—'}</Dado>
            <Dado rotulo="Chave de acesso">
              {n.chaveAcesso
                ? <span className="nf-chave"><code>{n.chaveAcesso}</code><button type="button" className="icon-btn icon-btn-sm" onClick={() => void vm.copiarChave()} aria-label="Copiar a chave de acesso" title="Copiar a chave"><Icone nome="copiar" /></button></span>
                : '—'}
            </Dado>
            <Dado rotulo="DPS">{n.dps ? 'Série ' + n.dps.serie + ' · nº ' + n.dps.numero : '—'}</Dado>
            <Dado rotulo="Pedida por">{n.pedidoPor}<span className="fraco"> · {dataHoraBr(n.pedidoEm)}</span></Dado>
            {n.cancelamento && (
              <Dado rotulo="Cancelamento">
                {n.cancelamento.motivo}<span className="fraco"> · {n.cancelamento.pedidoPor}, {dataHoraBr(n.cancelamento.pedidoEm)}</span>
              </Dado>
            )}
          </div>

          {n.erros.length > 0 && (
            <div className="nf-erros">
              <span className="nf-dado-nome">A prefeitura respondeu</span>
              <ul className="registro-erros">{n.erros.map((e, i) => <li key={e.codigo + i}><Icone nome="alert" /><span><b>{e.codigo}</b> {e.descricao}</span></li>)}</ul>
            </div>
          )}

          {vm.mandandoEmail && (
            <div className="nf-cancelar">
              <div className="registro-prop">
                <span className="registro-prop-nome"><Icone nome="envelope" />Para</span>
                <div className="registro-prop-valor">
                  <input type="email" className="nf-entrada largo" value={vm.paraEmail} onChange={e => vm.setParaEmail(e.target.value)} autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') void vm.enviarPorEmail(); }} placeholder="email@cliente.com.br" aria-label="E-mail para mandar a nota" />
                </div>
              </div>
              <span className={'registro-dica' + (vm.avisoEmail ? ' registro-dica-erro' : '')}>
                {vm.avisoEmail || 'O robô manda a DANFSe (PDF) e o XML' + (n.ambiente === 'homologacao' ? ', avisando que a nota é sem valor fiscal.' : '.')}
              </span>
            </div>
          )}

          {vm.cancelando && (
            <div className="nf-cancelar">
              <div className="registro-prop">
                <span className="registro-prop-nome"><Icone nome="alert" />Motivo</span>
                <div className="registro-prop-valor">
                  <MenuSuspenso rotulo={motivo} className="btn btn-ghost registro-escolha" titulo="Motivo do cancelamento" largura={220}
                    itens={vm.motivos.map(m => ({ rotulo: m.rotulo, marcado: m.id === vm.cMotivo, onClick: () => vm.setCMotivo(m.id) }))} />
                </div>
              </div>
              <textarea className="nf-texto" rows={3} value={vm.justificativa} onChange={e => vm.setJustificativa(e.target.value)} autoFocus
                placeholder="Justificativa do cancelamento (mínimo de 15 letras)" aria-label="Justificativa do cancelamento" />
              <span className={'registro-dica' + (vm.podePedirCancelamento || !vm.letras ? '' : ' registro-dica-erro')}>{vm.letras}/{MINIMO_DA_JUSTIFICATIVA} letras no mínimo</span>
            </div>
          )}
        </div>

        <footer className="registro-pe">
          <span className="tarefas-barra-espaco" />
          {vm.mandandoEmail ? (
            <>
              <button type="button" className="btn btn-outline" onClick={vm.fecharEmail}>Voltar</button>
              <BotaoAcao className="btn btn-primary" carregando={vm.pedindoEmail} textoCarregando="Pedindo…" disabled={!vm.paraEmail.trim()} onClick={() => void vm.enviarPorEmail()}>
                <Icone nome="envelope" />Enviar
              </BotaoAcao>
            </>
          ) : vm.cancelando ? (
            <>
              <button type="button" className="btn btn-outline" onClick={vm.fecharCancelamento}>Voltar</button>
              <BotaoAcao className="btn btn-danger" carregando={vm.enviando} textoCarregando="Pedindo…" disabled={!vm.podePedirCancelamento} onClick={() => void vm.pedirCancelamento()}>
                Cancelar nota
              </BotaoAcao>
            </>
          ) : (
            <>
              {vm.podeCancelar && <button type="button" className="btn btn-outline" onClick={vm.abrirCancelamento}>Cancelar nota</button>}
              {vm.podeBaixar && (
                <BotaoAcao className="btn" carregando={vm.baixando} textoCarregando="Baixando…" onClick={() => void vm.baixarXml()}><Icone nome="download" />Baixar XML</BotaoAcao>
              )}
              {vm.podeBaixar && (
                <BotaoAcao className="btn" carregando={vm.baixandoDanfse} textoCarregando="Gerando…" onClick={() => void vm.baixarDanfse()}><Icone nome="download" />Baixar DANFSe</BotaoAcao>
              )}
              {vm.podeCorrigir && <button type="button" className="btn btn-primary" onClick={() => corrigir(n)}><Icone nome="lapis" />Corrigir e reenviar</button>}
              <button type="button" className="btn btn-outline" onClick={fechar}>Fechar</button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
