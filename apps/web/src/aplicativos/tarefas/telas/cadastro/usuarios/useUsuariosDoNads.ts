// ViewModel de Cadastro › Usuários: a equipe do Entregas numa lista (quem é, o cargo, os papéis que tem, se está ativa e
// os computadores liberados); clicar numa pessoa abre a janela dela (cargo, papéis, ativo e computadores — só o admin
// muda), e o "Novo usuário" abre a janela de criar o acesso (Vitor, 05/10/2026: "novo usuário vai ser uma tela
// flutuante como as configurações, na aba de usuários").
import { usuarios } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useOperador } from '../../../casca/operador';
import { useAcesso } from '../../../dados/repo';

export type FiltroDeUsuarios = 'todos' | 'online' | 'ativos' | 'inativos';
type Janela = { tipo: 'novo' } | { tipo: 'pessoa'; uid: string } | null;

/** Para que serve cada papel (a dica da janela da pessoa). */
const DICAS: Partial<Record<usuarios.Papel, string>> = {
  admin: 'Muda a equipe, as configurações e libera computadores.',
  office_boy: 'Faz a rota de entregas no Entregas.',
  contabil: 'Vê e faz a rotina do Contábil.',
  fiscal: 'Vê e faz a rotina do Fiscal.',
  dp: 'Vê e faz a rotina do Departamento Pessoal.',
  equipe_geral: 'Vê o que é de todos no Entregas.',
};

export function useUsuariosDoNads() {
  const repo = useAcesso();
  const { toast, modal } = useRetorno();
  const admin = !!useOperador().operador?.admin;
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroDeUsuarios>('todos');
  const [janela, setJanela] = useState<Janela>(null);
  // o relógio do "online" (quem parou de bater o ponto sai sem a lista mudar)
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => { const r = setInterval(() => setAgora(new Date()), 30 * 1000); return () => clearInterval(r); }, []);
  const equipe = repo.equipe();
  const sessoes = repo.sessoes();
  const q = busca.trim().toLowerCase();

  async function tentar(f: () => Promise<void>, ok: string) {
    if (!admin) { toast('Só um administrador muda a equipe.'); return; }
    try { await f(); toast(ok); } catch (err) { toast('Não consegui salvar: ' + (err as Error).message); }
  }

  const todas = equipe.lista
    .map(p => ({
      ...p,
      cargo: p.departamento || p.nivel ? usuarios.rotuloDoCargo(p) : '',
      iniciais: usuarios.iniciais(p.nome),
      rotulosDosPapeis: usuarios.PAPEIS.filter(x => p.papeis.includes(x.id)).map(x => x.rotulo),
      computadores: sessoes.filter(s => s.uid === p.uid),
      online: p.ativo && usuarios.estaOnline(p.vistoNoNads, agora),
      presenca: usuarios.rotuloDaPresenca(p.vistoNoNads, agora),
    }))
    // quem está online primeiro, depois os ativos, depois os inativos
    .sort((a, b) => Number(b.online) - Number(a.online) || Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome));

  return {
    exemplos: repo.exemplos,
    admin,
    carregando: !equipe.carregada,
    busca, setBusca,
    filtro, setFiltro,
    contagem: { todos: todas.length, online: todas.filter(p => p.online).length, ativos: todas.filter(p => p.ativo).length, inativos: todas.filter(p => !p.ativo).length },
    linhas: todas
      .filter(p => filtro === 'todos' || (filtro === 'online' ? p.online : filtro === 'ativos' ? p.ativo : !p.ativo))
      .filter(p => !q || (p.nome + ' ' + p.email + ' ' + p.cargo).toLowerCase().includes(q)),
    // as janelas: a da pessoa (os dados ao vivo) e a de criar o acesso
    pessoa: janela?.tipo === 'pessoa' ? todas.find(p => p.uid === janela.uid) || null : null,
    novoAberto: janela?.tipo === 'novo',
    abrirPessoa: (uid: string) => setJanela({ tipo: 'pessoa', uid }),
    abrirNovo: () => setJanela({ tipo: 'novo' }),
    fechar: () => setJanela(null),
    departamentos: usuarios.DEPARTAMENTOS,
    niveis: usuarios.NIVEIS,
    papeis: usuarios.PAPEIS.map(x => ({ ...x, dica: DICAS[x.id] || '' })),
    mudarCargo: (p: usuarios.Usuario, departamento: usuarios.Departamento | null, nivel: usuarios.Nivel | null) =>
      tentar(() => repo.salvarCargo(p.uid, departamento, nivel), 'Cargo de ' + p.nome + ' salvo.'),
    alternarPapel(p: usuarios.Usuario, papel: usuarios.Papel) {
      const tem = p.papeis.includes(papel);
      const novos = tem ? p.papeis.filter(x => x !== papel) : [...p.papeis, papel];
      return tentar(() => repo.salvarPapeis(p.uid, novos), (tem ? 'Tirei ' : 'Dei ') + 'o papel ' + (usuarios.PAPEIS.find(x => x.id === papel)?.rotulo || papel) + (tem ? ' de ' : ' a ') + p.nome + '.');
    },
    async ativar(p: usuarios.Usuario) {
      if (p.ativo) {
        const ok = await modal<boolean>({ icone: 'alert', titulo: 'Desativar ' + p.nome + '?', texto: 'A conta deixa de entrar no nads e no Entregas (os robôs e as telas respeitam o "ativo").',
          botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Desativar', valor: true, variante: 'btn-danger' }] });
        if (!ok) return;
      }
      await tentar(() => repo.ativar(p.uid, !p.ativo), p.nome + (p.ativo ? ' desativado.' : ' ativado.'));
    },
    revogar: (s: usuarios.SessaoLiberada) => tentar(() => repo.revogar(s), 'Liberação de ' + s.nome + ' (' + s.computador + ') revogada: o código não vale mais.'),
    quando: (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''),
  };
}

export type VmUsuarios = ReturnType<typeof useUsuariosDoNads>;
