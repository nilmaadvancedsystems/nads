// A casca da Área do Cliente (Vitor, 16/10/2026): um site para a pessoa de fora, no celular e no PC. No alto, a marca
// da Nilma e o nome da empresa; embaixo dele as abas (no celular, rolam de lado dentro delas); sem a barra lateral do
// nads. Link desconhecido ou trocado: só o aviso, sem dado nenhum.
import { Alerta, Esqueleto, Icone, MarcaN } from '@nads/ui';
import { Agenda } from './Agenda';
import { Chamados } from './Chamados';
import { Enviar } from './Enviar';
import { Guias } from './Guias';
import { Inicio } from './Inicio';
import { useAreaCliente } from './useAreaCliente';

export function AreaDoCliente() {
  const vm = useAreaCliente();
  const { area } = vm;
  const daCasca = { token: vm.token, area, hoje: vm.hoje, irPara: vm.irPara };
  return (
    <div className="cli-pagina">
      <header className="gh-header">
        <div className="gh-header-top">
          <span className="brand-mark" aria-hidden="true"><MarcaN /></span>
          <b>Nilma Contabilidade</b>
          <span className="gh-header-spacer" />
          {vm.empresa && <span className="cli-empresa" title={vm.empresa}>{vm.empresa}</span>}
        </div>
        {area.valido && (
          <nav className="menu" aria-label="Seções">
            {vm.abas.map(a => (
              <button key={a.id} type="button" className={'menu-item' + (vm.aba === a.id ? ' active' : '')} aria-current={vm.aba === a.id ? 'page' : undefined} onClick={() => vm.irPara(a.id)}>
                <Icone nome={a.icone} width={16} height={16} /><span>{a.rotulo}</span>
              </button>
            ))}
          </nav>
        )}
      </header>
      <main className="cli-main">
        {!area.carregado ? <Esqueleto linhas={4} numeros={3} /> : !area.valido ? (
          <div className="gh-blank" style={{ marginTop: 48 }}>
            <Icone nome="link" width={32} height={32} />
            <p><b>Este link não é válido ou foi trocado.</b> Peça um novo ao escritório.</p>
          </div>
        ) : (
          <>
            {vm.exemplos && <Alerta naLinha titulo="Versão de exemplo" texto="Os dados desta página são de mentira e nada que você fizer aqui chega ao escritório." />}
            {vm.aba === 'inicio' && <Inicio {...daCasca} />}
            {vm.aba === 'guias' && <Guias {...daCasca} />}
            {vm.aba === 'agenda' && <Agenda {...daCasca} />}
            {vm.aba === 'enviar' && <Enviar {...daCasca} />}
            {vm.aba === 'chamados' && <Chamados {...daCasca} />}
          </>
        )}
      </main>
    </div>
  );
}
