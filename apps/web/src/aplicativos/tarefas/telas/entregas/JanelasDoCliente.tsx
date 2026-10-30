// As janelas que a página do cliente abre (16/10/2026, a cópia fiel do Entregas no visual do nads): a entrega feita,
// Corrigir localização, Aglutinar com outra empresa e o Link do cliente.
import { BotaoAcao, Esqueleto, Icone, LogoWhatsApp } from '@nads/ui';
import type { entregas } from '@nads/core';
import type { JanelaDaEntrega } from './contextoDasJanelas';
import { MolduraDaJanela } from './MolduraDaJanela';
import { useQr } from './useQr';
import { useAglutinar, useCorrigirLocal, useJanelaDaEntrega, useLinkDoCliente } from './useJanelasDoCliente';

type Entrega = ReturnType<typeof entregas.entregaDoDocumento>;

export function JanelaDaEntregaFeita({ entrega, nome, clienteId, voltar }: { entrega: Entrega; nome: string; clienteId: string | null; voltar: JanelaDaEntrega | null }) {
  const vm = useJanelaDaEntrega(entrega, nome, clienteId, voltar);
  return (
    <MolduraDaJanela caminho="Cliente" titulo={vm.nome} sub={vm.competencia} onFechar={vm.fechar} classe="ent-parada"
      rodape={<>
        {vm.podeExcluir && <button type="button" className="btn btn-danger" onClick={() => void vm.excluir()}><Icone nome="lixeira" />Excluir entrega</button>}
        <span className="tarefas-barra-espaco" />
        <button type="button" className="btn btn-outline" onClick={() => void vm.imprimir()}><Icone nome="printer" />Imprimir</button>
        <button type="button" className="btn btn-primary" onClick={() => void vm.enviarComprovante()}><span className="ent-logo"><LogoWhatsApp /></span>Enviar comprovante</button>
      </>}>
      <div className="ent-fichas">{vm.fichas.map((f, i) => <span key={i} className="badge badge-neutral">{f}</span>)}</div>
      {vm.falha && <p className="registro-dica registro-dica-erro"><Icone nome="alert" />Não entregue: {vm.falha}</p>}
      {vm.semComprovante && <p className="registro-dica"><b>Sem comprovante.</b> {vm.semComprovante}</p>}
      {vm.localDivergente && <p className="registro-dica"><Icone nome="mapaPin" />{vm.localDivergente}</p>}
      {!vm.anexos ? <Esqueleto linhas={2} /> : (
        <div className="ent-comprovante">
          {vm.anexos.assinatura && <figure><img src={vm.anexos.assinatura} alt="Assinatura de recebimento" /><button type="button" className="btn btn-ghost" onClick={() => vm.salvar('assinatura')}><Icone nome="download" />Salvar assinatura</button></figure>}
          {vm.anexos.foto && <figure><img src={vm.anexos.foto} alt="Foto anexada" /><button type="button" className="btn btn-ghost" onClick={() => vm.salvar('foto')}><Icone nome="download" />Salvar foto</button></figure>}
          {!vm.anexos.assinatura && !vm.anexos.foto && !vm.guias.length && <p className="hint">Sem comprovante anexado.</p>}
          {vm.guias.map(g => (g.pdf
            ? <button key={g.tipo} type="button" className="btn btn-ghost" onClick={() => vm.baixarGuia(g)}><Icone nome="fileDown" />Baixar {g.nome || 'guia.pdf'}</button>
            : <p key={g.tipo} className="hint"><Icone nome="arquivo" width={14} height={14} /> {g.nome || 'guia'} (grande demais para anexar; está na pasta do cliente no Drive)</p>))}
        </div>
      )}
      <dl className="ent-dados">
        {vm.dados.map(([r, v]) => <div key={r}><dt>{r}</dt><dd className={r === 'Total' ? 'num' : undefined}>{v}</dd></div>)}
        <div><dt>Localização</dt><dd>{vm.mapa ? <a href={vm.mapa} target="_blank" rel="noopener noreferrer">ver no mapa</a> : 'não capturada'}</dd></div>
      </dl>
    </MolduraDaJanela>
  );
}

