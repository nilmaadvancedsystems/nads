// Aplicativo Conciliadorzinho: mostra a rota aberta. No site ligado ao banco, a trava vem antes (29/10/2026): só
// quem entrou com a conta do Entregas e pode usar o Conciliadorzinho. Os arquivos continuam só no navegador.
import { Outlet } from 'react-router';
import { Trava } from '../../comum/trava/Trava';
import { sessaoDoConciliadorzinho } from './dados/fonte';

export function AppConciliadorzinho() {
  return (
    <Trava porta={sessaoDoConciliadorzinho()} recursos={['conciliadorzinho']} nome="Conciliadorzinho">
      <Outlet />
    </Trava>
  );
}
