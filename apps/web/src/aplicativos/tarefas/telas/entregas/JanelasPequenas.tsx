// As janelas pequenas da entrega de documentos (16/10/2026, a cópia fiel do Entregas no visual do nads): "Não esqueça de
// falar com o cliente", "Assinar no celular do cliente" (o QR), "Ler guia" (a câmera), "Meta do mês", "Sem entrega há
// tempo" e o texto para copiar à mão (quando o navegador não deixa copiar sozinho).
import { BotaoAcao, Icone, LogoWhatsApp } from '@nads/ui';
import type { entregas } from '@nads/core';
import { useEffect, useRef } from 'react';
import { MolduraDaJanela } from './MolduraDaJanela';
import { useQr } from './useQr';
import { useAssinarNoCelular, useJanelaDaMeta, useJanelaDosLembretes, useJanelaParaCopiar, useJanelaSemEntrega, useLerGuia } from './useJanelasPequenas';

type Entrega = ReturnType<typeof entregas.entregaDoDocumento>;

export function JanelaDosLembretes({ clientes }: { clientes: { id: string; nome: string }[] }) {
  const vm = useJanelaDosLembretes(clientes);
  return (
    <MolduraDaJanela icone="sino" caminho="Entrega" titulo="Não esqueça de falar com o cliente" sub={vm.principal} onFechar={vm.fechar}
      rodape={<><span className="tarefas-barra-espaco" /><BotaoAcao className="btn btn-primary" carregando={vm.salvando} textoCarregando="Salvando…" onClick={() => void vm.pronto()}>Pronto</BotaoAcao></>}>
      <ul className="ent-lembretes">
        {vm.itens.map(l => (
          <li key={l.id} className={'ent-lembrete-item' + (l.estado === 'falei' ? ' feito' : l.estado === 'depois' ? ' adiado' : '')}>
            <Icone nome="sino" width={16} height={16} />
            <div className="ent-lembrete-corpo"><div>{l.texto}</div><div className="hint">{l.meta}</div></div>
            <div className="ent-lembrete-acoes">
              {l.estado === 'falei' ? <span className="badge badge-ok">Falei</span> : l.estado === 'depois' ? <span className="badge badge-neutral">Fica pra próxima</span> : <>
                <button type="button" className="btn btn-primary" disabled={l.estado === 'gravando'} onClick={() => void vm.falei(l.id)}><Icone nome="check" />Falei</button>
                <button type="button" className="btn btn-outline" onClick={() => vm.depois(l.id)}>Deixar pra próxima</button>
              </>}
            </div>
          </li>
        ))}
      </ul>
      <div className="field">
        <label htmlFor="ent-lembrete-novo">Novo lembrete pra próxima vez (opcional)</label>
        <textarea id="ent-lembrete-novo" rows={2} maxLength={500} value={vm.novo} onChange={e => vm.setNovo(e.target.value)} placeholder="Ex.: o cliente pediu pra ligar antes" />
      </div>
    </MolduraDaJanela>
  );
}

export function JanelaAssinarNoCelular({ entrega }: { entrega: Entrega }) {
  const vm = useAssinarNoCelular(entrega);
  const qr = useQr(vm.link, 200);
  return (
    <MolduraDaJanela icone="celular" caminho="Rota" titulo="Assinar no celular do cliente" sub={vm.nome} onFechar={vm.voltar}>
      <p className="hint">{vm.status}</p>
      {qr && <img className="ent-qr" src={qr} alt="QR do link para o cliente assinar" width={200} height={200} />}
      <div className="ent-acoes-linha">
        <button type="button" className="btn btn-outline" disabled={!vm.link} onClick={() => void vm.copiar()}><Icone nome="copiar" />Copiar link</button>
        <button type="button" className="btn btn-outline" disabled={!vm.link} onClick={vm.whatsapp}><span className="ent-logo"><LogoWhatsApp /></span>Mandar no WhatsApp</button>
      </div>
      <p className="hint">O cliente aponta a câmera pro código. O link vale uma vez só e expira em 2 horas.</p>
    </MolduraDaJanela>
  );
}

export function JanelaLerGuia() {
  const video = useRef<HTMLVideoElement>(null);
  const vm = useLerGuia(video);
  return (
    <MolduraDaJanela icone="codigoBarras" caminho="Rota" titulo="Ler guia" sub="Aponte pro código de barras ou pro QR do PIX da guia." onFechar={vm.fechar}>
      <video ref={video} className="ent-leitor" playsInline muted onClick={vm.tocarVideo} />
      <div className="ent-acoes-linha">
        <button type="button" className="btn btn-primary" onClick={vm.lerDaFoto}><Icone nome="camera" />Focar e ler</button>
        {vm.lanterna !== null && <button type="button" className={'btn btn-outline' + (vm.lanterna ? ' ativo' : '')} onClick={vm.alternarLanterna}><Icone nome="zap" />Lanterna</button>}
        {vm.podeTrocar && <button type="button" className="btn btn-outline" onClick={vm.trocar}><Icone nome="girar" />Trocar câmera</button>}
      </div>
      <p className="hint">{vm.status}</p>
      {vm.diag && <p className="hint num">{vm.diag}</p>}
    </MolduraDaJanela>
  );
}

export function JanelaDaMeta() {
  const vm = useJanelaDaMeta();
  return (
    <MolduraDaJanela icone="alvo" caminho="Painel" titulo="Meta do mês" sub="Quantas entregas confirmadas cada pessoa deve fazer por competência" onFechar={vm.fechar}
      rodape={<><span className="tarefas-barra-espaco" /><BotaoAcao className="btn btn-primary" carregando={vm.salvando} textoCarregando="Salvando…" onClick={() => void vm.salvar()}>Salvar meta</BotaoAcao></>}>
      <div className="field">
        <label htmlFor="ent-meta">Entregas por pessoa</label>
        <input id="ent-meta" type="text" inputMode="numeric" value={vm.valor} onChange={e => vm.setValor(e.target.value.replace(/\D/g, ''))} placeholder="ex.: 40" autoFocus
          onKeyDown={e => { if (e.key === 'Enter') void vm.salvar(); }} />
        <p className="hint">Deixe vazio ou zero para não mostrar meta nenhuma.</p>
      </div>
    </MolduraDaJanela>
  );
}

export function JanelaSemEntrega({ ids }: { ids: string[] }) {
  const vm = useJanelaSemEntrega(ids);
  return (
    <MolduraDaJanela icone="alert" caminho="Painel" titulo="Sem entrega há tempo" sub={vm.lista.length + ' cliente(s) ativo(s) sem entrega confirmada nas últimas 3 competências'} onFechar={vm.fechar}>
      <ul className="nf-achados ent-lista-janela">
        {vm.lista.map(c => <li key={c.id}><button type="button" className="popover-item" onClick={() => vm.abrir(c.id)}><span className="popover-texto">{c.nome}</span><Icone nome="chevronRight" width={14} height={14} /></button></li>)}
      </ul>
    </MolduraDaJanela>
  );
}

export function JanelaParaCopiar({ titulo, texto }: { titulo: string; texto: string }) {
  const vm = useJanelaParaCopiar();
  const campo = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { campo.current?.focus(); campo.current?.select(); }, []);
  return (
    <MolduraDaJanela icone="copiar" caminho="Entregas" titulo={titulo} sub="Selecione tudo e copie pra mandar onde quiser." onFechar={vm.fechar}>
      <div className="field"><textarea ref={campo} rows={12} readOnly value={texto} aria-label={titulo} /></div>
    </MolduraDaJanela>
  );
}