export function JanelaCorrigirLocal({ clienteId, voltar }: { clienteId: string; voltar: JanelaDaEntrega | null }) {
  const vm = useCorrigirLocal(clienteId, voltar);
  return (
    <MolduraDaJanela icone="mapaPin" caminho="Cliente" titulo="Corrigir localização" sub={vm.rotulo} onFechar={vm.fechar}
      rodape={<><span className="tarefas-barra-espaco" /><BotaoAcao className="btn btn-primary" carregando={vm.salvando} textoCarregando="Salvando…" onClick={() => void vm.salvar()}>Salvar</BotaoAcao></>}>
      <div className="field">
        <label>Onde fica</label>
        <button type="button" className="btn btn-outline ent-largo" disabled={vm.pegando} onClick={vm.estouNoLocal}>
          {vm.pegando ? <span className="btn-spinner" aria-hidden="true" /> : <Icone nome="mapaPin" />}Estou no local agora
        </button>
        <input type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Ou: mesmo local de outro cliente — busque pelo nome" autoComplete="off" aria-label="Mesmo local de outro cliente" />
        {vm.achados.length > 0 && (
          <ul className="nf-achados">{vm.achados.map(a => (
            <li key={a.c.id}><button type="button" className="popover-item" onClick={() => vm.mesmoLocalDe(a.c)}><span className="popover-texto">{a.nome}</span><span className="popover-dica">{a.sub}</span></button></li>
          ))}</ul>
        )}
      </div>
      <div className="field">
        <label htmlFor="ent-corrigir-zona">Região da rota</label>
        <select id="ent-corrigir-zona" value={vm.zona} onChange={e => vm.setZona(e.target.value)}>
          <option value="">Sem região definida</option>{vm.zonas.map(z => <option key={z.valor} value={z.valor}>{z.rotulo}</option>)}
        </select>
      </div>
      {vm.status && <p className="hint">{vm.status}</p>}
    </MolduraDaJanela>
  );
}

export function JanelaAglutinar({ clienteId, voltar }: { clienteId: string; voltar: JanelaDaEntrega | null }) {
  const vm = useAglutinar(clienteId, voltar);
  return (
    <MolduraDaJanela icone="link" caminho="Cliente" titulo="Aglutinar com outra empresa" sub={vm.rotulo} onFechar={vm.fechar}>
      {vm.ancora && (
        <div className="ent-acoes-linha">
          <p className="hint"><b>Aglutinado com:</b> {vm.ancora}</p>
          <button type="button" className="btn btn-danger" disabled={vm.gravando} onClick={() => void vm.desfazer()}><Icone nome="x" />Desfazer aglutinação</button>
        </div>
      )}
      {!vm.ancora && vm.seguidores.length > 0 && <p className="hint"><b>É a referência de:</b> {vm.seguidores.join(', ')}. Para desfazer, abra a ficha de um deles.</p>}
      <div className="field">
        <label htmlFor="ent-aglutinar">{vm.ancora ? 'Trocar para outra empresa' : 'Buscar a outra empresa'}</label>
        <input id="ent-aglutinar" type="text" value={vm.busca} onChange={e => vm.setBusca(e.target.value)} placeholder="Nome, código ou CNPJ" autoComplete="off" />
        {vm.achados.length > 0 && (
          <ul className="nf-achados">{vm.achados.map(a => (
            <li key={a.c.id}><button type="button" className="popover-item" disabled={vm.gravando} onClick={() => void vm.aglutinarCom(a.c)}><span className="popover-texto">{a.nome}</span><span className="popover-dica">{a.sub}</span></button></li>
          ))}</ul>
        )}
      </div>
      {vm.status && <p className="hint">{vm.status}</p>}
    </MolduraDaJanela>
  );
}

export function JanelaLinkDoCliente({ clienteId }: { clienteId: string }) {
  const vm = useLinkDoCliente(clienteId);
  const qr = useQr(vm.link, 180);
  return (
    <MolduraDaJanela icone="link" caminho="Cliente" titulo="Link do cliente" sub={vm.rotulo} onFechar={vm.fechar}>
      {vm.avisoDoGrupo && <p className="registro-dica"><Icone nome="ajuda" />{vm.avisoDoGrupo}</p>}
      {vm.tem ? (
        <>
          {vm.grupo && <p className="hint">{vm.grupo}</p>}
          {vm.visto && <p className="hint">{vm.visto}</p>}
          <div className="ent-acoes-linha">
            <button type="button" className="btn btn-primary" onClick={vm.whatsapp}><span className="ent-logo"><LogoWhatsApp /></span>Mandar no WhatsApp</button>
            <button type="button" className="btn btn-outline" onClick={() => void vm.copiar()}><Icone nome="copiar" />Copiar link</button>
            <button type="button" className="btn btn-outline" onClick={vm.verComoOCliente}><Icone nome="olho" />Ver como o cliente vê</button>
          </div>
          {qr && <img className="ent-qr" src={qr} alt="QR do link do cliente" width={180} height={180} />}
          {vm.admin && (
            <details className="ent-dobra">
              <summary className="hint">O link vazou?</summary>
              <p className="hint">Trocar gera um link novo e o antigo para de funcionar na hora. O cliente precisa receber o novo.</p>
              <button type="button" className="btn btn-danger" disabled={vm.criando} onClick={() => void vm.criar(true)}><Icone nome="girar" />Trocar o link</button>
            </details>
          )}
        </>
      ) : (
        <>
          <p className="hint">Este cliente ainda não tem link.</p>
          {vm.admin
            ? <BotaoAcao className="btn btn-primary" carregando={vm.criando} textoCarregando="Criando…" onClick={() => void vm.criar(false)}><Icone nome="link" />Criar link</BotaoAcao>
            : <p className="hint">Só admin cria o link.</p>}
        </>
      )}
    </MolduraDaJanela>
  );
}
