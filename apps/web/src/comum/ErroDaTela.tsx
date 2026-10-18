// A tela que quebrou (revisão da UI, 18/10/2026: "erro com uma mensagem clara e um botão de tentar de novo"): no lugar da
// página padrão do React Router ("Unexpected Application Error!"), o vazio do catálogo com o que houve, o Tentar de novo
// (recarrega a página) e o Voltar ao início.
import { Vazio } from '@nads/ui';
import { isRouteErrorResponse, useRouteError } from 'react-router';

export function ErroDaTela() {
  const erro = useRouteError();
  const texto = isRouteErrorResponse(erro) ? erro.status + ' · ' + (erro.statusText || 'a página não abriu')
    : erro instanceof Error ? erro.message : 'Algo deu errado ao abrir esta tela.';
  return (
    <main className="main" style={{ paddingTop: 48 }}>
      <Vazio icone="alert" titulo="Esta tela não abriu" texto={texto} onTentarDeNovo={() => location.reload()}>
        <a className="btn btn-ghost" href="/">Voltar ao início</a>
      </Vazio>
    </main>
  );
}
