// Minha página › Meus acessos (22/11/2026, ficha E21; o dono: "pode fazer tudo"): os computadores em que a conta da pessoa foi
// liberada e o "Não fui eu" em cada um (encerra o acesso e avisa os admins no celular).
import type { usuarios } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useAcesso } from '../../dados/repo';

const quando = (iso: string) => { const d = new Date(iso); return Number.isFinite(d.getTime()) ? d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) : ''; };

export function useMeusAcessos() {
  const repo = useAcesso();
  const { modal, toast } = useRetorno();
  const [lista, setLista] = useState<usuarios.SessaoLiberada[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [vez, setVez] = useState(0);
  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    repo.meusAcessos().then(l => { if (vivo) { setLista(l); setErro(''); } }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : 'Não deu para ler.'); }).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [repo, vez]);
  return {
    carregando, erro,
    acessos: lista.map(s => ({ ...s, quando: quando(s.liberadoEm) })),
    async naoFuiEu(s: usuarios.SessaoLiberada) {
      const ok = await modal({ titulo: 'Não foi você?', texto: 'O acesso em ' + (s.computador || 'este computador') + ' é encerrado agora e os administradores são avisados. Se for este computador, você vai precisar pedir a liberação de novo. Depois, peça ao Diretor um link de senha nova.',
        botoes: [{ rotulo: 'Encerrar e avisar', valor: true, variante: 'btn-danger' }, { rotulo: 'Voltar', valor: false, variante: 'btn-outline' }] });
      if (!ok) return;
      try { await repo.naoFuiEu(s); toast('Acesso encerrado. Os administradores foram avisados.'); setVez(v => v + 1); }
      catch (e) { toast(e instanceof Error ? e.message : 'Não deu para encerrar agora.'); }
    },
  };
}
