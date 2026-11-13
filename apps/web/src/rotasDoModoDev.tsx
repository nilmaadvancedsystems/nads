// A Área do Cliente e a Central dos robôs dentro do nads, no modo desenvolvedor (Vitor, 13/11/2026: "quero que a Área do
// Cliente e a do robô estejam no modo dev do nads"; "um botão que só aparece ou funciona no modo dev que fica lá no nads,
// pode colocar como um módulo pra quem tá no modo dev"). O botão é o módulo Desenvolvedor da gaveta ☰ da Tarefas
// (telas/desenvolvedor); daqui vêm as rotas que ele abre, as mesmas dos sites deles: /cliente/<token>/<aba> e /robos/*.
//
// No site da Tarefas (exigir), as rotas só abrem com o modo desenvolvedor ligado; desligado, o endereço volta para a
// Tarefas. No npm run dev com todos os aplicativos, abrem sempre, como antes. Com o modo ligado, as telas leem o banco de
// verdade e nada é gravado: as travas ficam nos repositórios (a Área do Cliente: travaDoModoDev.ts; a Central: guardar e
// guardarPedido), e a faixa azul no canto lembra disso e leva de volta ao módulo.
//
// O caminho é só de ida: a Tarefas leva as telas do cliente e dos robôs (em pedaços à parte, que só baixam quando abertos);
// o site do cliente (rotasDoCliente.tsx) e o dos robôs (rotasDosRobos.tsx) continuam sem nada daqui.
import type { ReactNode } from 'react';
import { Navigate, useNavigate, type RouteObject } from 'react-router';
import { Icone } from '@nads/ui';
import { useAvisoDeBloqueio, useModoDesenvolvedor } from './comum/modoDesenvolvedor';
import { NaEspera, pedaco } from './comum/pedaco';

const AreaDoCliente = pedaco(() => import('./aplicativos/cliente/telas/AreaDoCliente'), 'AreaDoCliente');
const AppRobos = pedaco(() => import('./aplicativos/robos/AppRobos'), 'AppRobos');
const Central = pedaco(() => import('./aplicativos/robos/casca/Central'), 'Central');

/** O módulo Desenvolvedor da Tarefas (para onde a faixa volta). */
export const CAMINHO_DO_MODULO_DEV = '/tarefas/desenvolvedor/sites';

/** A faixa do canto: está no modo desenvolvedor (nada é gravado) e o caminho de volta ao nads. */
function FaixaDoModoDev() {
  const ir = useNavigate();
  return (
    <div className="faixa-modo-dev" role="status">
      <span className="faixa-modo-dev-txt"><b>Modo desenvolvedor</b><small>Lê o banco; nada é gravado nem enviado.</small></span>
      <button type="button" className="btn" onClick={() => ir(CAMINHO_DO_MODULO_DEV)}>
        <Icone nome="chevronLeft" width={14} height={14} />Voltar ao nads
      </button>
    </div>
  );
}

function NoModoDev({ exigir, children }: { exigir: boolean; children: ReactNode }) {
  const [dev] = useModoDesenvolvedor();
  // o pedido recusado pela trava (enviar, solicitar, comandar um robô): o aviso em cima, como na Tarefas
  useAvisoDeBloqueio();
  if (!dev) return exigir ? <Navigate to="/tarefas" replace /> : <>{children}</>;
  return <>{children}<FaixaDoModoDev /></>;
}

const cliente = <NaEspera inteira><AreaDoCliente /></NaEspera>;
const central = <NaEspera inteira><Central /></NaEspera>;

/** As rotas da Área do Cliente e da Central dos robôs no nads. exigir: só abrem com o modo desenvolvedor ligado. */
export function rotasDoModoDev(exigir: boolean): RouteObject[] {
  const noModo = (tela: ReactNode) => <NoModoDev exigir={exigir}>{tela}</NoModoDev>;
  return [
    { path: '/cliente/:token/:aba?', element: noModo(cliente) },
    { path: '/cliente', element: noModo(cliente) },
    {
      path: '/robos',
      element: noModo(<NaEspera inteira><AppRobos /></NaEspera>),
      children: [
        { index: true, element: central },
        { path: '*', element: central },
      ],
    },
  ];
}
