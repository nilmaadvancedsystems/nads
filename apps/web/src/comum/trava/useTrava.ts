// ViewModel da trava de acesso (29/10/2026): o Concilia aí, o Conciliadorzinho e o Extratudo só abrem para quem
// entrou com a conta do Entregas e tem um papel que a tabela de acesso (usuarios.ACESSO) libera. A porta é a sessão
// do Entregas de cada aplicativo (aplicativos/<app>/dados/entregas.firestore.ts); null = sem banco (exemplos) ou
// dentro do Entregas, que já confere o login: a trava fica aberta.
import { usuarios } from '@nads/core';
import { useState, useSyncExternalStore } from 'react';

/** `pronta` = já se sabe se tem alguém; `aviso` = por que a conta não entrou. */
export interface EstadoDaPorta { pronta: boolean; usuario: usuarios.Usuario | null; aviso: string }

/** A sessão do Entregas, como cada aplicativo cria (o mesmo formato da Tarefas). */
export interface PortaDaTrava {
  estado(): EstadoDaPorta;
  entrar(login: string, senha: string): Promise<void>;
  sair(): Promise<void>;
  assinar(aoMudar: () => void): () => void;
  versao(): number;
}

/** aberta: mostra o aplicativo; entrar: pede nome e senha; sem-acesso: entrou, mas o papel não libera. */
export type FaseDaTrava = 'aberta' | 'carregando' | 'entrar' | 'sem-acesso';

const nada = () => () => {};
const zero = () => 0;

export function useTrava(porta: PortaDaTrava | null, recursos: readonly usuarios.Recurso[]) {
  useSyncExternalStore(porta ? porta.assinar : nada, porta ? porta.versao : zero, porta ? porta.versao : zero);
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [entrando, setEntrando] = useState(false);
  const [erro, setErro] = useState('');

  const estado = porta ? porta.estado() : null;
  const usuario = estado?.usuario ?? null;
  const fase: FaseDaTrava = !porta || !estado ? 'aberta'
    : !estado.pronta ? 'carregando'
      : !usuario ? 'entrar'
        : usuarios.podeAlgum(usuario, recursos) ? 'aberta' : 'sem-acesso';

  async function entrar() {
    if (!porta || !login.trim() || !senha || entrando) return;
    setEntrando(true);
    setErro('');
    try {
      await porta.entrar(login, senha);
      setSenha('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Nome ou senha inválidos.');
    } finally {
      setEntrando(false);
    }
  }

  // os papéis que liberam (sem repetir), com o Admin, que libera tudo: "Contábil ou Admin"
  const liberam = usuarios.PAPEIS.filter(p => p.id === 'admin' || recursos.some(r => usuarios.ACESSO[r].includes(p.id)));
  const ordem = [...liberam.filter(p => p.id !== 'admin'), ...liberam.filter(p => p.id === 'admin')];

  return {
    fase,
    login, setLogin, senha, setSenha,
    entrando, podeEntrar: !!login.trim() && !!senha && !entrando,
    erro: erro || estado?.aviso || '',
    entrar,
    sair: () => { void porta?.sair(); },
    /** quem entrou sem ter o papel (para a mensagem de sem acesso) */
    semAcesso: fase === 'sem-acesso' && usuario ? { nome: usuario.nome, cargo: usuarios.rotuloDoCargo(usuario) } : null,
    papeisQueLiberam: ordem.map(p => p.rotulo).join(' ou '),
  };
}
