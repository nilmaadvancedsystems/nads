// Escolha de empresa (a entrada de cada aplicativo): logo, título e o campo "nome ou código do ERP"
// com a lista embaixo. Nasceu na entrada da Conferência (conferencia.html #login ~L955) e agora é
// de todos os aplicativos. Só desenha: a busca e o "entrar" vêm do ViewModel.
import type { ReactNode } from 'react';
import { MarcaN } from './icones';

export interface EmpresaNaLista { codigo: number | null; nome: string; regime?: string }

export interface PropsEscolherEmpresa<T extends EmpresaNaLista> {
  titulo: string;
  busca: string;
  onBusca: (v: string) => void;
  listaAberta: boolean;
  onAbrirLista: () => void;
  onFecharLista: () => void;
  achadas: T[];
  total: number;
  limite: number;
  onEntrar: (x: T) => void;
  onConfirmar: () => void;
  carregando?: boolean;
  versao: string;
  /** voltar para a tela de aplicativos */
  onAplicativos?: () => void;
  /** linha extra embaixo (ex.: aviso de dados de exemplo) */
  rodape?: ReactNode;
}

export function EscolherEmpresa<T extends EmpresaNaLista>(p: PropsEscolherEmpresa<T>) {
  return (
    <div id="login">
      <div className="auth">
        <span className="auth-mark" aria-hidden="true"><MarcaN /></span>
        <h1 className="auth-title">{p.titulo}</h1>
        <div className="auth-box">
          <div className="field" style={{ position: 'relative' }}>
            <label htmlFor="buscaTxt">Empresa</label>
            <input type="text" id="buscaTxt" placeholder="nome ou código do ERP" autoComplete="off" value={p.busca}
              onChange={ev => p.onBusca(ev.target.value)} onFocus={p.onAbrirLista} onBlur={p.onFecharLista}
              onKeyDown={ev => { if (ev.key === 'Enter') { ev.preventDefault(); p.onConfirmar(); } }} />
            {p.listaAberta && (
              <div id="buscaLista" className="table-wrap scroll-list" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 30, boxShadow: 'var(--shadow-lg)' }}>
                {!p.total ? <p className="empty">Nenhuma empresa com esse nome.</p> : (
                  <div className="emp-list">
                    {p.achadas.map(x => (
                      <button key={(x.codigo ?? '') + x.nome} type="button" className="emp-item" title={'Entrar em ' + x.nome} onMouseDown={ev => ev.preventDefault()} onClick={() => p.onEntrar(x)}>
                        <span className="emp-cod">{x.codigo != null ? String(x.codigo) : '—'}</span>
                        <span className="emp-txt"><span className="emp-nome">{x.nome}</span>{x.regime && <span className="emp-reg">{x.regime}</span>}</span>
                      </button>
                    ))}
                  </div>
                )}
                {p.total > p.limite && <p className="hint" style={{ padding: '4px 14px 10px' }}>Mostrando {p.limite} de {p.total}. Refine a busca.</p>}
              </div>
            )}
          </div>
        </div>
        {p.carregando && <p className="hint" style={{ textAlign: 'center' }}>Carregando empresas…</p>}
        <p className="hint" style={{ textAlign: 'center' }}>Versão do sistema: {p.versao}</p>
        {p.rodape}
        {p.onAplicativos && (
          <p className="hint" style={{ textAlign: 'center', marginTop: 8 }}>
            <button type="button" className="link-btn" onClick={p.onAplicativos}>← Outros aplicativos</button>
          </p>
        )}
      </div>
    </div>
  );
}
