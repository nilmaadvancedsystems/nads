// "Quem está trabalhando?" — escolher o nome na lista da equipe (não é login: a autenticação fica
// para depois). O nome vai em cada evento das tarefas.
import { usuarios } from '@nads/core';
import { MarcaN } from '@nads/ui';
import { VERSAO_SISTEMA } from '../../../../versao';
import { EQUIPE, useOperador } from '../../casca/operador';

export function QuemSouEu() {
  const { escolher } = useOperador();
  return (
    <div id="login">
      <div className="auth">
        <span className="auth-mark" aria-hidden="true"><MarcaN /></span>
        <h1 className="auth-title">Quem está trabalhando?</h1>
        <div className="auth-box" style={{ padding: 6 }}>
          <div className="emp-list">
            {EQUIPE.map(u => (
              <button key={u.uid} type="button" className="emp-item" onClick={() => escolher(u.nome)}>
                <span className="emp-cod">{usuarios.iniciais(u.nome)}</span>
                <span className="emp-txt"><span className="emp-nome">{u.nome}</span><span className="emp-reg">{usuarios.rotuloDoCargo(u)}</span></span>
              </button>
            ))}
          </div>
        </div>
        <p className="hint" style={{ textAlign: 'center' }}>Protótipo: ainda sem login. Versão do sistema: {VERSAO_SISTEMA}</p>
      </div>
    </div>
  );
}
