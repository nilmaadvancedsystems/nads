// A casca da Área do Cliente (Vitor, 16/10/2026: "quero assim, só que no design do app"): o layout do protótipo
// AreaCliente.HTML, tela por tela, montado com as peças do nads. O menu lateral do protótipo (Visão geral, Central de
// documentos, Guias e obrigações, Departamento pessoal, Solicitações e chamados; em Administrativo, Dados cadastrais e Fale
// com o escritório) no subnav-item do nads, com o rodapé do atendimento; no alto, a empresa com o CNPJ, o sino dos avisos e
// Nova solicitação. No celular, o menu vira a gaveta do ☰. Link desconhecido ou trocado: só o aviso, sem dado nenhum.
// Versão D (acabamento premium sóbrio): a marca em duas linhas, o item aberto no fundo carmim suave, o atendimento com o
// N da Nilma no rodapé, a empresa com a plaquinha do prédio, o esqueleto no formato da página e os estados vazios.
// Com o banco (17/10/2026): o que não tem fonte some (Dados cadastrais sem a ficha; a Central de documentos, e então o
// "Enviar documento" vai para o topo); sem token (a raiz do site), o aviso para usar o link que o escritório mandou.
// Polida de 17/10/2026: a gaveta do celular leva o foco para o ✕ ao abrir e devolve ao ☰ ao fechar; o WhatsApp do cartão
// de atendimento abre a conversa. "Melhora mais" de 17/10/2026: na Visão geral o envio fica no cartão dela, sem o botão do topo.
import { Icone, MarcaN, MenuSuspenso, useRetorno } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { EsqueletoDaArea } from '../partes/EsqueletoDaArea';
import { MarcaDoEscritorio } from '../partes/MarcaDoEscritorio';
import { Vazio } from '../partes/Vazio';
import { Chamados } from './Chamados';
import { DepartamentoPessoal } from './DepartamentoPessoal';
import { Documentos } from './Documentos';
import { Guias } from './Guias';
import { Inicio } from './Inicio';
import { useJanelaDeEnvio } from './JanelaDeEnvio';
import { useAreaCliente } from './useAreaCliente';
import '../cliente.css';

