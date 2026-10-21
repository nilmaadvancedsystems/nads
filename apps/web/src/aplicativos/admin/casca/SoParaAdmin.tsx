// "Só para administradores": quem entrou com a conta do Entregas e não é admin (ou, nos exemplos, escolheu alguém da equipe
// que não é admin) vê só isto, com o botão de sair. A proteção de verdade é a regra do banco (robo/*, roboAtividade, uso,
// feedbacks e painelMaquinas só o admin lê); esta tela só evita mostrar uma página vazia. A mesma marcação da entrada.
import { MarcaN } from '@nads/ui';

export function SoParaAdmin({ nome, rotuloSair, sair }: { nome: string; rotuloSair: string; sair: () => void }) {
  return (
    <div id="login">
      <div className="auth">
        <span className="auth-mark" aria-hidden="true"><MarcaN /></span>
        <h1 className="auth-title">Só para administradores</h1>
        <div className="auth-box">
          <p style={{ margin: 0 }}>Olá, <b>{nome}</b>. Este site mostra o robô, o uso do sistema e a saúde do banco, e só quem é administrador do nads entra. Se precisar, peça ao administrador.</p>
        </div>
        <button className="btn btn-outline" type="button" onClick={sair}>{rotuloSair}</button>
      </div>
    </div>
  );
}
