// ViewModel da página do convite (/tarefas/convite/<código>, sem login; 15/10/2026: "a redefinição de senha e o link de
// cadastro para usuários"): lê o convite; no de cadastro, a pessoa escolhe o nome (vira o login) e a senha; no de nova
// senha, só a senha. Convite usado, vencido ou que não existe: a mensagem e pedir outro ao admin.
import { usuarios } from '@nads/core';
import { useEffect, useState } from 'react';
import { aceitarCadastro, lerConvite, trocarSenhaPeloConvite, type ConviteDoNads } from '../../dados/convite.firestore';

const semDominio = (email: string) => email.replace(usuarios.DOMINIO_LOGIN, '');

export function useConvite(codigo: string) {
  const [convite, setConvite] = useState<ConviteDoNads | null | undefined>(undefined);
  const [erroAoLer, setErroAoLer] = useState('');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [repetir, setRepetir] = useState('');
  const [tentou, setTentou] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [pronto, setPronto] = useState<{ login: string } | null>(null);

  useEffect(() => {
    let vale = true;
    lerConvite(codigo).then(
      c => { if (vale) setConvite(c); },
      e => { if (vale) { setConvite(null); setErroAoLer(String((e as Error)?.message || e)); } },
    );
    return () => { vale = false; };
  }, [codigo]);

  const limpo = nome.trim().replace(/\s+/g, ' ');
  const faltas: string[] = [];
  if (convite?.tipo === 'novo' && limpo.length < 2) faltas.push('Escreva o seu nome.');
  if (senha.length < usuarios.SENHA_MINIMA) faltas.push('A senha precisa de pelo menos ' + usuarios.SENHA_MINIMA + ' caracteres.');
  else if (senha !== repetir) faltas.push('As duas senhas não são iguais.');
  const cargo = convite
    ? [usuarios.DEPARTAMENTOS.find(d => d.id === convite.departamento)?.rotulo, usuarios.NIVEIS.find(n => n.id === convite.nivel)?.rotulo].filter(Boolean).join(' · ')
    : '';

  return {
    carregando: convite === undefined,
    /** por que o convite não serve ('' = serve) */
    problema: convite === undefined ? ''
      : erroAoLer ? 'Não consegui abrir o convite (' + erroAoLer + ').'
        : !convite ? 'Este link não existe. Peça um link novo ao administrador.'
          : convite.usado ? 'Este link já foi usado. Peça um link novo ao administrador.'
            : convite.vencido ? 'Este link venceu (vale 24 horas). Peça um link novo ao administrador.' : '',
    tipo: convite?.tipo || 'novo',
    paraQuem: convite?.nome || '',
    cargo,
    nome, setNome, senha, setSenha, repetir, setRepetir,
    login: limpo.length >= 2 ? semDominio(usuarios.emailDoNome(limpo)) : '',
    faltas: tentou ? faltas : [],
    erro, enviando, pronto,
    async enviar() {
      setTentou(true);
      setErro('');
      if (!convite || faltas.length || enviando) return;
      setEnviando(true);
      try {
        if (convite.tipo === 'novo') setPronto({ login: semDominio(await aceitarCadastro(convite, limpo, senha)) });
        else { await trocarSenhaPeloConvite(convite, senha); setPronto({ login: convite.nome }); }
      } catch (e) {
        setErro((e as Error).message || String(e));
      } finally { setEnviando(false); }
    },
  };
}
