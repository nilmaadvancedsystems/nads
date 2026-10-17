// A casca da Área do Cliente (Vitor, 16/10/2026): um site para a pessoa de fora, no celular e no PC. A estrutura vem do
// protótipo AreaCliente.HTML do Vitor; o estilo é o do nads ("tira a cara de IA e deixe no estilo do nads"). No PC, a
// barra lateral fixa com o N e "Nilma Contabilidade", as cinco seções (com o contador) e, em "Sua empresa", os dados
// cadastrais e os canais do escritório (janelas); no celular ela vira a gaveta do ☰. No alto, a empresa, o sino dos
// avisos e o "Abrir um chamado". Link desconhecido ou trocado: só o aviso, sem dado nenhum.
import { formatos } from '@nads/core';
import { Alerta, Esqueleto, Icone, MarcaN, MenuSuspenso, useRetorno } from '@nads/ui';
import { Chamados } from './Chamados';
import { DepartamentoPessoal } from './DepartamentoPessoal';
import { Documentos } from './Documentos';
import { Guias } from './Guias';
import { Inicio } from './Inicio';
import { useAreaCliente, type IdAba } from './useAreaCliente';
import '../cliente.css';

const TITULOS: Record<Exclude<IdAba, 'inicio'>, { titulo: string; texto: string }> = {
  documentos: { titulo: 'Documentos', texto: 'O que o escritório deixou para você e o que você mandou para o escritório.' },
  guias: { titulo: 'Guias e obrigações', texto: 'As guias para pagar, as já pagas e a agenda do mês.' },
  dp: { titulo: 'Departamento pessoal', texto: 'Seus funcionários e os pedidos de admissão, férias e demissão.' },
  chamados: { titulo: 'Solicitações', texto: 'Peça serviços e tire dúvidas. A conversa fica guardada aqui.' },
};

