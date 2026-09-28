// Tela de entrada: logo, título e o campo "nome ou código do ERP" (conferencia.html #login ~L955).
import { MarcaN } from '@nads/ui';
import { VERSAO } from '../useCascaConferencia';
import { LIMITE_LISTA, useEntrada } from './useEntrada';

export function Entrada() {
  const vm = useEntrada();
  return (
    <div id="login">
      <div className="auth">
        <span className="auth-mark" aria-hidden="true"><MarcaN /></span>
        <h1 className="auth-title">Entrar na Conferência Contábil</h1>
        <div className="auth-box">
          <div className="field" style={{ position: 'relative' }}>
            <label htmlFor="buscaTxt">Empresa</label>
            <input type="text" id="buscaTxt" placeholder="nome ou código do ERP" autoComplete="off" value={vm.busca}
              onChange={ev => vm.setBusca(ev.target.value)} onFocus={vm.abrirLista} onBlur={vm.fecharLista}
              onKeyDown={ev => { if (ev.key === 'Enter') { ev.preventDefault(); vm.confirmar(); } }} />
            {vm.listaAberta && (
              <div id="buscaLista" className="table-wrap scroll-list" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 30, boxShadow: 'var(--shadow-lg)' }}>
                {!vm.total ? <p className="empty">Nenhuma empresa com esse nome.</p> : (
                  <div className="emp-list">
                    {vm.achadas.map(x => (
                      <button key={x.nome} type="button" className="emp-item" title={'Entrar em ' + x.nome} onMouseDown={ev => ev.preventDefault()} onClick={() => vm.entrar(x.nome)}>
                        <span className="emp-cod">{x.codigo != null ? String(x.codigo) : '—'}</span>
                        <span className="emp-txt"><span className="emp-nome">{x.nome}</span>{x.regime && <span className="emp-reg">{x.regime}</span>}</span>
                      </button>
                    ))}
                  </div>
                )}
                {vm.total > LIMITE_LISTA && <p className="hint" style={{ padding: '4px 14px 10px' }}>Mostrando {LIMITE_LISTA} de {vm.total}. Refine a busca.</p>}
              </div>
            )}
          </div>
        </div>
        <p className="hint" style={{ textAlign: 'center' }}>Versão: {VERSAO}</p>
        <p className="hint" style={{ textAlign: 'center', marginTop: 8 }}>
          Cópia com dados de exemplo (901, 902, 903) · nada é gravado em banco ·{' '}
          <button type="button" className="link-btn" onClick={vm.restaurarExemplos}>restaurar exemplos</button>
        </p>
      </div>
    </div>
  );
}
