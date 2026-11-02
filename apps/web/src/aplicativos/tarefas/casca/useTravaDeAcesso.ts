// ViewModel da trava de acesso (29/10/2026): o Concilia aí, o Conciliadorzinho e o Extratudo usam o login da Tarefas
// (a conta do Entregas; tarefas/dados/sessao.ts), como o Admin, e só abrem para quem tem um papel que a tabela de acesso
// (usuarios.ACESSO) libera. Nos exemplos não há login (sessão null): a trava fica aberta.
import { usuarios } from '@nads/core';
import { useSessao, type Sessao } from '../dados/sessao';

/** aberta: mostra o aplicativo; entrar: a entrada da Tarefas (que também espera a sessão); sem-acesso: o papel não libera. */
export type FaseDaTrava = 'aberta' | 'entrar' | 'sem-acesso';

export function faseDaTrava(sessao: Pick<Sessao, 'usuario'> | null, recursos: readonly usuarios.Recurso[]): FaseDaTrava {
  if (!sessao) return 'aberta';
  if (!sessao.usuario) return 'entrar';
  return usuarios.podeAlgum(sessao.usuario, recursos) ? 'aberta' : 'sem-acesso';
}

/** Os papéis que liberam (sem repetir), com o Admin por último, que libera tudo: "Contábil ou Admin". */
export function papeisQueLiberam(recursos: readonly usuarios.Recurso[]): string {
  const outros = usuarios.PAPEIS.filter(p => p.id !== 'admin' && recursos.some(r => usuarios.ACESSO[r].includes(p.id)));
  return [...outros.map(p => p.rotulo), 'Admin'].join(' ou ');
}

/** livre: o aplicativo já está dentro de quem conferiu o login (o Extratudo dentro do Entregas). */
export function useTravaDeAcesso(recursos: readonly usuarios.Recurso[], livre = false) {
  const sessao = useSessao();
  const fase = livre ? 'aberta' : faseDaTrava(sessao, recursos);
  const u = sessao?.usuario;
  return {
    fase,
    sessao,
    semAcesso: fase === 'sem-acesso' && u ? { nome: u.nome, cargo: usuarios.rotuloDoCargo(u) } : null,
    papeisQueLiberam: papeisQueLiberam(recursos),
    sair: () => sessao?.sair(),
  };
}
