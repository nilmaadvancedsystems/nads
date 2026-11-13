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
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { Aparencia } from '../partes/Aparencia';
import { BuscaGeral } from '../partes/BuscaGeral';
import { Tutorial } from '../partes/Tutorial';
import { EsqueletoDaArea } from '../partes/EsqueletoDaArea';
import { MarcaDoEscritorio } from '../partes/MarcaDoEscritorio';
import { Vazio } from '../partes/Vazio';
import { Chamados } from './Chamados';
import { DepartamentoPessoal } from './DepartamentoPessoal';
import { Documentos } from './Documentos';
import { Contato, Empresa, Faturamento } from './Administrativo';
import { Guias } from './Guias';
import { Inicio } from './Inicio';
import { useJanelaDeEnvio } from './JanelaDeEnvio';
import { useAreaCliente } from './useAreaCliente';
import '../cliente.css';

/** Abrir outra empresa colando o link dela (13/11/2026): o botão vira o campo; Enter abre; o erro embaixo. */
function AbrirPeloLink({ abrir }: { abrir: (texto: string) => string }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const ir = () => setErro(abrir(texto));
  if (!aberto) return (
    <button type="button" className="cli-troca-mais" onClick={() => setAberto(true)}>
      <span className="cli-troca-mais-ico"><Icone nome="plus" width={14} height={14} /></span>
      <span><b>Abrir outra empresa</b><small>Cole o link que o escritório mandou</small></span>
    </button>
  );
  return (
    <div className="cli-troca-colar">
      <div className="cli-troca-colar-linha">
        <input type="text" autoFocus value={texto} onChange={e => { setTexto(e.target.value); setErro(''); }} onKeyDown={e => { if (e.key === 'Enter') ir(); }}
          placeholder="https://…/cliente/…" aria-label="Link da outra empresa" />
        <button type="button" className="btn btn-primary btn-sm" disabled={!texto.trim()} onClick={ir}>Abrir</button>
      </div>
      {erro ? <p className="cli-erro">{erro}</p> : <p className="cli-troca-dica-mini">Depois de aberta uma vez, ela fica nesta lista neste aparelho.</p>}
    </div>
  );
}