export function AreaDoCliente() {
  const vm = useAreaCliente();
  const { modal, toast } = useRetorno();
  const { area } = vm;
  const daCasca = { token: vm.token, area, hoje: vm.hoje, irPara: vm.irPara, copiar: vm.copiar, exemplos: vm.exemplos };
  const valido = area.carregado && area.valido;
  const fechar = [{ rotulo: 'Fechar', valor: null, variante: 'btn-outline' as const }];
  const c = vm.contato;
  const abrirEnvio = useJanelaDeEnvio(daCasca);
  // a gaveta (celular): o foco vai para o ✕ quando abre e volta para o ☰ quando fecha
  const xDaGaveta = useRef<HTMLButtonElement>(null);
  const botaoDoMenu = useRef<HTMLButtonElement>(null);
  const gavetaAbriu = useRef(false);
  useEffect(() => {
    if (vm.menuAberto) xDaGaveta.current?.focus();
    else if (gavetaAbriu.current) botaoDoMenu.current?.focus();
    gavetaAbriu.current = vm.menuAberto;
  }, [vm.menuAberto]);

  const abrirWhatsapp = () => {
    if (vm.exemplos) { toast('Na versão de exemplo o WhatsApp não abre.'); return; }
    window.open(c.whatsappLink, '_blank', 'noopener');
  };

  const abrirFicha = () => {
    const f = area.ficha;
    vm.setMenuAberto(false);
    void modal({
      titulo: 'Ficha cadastral da empresa', botoes: [{ rotulo: 'Entendido', valor: null, variante: 'btn-outline' }],
      corpo: f ? (
        <div className="cli-app cli-janela">
          <dl className="cli-dados">
            <dt>Razão social</dt><dd><b>{f.razaoSocial}</b></dd>
            <dt>CNPJ</dt><dd>{f.cnpj}</dd>
            {f.inscricaoEstadual && <><dt>Inscrição estadual</dt><dd>{f.inscricaoEstadual}</dd></>}
            {f.inscricaoMunicipal && <><dt>Inscrição municipal</dt><dd>{f.inscricaoMunicipal}</dd></>}
            <dt>Regime tributário</dt><dd>{f.regime}</dd>
            <dt>Atividade principal</dt><dd>{f.cnae}</dd>
            <dt>Endereço</dt><dd>{f.endereco}</dd>
            {f.socios.length > 0 && <><dt>Sócios</dt><dd>{f.socios.map(s => s.nome + ' (' + s.participacao + ')').join(', ')}</dd></>}
          </dl>
        </div>
      ) : <p>Os dados da empresa ainda não chegaram.</p>,
    });
  };

  const abrirContato = () => {
    vm.setMenuAberto(false);
    void modal({
      titulo: 'Fale com o escritório', texto: c.horario || undefined, botoes: fechar,
      corpo: (
        <div className="cli-app cli-janela">
          <ul>
            {c.whatsapp && (
              <li className="cli-linha">
                <div className="cli-linha-txt"><b>WhatsApp</b><p className="hint">{c.whatsapp}</p></div>
                <button type="button" className="btn btn-primary" onClick={abrirWhatsapp}>Abrir conversa</button>
              </li>
            )}
            {c.telefone && (
              <li className="cli-linha">
                <div className="cli-linha-txt"><b>Telefone</b><p className="hint">{c.telefone}</p></div>
                <button type="button" className="btn" onClick={() => vm.copiar(c.telefone!, 'Telefone')}>Copiar</button>
              </li>
            )}
            {[{ nome: 'E-mail', email: c.email ?? '' }, ...c.setores].filter(s => s.email).map(s => (
              <li key={s.nome} className="cli-linha">
                <div className="cli-linha-txt"><b>{s.nome === 'E-mail' ? 'E-mail' : 'E-mail do ' + s.nome.toLowerCase()}</b><p className="hint">{s.email}</p></div>
                <button type="button" className="btn" onClick={() => vm.copiar(s.email, 'E-mail')}>Copiar</button>
              </li>
            ))}
          </ul>
        </div>
      ),
    });
  };

  return (
    <div className={'cli-app' + (valido && vm.recolhida ? ' sidebar-oculta cli-recolhida' : '')}>
      {valido && (
        <>
          <aside className={'cli-lateral' + (vm.menuAberto ? ' aberta' : '')} id="cli-lateral" aria-label="Menu">
            <div>
              <div className="cli-marca">
                <span className="brand-mark" aria-hidden="true"><MarcaN /></span>
                <span className="cli-marca-nome"><b>Nilma</b><small>Contabilidade</small></span>
                <button type="button" ref={xDaGaveta} className="drawer-x" aria-label="Fechar o menu" onClick={() => vm.setMenuAberto(false)}><Icone nome="x" width={16} height={16} /></button>
              </div>
              <nav className="cli-menu" aria-label="Seções">
                {vm.abas.map(a => {
                  const conta = vm.contadores[a.id];
                  return (
                    <button key={a.id} type="button" title={a.rotulo} className={'subnav-item' + (vm.aba === a.id ? ' active' : '')} aria-current={vm.aba === a.id ? 'page' : undefined} onClick={() => vm.irPara(a.id)}>
                      <Icone nome={a.icone} width={16} height={16} /><span>{a.rotulo}</span>
                      {!!conta && <span className={'subnav-count' + (a.id === 'guias' ? ' cli-conta-ruim' : '')} title={a.id === 'guias' ? 'Guias vencidas' : 'Documentos novos'}>{conta}</span>}
                    </button>
                  );
                })}
                <p className="subnav-title">Administrativo</p>
                {vm.temFicha && <button type="button" className="subnav-item" title="Dados cadastrais" onClick={abrirFicha}><Icone nome="predio" width={16} height={16} /><span>Dados cadastrais</span></button>}
                <button type="button" className="subnav-item" title="Fale com o escritório" onClick={abrirContato}><Icone nome="telefone" width={16} height={16} /><span>Fale com o escritório</span></button>
              </nav>
            </div>
            <div>
            <div className="cli-lateral-pe" title={c.equipe + (c.horario ? ' · ' + c.horario : '')}>
              <div className="cli-pessoa">
                <MarcaDoEscritorio tamanho={36} />
                <div><span className="hint">Seu atendimento</span><b>{c.equipe}</b></div>
              </div>
              {c.horario && <p className="hint">{c.horario}</p>}
              {c.whatsappLink && <button type="button" className="btn" onClick={abrirWhatsapp}><Icone nome="mensagem" width={16} height={16} />WhatsApp do escritório</button>}
            </div>
            {/* recolher a lateral (só no PC), a mesma peça do app: o subnav-colapsar com o ícone do painel */}
            <div className="cli-menu cli-colapsar">
              <button type="button" className="subnav-item subnav-colapsar" aria-expanded={!vm.recolhida} title={vm.recolhida ? 'Mostrar barra lateral' : 'Ocultar barra lateral'} onClick={vm.alternarLateral}>
                <Icone nome="painel" width={16} height={16} /><span>{vm.recolhida ? 'Mostrar barra lateral' : 'Ocultar barra lateral'}</span>
              </button>
            </div>
            </div>
          </aside>
          {vm.menuAberto && <div className="cli-fundo-gaveta" onClick={() => vm.setMenuAberto(false)} aria-hidden="true" />}
        </>
      )}
      <div className={'cli-corpo' + (valido ? '' : ' sem-lateral')}>
        <header className="cli-topo">
          <div className="cli-topo-esq">
            {valido && (
              <button type="button" ref={botaoDoMenu} className="gh-hamb" aria-label="Abrir o menu" aria-expanded={vm.menuAberto} aria-controls="cli-lateral" onClick={() => vm.setMenuAberto(!vm.menuAberto)}>
                <Icone nome="menu" width={16} height={16} />
              </button>
            )}
            <div className="cli-empresa">
              <span className="cli-empresa-ico" aria-hidden="true"><Icone nome="predio" width={18} height={18} /></span>
              <div className="cli-empresa-txt">
                <b>{valido ? vm.empresa : 'Nilma Contabilidade'}</b>
                {valido && vm.cnpj && <small>{vm.rotuloDoDocumento} {vm.cnpj}</small>}
              </div>
            </div>
          </div>
          {valido && (
            <div className="cli-topo-dir">
              <MenuSuspenso className="icon-btn cli-sino" icone="sino" semSeta direita dica="Notificações" titulo="Notificações"
                rotulo={vm.naoLidas > 0 ? <span className="cli-sino-conta" aria-label={vm.naoLidas + ' notificação(ões) nova(s)'}>{vm.naoLidas}</span> : null}
                conteudo={fecharMenu => (
                  <div className="cli-avisos">
                    <div className="cli-avisos-topo">
                      <span>Notificações</span>
                      {vm.naoLidas > 0 && <button type="button" className="btn btn-ghost" onClick={vm.marcarLidas}>Marcar como lidas</button>}
                    </div>
                    {vm.avisos.length ? vm.avisos.map(n => (
                      <button key={n.id} type="button" className={'cli-aviso-item' + (vm.lida(n.id) ? ' lida' : '')} onClick={() => { fecharMenu(); vm.irPara(n.ir); }}>
                        <b>{n.titulo}</b><span>{n.texto}</span>
                      </button>
                    )) : <Vazio icone="sino" titulo="Nada novo" texto="Quando o escritório mandar algo, aparece aqui." />}
                  </div>
                )} />
              {/* em Solicitações o Enviar documento já está no título da página, e na Visão geral no cartão do envio rápido */}
              {!vm.secoes.documentos && vm.aba !== 'chamados' && vm.aba !== 'inicio' && <button type="button" className="btn cli-so-largo" onClick={abrirEnvio}><Icone nome="upload" width={16} height={16} />Enviar documento</button>}
              {vm.aba !== 'chamados' && <button type="button" className="btn btn-primary cli-so-largo" onClick={() => vm.irPara('chamados')}><Icone nome="plus" width={16} height={16} />Nova solicitação</button>}
            </div>
          )}
        </header>
        <main className="cli-main">
          {vm.exemplos && valido && <p className="cli-exemplo">Versão de exemplo: os dados são de mentira e nada chega ao escritório.</p>}
          {!area.carregado ? <EsqueletoDaArea /> : !area.valido ? (
            <div className="card cli-link-ruim">
              {!vm.token ? (
                // a raiz do site (sem token): o N da Nilma no lugar do ícone do vazio
                <div className="cli-vazio">
                  <MarcaDoEscritorio tamanho={48} />
                  <b>Use o link que o escritório enviou</b>
                  <p>A sua área abre pelo link exclusivo da sua empresa. Se não achar, peça ao escritório.</p>
                </div>
              ) : area.erro
                ? <Vazio icone="alert" titulo="Não deu para abrir agora" texto={area.erro} />
                : <Vazio icone="lock" titulo="Este link não vale mais" texto="Ele foi trocado ou não existe. Peça um novo ao escritório." />}
            </div>
          ) : (
            <>
              {vm.aba === 'inicio' && <Inicio {...daCasca} empresa={vm.empresa} contato={c} onWhatsapp={c.whatsappLink ? abrirWhatsapp : undefined} />}
              {vm.aba === 'documentos' && <Documentos {...daCasca} />}
              {vm.aba === 'guias' && <Guias {...daCasca} />}
              {vm.aba === 'dp' && <DepartamentoPessoal {...daCasca} />}
              {vm.aba === 'chamados' && <Chamados {...daCasca} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
