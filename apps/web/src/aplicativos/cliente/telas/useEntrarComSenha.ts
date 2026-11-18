// ViewModel da tela de entrar da Área do Cliente (18/11/2026; o dono: "a area de cliente vai ter senha de acesso", "Uma
// por pessoa"): quando o link pede senha, a pessoa entra com o e-mail que o escritório cadastrou e a senha que ela mesma
// criou. No primeiro acesso (ou se esqueceu), "Criar ou trocar a senha" manda um e-mail do Firebase com o link para criar
// a senha, que volta para esta empresa. A tela nunca diz se o e-mail existe (ninguém descobre quem tem acesso por aqui).
import { useState } from 'react';
import { repoAreaCliente } from '../dados/repo';

export function useEntrarComSenha(token: string) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);

  async function entrar() {
    if (ocupado) return;
    if (!email.trim() || !senha) { setErro('Digite o e-mail e a senha.'); return; }
    setOcupado(true); setErro(''); setAviso('');
    // deu certo: a tela troca sozinha (o banco abre a área para este login)
    try { await repoAreaCliente.entrar(token, email, senha); } catch (e) { setErro(e instanceof Error ? e.message : 'Não deu para entrar agora.'); } finally { setOcupado(false); }
  }

  async function criarSenha() {
    if (ocupado) return;
    if (!email.trim()) { setErro('Digite o seu e-mail primeiro.'); return; }
    setOcupado(true); setErro(''); setAviso('');
    try {
      await repoAreaCliente.criarSenha(token, email);
      setAviso('Se este e-mail tiver acesso, chega em instantes um e-mail para você criar a senha. Confira também o spam.');
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não deu para mandar agora.'); } finally { setOcupado(false); }
  }

  return {
    email, mudarEmail: setEmail, senha, mudarSenha: setSenha, erro, aviso, ocupado,
    entrar: () => void entrar(),
    criarSenha: () => void criarSenha(),
  };
}
