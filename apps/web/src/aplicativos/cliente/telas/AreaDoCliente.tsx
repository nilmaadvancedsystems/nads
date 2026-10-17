// A casca da Área do Cliente (Vitor, 16/10/2026). O menu e as seções são os do protótipo AreaCliente.HTML ("gostei dos
// menus e tudo do html"), sem a "cara de IA" e com só o essencial em cada tela. No PC, o menu lateral fixo: o N e
// "Nilma Contabilidade", a empresa embaixo, as cinco seções no item do nads e, separados, Dados cadastrais e Fale com o
// escritório (janelas; o atendimento fica só ali). No celular, a gaveta do ☰. O conteúdo numa coluna só. Link
// desconhecido ou trocado: só o aviso, sem dado nenhum.
import { Esqueleto, Icone, MarcaN, useRetorno } from '@nads/ui';
import { Chamados } from './Chamados';
import { DepartamentoPessoal } from './DepartamentoPessoal';
import { Documentos } from './Documentos';
import { Guias } from './Guias';
import { Inicio } from './Inicio';
import { useAreaCliente, type IdAba } from './useAreaCliente';
import '../cliente.css';

const TITULO: Record<IdAba, string> = { inicio: 'Visão geral', documentos: 'Documentos', guias: 'Guias e obrigações', dp: 'Departamento pessoal', chamados: 'Solicitações' };

export function AreaDoCliente() {
  const vm = useAreaCliente();
  const { modal, toast } = useRetorno();
  const { area } = vm;
  const daCasca = { token: vm.token, area, hoje: vm.hoje, irPara: vm.irPara, copiar: vm.copiar, exemplos: vm.exemplos };
  const valido = area.carregado && area.valido;
  const fechar = [{ rotulo: 'Fechar', valor: null, variante: 'btn-outline' as const }];

  const abrirFicha = () => {
    const f = area.ficha;
    vm.setMenuAberto(false);
    void modal({
      titulo: 'Dados cadastrais', botoes: fechar,
      corpo: f ? (
        <div className="cli-app cli-janela">
          <dl className="cli-dados">
            <dt>Razão social</dt><dd>{f.razaoSocial}</dd>
            <dt>CNPJ</dt><dd>{f.cnpj}</dd>
            {f.inscricaoEstadual && <><dt>Inscrição estadual</dt><dd>{f.inscricaoEstadual}</dd></>}
            {f.inscricaoMunicipal && <><dt>Inscrição municipal</dt><dd>{f.inscricaoMunicipal}</dd></>}
            <dt>Regime</dt><dd>{f.regime}</dd>
            <dt>Atividade</dt><dd>{f.cnae}</dd>
            <dt>Endereço</dt><dd>{f.endereco}</dd>
            {f.socios.length > 0 && <><dt>Sócios</dt><dd>{f.socios.map(s => s.nome + ' (' + s.participacao + ')').join(', ')}</dd></>}
          </dl>
          <p className="hint" style={{ marginTop: 12 }}>Algo errado? Peça a correção em Solicitações.</p>
        </div>
      ) : <p>Os dados da empresa ainda não chegaram.</p>,
    });
  };

  const abrirContato = () => {
    const c = vm.contato;
    vm.setMenuAberto(false);
    const whatsapp = () => {
      if (vm.exemplos) { toast('Na versão de exemplo o WhatsApp não abre.'); return; }
      window.open(c.whatsappLink, '_blank', 'noopener');
    };
    void modal({
      titulo: 'Fale com o escritório', texto: c.horario || undefined, botoes: fechar,
      corpo: (
        <div className="cli-app cli-janela">
          <dl className="cli-dados">
            {c.telefone && <><dt>Telefone</dt><dd>{c.telefone}</dd></>}
            {c.whatsapp && <><dt>WhatsApp</dt><dd>{c.whatsapp}</dd></>}
            {c.email && <><dt>E-mail</dt><dd>{c.email}</dd></>}
            {c.setores.map(s => <span key={s.nome} style={{ display: 'contents' }}><dt>{s.nome}</dt><dd>{s.email}</dd></span>)}
          </dl>
          <div className="cli-acao">
            {c.whatsappLink && <button type="button" className="btn btn-primary" onClick={whatsapp}>Abrir o WhatsApp</button>}
            <button type="button" className="btn" onClick={() => vm.irPara('chamados')}>Mandar pelo site</button>
          </div>
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
            <p className="cli-empresa-lateral">{vm.empresa}</p>
            <nav className="cli-menu" aria-label="Seções">
              {vm.abas.map(a => (
                <button key={a.id} type="button" className={'subnav-item' + (vm.aba === a.id ? ' active' : '')} aria-current={vm.aba === a.id ? 'page' : undefined} onClick={() => vm.irPara(a.id)}>
                  <Icone nome={a.icone} width={16} height={16} /><span>{a.rotulo}</span>
                  {a.id === 'guias' && vm.vencidas > 0 && <span className="cli-conta" title="Guias vencidas">{vm.vencidas}</span>}
                </button>
              ))}
              <hr className="cli-sep" />
              <button type="button" className="subnav-item" onClick={abrirFicha}><Icone nome="predio" width={16} height={16} /><span>Dados cadastrais</span></button>
              <button type="button" className="subnav-item" onClick={abrirContato}><Icone nome="telefone" width={16} height={16} /><span>Fale com o escritório</span></button>
            </nav>
          </aside>
          {vm.menuAberto && <div className="cli-fundo-gaveta" onClick={() => vm.setMenuAberto(false)} aria-hidden="true" />}
        </>
      )}
      <div className={'cli-corpo' + (valido ? '' : ' sem-lateral')}>
        <header className="cli-topo">
          {valido ? (
            <>
              <button type="button" className="gh-hamb" aria-label="Abrir o menu" aria-expanded={vm.menuAberto} aria-controls="cli-lateral" onClick={() => vm.setMenuAberto(!vm.menuAberto)}>
                <Icone nome="menu" width={16} height={16} />
              </button>
              <b>{vm.empresa}</b>
            </>
          ) : <><span className="brand-mark" aria-hidden="true"><MarcaN /></span><b>Nilma Contabilidade</b></>}
        </header>
        <main className="cli-main">
          {!area.carregado ? <Esqueleto linhas={4} /> : !area.valido ? (
            <div className="cli-cabeca">
              <h1 className="page-title">Este link não vale mais</h1>
              <p className="page-desc">Ele foi trocado ou não existe. Peça um novo ao escritório.</p>
            </div>
          ) : (
            <>
              <div className="cli-cabeca">
                <h1 className="page-title">{TITULO[vm.aba]}</h1>
                {vm.exemplos && <p className="cli-exemplo">Versão de exemplo. Nada do que você fizer aqui chega ao escritório.</p>}
              </div>
              {vm.aba === 'inicio' && <Inicio {...daCasca} />}
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
