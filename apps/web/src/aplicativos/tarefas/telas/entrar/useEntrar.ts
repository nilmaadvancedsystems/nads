// ViewModel da entrada da Tarefas: login com o nome (ou e-mail) e a senha do Entregas. Também cobre a
// conta que entrou mas não diz o departamento (sem cargo e sem papel de contábil/fiscal/DP).
import { useState } from 'react';
import { useNovidade } from '../../../../comum/novidades';
import type { Sessao } from '../../dados/sessao';
import { comecarAberturaDoLogin, pararAberturaDoLogin } from './aberturaDoLogin';

export function useEntrar(sessao: Sessao) {
  // a entrada pelo e-mail (Vitor, 16/11/2026: "se o usuario for logar, peça o email, ao inves do usuario"): o campo pede o
  // e-mail; o nome continua entrando por baixo (o índice loginPorNome), para quem ainda não deu o e-mail não ficar de fora
  const porEmail = useNovidade('email-principal');
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState('');

  async function entrar() {
    if (!login.trim() || !senha || entrando) return;
    setEntrando(true);
    setErro('');
    comecarAberturaDoLogin();
    try {
      await sessao.entrar(login, senha);
      setSenha('');
    } catch (e) {
      pararAberturaDoLogin();
      const msg = e instanceof Error ? e.message : 'Nome ou senha inválidos.';
      setErro(porEmail && login.indexOf('@') !== -1 ? msg.replace(/^Nome ou senha/, 'E-mail ou senha') : msg);
    } finally {
      setEntrando(false);
    }
  }

  return {
    carregando: !sessao.pronta,
    /** entrou, mas a conta não diz em que departamento trabalha */
    semDepartamento: sessao.usuario ? { nome: sessao.usuario.nome } : null,
    porEmail,
    login, setLogin, senha, setSenha,
    entrando, podeEntrar: !!login.trim() && !!senha && !entrando,
    erro: erro || sessao.aviso,
    entrar,
    sair: sessao.sair,
  };
}
