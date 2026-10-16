// A casca da Área do Cliente (Vitor, 16/10/2026): um site para a pessoa de fora, no celular e no PC, no visual do protótipo
// AreaCliente.HTML do Vitor (estrutura e estilo do protótipo, com as cores, as fontes e o logo do nads). No PC, a barra
// lateral fica fixa com a marca, as cinco seções (cada uma com o seu número) e o cartão do escritório; no celular ela vira
// uma gaveta aberta pelo ☰, como no protótipo, e as cinco cabem sem rolar de lado. No alto, o cabeçalho com a empresa e o
// botão de abrir um chamado; embaixo, o rodapé. Sem a barra lateral do nads. Link desconhecido ou trocado: só o aviso, sem
// dado nenhum.
import { Alerta, Esqueleto, Icone, MarcaN } from '@nads/ui';
import { Agenda } from './Agenda';
import { Chamados } from './Chamados';
import { Enviar } from './Enviar';
import { Guias } from './Guias';
import { Inicio } from './Inicio';
import { useAreaCliente, type IdAba } from './useAreaCliente';
import '../cliente.css';

const TITULOS: Record<Exclude<IdAba, 'inicio'>, { titulo: string; texto: string }> = {
  guias: { titulo: 'Suas guias', texto: 'Baixe as guias de pagamento que o escritório gerou para a sua empresa.' },
  agenda: { titulo: 'Agenda do mês', texto: 'O que vence em cada mês e se o escritório já fez a sua parte.' },
  enviar: { titulo: 'Enviar documentos', texto: 'Mande extratos, notas e comprovantes para o escritório, direto do seu aparelho.' },
  chamados: { titulo: 'Chamados', texto: 'Tire dúvidas e peça serviços: a conversa com o escritório fica guardada aqui.' },
};

function Marca() {
  return (
    <>
      <span className="cli-marca-n" aria-hidden="true"><MarcaN /></span>
      <div className="cli-marca-txt">
        <div className="cli-marca-nome">Nilma<small>Portal</small></div>
        <div className="cli-marca-sub">Contabilidade</div>
      </div>
    </>
  );
}

export function AreaDoCliente() {
  const vm = useAreaCliente();
  const { area } = vm;
  const daCasca = { token: vm.token, area, hoje: vm.hoje, irPara: vm.irPara };
  const valido = area.carregado && area.valido;
  const cabecalho = vm.aba === 'inicio' ? null : TITULOS[vm.aba];
  const contato = area.resumo?.escritorio;
  return (
    <div className="cli-app">
      {valido && (
        <>
          <aside className={'cli-lateral' + (vm.menuAberto ? ' aberta' : '')} id="cli-lateral" aria-label="Menu">
            <div>
              <div className="cli-marca">
                <Marca />
                <button type="button" className="cli-fechar" aria-label="Fechar o menu" onClick={() => vm.setMenuAberto(false)}>
                  <Icone nome="x" width={18} height={18} />
                </button>
              </div>
              <nav className="cli-menu" aria-label="Seções">
                {vm.abas.map(a => {
                  const conta = vm.contadores[a.id];
                  return (
                    <button key={a.id} type="button" className={'cli-menu-item' + (vm.aba === a.id ? ' on' : '')} aria-current={vm.aba === a.id ? 'page' : undefined} onClick={() => vm.irPara(a.id)}>
                      <Icone nome={a.icone} width={20} height={20} /><span>{a.rotulo}</span>
                      {!!conta && <span className="cli-menu-conta" aria-label={conta + ' pendente(s)'}>{conta}</span>}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className="cli-lateral-pe">
              <div className="cli-lateral-quem">
                <span className="cli-avatar" aria-hidden="true">NC</span>
                <div>
                  <b>Nilma Contabilidade</b>
                  <span><span className="cli-ponto" aria-hidden="true" />{contato?.telefone || contato?.whatsapp || 'Seu escritório de contabilidade'}</span>
                </div>
              </div>
              <button type="button" className="cli-btn" onClick={() => vm.irPara('chamados')}><Icone nome="mensagem" width={16} height={16} />Falar com o escritório</button>
            </div>
          </aside>
          {vm.menuAberto && <div className="cli-fundo-gaveta" onClick={() => vm.setMenuAberto(false)} aria-hidden="true" />}
        </>
      )}
      <div className={'cli-corpo' + (valido ? '' : ' sem-lateral')}>
        <header className="cli-topo">
          <div className="cli-topo-esq">
            {valido && (
              <button type="button" className="cli-hamb" aria-label="Abrir o menu" aria-expanded={vm.menuAberto} aria-controls="cli-lateral" onClick={() => vm.setMenuAberto(!vm.menuAberto)}>
                <Icone nome="menu" width={22} height={22} />
              </button>
            )}
            {valido && vm.empresa ? (
              <div className="cli-empresa" title={vm.empresa}>
                <span className="cli-empresa-ico" aria-hidden="true"><Icone nome="predio" width={15} height={15} /></span>
                <div className="cli-empresa-txt">
                  <b>{vm.empresa}</b>
                  {vm.cnpj && <small>CNPJ: {vm.cnpj}</small>}
                </div>
              </div>
            ) : (
              <div className="cli-topo-marca"><span className="cli-marca-n" aria-hidden="true"><MarcaN /></span><b>Nilma Contabilidade</b></div>
            )}
          </div>
          {valido && (
            <div className="cli-topo-dir">
              <span className="cli-seguro"><Icone nome="escudo" width={16} height={16} />Área exclusiva da sua empresa</span>
              {vm.aba !== 'chamados' && <button type="button" className="cli-btn cli-btn-marca" onClick={() => vm.irPara('chamados')}><Icone nome="plus" width={16} height={16} />Abrir um chamado</button>}
            </div>
          )}
        </header>
        <main className="cli-main">
          {!area.carregado ? <Esqueleto linhas={4} numeros={3} /> : !area.valido ? (
            <div className="cli-cartao cli-vazio cli-invalido">
              <span className="cli-vazio-ico"><Icone nome="link" width={26} height={26} /></span>
              <h3>Este link não é válido ou foi trocado.</h3>
              <p>Peça um novo ao escritório.</p>
            </div>
          ) : (
            <>
              {vm.exemplos && <Alerta naLinha titulo="Versão de exemplo" texto="Os dados desta página são de mentira e nada que você fizer aqui chega ao escritório." />}
              {cabecalho && (
                <div className="cli-pagina-topo">
                  <div><h1>{cabecalho.titulo}</h1><p>{cabecalho.texto}</p></div>
                </div>
              )}
              {vm.aba === 'inicio' && <Inicio {...daCasca} empresa={vm.empresa} />}
              {vm.aba === 'guias' && <Guias {...daCasca} />}
              {vm.aba === 'agenda' && <Agenda {...daCasca} />}
              {vm.aba === 'enviar' && <Enviar {...daCasca} />}
              {vm.aba === 'chamados' && <Chamados {...daCasca} />}
            </>
          )}
        </main>
        <footer className="cli-rodape">
          <span>© {vm.hoje.getFullYear()} Nilma Contabilidade</span>
          {valido && <span><Icone nome="lock" width={13} height={13} />Este link é só da sua empresa. Não repasse.</span>}
        </footer>
      </div>
    </div>
  );
}
