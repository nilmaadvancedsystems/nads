// A tela de entrada por e-mail no ⚡ da Minha conta (16/11/2026, só no modo desenvolvedor): a Entrar de verdade, por cima de
// tudo, com uma sessão de mentira. Entrar não entra em conta nenhuma: diz como seria e fecha.
import { Icone, useRetorno } from '@nads/ui';
import { createPortal } from 'react-dom';
import type { Sessao } from '../../dados/sessao';
import { simularEmailPrincipal, useSimulacaoDoEmailPrincipal } from '../../casca/simulacaoDoEmailPrincipal';
import { pararAberturaDoLogin } from './aberturaDoLogin';
import { Entrar } from './Entrar';

const nada = async () => {};

export function EntradaDeTeste() {
  const simulacao = useSimulacaoDoEmailPrincipal();
  const { toast } = useRetorno();
  if (simulacao !== 'entrada') return null;
  const sessao: Sessao = {
    pronta: true, usuario: null, aviso: '',
    async entrar(login) {
      await new Promise(ok => setTimeout(ok, 700));
      pararAberturaDoLogin();
      simularEmailPrincipal(null);
      toast(login.indexOf('@') !== -1
        ? 'Simulação: entraria com o e-mail ' + login.trim() + '. Nada foi enviado.'
        : 'Simulação: entraria pelo nome (o índice loginPorNome), e a janela do e-mail principal abriria em seguida. Nada foi enviado.');
    },
    sair: () => simularEmailPrincipal(null),
    trocarSenha: nada, trocarNome: nada, trocarMeuEmail: nada, trocarSobrenome: nada, confirmarEmailPrincipal: nada,
  };
  return createPortal(
    <div className="entrada-de-teste">
      <button type="button" className="btn btn-ghost entrada-de-teste-voltar" onClick={() => simularEmailPrincipal(null)}><Icone nome="chevronLeft" />Voltar · simulação</button>
      <Entrar sessao={sessao} />
    </div>,
    document.body,
  );
}
