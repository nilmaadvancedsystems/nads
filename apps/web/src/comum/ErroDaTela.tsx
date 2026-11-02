// A tela que quebrou (revisão da UI, 18/10/2026: "erro com uma mensagem clara e um botão de tentar de novo"): no lugar da
// página padrão do React Router ("Unexpected Application Error!"), o vazio do catálogo com o que houve, o Tentar de novo
// e o Voltar ao início.
//
// O Tentar de novo primeiro remonta a rota sem recarregar a página: navega para a mesma rota trocando a entrada do
// histórico (replace). O React Router roda de novo os loaders e, com a location nova, o limite de erro da rota se reseta
// (RenderErrorBoundary.getDerivedStateFromProps, no react-router) e a tela é montada de novo do zero. O revalidate() não
// serve: o "loading" e o "idle" dele chegam no mesmo lote do React e o limite de erro não percebe. Se ela quebrar de novo
// logo em seguida, o botão passa a recarregar a página. Quando o erro é um pedaço do site que sumiu (o arquivo .js da versão anterior, depois de publicar), recarregar
// é o único jeito: a página recarrega sozinha uma vez (recarregarUmaVez, em pedacoQueSumiu.ts) e, se não adiantar, o
// botão recarrega.
import { Vazio } from '@nads/ui';
import { useEffect, useState } from 'react';
import { isRouteErrorResponse, useLocation, useNavigate, useRouteError } from 'react-router';
import { ehPedacoQueSumiu, podeRecarregarSozinho, recarregarUmaVez } from './pedacoQueSumiu';
import { Recarregando } from './pedaco';

// a última tentativa (a rota e a hora): se a mesma rota quebra de novo poucos segundos depois, a tentativa falhou
let ultimaTentativa: { rota: string; quando: number } | null = null;
const JANELA_DA_TENTATIVA_MS = 10_000;

export function ErroDaTela() {
  const erro = useRouteError();
  const local = useLocation();
  const navegar = useNavigate();
  const rota = local.pathname + local.search;
  const pedacoSumiu = ehPedacoQueSumiu(erro);
  // decidido na montagem, sem efeito colateral (depois de um erro o React descarta a primeira renderização e faz de novo):
  // a tentativa anterior (nesta rota, há pouco) não adiantou; e o pedaço que sumiu ainda pode recarregar sozinho
  const [falhouDeNovo] = useState(() => {
    const t = ultimaTentativa;
    return !!t && t.rota === rota && Date.now() - t.quando < JANELA_DA_TENTATIVA_MS;
  });
  const [recarregando] = useState(() => pedacoSumiu && podeRecarregarSozinho());
  // o que mexe fora da tela, só depois de a tela entrar
  useEffect(() => {
    ultimaTentativa = null;
    if (recarregando) recarregarUmaVez();
  }, [recarregando]);

  const texto = pedacoSumiu ? 'Saiu uma versão nova do nads e esta tela precisa recarregar.'
    : isRouteErrorResponse(erro) ? erro.status + ' · ' + (erro.statusText || 'a página não abriu')
    : erro instanceof Error ? erro.message : 'Algo deu errado ao abrir esta tela.';

  const tentarDeNovo = () => {
    if (pedacoSumiu || falhouDeNovo) { location.reload(); return; }
    ultimaTentativa = { rota, quando: Date.now() };
    void navegar({ pathname: local.pathname, search: local.search, hash: local.hash }, { replace: true, state: local.state });
  };

  // recarregando sozinho (o pedaço que sumiu): só a bolinha, sem o "não abriu" (Vitor, 28/10/2026)
  if (recarregando) return <Recarregando />;
  return (
    <main className="main" style={{ paddingTop: 48 }}>
      <Vazio icone="alert" titulo={recarregando ? 'Recarregando…' : 'Esta tela não abriu'}
        texto={falhouDeNovo ? texto + ' (quebrou de novo; o Tentar de novo agora recarrega a página)' : texto}
        onTentarDeNovo={recarregando ? undefined : tentarDeNovo}>
        {!recarregando && <a className="btn btn-ghost" href="/">Voltar ao início</a>}
      </Vazio>
    </main>
  );
}
