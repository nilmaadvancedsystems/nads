// A janela da parada (16/10/2026, a cópia fiel do Entregas: "só copia o entregas e joga aqui no design n1"): a mesma
// ordem de lá — os documentos (e Editar documentos/competência), o lembrete, "Cliente ausente / entrega não realizada", o
// PIX do honorário, o motivo num toque, quem recebeu (os nomes num toque), "Entreguei, mas o cliente não assinou", a foto,
// a assinatura (Tela cheia; "Assinar no celular do cliente"), o lugar, o link do cliente; no rodapé "Remover da rota" e
// "Confirmar entrega". O visual é o do nads (a moldura de criar registro, o campo, a assinatura e o arquivo do catálogo).
import { BotaoAcao, BotaoIcone, CampoArquivos, CampoAssinatura, Icone, SeletorMes } from '@nads/ui';
import type { entregas } from '@nads/core';
import { MolduraDaJanela } from './MolduraDaJanela';
import { useQr } from './useQr';
import { useJanelaDaParada } from './useJanelaDaParada';
import { useState } from 'react';

type Entrega = ReturnType<typeof entregas.entregaDoDocumento>;

export function JanelaDaParada({ entrega, assinatura }: { entrega: Entrega; assinatura?: { assinatura: string; recebedor: string } }) {
  const vm = useJanelaDaParada(entrega, assinatura);
  const e = vm.entrega;
  const qrPix = useQr(vm.pixCodigo, 132);
  return (
    <MolduraDaJanela caminho="Rota" titulo={e.clienteNome} sub={vm.sub} onFechar={vm.fechar} classe="ent-parada"
      rodape={<>
        {vm.podeEditar && <button type="button" className="btn btn-danger" onClick={() => void vm.removerDaRota()}><Icone nome="lixeira" />Remover da rota</button>}
        <span className="tarefas-barra-espaco" />
        <BotaoAcao className="btn btn-primary" carregando={vm.salvando} textoCarregando="Salvando…" onClick={() => void vm.confirmar()}>{vm.rotuloDoBotao}</BotaoAcao>
      </>}>
      {vm.dica && <p className="registro-dica"><Icone nome="lampada" />{vm.dica}.</p>}

      {!vm.edicao ? (
        <div>
          <div className="ent-fichas">{vm.fichas.map((f, i) => <span key={i} className="badge badge-neutral">{f}</span>)}</div>
          {vm.podeEditar && <button type="button" className="btn btn-ghost ent-editar" onClick={vm.abrirEdicao}><Icone nome="lapis" />Editar documentos/competência</button>}
        </div>
      ) : <EdicaoDaParada vm={vm} />}

      {vm.lembretes.length > 0 && (
        <div className="alert ent-lembrete" role="note"><Icone nome="sino" width={18} height={18} />
          <div><b className="alert-title">Pra falar com o cliente</b>{vm.lembretes.map((t, i) => <div key={i} className="alert-text">{t}</div>)}</div>
        </div>
      )}

      <label className="ent-marca ent-marca-falha"><input type="checkbox" checked={vm.falha} onChange={ev => vm.setFalha(ev.target.checked)} /><Icone nome="alert" />Cliente ausente / entrega não realizada</label>

      {vm.soHonorario && <label className="ent-marca"><input type="checkbox" checked={vm.pix} onChange={ev => vm.setPix(ev.target.checked)} />Pagamento via Pix</label>}
      {vm.pix && (
        <div className="ent-pix">
          <div className="field"><label htmlFor="ent-parada-pix">Valor do honorário</label>
            <input id="ent-parada-pix" type="text" inputMode="decimal" placeholder="0,00" autoComplete="off" value={vm.pixValor} onChange={ev => vm.setPixValor(ev.target.value)} /></div>
          {vm.pixSemChave ? <p className="hint">Sem chave Pix cadastrada em Escritório.</p> : qrPix && (
            <div className="ent-pix-qr"><img src={qrPix} alt="QR do Pix do escritório" width={132} height={132} />
              <div className="ent-pix-lado"><b>Pix do escritório</b><span className="hint">{vm.pixSub}</span>
                <button type="button" className="btn btn-outline" onClick={() => void vm.copiarPix(vm.pixCodigo)}><Icone nome="copiar" />Copiar código</button></div></div>
          )}
        </div>
      )}

      {vm.falha && (
        <div className="field">
          <label htmlFor="ent-falha">O que aconteceu</label>
          <div className="ent-motivos">{vm.motivos.map(m => <button key={m} type="button" className={'chip-f' + (vm.motivoMarcado === m ? ' on' : '')} onClick={() => vm.usarMotivo(m)}>{m}</button>)}</div>
          <textarea id="ent-falha" rows={2} value={vm.motivoFalha} onChange={ev => vm.setMotivoFalha(ev.target.value)} placeholder="Ex.: Estabelecimento fechado, ninguém atendeu..." />
          {vm.erros.motivo && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erros.motivo}</p>}
        </div>
      )}

      {!vm.falha && (
        <div className="field">
          <label htmlFor="ent-recebedor">Nome de quem recebeu (opcional)</label>
          <input id="ent-recebedor" type="text" value={vm.recebedor} onChange={ev => vm.setRecebedor(ev.target.value)} placeholder="Quem assinou pelo cliente" />
          {vm.sugeridos.length > 0 && <div className="ent-motivos">{vm.sugeridos.map(n => <button key={n} type="button" className="chip-f" onClick={() => vm.setRecebedor(n)}>{n}</button>)}</div>}
        </div>
      )}

      {!vm.falha && <label className="ent-marca"><input type="checkbox" checked={vm.semAssinatura} onChange={ev => vm.setSemAssinatura(ev.target.checked)} /><Icone nome="lapis" />Entreguei, mas o cliente não assinou</label>}
      {!vm.falha && vm.semAssinatura && (
        <div className="field">
          <label htmlFor="ent-sem-ass">Por que não assinou (opcional)</label>
          <textarea id="ent-sem-ass" rows={2} value={vm.motivoSemAssinatura} onChange={ev => vm.setMotivoSemAssinatura(ev.target.value)} placeholder="Ex.: deixei na portaria, responsável não estava..." />
          <p className="hint">Tire uma <b>foto</b> mostrando a entrega (o documento na portaria, na mesa, na caixa de correio): ela vale como comprovante.</p>
        </div>
      )}

      <div className="field">
        <label>{vm.rotuloDaFoto}</label>
        {vm.foto ? (
          <span className="ent-anexo"><img className="ent-foto" src={vm.foto} alt="Foto anexada" /><button type="button" className="btn btn-ghost" onClick={vm.tirarFoto}><Icone nome="x" />Remover foto</button></span>
        ) : <CampoArquivos id={'ent-foto-' + e.id} aceitar="image/*" camera rotulo="Tirar foto / anexar" onEscolher={fs => void vm.anexarFoto(fs)} />}
        {vm.erros.foto && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erros.foto}</p>}
      </div>

      {!vm.falha && !vm.semAssinatura && (
        <div className="field">
          <label>Assinatura (opcional se anexar foto)</label>
          <CampoAssinatura valor={vm.assinatura} onMudar={vm.setAssinatura} altura={200} telaCheia rotulo="Assinatura de quem recebeu"
            textoPronta={vm.doCelular ? 'Assinado no celular do cliente.' : 'Assinatura capturada.'} />
          <button type="button" className="btn btn-ghost ent-editar" onClick={vm.assinarNoCelular}><Icone nome="celular" />Assinar no celular do cliente</button>
          {vm.erros.assinatura && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />{vm.erros.assinatura}</p>}
          <p className="hint ent-geo"><Icone nome="mapaPin" />{vm.localizacao}</p>
        </div>
      )}

      {vm.linkDoCliente && <LinkDoClienteNaParada link={vm.linkDoCliente} />}
    </MolduraDaJanela>
  );
}

