// Os ViewModels das abas de Ajustes da Central: Ajustes, Horários, Alertas e Quem pode. Cada um lê uma vez, guarda o que a pessoa
// mexeu e só grava depois da confirmação.
import { robos as r } from '@nads/core';
import { useCallback, useEffect, useState } from 'react';
import type { PessoaDaEquipe, ValoresDoGrupo } from '../dados/ajustes';
import { ajustesDaCentral } from '../dados/repo';

const mensagem = (err: unknown) => {
  const m = err instanceof Error ? err.message : String(err);
  return /permission|insufficient/i.test(m) ? 'O banco não deixou (ou as regras novas ainda não foram publicadas).' : m;
};

function useLeitura<T>(ler: () => Promise<T>) {
  const [dado, setDado] = useState<T | null>(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    let vivo = true;
    ler().then(d => { if (vivo) setDado(d); }).catch(err => { if (vivo) setErro(mensagem(err)); });
    return () => { vivo = false; };
  }, [ler]);
  return { dado, setDado, erro };
}

/** A gravação com confirmação: `preparar` abre a pergunta, `confirmar` grava. */
export function useGravacao<P>(gravar: (p: P) => Promise<void>) {
  const [pendente, setPendente] = useState<P | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  return {
    pendente, enviando, erro,
    preparar: (p: P) => { setErro(''); setPendente(p); },
    cancelar: () => { setPendente(null); setErro(''); },
    async confirmar() {
      if (!pendente) return;
      setEnviando(true);
      setErro('');
      try { await gravar(pendente); setPendente(null); }
      catch (err) { setErro(mensagem(err)); }
      finally { setEnviando(false); }
    },
  };
}

const lerAjustes = () => ajustesDaCentral().lerAjustes();
const lerHorarios = () => ajustesDaCentral().lerHorarios();
const lerAlertas = () => ajustesDaCentral().lerAlertas();
const lerPessoas = () => ajustesDaCentral().pessoas();
const lerPermissoes = () => ajustesDaCentral().lerPermissoes();

export function useAbaAjustes(por: string) {
  const { dado, setDado, erro } = useLeitura(lerAjustes);
  const gravacao = useGravacao<{ g: r.GrupoDeAjustes; antes: ValoresDoGrupo; agora: ValoresDoGrupo }>(async ({ g, antes, agora }) => {
    await ajustesDaCentral().gravarAjuste(g, antes, agora, por);
    setDado(d => (d ? { ...d, [g.doc]: agora } : d));
  });
  return { valores: dado, erro, gravacao };
}

export function useAbaHorarios(por: string) {
  const { dado, setDado, erro } = useLeitura(lerHorarios);
  const gravacao = useGravacao<{ robo: r.RoboDaCentral; antes: r.HorarioDoRobo; agora: r.HorarioDoRobo }>(async ({ robo, agora }) => {
    await ajustesDaCentral().gravarHorario(robo.id, agora, por);
    setDado(d => (d ? { ...d, [robo.id]: agora } : d));
  });
  return { horarios: dado, erro, gravacao };
}

export function useAbaAlertas(por: string) {
  const { dado, setDado, erro } = useLeitura(lerAlertas);
  const pessoas = useLeitura(lerPessoas);
  const gravacao = useGravacao<r.AlertasDosRobos>(async a => {
    await ajustesDaCentral().gravarAlertas(a, por);
    setDado(a);
  });
  return { alertas: dado, pessoas: pessoas.dado as PessoaDaEquipe[] | null, erro: erro || pessoas.erro, gravacao };
}

export function useAbaQuemPode(por: string) {
  const { dado, setDado, erro } = useLeitura(lerPermissoes);
  const pessoas = useLeitura(lerPessoas);
  const gravar = useCallback(async ({ pessoa, agora }: { pessoa: PessoaDaEquipe; antes: r.PermissaoNaCentral; agora: r.PermissaoNaCentral }) => {
    await ajustesDaCentral().gravarPermissao(pessoa.uid, agora, por);
    setDado(d => (d ? { ...d, [pessoa.uid]: agora } : d));
  }, [por, setDado]);
  const gravacao = useGravacao(gravar);
  return { permissoes: dado, pessoas: pessoas.dado as PessoaDaEquipe[] | null, erro: erro || pessoas.erro, gravacao };
}
