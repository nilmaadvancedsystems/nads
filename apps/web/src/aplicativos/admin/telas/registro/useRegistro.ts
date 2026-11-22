// ViewModel do Registro de alterações (22/11/2026, ficha E20; o dono: "pode fazer tudo"): as últimas linhas da auditoria,
// com o filtro das alterações sensíveis (usuários e acessos) e a busca por pessoa ou texto.
import { formatos } from '@nads/core';
import { useEffect, useMemo, useState } from 'react';
import type { usuarios as u } from '@nads/core';
import { repoDoRegistro } from '../../dados/fonte';

const simples = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function useRegistro() {
  const [linhas, setLinhas] = useState<u.LinhaDaAuditoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [soSensiveis, setSoSensiveis] = useState(true);
  const [busca, setBusca] = useState('');
  const [vez, setVez] = useState(0);
  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    repoDoRegistro().ultimas().then(l => { if (vivo) { setLinhas(l); setErro(''); } }).catch(e => { if (vivo) setErro(e instanceof Error ? e.message : 'Não deu para ler.'); }).finally(() => { if (vivo) setCarregando(false); });
    return () => { vivo = false; };
  }, [vez]);
  const filtradas = useMemo(() => {
    const q = simples(busca.trim());
    return linhas.filter(l => (!soSensiveis || l.sensivel) && (!q || simples(l.rotulo + ' ' + l.detalhe + ' ' + l.por).includes(q)));
  }, [linhas, soSensiveis, busca]);
  return {
    carregando, erro, soSensiveis, setSoSensiveis, busca, setBusca, recarregar: () => setVez(v => v + 1),
    total: linhas.length,
    linhas: filtradas.map(l => ({ ...l, data: formatos.diaEmBrasilia(l.quando).split('-').reverse().join('/'), hora: new Date(l.quando).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }) })),
  };
}
