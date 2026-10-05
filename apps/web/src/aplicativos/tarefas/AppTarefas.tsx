// Aplicativo Tarefas: liga o repositório (no site, o Firestore da Conferência, coleção `tarefas`) e
// pede quem está trabalhando antes de mostrar qualquer tela: no banco, o login com a conta do Entregas
// (30/09/2026); nos exemplos, a escolha do nome na lista da equipe. Com a proteção do login ligada
// (Cadastro › Configurações), quem não é admin precisa liberar o computador com o código de um admin.
import { usuarios } from '@nads/core';
import { aplicarTabelasCompactas, useRetorno } from '@nads/ui';
import { useEffect, type ReactNode } from 'react';
import { Outlet } from 'react-router';
import { OperadorProvider, operadorDaConta, useOperador } from './casca/operador';
import { avisarErrosDoBanco, repoDaTarefas, repoDeAcesso } from './dados/fonte';
import { RepoProvider } from './dados/repo';
import { useSessao } from './dados/sessao';
import { AvisosDeLiberacao } from './telas/acesso/AvisosDeLiberacao';
import { LiberarComputador } from './telas/acesso/LiberarComputador';
import { useLiberacao } from './telas/acesso/useLiberacao';
import { AberturaDoLogin } from './telas/entrar/aberturaDoLogin';
import { Entrar } from './telas/entrar/Entrar';
import { PessoalProvider } from './telas/pessoal/contexto';
import { QuemSouEu } from './telas/quem/QuemSouEu';

/**
 * Quem está online (Cadastro › Usuários): enquanto o nads está aberto e a aba visível, bate o ponto a cada 3 minutos
 * (usuarios/{uid}.nadsVistoEm); voltou para a aba depois de um tempo, bate na hora. Aba escondida não bate (economiza).
 */
function usePresenca(ligada: boolean) {
  useEffect(() => {
    if (!ligada) return;
    let ultimo = 0;
    const bater = () => {
      if (document.visibilityState !== 'visible' || Date.now() - ultimo < 60 * 1000) return;
      ultimo = Date.now();
      void repoDeAcesso().marcarPresenca().catch(() => undefined);
    };
    bater();
    const relogio = setInterval(bater, usuarios.PONTO_DA_PRESENCA_MS);
    document.addEventListener('visibilitychange', bater);
    return () => { clearInterval(relogio); document.removeEventListener('visibilitychange', bater); };
  }, [ligada]);
}

function PrecisaDeOperador({ children }: { children: ReactNode }) {
  const { operador } = useOperador();
  usePresenca(!!operador);
  return operador ? <>{children}</> : <QuemSouEu />;
}

export function AppTarefas() {
  const repo = repoDaTarefas();
  const sessao = useSessao();
  const { toast } = useRetorno();
  useEffect(() => { avisarErrosDoBanco(repo, toast); }, [repo, toast]);
  // as tabelas compactas (Minha página › Aparência e telas), se a pessoa escolheu neste navegador
  useEffect(() => { aplicarTabelasCompactas(); }, []);

  // no banco: sem conta (ou conta sem departamento), só a entrada
  const operador = sessao?.usuario ? operadorDaConta(sessao.usuario) : null;
  const admin = !!sessao?.usuario?.papeis.includes('admin');
  const liberacao = useLiberacao(admin);
  // a abertura do login fica sempre no mesmo lugar: a tela troca por baixo (entrada → app) sem ela recomeçar
  return <>{conteudo()}<AberturaDoLogin /></>;

  function conteudo() {
  if (sessao && !operador) return <Entrar sessao={sessao} />;
  // proteção do login: este computador ainda não foi liberado por um admin
  if (sessao && operador && liberacao.carregando) return null;
  if (sessao && operador && liberacao.precisa) return <LiberarComputador vm={liberacao} nome={operador.nome} sair={sessao.sair} />;

  return (
    <RepoProvider repo={repo}>
      <OperadorProvider daConta={sessao && operador ? { operador, sair: sessao.sair } : undefined}>
        <PrecisaDeOperador>
          <PessoalProvider>
            <Outlet />
            <AvisosDeLiberacao admin={admin} />
          </PessoalProvider>
        </PrecisaDeOperador>
      </OperadorProvider>
    </RepoProvider>
  );
  }
}
