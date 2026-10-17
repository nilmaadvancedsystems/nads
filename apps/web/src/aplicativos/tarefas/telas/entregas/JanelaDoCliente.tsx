// A página do cliente (16/10/2026, a cópia fiel da página do cliente do Entregas, no visual do nads): a janela grande com
// abas do catálogo (a da empresa no Cadastro) — no topo quem é (as iniciais, o nome, o código, o CNPJ, a cidade e os
// selos); à esquerda Resumo, Entregas, Cadastro, Receita, Contatos, Documentos e Ações; o conteúdo em cartões do nads.
import { BotaoFechar, ConfigLinha, ConfigSecao, Esqueleto, Icone, LogoWhatsApp, Stat, Vazio, useJanela, type NomeIcone } from '@nads/ui';
import { useRef, type ReactNode } from 'react';
import { useJanelaDoCliente } from './useJanelaDoCliente';

type VmDaJanela = ReturnType<typeof useJanelaDoCliente>;

export function JanelaDoCliente({ clienteId, consulta, aba }: { clienteId: string; consulta: boolean; aba?: string }) {
  const vm = useJanelaDoCliente(clienteId, consulta, aba);
  return vm.cliente ? <ClienteAberto vm={vm} /> : <ClienteAinda vm={vm} />;
}

// revisão da UI (16/10/2026, como os commits 707009b0 e 3ac496fb): Esc, foco preso e o foco de volta pela peça useJanela
// (antes, um Esc à mão) e o × do catálogo (BotaoFechar); cada estado é uma janela, para o foco seguir a que está na tela
function ClienteAinda({ vm }: { vm: Pick<VmDaJanela, 'carregando' | 'fechar'> }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fechar);
  return (
    <div className="cad-janela-fundo" onMouseDown={e => { if (e.target === e.currentTarget) vm.fechar(); }}>
      <div ref={janela} className="cad-janela ent-cliente-janela" role="dialog" aria-modal="true" aria-label="Cliente"><div className="cad-janela-topo"><span className="cad-janela-empresa">Cliente</span><BotaoFechar onClick={vm.fechar} /></div>
        <div className="cad-janela-conteudo">{vm.carregando ? <Esqueleto linhas={5} /> : <Vazio icone="usuario" texto="Cliente não encontrado no cadastro do Entregas." />}</div></div>
    </div>
  );
}

function ClienteAberto({ vm }: { vm: Vm }) {
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, vm.fechar);
  return (
    <div className="cad-janela-fundo" onMouseDown={e => { if (e.target === e.currentTarget) vm.fechar(); }}>
      <div ref={janela} className="cad-janela ent-cliente-janela" role="dialog" aria-modal="true" aria-label={vm.rotulo}>
        <div className="cad-janela-topo ent-cliente-topo">
          <span className="ent-avatar" aria-hidden="true">{vm.iniciais}</span>
          <div className="ent-cliente-quem">
            <b className="cad-janela-nome">{vm.rotulo}</b>
            {vm.subtitulo && <span className="fraco">{vm.subtitulo}</span>}
            {vm.selos.length > 0 && <span className="ent-selos">{vm.selos.map(s => <span key={s.texto} className={'badge badge-' + s.tom} title={s.dica}>{s.pin && <Icone nome="mapaPin" width={12} height={12} />}{s.texto}</span>)}</span>}
          </div>
          <BotaoFechar onClick={vm.fechar} />
        </div>
        <div className="cad-janela-corpo">
          <nav className="cad-janela-abas" role="tablist" aria-label="Seções do cliente">
            {vm.abas.map(a => (
              <button key={a.id} type="button" role="tab" aria-selected={vm.aba === a.id} className={'cad-janela-aba' + (vm.aba === a.id ? ' ativa' : '')} onClick={() => vm.setAba(a.id)}>
                <Icone nome={a.icone} />{a.rotulo}{a.n ? <span className="menu-contador">{a.n}</span> : null}
              </button>
            ))}
          </nav>
          <div className="cad-janela-conteudo">
            {vm.aba === 'resumo' && <Resumo vm={vm} />}
            {vm.aba === 'entregas' && <Entregas vm={vm} />}
            {vm.aba === 'cadastro' && <Cadastro vm={vm} />}
            {vm.aba === 'receita' && <Receita vm={vm} />}
            {vm.aba === 'contatos' && <Contatos vm={vm} />}
            {vm.aba === 'documentos' && <Documentos vm={vm} />}
            {vm.aba === 'acoes' && <Acoes vm={vm} />}
          </div>
        </div>
      </div>
    </div>
  );
}

