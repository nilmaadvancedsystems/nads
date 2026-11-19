// ViewModel da página própria de criar a senha da Área do Cliente (19/11/2026; o dono, sobre a página "Senha alterada" do Firebase: "tem como melhorar isso?").
// O link do e-mail do Firebase traz o código (?oobCode=...). A página confere o código (mostra o e-mail), pede a senha
// nova duas vezes e, gravada, já entra e leva à empresa: uma só, direto; várias, a pessoa escolhe.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { repoAreaCliente } from '../dados/repo';

/** A senha nova está boa? '' = sim; senão, o que falta. */
export function erroDaSenhaNova(senha: string, repetida: string): string {
  if (senha.length < 8) return 'Use pelo menos 8 caracteres.';
  if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) return 'Misture letras e números.';
  if (senha !== repetida) return 'As duas senhas não são iguais.';
  return '';
}

export function useCriarSenha() {
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const codigo = params.get('oobCode') ?? '';
  // o endereço do link vale para todos os e-mails de login do projeto: o que não é criar senha (confirmar e-mail, desfazer a
  // troca de e-mail) segue para a página padrão do Firebase, com o mesmo pedido
  const modo = params.get('mode') ?? 'resetPassword';
  const outroModo = modo !== 'resetPassword';
  const [email, setEmail] = useState('');
  const [conferindo, setConferindo] = useState(true);
  const [erroDoLink, setErroDoLink] = useState('');
  const [senha, setSenha] = useState('');
  const [repetida, setRepetida] = useState('');
  const [erro, setErro] = useState('');
  const [gravando, setGravando] = useState(false);
  const [empresas, setEmpresas] = useState<{ token: string; nome: string }[] | null>(null);

  useEffect(() => {
    if (outroModo) { window.location.replace('https://entregas-2e5e2.firebaseapp.com/__/auth/action' + window.location.search); return; }
    if (!codigo) { setErroDoLink('Este endereço está incompleto. Abra o link do e-mail de novo, ou peça outro na tela de entrar.'); setConferindo(false); return; }
    let vivo = true;
    repoAreaCliente.conferirCodigoDaSenha(codigo)
      .then(e => { if (vivo) setEmail(e); })
      .catch(e => { if (vivo) setErroDoLink(e instanceof Error ? e.message : 'Este link não vale mais.'); })
      .finally(() => { if (vivo) setConferindo(false); });
    return () => { vivo = false; };
  }, [codigo, outroModo]);

  async function gravar() {
    const problema = erroDaSenhaNova(senha, repetida);
    setErro(problema);
    if (problema || gravando) return;
    setGravando(true);
    try {
      const lista = await repoAreaCliente.gravarSenha(codigo, senha);
      // uma empresa só: direto para ela; nenhuma ou várias: a lista (ou o aviso)
      if (lista.length === 1) { navegar('/cliente/' + lista[0].token, { replace: true }); return; }
      setEmpresas(lista);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não deu para gravar a senha agora.'); } finally { setGravando(false); }
  }

  return {
    conferindo, erroDoLink, email,
    senha, mudarSenha: setSenha, repetida, mudarRepetida: setRepetida, erro, gravando,
    gravar: () => void gravar(),
    empresas,
    abrir: (token: string) => navegar('/cliente/' + token, { replace: true }),
  };
}
