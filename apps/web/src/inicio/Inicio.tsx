// Início do nads: escolher o aplicativo. Depois de escolher, o aplicativo pede a empresa.
import { Icone, MarcaN } from '@nads/ui';
import { useInicio } from './useInicio';

export function Inicio() {
  const vm = useInicio();
  return (
    <div id="login">
      <div className="auth apps-inicio">
        <span className="auth-mark" aria-hidden="true"><MarcaN /></span>
        <h1 className="auth-title">Escolha o aplicativo</h1>
        <div className="app-grid">
          {vm.aplicativos.map(a => (
            <button key={a.id} type="button" className="app-card" onClick={() => vm.abrir(a)}>
              <span className="app-card-ico"><Icone nome={a.icone} /></span>
              <span className="app-card-nome">{a.nome}</span>
              <span className="app-card-desc">{a.descricao}</span>
            </button>
          ))}
        </div>
        <p className="hint" style={{ textAlign: 'center', marginTop: 24 }}>Versão: {vm.versao}</p>
      </div>
    </div>
  );
}