type Vm = Extract<ReturnType<typeof useJanelaDoCliente>, { grupos: unknown }>;

function Cartao({ titulo, icone, acao, children }: { titulo: string; icone: NomeIcone; acao?: ReactNode; children: ReactNode }) {
  return (
    <section className="card ent-cartao">
      <div className="card-head"><h3><Icone nome={icone} width={16} height={16} /> {titulo}</h3>{acao && <span className="card-head-ctl">{acao}</span>}</div>
      {children}
    </section>
  );
}
function Dados({ linhas }: { linhas: [string, string][] }) {
  if (!linhas.length) return null;
  return <dl className="ent-dados">{linhas.map(([r, v]) => <div key={r}><dt>{r}</dt><dd>{v}</dd></div>)}</dl>;
}
function Situacao({ s }: { s: { rotulo: string; tom: 'ok' | 'bad' | 'warn' } }) {
  return <span className={'badge ' + (s.tom === 'ok' ? 'badge-ok' : s.tom === 'bad' ? 'badge-danger' : 'badge-warn')}>{s.rotulo}</span>;
}

function Resumo({ vm }: { vm: Vm }) {
  return (
    <>
      <div className="stat-grid ent-kpis">{vm.kpis.map(k => <Stat key={k.rotulo} rotulo={k.rotulo} valor={<>{k.valor}{k.sub && <span className="ent-kpi-sub">{k.sub}</span>}</>} grande={false} cor={k.pendente ? 'entrada' : undefined} />)}</div>
      {vm.avisos.length > 0 && (
        <div className="ent-avisos">{vm.avisos.map((a, i) => (
          <p key={i} className={'registro-dica' + (a.grave ? ' registro-dica-erro' : '')}>
            <Icone nome={a.tipo === 'mapa' ? 'mapaPin' : a.tipo === 'recado' ? 'fileText' : a.grave ? 'alert' : 'ajuda'} />{a.texto}
            {a.tipo === 'mapa' && <button type="button" className="btn btn-ghost" onClick={vm.corrigirLocal}>Corrigir localização</button>}
          </p>
        ))}</div>
      )}
      <Cartao titulo="Lembretes pra entrega" icone="sino">
        {vm.lembretes.length ? (
          <ul className="ent-lembretes">{vm.lembretes.map(l => (
            <li key={l.id} className="ent-lembrete-item"><Icone nome="sino" width={16} height={16} />
              <div className="ent-lembrete-corpo"><div>{l.texto}</div><div className="hint">{l.meta}</div></div>
              {!vm.consulta && <button type="button" className="btn btn-outline" onClick={() => void vm.resolverLembrete(l.id)}><Icone nome="check" />Resolvido</button>}
            </li>
          ))}</ul>
        ) : <p className="hint">Nenhum lembrete. O que você deixar aqui aparece pra quem for entregar, na hora de concluir a entrega.</p>}
        {!vm.consulta && (
          <div className="ent-lembrete-novo">
            <textarea rows={2} maxLength={500} value={vm.lembreteNovo} onChange={e => vm.setLembreteNovo(e.target.value)} placeholder="Ex.: falar do honorário atrasado" aria-label="Novo lembrete" />
            <button type="button" className="btn btn-outline" disabled={vm.gravando} onClick={() => void vm.criarLembrete()}><Icone nome="plus" />Lembrete</button>
          </div>
        )}
      </Cartao>
      <div className="ent-grade">
        <Cartao titulo="Contato" icone="usuario">
          {vm.telefone && (
            <div className="ent-telefone"><span>{vm.telefone}</span>{!vm.consulta && <>
              {vm.comWhats && <button type="button" className="btn btn-outline" onClick={() => vm.whatsapp()}><span className="ent-logo"><LogoWhatsApp /></span>WhatsApp</button>}
              <a className="btn btn-outline" href={vm.telefoneLink}><Icone nome="telefone" />Ligar</a></>}</div>
          )}
          {vm.contato.length || vm.telefone ? <Dados linhas={vm.contato} /> : <p className="hint">Sem telefone, e-mail ou endereço no cadastro.</p>}
        </Cartao>
        <Cartao titulo="Empresa" icone="landmark">
          {vm.empresa.length ? <Dados linhas={vm.empresa} /> : <p className="hint">Sem dados da Receita ainda.</p>}
          {vm.temReceita && <button type="button" className="btn btn-ghost" onClick={() => vm.setAba('receita')}>Ver tudo da Receita</button>}
        </Cartao>
      </div>
      <Cartao titulo="Últimas entregas" icone="caminhao">
        {vm.carregando ? <Esqueleto linhas={3} /> : vm.ultimas.length ? (
          <>
            <ul className="ent-linhas">{vm.ultimas.map(u => (
              <li key={u.e.id}><div><b>{u.docs}</b><span className="fraco">{u.quando}</span></div><Situacao s={u.situacao} /></li>
            ))}</ul>
            {vm.total > 5 && <button type="button" className="btn btn-ghost" onClick={() => vm.setAba('entregas')}>Ver as {vm.total} entregas</button>}
          </>
        ) : <Vazio compacto icone="caminhao" texto={vm.erro || 'Nenhuma entrega registrada para este cliente ainda.'} />}
      </Cartao>
    </>
  );
}