export function AreaDoCliente() {
  const vm = useAreaCliente();
  const { modal } = useRetorno();
  const { area } = vm;
  const daCasca = { token: vm.token, area, hoje: vm.hoje, irPara: vm.irPara, copiar: vm.copiar };
  const valido = area.carregado && area.valido;
  const cabecalho = vm.aba === 'inicio' ? null : TITULOS[vm.aba];
  const contato = area.resumo?.escritorio ?? {};
  const fechar = [{ rotulo: 'Fechar', valor: null, variante: 'btn-outline' as const }];

  const abrirFicha = () => {
    const f = area.ficha;
    vm.setMenuAberto(false);
    void modal({
      icone: 'predio', titulo: 'Dados da empresa', botoes: fechar,
      corpo: f ? (
        <div className="cli-app cli-janela">
          <dl className="cli-dados">
            <dt>Razão social</dt><dd>{f.razaoSocial}</dd>
            {f.nomeFantasia && <><dt>Nome fantasia</dt><dd>{f.nomeFantasia}</dd></>}
            <dt>CNPJ</dt><dd className="num">{f.cnpj}</dd>
            {f.inscricaoEstadual && <><dt>Inscrição estadual</dt><dd className="num">{f.inscricaoEstadual}</dd></>}
            {f.inscricaoMunicipal && <><dt>Inscrição municipal</dt><dd className="num">{f.inscricaoMunicipal}</dd></>}
            <dt>Regime</dt><dd>{f.regime}</dd>
            <dt>Atividade</dt><dd>{f.cnae}</dd>
            {f.abertura && <><dt>Abertura</dt><dd>{new Date(f.abertura + 'T12:00').toLocaleDateString('pt-BR')}</dd></>}
            <dt>Endereço</dt><dd>{f.endereco}</dd>
            {f.socios.length > 0 && <><dt>Sócios</dt><dd>{f.socios.map(s => <span key={s.nome} style={{ display: 'block' }}>{s.nome} ({s.participacao})</span>)}</dd></>}
          </dl>
          <p className="hint" style={{ marginTop: 12 }}>Algo errado? Abra uma solicitação para o escritório corrigir.</p>
        </div>
      ) : <p>Os dados da empresa ainda não chegaram.</p>,
    });
  };

  const abrirCanais = () => {
    const at = area.atendimento;
    vm.setMenuAberto(false);
    void modal({
      icone: 'telefone', titulo: 'Fale com o escritório', texto: at?.horario, botoes: fechar,
      corpo: (
        <div className="cli-app cli-janela">
          <ul>
            {[['Telefone', contato.telefone], ['WhatsApp', contato.whatsapp], ['E-mail', contato.email], ...(at?.setores ?? []).map(s => [s.nome, s.email])]
              .filter(([, v]) => v).map(([rotulo, valor]) => (
                <li key={rotulo} className="cli-linha">
                  <div className="cli-linha-txt"><b>{rotulo}</b><p className="hint">{valor}</p></div>
                  <button type="button" className="btn" onClick={() => vm.copiar(valor!, rotulo!)}><Icone nome="copiar" width={16} height={16} />Copiar</button>
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
            <div className="cli-marca">
              <span className="brand-mark" aria-hidden="true"><MarcaN /></span>
              <b>Nilma Contabilidade</b>
              <button type="button" className="drawer-x" aria-label="Fechar o menu" onClick={() => vm.setMenuAberto(false)}><Icone nome="x" width={16} height={16} /></button>
            </div>
            <nav className="cli-menu" aria-label="Seções">
              <p className="subnav-title">Área do cliente</p>
              {vm.abas.map(a => {
                const conta = vm.contadores[a.id];
                return (
                  <button key={a.id} type="button" className={'subnav-item' + (vm.aba === a.id ? ' active' : '')} aria-current={vm.aba === a.id ? 'page' : undefined} onClick={() => vm.irPara(a.id)}>
                    <Icone nome={a.icone} width={16} height={16} /><span>{a.rotulo}</span>
                    {!!conta && <span className="subnav-count">{conta}</span>}
                  </button>
                );
              })}
              <p className="subnav-title">Sua empresa</p>
              <button type="button" className="subnav-item" onClick={abrirFicha}><Icone nome="predio" width={16} height={16} /><span>Dados da empresa</span></button>
              <button type="button" className="subnav-item" onClick={abrirCanais}><Icone nome="telefone" width={16} height={16} /><span>Fale com o escritório</span></button>
            </nav>
            <div className="cli-lateral-pe">
              <b>{area.atendimento?.equipe || 'Nilma Contabilidade'}</b>
              {contato.telefone && <span style={{ display: 'block' }}>{contato.telefone}</span>}
              {area.atendimento?.horario && <span style={{ display: 'block' }}>{area.atendimento.horario}</span>}
            </div>
          </aside>
          {vm.menuAberto && <div className="cli-fundo-gaveta" onClick={() => vm.setMenuAberto(false)} aria-hidden="true" />}
        </>
      )}
      <div className={'cli-corpo' + (valido ? '' : ' sem-lateral')}>
        <header className="cli-topo">
          <div className="cli-topo-esq">
            {valido && (
              <button type="button" className="gh-hamb" aria-label="Abrir o menu" aria-expanded={vm.menuAberto} aria-controls="cli-lateral" onClick={() => vm.setMenuAberto(!vm.menuAberto)}>
                <Icone nome="menu" width={16} height={16} />
              </button>
            )}
            {valido && vm.empresa ? (
              <div className="cli-empresa" title={vm.empresa}>
                <b>{vm.empresa}</b>
                {vm.cnpj && <small>CNPJ <span className="num">{vm.cnpj}</span></small>}
              </div>
            ) : (
              <div className="cli-topo-marca"><span className="brand-mark" aria-hidden="true"><MarcaN /></span>Nilma Contabilidade</div>
            )}
          </div>
          {valido && (
            <div className="cli-topo-dir">
              <div className="cli-sino">
                <MenuSuspenso className="icon-btn" icone="sino" semSeta direita dica="Avisos" titulo="Avisos"
                  rotulo={vm.naoLidas > 0 ? <span className="cli-sino-conta" aria-label={vm.naoLidas + ' aviso(s) novo(s)'}>{vm.naoLidas}</span> : null}
                  conteudo={fecharMenu => (
                    <div className="cli-avisos">
                      <div className="cli-avisos-topo">
                        <span>Avisos</span>
                        {vm.naoLidas > 0 && <button type="button" className="btn btn-ghost" onClick={vm.marcarLidas}>Marcar como lidos</button>}
                      </div>
                      {vm.avisos.length ? vm.avisos.map(n => (
                        <button key={n.id} type="button" className={'cli-aviso-item' + (vm.lida(n.id) ? ' lida' : '')} onClick={() => { fecharMenu(); vm.irPara(n.ir); }}>
                          <b>{n.titulo}</b><span>{n.texto}</span>
                        </button>
                      )) : <p className="empty" style={{ padding: 16 }}>Nada novo por aqui.</p>}
                    </div>
                  )} />
              </div>
              {vm.aba !== 'chamados' && <button type="button" className="btn btn-primary" onClick={() => vm.irPara('chamados')}><Icone nome="plus" width={16} height={16} />Abrir um chamado</button>}
            </div>
          )}
        </header>
        <main className="cli-main">
          {!area.carregado ? <Esqueleto linhas={4} numeros={3} /> : !area.valido ? (
            <div className="card" style={{ maxWidth: 460, margin: '48px auto 0', textAlign: 'center' }}>
              <h3>Este link não é válido ou foi trocado.</h3>
              <p className="hint">Peça um novo ao escritório.</p>
            </div>
          ) : (
            <>
              {vm.exemplos && <Alerta naLinha titulo="Versão de exemplo" texto="Os dados desta página são de mentira e nada que você fizer aqui chega ao escritório." />}
              {cabecalho && (
                <div className="cli-titulo">
                  <div><h1 className="page-title">{cabecalho.titulo}</h1><p className="page-desc">{cabecalho.texto}</p></div>
                </div>
              )}
              {vm.aba === 'inicio' && <Inicio {...daCasca} empresa={vm.empresa} onCanais={abrirCanais} />}
              {vm.aba === 'documentos' && <Documentos {...daCasca} />}
              {vm.aba === 'guias' && <Guias {...daCasca} />}
              {vm.aba === 'dp' && <DepartamentoPessoal {...daCasca} />}
              {vm.aba === 'chamados' && <Chamados {...daCasca} />}
            </>
          )}
        </main>
        <footer className="cli-rodape">
          <span>© {vm.hoje.getFullYear()} Nilma Contabilidade</span>
          {valido && <span>Este link é só da sua empresa. Não repasse.{area.resumo?.atualizadoEm ? ' Atualizado em ' + formatos.dataHora(area.resumo.atualizadoEm) + '.' : ''}</span>}
        </footer>
      </div>
    </div>
  );
}