export function AreaDoCliente() {
  const vm = useAreaCliente();
  const { toast } = useRetorno();
  const { area } = vm;
  // a tela recriada a cada navegação: o que a busca geral pede (a busca preenchida, a solicitação) vale de novo
  const { key: chaveDaTela } = useLocation();
  const daCasca = { token: vm.token, area, hoje: vm.hoje, irPara: vm.irPara, copiar: vm.copiar, exemplos: vm.exemplos };
  const valido = area.carregado && area.valido;
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

  return (
    // durante o tutorial a tela não faz a entrada animada a cada troca de aba (13/11/2026: "toda vez que clico no próximo roda a animação de carregando")
    <div className={'cli-app cli-raiz' + (valido && vm.recolhida ? ' sidebar-oculta cli-recolhida' : '')} data-sem-animacao={vm.tutorial.modo ? '' : undefined}>
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
                {vm.abas.filter(a => !a.administrativo).map(a => {
                  const conta = vm.contadores[a.id];
                  return (
                    <button key={a.id} type="button" title={a.rotulo} className={'subnav-item' + (vm.aba === a.id ? ' active' : '')} aria-current={vm.aba === a.id ? 'page' : undefined} onClick={() => vm.irPara(a.id)}>
                      <Icone nome={a.icone} width={16} height={16} /><span>{a.rotulo}</span>
                      {!!conta && <span className={'subnav-count' + (a.id === 'guias' ? ' cli-conta-ruim' : '')} title={a.id === 'guias' ? 'Guias vencidas' : 'Documentos novos'}>{conta}</span>}
                    </button>
                  );
                })}
                <p className="subnav-title">Administrativo</p>
                {/* o Faturamento, os Dados cadastrais e o Fale com o escritório viraram telas (12/11/2026) */}
                {vm.abas.filter(a => a.administrativo).map(a => (
                  <button key={a.id} type="button" title={a.rotulo} className={'subnav-item' + (vm.aba === a.id ? ' active' : '')} aria-current={vm.aba === a.id ? 'page' : undefined} onClick={() => vm.irPara(a.id)}>
                    <Icone nome={a.icone} width={16} height={16} /><span>{a.rotulo}</span>
                  </button>
                ))}
              </nav>
            </div>
            <div>
            {/* o cartão "Seu atendimento" do pé saiu (12/11/2026: "remove esse seu atendimento"): o contato fica em Fale com o escritório */}
            {/* recolher a lateral (só no PC), a mesma peça do app: o subnav-colapsar com o ícone do painel */}
            {/* a aparência (13/11/2026: o modo OLED): sistema, claro, escuro e OLED; no celular, no Mais */}
            <Aparencia recolhida={vm.recolhida} />
            {/* o tutorial guiado de novo (13/11/2026); no celular, aparece no Mais */}
            <div className="cli-menu cli-menu-tutorial">
              <button type="button" className="subnav-item" title="Ver o tutorial" onClick={vm.tutorial.abrir}>
                <Icone nome="ajuda" width={16} height={16} /><span>Ver o tutorial</span>
              </button>
            </div>
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
            {/* a empresa no topo; com outras empresas abertas neste aparelho, vira a troca de empresa (12/11/2026) */}
            {(() => {
              const ficha = (
                <>
                  {valido && vm.logo
                    ? <span className="cli-empresa-ico cli-empresa-logo"><img src={vm.logo} alt={'Logo de ' + vm.empresa} /></span>
                    : <span className="cli-empresa-ico" aria-hidden="true">{valido ? <Icone nome="predio" width={18} height={18} /> : <span className="cli-empresa-n"><MarcaN /></span>}</span>}
                  <div className="cli-empresa-txt">
                    <b>{valido ? vm.empresa : 'Nilma Contabilidade'}</b>
                    {valido && vm.cnpj && <small>{vm.rotuloDoDocumento} {vm.cnpj}</small>}
                  </div>
                </>
              );
              // sempre o botão com a seta (12/11/2026: "isso não está com o dropdown"); sem outra empresa, o menu explica
              if (!valido) return <div className="cli-empresa">{ficha}</div>;
              return (
                <MenuSuspenso className="cli-empresa cli-empresa-troca" titulo="Trocar de empresa" dica="Trocar de empresa" largura={380} rotulo={ficha}
                  conteudo={fechar => (
                    <div className="cli-troca">
                      {/* a empresa aberta, com o regime e os atalhos (13/11/2026: "muito simples") */}
                      <div className="cli-troca-aberta">
                        <span className="cli-troca-marca grande">{vm.logo ? <img src={vm.logo} alt="" /> : vm.iniciais}</span>
                        <span className="cli-troca-txt">
                          <b className="cli-troca-nome">{vm.empresa}</b>
                          {vm.cnpj && <small>{vm.rotuloDoDocumento} {vm.cnpj}</small>}
                          {vm.regime && <span className={vm.seloDoRegime + ' cli-troca-regime'}>{vm.regime}</span>}
                        </span>
                      </div>
                      <div className="cli-troca-atalhos">
                        {vm.temFicha && <button type="button" className="btn btn-sm" onClick={() => { fechar(); vm.irPara('empresa'); }}><Icone nome="predio" width={14} height={14} />Dados cadastrais</button>}
                        <button type="button" className="btn btn-sm" onClick={() => { fechar(); vm.copiarLink(); }}><Icone nome="link" width={14} height={14} />Copiar o link</button>
                      </div>
                      {vm.outrasEmpresas.length > 0 && (
                        <>
                          <p className="cli-troca-titulo">Trocar para</p>
                          {vm.outrasEmpresas.map(p => (
                            <div key={p.token} className="cli-troca-linha">
                              <button type="button" className="cli-troca-item" onClick={() => { fechar(); vm.trocarDeEmpresa(p.token); }}>
                                <span className="cli-troca-marca">{p.logo ? <img src={p.logo} alt="" /> : p.iniciais}</span>
                                <span className="cli-troca-txt">
                                  <b className="cli-troca-um" title={p.nome}>{p.nome}</b>
                                  {p.documento && <small>{(p.documento.replace(/\D/g, '').length === 11 ? 'CPF ' : 'CNPJ ') + p.documento}</small>}
                                </span>
                                {p.quando && <span className="cli-troca-quando">{p.quando}</span>}
                              </button>
                              <button type="button" className="icon-btn icon-btn-sm cli-troca-tirar" title="Tirar desta lista" aria-label={'Tirar ' + p.nome + ' desta lista'} onClick={() => vm.esquecerEmpresa(p.token)}>
                                <Icone nome="x" width={14} height={14} />
                              </button>
                            </div>
                          ))}
                        </>
                      )}
                      <AbrirPeloLink abrir={t => { const erro = vm.abrirPeloLink(t); if (!erro) fechar(); return erro; }} />
                    </div>
                  )} />
              );
            })()}
          </div>
          {valido && (
            <div className="cli-topo-dir">
              {/* a busca geral (13/11/2026): no computador, o campo com o Ctrl K; no celular, só a lupa */}
              <button type="button" className="cli-busca-topo" data-tutorial="busca" onClick={vm.busca.abrir} aria-label="Buscar na área (Ctrl+K)" title="Buscar (Ctrl+K)">
                <Icone nome="search" width={16} height={16} /><span className="cli-so-largo">Buscar</span><kbd className="cli-tecla cli-so-largo">Ctrl K</kbd>
              </button>
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
                        <span className={'cli-notif-ico t-' + n.tom} aria-hidden="true"><Icone nome={n.icone} width={16} height={16} /></span>
                        <span className="cli-notif-txt"><b>{n.titulo}</b><span>{n.texto}</span></span>
                        <Icone nome="chevronRight" width={16} height={16} className="cli-notif-seta" />
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
              {/* as empresas já abertas neste aparelho (13/11/2026: "primeira impressão"): um clique e entra */}
              {vm.outrasEmpresas.length > 0 && (
                <div className="cli-link-ruim-empresas">
                  <p className="cli-troca-titulo">Ou abra uma empresa já usada neste aparelho</p>
                  {vm.outrasEmpresas.map(p => (
                    <button key={p.token} type="button" className="cli-troca-item" onClick={() => vm.trocarDeEmpresa(p.token)}>
                      <span className="cli-troca-marca">{p.logo ? <img src={p.logo} alt="" /> : p.iniciais}</span>
                      <span className="cli-troca-txt"><b>{p.nome}</b>{p.documento && <small>{p.documento}</small>}</span>
                      <Icone nome="chevronRight" width={16} height={16} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {vm.aba === 'inicio' && <Inicio key={chaveDaTela} {...daCasca} empresa={vm.empresa} contato={c} onWhatsapp={c.whatsappLink ? abrirWhatsapp : undefined} />}
              {vm.aba === 'documentos' && <Documentos key={chaveDaTela} {...daCasca} />}
              {vm.aba === 'guias' && <Guias key={chaveDaTela} {...daCasca} />}
              {vm.aba === 'dp' && <DepartamentoPessoal key={chaveDaTela} {...daCasca} />}
              {vm.aba === 'chamados' && <Chamados key={chaveDaTela} {...daCasca} />}
              {vm.aba === 'faturamento' && <Faturamento {...daCasca} />}
              {vm.aba === 'empresa' && <Empresa {...daCasca} />}
              {vm.aba === 'contato' && <Contato {...daCasca} contato={c} onWhatsapp={c.whatsappLink ? abrirWhatsapp : undefined} />}
            </>
          )}
        </main>
      </div>
      {vm.tutorial.modo && valido && <Tutorial passos={vm.tutorial.passos} abaAtual={vm.aba} irPara={vm.tutorial.irPara} onFechar={vm.tutorial.fechar} />}
      {vm.busca.aberta && <BuscaGeral indice={vm.busca.indice} onEscolher={vm.busca.escolher} onFechar={vm.busca.fechar} />}
      {/* a barra de abas de baixo, no celular (13/11/2026: "cara de app no celular"); o Mais abre o menu inteiro */}
      {valido && (
        <nav className="cli-abas-baixo" aria-label="Seções principais">
          {vm.abasDeBaixo.map(a => (
            <button key={a.id} type="button" className={'cli-aba-baixo' + (a.ativa ? ' ativa' : '')} aria-current={a.ativa ? 'page' : undefined} onClick={() => vm.irPara(a.id)}>
              <span className="cli-aba-baixo-ico"><Icone nome={a.icone} width={20} height={20} />{a.conta > 0 && <span className="cli-aba-baixo-conta">{a.conta}</span>}</span>
              <span>{a.rotulo}</span>
            </button>
          ))}
          <button type="button" data-tutorial="mais" className={'cli-aba-baixo' + (vm.maisAtivo ? ' ativa' : '')} aria-expanded={vm.menuAberto} aria-controls="cli-lateral" onClick={() => vm.setMenuAberto(true)}>
            <span className="cli-aba-baixo-ico"><Icone nome="menu" width={20} height={20} /></span>
            <span>Mais</span>
          </button>
        </nav>
      )}
    </div>
  );
}