function Entregas({ vm }: { vm: Vm }) {
  if (vm.carregando) return <Esqueleto linhas={6} />;
  if (!vm.grupos.length) return <Vazio icone="caminhao" texto={vm.erro || 'Nenhuma entrega registrada para este cliente ainda.'} />;
  return (
    <div className="ent-historico">
      {vm.grupos.map(g => (
        <section key={g.competencia} className="ent-mes">
          <div className="gm-grupo-rotulo ent-mes-topo">
            <b>{g.rotulo}</b>
            {g.competencia !== 'sem competência' && <>
              <button type="button" className="btn btn-ghost" title="Documento do mês pra imprimir ou salvar em PDF" onClick={() => void vm.protocolo(g.competencia)}><Icone nome="printer" />Protocolo</button>
              <button type="button" className="btn btn-ghost" title="O que entregamos e o que o cliente mandou no mês" onClick={() => void vm.extrato(g.competencia)}><Icone nome="checklist" />Extrato</button>
            </>}
            <span className="tarefas-barra-espaco" /><span className="fraco num">{g.resumo}</span>
          </div>
          <ul className="ent-linhas">{g.linhas.map(l => (
            <li key={l.e.id}><button type="button" className="ent-linha-abre" onClick={() => vm.abrirEntrega(l.e)}><div><b>{l.docs}</b><span className="fraco">{l.quando}</span></div><Situacao s={l.situacao} /></button></li>
          ))}</ul>
        </section>
      ))}
    </div>
  );
}

function Cadastro({ vm }: { vm: Vm }) {
  return (
    <>
      {vm.cadastro.length > 0 && <Cartao titulo="Dados do cadastro" icone="fileText"><Dados linhas={vm.cadastro} /></Cartao>}
      {vm.rota.length > 0 && <Cartao titulo="Rota" icone="caminhao"><Dados linhas={vm.rota} /></Cartao>}
      {vm.honorario.length > 0 && <Cartao titulo="Honorário" icone="dinheiro"><Dados linhas={vm.honorario} /></Cartao>}
      {vm.mostrarLink && (
        <Cartao titulo="Link do cliente" icone="link">
          <p className="hint">{vm.temLink ? 'O cliente tem link próprio: vê as guias, confirma o recebimento e manda documentos.' : 'Este cliente ainda não tem link.'}</p>
          <button type="button" className="btn btn-outline" onClick={vm.abrirLink}><Icone nome="link" />{vm.temLink ? 'Abrir link do cliente' : 'Criar link do cliente'}</button>
        </Cartao>
      )}
    </>
  );
}

function Receita({ vm }: { vm: Vm }) {
  if (!vm.temReceita) return <Vazio icone="clock" titulo="Ainda sem dados da Receita" texto="O robô confere os CNPJs uma vez por semana." />;
  return (
    <>
      {vm.mudancas.length > 0 && (
        <div className="ent-avisos">
          {vm.mudancas.map((m, i) => <p key={i} className={'registro-dica' + (m.grave ? ' registro-dica-erro' : '')}><Icone nome={m.grave ? 'alert' : 'ajuda'} />{m.texto} · notado em {m.quando}</p>)}
          {vm.podeMarcarVisto && <button type="button" className="btn btn-outline" onClick={() => void vm.marcarVisto()}><Icone nome="check" />Já vi</button>}
        </div>
      )}
      <Cartao titulo="Dados na Receita Federal" icone="landmark">
        <Dados linhas={vm.receita} />
        <p className="hint">Dados abertos da Receita, conferidos toda semana (último: {vm.conferidaEm}). Podem ter semanas de atraso em relação ao e-CAC.</p>
      </Cartao>
    </>
  );
}

