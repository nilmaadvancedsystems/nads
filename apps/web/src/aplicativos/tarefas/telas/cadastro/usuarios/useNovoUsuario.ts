// ViewModel da janela Novo usuário (Cadastro › Usuários; o "Criar acesso" do Entregas): nome, senha, departamento, nível e os papéis a
// mais; mostra o login que a pessoa vai usar e os papéis que a conta vai ter. Só o admin cria (as regras do Entregas).
import { usuarios } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useOperador } from '../../../casca/operador';
import { useAcesso } from '../../../dados/repo';

/** Os papéis que se dão à mão (o resto vem do departamento e do nível). */
const EXTRAS: readonly usuarios.Papel[] = ['admin', 'office_boy', 'equipe_geral'];

export function useNovoUsuario(aoCriar: () => void = () => {}) {
  const repo = useAcesso();
  const { toast } = useRetorno();
  const admin = !!useOperador().operador?.admin;
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [departamento, setDepartamento] = useState<usuarios.Departamento | ''>('');
  const [nivel, setNivel] = useState<usuarios.Nivel | ''>('');
  const [extras, setExtras] = useState<usuarios.Papel[]>([]);
  const [tentou, setTentou] = useState(false);
  const [criando, setCriando] = useState(false);

  const conta: usuarios.NovaConta = { nome, senha, departamento, nivel, extras };
  const emails = repo.equipe().lista.map(p => p.email);
  const erros = usuarios.conferirNovaConta(conta, emails);
  const limpo = nome.trim().replace(/\s+/g, ' ');
  const papeis = usuarios.papeisDaContaNova(usuarios.ehDepartamento(departamento) ? departamento : null, usuarios.ehNivel(nivel) ? nivel : null, extras)
    .filter(p => p !== 'staff');

  return {
    exemplos: repo.exemplos,
    admin,
    nome, setNome, senha, setSenha, departamento, setDepartamento, nivel, setNivel,
    login: limpo.length >= 2 ? usuarios.emailDoNome(limpo) : '',
    departamentos: usuarios.DEPARTAMENTOS,
    niveis: usuarios.NIVEIS,
    extras: usuarios.PAPEIS.filter(p => EXTRAS.includes(p.id)).map(p => ({ ...p, on: extras.includes(p.id) })),
    alternarExtra: (p: usuarios.Papel) => setExtras(l => (l.includes(p) ? l.filter(x => x !== p) : [...l, p])),
    /** os papéis que a conta vai ter (os do cargo + os marcados) */
    papeis: papeis.map(p => usuarios.PAPEIS.find(x => x.id === p)?.rotulo || p),
    erros: tentou ? erros : [],
    iniciais: limpo ? usuarios.iniciais(limpo) : '?',
    criando,
    async criar() {
      setTentou(true);
      if (!admin) { toast('Só um administrador cadastra pessoas.'); return; }
      if (erros.length || criando) return;
      setCriando(true);
      try {
        const login = await repo.criarConta(conta);
        toast('Acesso criado para ' + limpo + ' (entra como ' + login + ').');
        aoCriar();
      } catch (err) {
        toast(err instanceof Error ? err.message : String(err));
      } finally { setCriando(false); }
    },
  };
}
