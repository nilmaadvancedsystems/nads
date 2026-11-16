// ViewModel da janela do e-mail principal (Vitor, 16/11/2026: "mande uma requisição a todos os usuarios ao atualizarem o
// sistema, de colocar o email principal que eles usam ... Dessa maneira, voce atrela o login ao email, não ao usuario"). Só quem
// ainda entra pelo nome@nilma.local vê a janela por cima da Tarefas; quem já tem e-mail de verdade, não. Depois de gravar, a
// mesma janela avisa que da próxima vez a entrada é pelo e-mail (16/11/2026: "assim que a pessoa registrar, avise que o login
// agora vai ser por e-mail, da próxima vez"). O e-mail principal
// É o login: trocado, vai pelo mesmo caminho da Minha conta (a senha, o robô da nuvem troca o login e o cadastro, a sessão
// entra de novo com o e-mail novo); igual ao de hoje, só confirma (usuarios/{uid}.emailPrincipalEm). Obrigatória (Vitor,
// 16/11/2026: "o usuário vai ser obrigado a colocar o e-mail pessoal"): não fecha sem responder; a única saída é sair da conta.
// Na novidade 'email-principal' (só no modo desenvolvedor); o ⚡ da Minha conta simula.
import { usuarios } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useNovidade } from '../../../comum/novidades';
import { useAcesso } from '../dados/repo';
import { useSessao } from '../dados/sessao';
import { EMAIL_DE_TESTE, simularEmailPrincipal, useSimulacaoDoEmailPrincipal } from './simulacaoDoEmailPrincipal';

const espera = (ms: number) => new Promise(ok => setTimeout(ok, ms));

export function useJanelaDoEmailPrincipal() {
  const ligada = useNovidade('email-principal');
  const sessao = useSessao();
  const acesso = useAcesso();
  const simulacao = useSimulacaoDoEmailPrincipal();
  const { toast } = useRetorno();
  // respondida: no modo desenvolvedor a gravação é de mentira e o cadastro continua sem a confirmação, então a janela não pode
  // depender só dele para sair
  const [respondida, setRespondida] = useState(false);
  /** gravou: o e-mail novo, para o aviso "da próxima vez, entre com ele" (a janela fica aberta até o Entendi) */
  const [feito, setFeito] = useState<string | null>(null);
  const [form, setForm] = useState({ de: '', email: '', confirmacao: '', senha: '', erro: '' });
  const [enviando, setEnviando] = useState(false);

  const deTeste = simulacao === 'so-nome' || simulacao === 'com-email';
  const u = sessao?.usuario || null;
  const atual = deTeste ? EMAIL_DE_TESTE[simulacao] : u?.email || '';
  const aberta = !!feito || deTeste || (ligada && !!u && !respondida && usuarios.precisaDoEmailPrincipal(u));
  // quem já tem um e-mail de verdade começa com ele no campo (é só confirmar); o nome@nilma.local não vai para o campo
  const inicial = atual && !usuarios.ehEmailDoNome(atual) ? atual : '';
  const f = form.de === atual + '|' + simulacao ? form : { de: atual + '|' + simulacao, email: inicial, confirmacao: '', senha: '', erro: '' };
  const mudar = (x: Partial<typeof form>) => setForm({ ...f, ...x, erro: x.erro ?? '' });
  /** o e-mail digitado é outro que o login de hoje: troca o login (pede a confirmação e a senha) */
  const troca = f.email.trim().toLowerCase() !== atual.trim().toLowerCase();

  /** a única saída sem responder: sair da conta (na simulação, só fecha) */
  function sair() {
    setForm({ de: '', email: '', confirmacao: '', senha: '', erro: '' });
    if (deTeste) simularEmailPrincipal(null); else sessao?.sair();
  }

  async function enviar() {
    if (enviando) return;
    const novo = f.email.trim().toLowerCase();
    const problema = troca
      ? usuarios.problemaDoEmailPrincipal(f.email, f.confirmacao) || (!f.senha ? 'Digite a sua senha (a mesma de sempre), para trocar o login.' : '')
      : '';
    if (problema) { mudar({ erro: problema }); return; }
    setEnviando(true);
    try {
      if (deTeste) {
        await espera(900);
        simularEmailPrincipal(null);
        setFeito(novo);
        toast('Simulação: nada foi gravado.');
        return;
      }
      if (!u || !sessao) throw new Error('Sem login.');
      // o Firebase derruba as sessões quando o e-mail muda: a sessão confere a senha, espera o robô e entra de novo
      if (troca) await sessao.trocarMeuEmail(novo, f.senha, () => acesso.trocarEmail(u.uid, novo));
      await sessao.confirmarEmailPrincipal();
      setRespondida(true);
      setFeito(novo);
    } catch (e) {
      mudar({ erro: e instanceof Error ? e.message : String(e) });
    } finally {
      setEnviando(false);
    }
  }

  return {
    aberta,
    /** o aviso do fim: o e-mail com que a pessoa entra da próxima vez (null = ainda pedindo) */
    feito,
    entendi: () => setFeito(null),
    deTeste,
    /** o e-mail de entrada de hoje, quando é um e-mail de verdade ('' = a conta entra pelo nome) */
    loginDeHoje: inicial,
    email: f.email, setEmail: (email: string) => mudar({ email }),
    confirmacao: f.confirmacao, setConfirmacao: (confirmacao: string) => mudar({ confirmacao }),
    senha: f.senha, setSenha: (senha: string) => mudar({ senha }),
    troca,
    erro: f.erro,
    enviando,
    podeEnviar: !!f.email.trim() && !enviando,
    enviar,
    sair,
  };
}
