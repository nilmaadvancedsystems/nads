// A Carteira para quem ainda não tem (12/11/2026: "nos usuários demais deixa o botão, mas a tela em desenvolvimento").
import { Icone } from '@nads/ui';

export function CarteiraEmBreve() {
  return (
    <div className="gh-blank cart-em-breve">
      <span className="cart-em-breve-icone" aria-hidden="true"><Icone nome="dinheiro" /></span>
      <span className="badge badge-neutral">Em desenvolvimento</span>
      <h4>Carteira</h4>
      <p>Uma nova forma de acompanhar suas comissões, seu salário e suas finanças, tudo num só lugar.</p>
      <p className="fraco">Em breve você registra suas comissões, vê o que já foi aprovado e pago e recebe seus holerites e comprovantes por aqui.</p>
    </div>
  );
}
