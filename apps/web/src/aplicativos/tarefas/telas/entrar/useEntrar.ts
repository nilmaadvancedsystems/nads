// ViewModel da entrada da Tarefas: login com o nome (ou e-mail) e a senha do Entregas. Também cobre a
// conta que entrou mas não diz o departamento (sem cargo e sem papel de contábil/fiscal/DP).
import { useState } from 'react';
import type { Sessao } from '../../dados/sessao';
import { comecarAberturaDoLogin, pararAberturaDoLogin } from './aberturaDoLogin';

export function useEntrar(sessao: Sessao) {
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
      setErro(e instanceof Error ? e.message : 'Nome ou senha inválidos.');
    } finally {
      setEntrando(false);
    }
  }

  return {
    carregando: !sessao.pronta,
    /** entrou, mas a conta não diz em que departamento trabalha */
    semDepartamento: sessao.usuario ? { nome: sessao.usuario.nome } : null,
    login, setLogin, senha, setSenha,
    entrando, podeEntrar: !!login.trim() && !!senha && !entrando,
    erro: erro || sessao.aviso,
    entrar,
    sair: sessao.sair,
  };
}