/** "Mostrar o link do cliente": uma dobra (trocar de tela apagaria a assinatura colhida); o QR só é desenhado ao abrir. */
function LinkDoClienteNaParada({ link }: { link: string }) {
  const [aberto, setAberto] = useState(false);
  const qr = useQr(aberto ? link : '', 200);
  return (
    <details className="ent-dobra" onToggle={ev => setAberto((ev.target as HTMLDetailsElement).open)}>
      <summary className="hint"><Icone nome="qrCode" width={14} height={14} /> Mostrar o link do cliente</summary>
      {qr && <img className="ent-qr" src={qr} alt="QR do link do cliente" width={200} height={200} />}
      <p className="hint ent-centro">O cliente aponta a câmera e guarda o link: guias, comprovantes e o que falta enviar.</p>
    </details>
  );
}

type Vm = ReturnType<typeof useJanelaDaParada>;

/** Editar documentos/competência (abrirEdicaoPendente): a competência, a região, os documentos e os valores. */
function EdicaoDaParada({ vm }: { vm: Vm }) {
  const ed = vm.edicao;
  if (!ed) return null;
  const linhas = [...vm.tipos.filter(t => ed.marcados.includes(t.chave)).map(t => ({ rotulo: t.rotulo, semValor: !!t.semValor, pedeFuncionario: !!t.pedeFuncionario })),
    ...(ed.outro.trim() ? [{ rotulo: ed.outro.trim(), semValor: false, pedeFuncionario: false }] : [])].filter(l => !l.semValor);
  return (
    <div className="ent-edicao">
      <div className="field"><label>Competência</label><SeletorMes valor={ed.competencia} onMudar={v => vm.mudarEdicao({ competencia: v })} rotulo="Competência" /></div>
      <div className="field"><label htmlFor="ent-ed-zona">Região da rota</label>
        <select id="ent-ed-zona" value={ed.zona} onChange={ev => vm.mudarEdicao({ zona: ev.target.value })}>
          <option value="">Selecione a região</option>{vm.zonas.map(z => <option key={z.valor} value={z.valor}>{z.rotulo}</option>)}
        </select></div>
      <div className="field"><label>Documentos entregues</label>
        <div className="chip-row">{vm.tipos.map(t => {
          const on = ed.marcados.includes(t.chave);
          return <button key={t.chave} type="button" className={'chip-f' + (on ? ' on' : '')} aria-pressed={on}
            onClick={() => vm.mudarEdicao({ marcados: on ? ed.marcados.filter(k => k !== t.chave) : [...ed.marcados, t.chave] })}>{t.rotulo}</button>;
        })}</div></div>
      <div className="field"><label htmlFor="ent-ed-outro">Outro documento (opcional)</label>
        <input id="ent-ed-outro" type="text" value={ed.outro} onChange={ev => vm.mudarEdicao({ outro: ev.target.value })} placeholder="Ex.: Contrato social, procuração..." /></div>
      {linhas.length > 0 && (
        <div className="field"><label>Valores</label>
          <ul className="ent-docs">{linhas.map(l => (
            <li key={l.rotulo} className="ent-doc-grupo">
              <div className="ent-doc"><span className="ent-doc-tipo">{l.rotulo}</span>
                <input type="text" inputMode="decimal" className="ent-doc-valor num" placeholder="R$ 0,00" aria-label={'Valor de ' + l.rotulo} value={ed.valores[l.rotulo] || ''}
                  onChange={ev => vm.mudarEdicao({ valores: { ...ed.valores, [l.rotulo]: ev.target.value } })} />
                <BotaoIcone icone="x" titulo="Remover valor" pequeno onClick={() => vm.mudarEdicao({ valores: { ...ed.valores, [l.rotulo]: '' } })} /></div>
              {l.pedeFuncionario && <div className="ent-doc"><input type="text" className="ent-doc-tipo" placeholder="Nome do funcionário" aria-label={'Nome do funcionário para ' + l.rotulo} value={ed.funcionarios[l.rotulo] || ''}
                onChange={ev => vm.mudarEdicao({ funcionarios: { ...ed.funcionarios, [l.rotulo]: ev.target.value } })} /></div>}
            </li>
          ))}</ul></div>
      )}
      <BotaoAcao className="btn btn-outline" carregando={vm.salvandoEdicao} textoCarregando="Salvando…" onClick={() => void vm.salvarEdicao()}><Icone nome="check" />Salvar alterações</BotaoAcao>
    </div>
  );
}
