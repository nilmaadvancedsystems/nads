// ViewModel de Cadastro › Usuários: a equipe (usuarios do Entregas) com cargo, papéis e ativo (só o admin muda) e os
// computadores liberados de cada pessoa (revogar = aquele login precisa de liberação de novo, com outro código).
import { usuarios } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useOperador } from '../../../casca/operador';
import { useAcesso } from '../../../dados/repo';

export function useUsuariosDoNads() {
  const repo = useAcesso();
  const { toast, modal } = useRetorno();
  const admin = !!useOperador().operador?.admin;
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState<string | null>(null);
  const equipe = repo.equipe();
  const sessoes = repo.sessoes();
  const q = busca.trim().toLowerCase();

  async function tentar(f: () => Promise<void>, ok: string) {
    if (!admin) { toast('Só um administrador muda a equipe.'); return; }
    try { await f(); toast(ok); } catch (err) { toast('Não consegui salvar: ' + (err as Error).message); }
  }

  return {
    exemplos: repo.exemplos,
    admin,
    carregando: !equipe.carregada,
    busca, setBusca,
    linhas: equipe.lista
      .filter(p => !q || (p.nome + ' ' + p.email).toLowerCase().includes(q))
      .map(p => ({ ...p, cargo: usuarios.rotuloDoCargo(p), computadores: sessoes.filter(s => s.uid === p.uid) })),
    departamentos: usuarios.DEPARTAMENTOS,
    niveis: usuarios.NIVEIS,
    papeis: usuarios.PAPEIS,
    aberto, alternarAberto: (uid: string) => setAberto(a => (a === uid ? null : uid)),
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
          botoes: [{ rotulo: 'Voltar', valor: false, variante: 'btn-outline' }, { rotulo: 'Desativar', valor: true, variante: 'btn-danger' }] });
        if (!ok) return;
      }
      await tentar(() => repo.ativar(p.uid, !p.ativo), p.nome + (p.ativo ? ' desativado.' : ' ativado.'));
    },
    revogar: (s: usuarios.SessaoLiberada) => tentar(() => repo.revogar(s), 'Liberação de ' + s.nome + ' (' + s.computador + ') revogada: o código não vale mais.'),
    quando: (iso: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''),
  };
}
