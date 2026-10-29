// Aplicativo Conciliadorzinho: mostra a rota aberta. No site ligado ao banco, a trava vem antes (29/10/2026): só quem
// entrou com a conta do Entregas e pode usar o Conciliadorzinho. Os arquivos continuam só no navegador.
import { Outlet } from 'react-router';
import { TravaDeAcesso } from '../tarefas/casca/TravaDeAcesso';

export function AppConciliadorzinho() {
  return (
    <TravaDeAcesso recursos={['conciliadorzinho']} nome="Conciliadorzinho">
      <Outlet />
    </TravaDeAcesso>
  );
}
