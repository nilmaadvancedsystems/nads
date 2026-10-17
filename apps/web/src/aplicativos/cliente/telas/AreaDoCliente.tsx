// A casca da Área do Cliente (Vitor, 16/10/2026: "quero assim, só que no design do app"): o layout do protótipo
// AreaCliente.HTML, tela por tela, montado com as peças do nads. O menu lateral do protótipo (Visão geral, Central de
// documentos, Guias e obrigações, Departamento pessoal, Solicitações e chamados; em Administrativo, Dados cadastrais e Fale
// com o escritório) no subnav-item do nads, com o rodapé do atendimento; no alto, a empresa com o CNPJ, o sino dos avisos e
// Nova solicitação. No celular, o menu vira a gaveta do ☰. Link desconhecido ou trocado: só o aviso, sem dado nenhum.
import { Esqueleto, Icone, MarcaN, MenuSuspenso, useRetorno } from '@nads/ui';
import { Chamados } from './Chamados';
import { DepartamentoPessoal } from './DepartamentoPessoal';
import { Documentos } from './Documentos';
import { Guias } from './Guias';
import { Inicio } from './Inicio';
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

  // "Nova solicitação" leva à abertura rápida (na própria tela de Solicitações, só põe o cursor no título)
  const novaSolicitacao = () => {
    if (vm.aba !== 'chamados') vm.irPara('chamados');
    setTimeout(() => document.getElementById('cli-titulo-chamado')?.focus(), 50);
  };

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
    <div className="cli-app">
      {valido && (
        <>
          <aside className={'cli-lateral' + (vm.menuAberto ? ' aberta' : '')} id="cli-lateral" aria-label="Menu">
            <div>
              <div className="cli-marca">
                <span className="brand-mark" aria-hidden="true"><MarcaN /></span>
                <b>Nilma Contabilidade</b>
                <button type="button" className="drawer-x" aria-label="Fechar o menu" onClick={() => vm.setMenuAberto(false)}><Icone nome="x" width={16} height={16} /></button>
              </div>
              <nav className="cli-menu" aria-label="Seções">
                {vm.abas.map(a => {
                  const conta = vm.contadores[a.id];
                  return (
                    <button key={a.id} type="button" className={'subnav-item' + (vm.aba === a.id ? ' active' : '')} aria-current={vm.aba === a.id ? 'page' : undefined} onClick={() => vm.irPara(a.id)}>
                      <Icone nome={a.icone} width={16} height={16} /><span>{a.rotulo}</span>
                      {!!conta && <span className={'subnav-count' + (a.id === 'guias' ? ' cli-conta-ruim' : '')} title={a.id === 'guias' ? 'Guias vencidas' : 'Documentos novos'}>{conta}</span>}
                    </button>
                  );
                })}
                <p className="subnav-title">Administrativo</p>
                <button type="button" className="subnav-item" onClick={abrirFicha}><Icone nome="predio" width={16} height={16} /><span>Dados cadastrais</span></button>
                <button type="button" className="subnav-item" onClick={abrirContato}><Icone nome="telefone" width={16} height={16} /><span>Fale com o escritório</span></button>
              </nav>
            </div>
            <div className="cli-lateral-pe">
              <b>{c.equipe}</b>
              {c.horario && <span>{c.horario}</span>}
              {c.whatsappLink && <button type="button" className="btn" onClick={abrirWhatsapp}><Icone nome="mensagem" width={16} height={16} />WhatsApp do escritório</button>}
            </div>
          </aside>
          {vm.menuAberto && <div className="cli-fundo-gaveta" onClick={() => vm.setMenuAberto(false)} aria-hidden="true" />}
        </>
      )}
      <div className={'cli-corpo' + (valido ? '' : ' sem-lateral')}>
        {vm.exemplos && valido && <p className="cli-faixa-exemplo">Versão de exemplo: os dados são de mentira e nada do que você fizer aqui chega ao escritório.</p>}
        <header className="cli-topo">
          <div className="cli-topo-esq">
            {valido && (
              <button type="button" className="gh-hamb" aria-label="Abrir o menu" aria-expanded={vm.menuAberto} aria-controls="cli-lateral" onClick={() => vm.setMenuAberto(!vm.menuAberto)}>
                <Icone nome="menu" width={16} height={16} />
              </button>
            )}
            {valido ? (
              <div className="cli-empresa">
                <b>{vm.empresa}</b>
                {vm.cnpj && <small>CNPJ {vm.cnpj}</small>}
              </div>
            ) : <div className="cli-empresa"><b>Nilma Contabilidade</b></div>}
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
                    )) : <p className="empty" style={{ padding: 16 }}>Nada novo.</p>}
                  </div>
                )} />
              <button type="button" className="btn btn-primary cli-so-largo" onClick={novaSolicitacao}><Icone nome="plus" width={16} height={16} />Nova solicitação</button>
            </div>
          )}
        </header>
        <main className="cli-main">
          {!area.carregado ? <Esqueleto linhas={4} numeros={3} /> : !area.valido ? (
            <div className="card" style={{ maxWidth: 460, margin: '48px auto 0', textAlign: 'center' }}>
              <h3>Este link não vale mais</h3>
              <p className="hint">Ele foi trocado ou não existe. Peça um novo ao escritório.</p>
            </div>
          ) : (
            <>
              {vm.aba === 'inicio' && <Inicio {...daCasca} empresa={vm.empresa} contato={c} />}
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