function Contatos({ vm }: { vm: Vm }) {
  return (
    <>
      <Cartao titulo="Contato principal" icone="usuario">
        {vm.telefone && <div className="ent-telefone"><span>{vm.telefone}</span></div>}
        <Dados linhas={vm.contato} />
      </Cartao>
      <Cartao titulo="Outros contatos" icone="usuario">
        <ul className="ent-linhas">{vm.contatos.map((c, i) => (
          <li key={i}><div><b>{c.nome || c.telefone}</b><span className="fraco">{c.sub}</span></div>
            {c.telefone && !vm.consulta && <span className="ent-acoes-linha">
              {c.whats && <button type="button" className="btn btn-outline" onClick={() => vm.whatsapp(c.telefone)}><span className="ent-logo"><LogoWhatsApp /></span>WhatsApp</button>}
              <a className="btn btn-outline" href={c.tel}><Icone nome="telefone" />Ligar</a></span>}
          </li>
        ))}</ul>
      </Cartao>
    </>
  );
}

function Documentos({ vm }: { vm: Vm }) {
  return (
    <>
      {vm.papeis.length > 0 && (
        <Cartao titulo="Documentos com validade" icone="arquivo">
          <ul className="ent-linhas">{vm.papeis.map((p, i) => (
            <li key={i}><div><b>{p.nome}</b><span className="fraco">{p.sub}</span></div>
              {p.prazo && <span className={'badge ' + (p.classe === 'vencido' ? 'badge-danger' : p.classe === 'perto' ? 'badge-warn' : 'badge-neutral')}>{p.prazo}</span>}</li>
          ))}</ul>
        </Cartao>
      )}
      {vm.ocorrencias.length > 0 && (
        <Cartao titulo="Anotações" icone="fileText">
          <ul className="ent-linhas">{vm.ocorrencias.map((o, i) => <li key={i}><div><b>{o.texto}</b><span className="fraco">{o.sub}</span></div></li>)}</ul>
        </Cartao>
      )}
    </>
  );
}

function Acoes({ vm }: { vm: Vm }) {
  const acao = (rotulo: string, onClick: () => void, perigo?: boolean) =>
    <button type="button" className={'btn ' + (perigo ? 'btn-danger' : 'btn-outline')} onClick={onClick}>{rotulo}<Icone nome="chevronRight" /></button>;
  return (
    <ConfigSecao titulo="Ações">
      <ConfigLinha titulo="Corrigir localização" descricao="Acerta o ponto do cliente no mapa, que é o que ordena a rota.">{acao('Corrigir', vm.corrigirLocal)}</ConfigLinha>
      <ConfigLinha titulo="Aglutinar com outra empresa" descricao="Mesma porta de outra empresa: as duas viram uma parada só e uma assinatura.">{acao('Aglutinar', vm.aglutinar)}</ConfigLinha>
      <ConfigLinha titulo="Copiar dados" descricao="Nome, CNPJ, endereço e contato, prontos pra colar.">{acao('Copiar', () => void vm.copiarDados())}</ConfigLinha>
      {vm.total > 0 && <ConfigLinha titulo="Exportar histórico" descricao="Planilha com todas as entregas deste cliente.">{acao('Exportar', vm.exportarHistorico)}</ConfigLinha>}
      {vm.admin && <ConfigLinha titulo={vm.cliente.ativo ? 'Desativar cliente' : 'Reativar cliente'} descricao={vm.cliente.ativo ? 'Sai das listas e da rota. O histórico fica guardado.' : 'Volta pra carteira ativa e pras listas.'}>{acao(vm.cliente.ativo ? 'Desativar' : 'Reativar', () => void vm.ativar())}</ConfigLinha>}
      {vm.admin && <ConfigLinha titulo="Levar os dados (LGPD)" descricao="Arquivo com tudo que o sistema tem deste cliente.">{acao('Baixar', () => void vm.levarDados())}</ConfigLinha>}
      {vm.admin && <ConfigLinha titulo="Apagar dados pessoais" descricao="Tira telefone, e-mail, endereço e contatos, e desliga o link do cliente.">{acao('Apagar', () => void vm.apagarDados(), true)}</ConfigLinha>}
    </ConfigSecao>
  );
}
