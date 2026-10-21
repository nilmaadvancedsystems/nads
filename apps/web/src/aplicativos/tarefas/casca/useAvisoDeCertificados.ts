// O ViewModel da faixa dos certificados digitais (19/10/2026): lê o resumo que o robô grava todo dia (robo/certificados),
// monta o título e o texto e guarda o "Fechar até amanhã" neste navegador.
import { cofre } from '@nads/core';
import { useEffect, useState } from 'react';
import { certificadosParaOAviso, ouvirAvisoDeCertificadosLigado } from '../dados/fonte';

const CHAVE = 'nads-aviso-certificados';
const hoje = () => new Date().toISOString().slice(0, 10);
const fechadoHoje = () => { try { return localStorage.getItem(CHAVE) === hoje(); } catch { return false; } };
const plural = (n: number, um: string, varios: string) => n + (n === 1 ? um : varios);

export function useAvisoDeCertificados(ligado: boolean) {
  const [lista, setLista] = useState<{ empresa: string; codigo: number | null; validade: string }[]>([]);
  const [fechado, setFechado] = useState(fechadoHoje);
  // o admin desligou os avisos em Senhas › Certificados (19/10/2026)
  const [avisos, setAvisos] = useState(true);
  useEffect(() => (ligado ? ouvirAvisoDeCertificadosLigado(setAvisos) : undefined), [ligado]);
  useEffect(() => {
    if (!ligado || fechado) return;
    let vivo = true;
    void certificadosParaOAviso().then(l => { if (vivo) setLista(l); });
    return () => { vivo = false; };
  }, [ligado, fechado]);
  const fechar = () => { try { localStorage.setItem(CHAVE, hoje()); } catch { /* só agora */ } setFechado(true); };
  if (!ligado || !avisos || fechado || !lista.length) return { mostrar: false as const, fechar };
  const agora = new Date();
  const comDias = lista.map(c => ({ ...c, dias: cofre.situacaoDoCertificado(c.validade, agora).dias ?? 0 })).sort((a, b) => a.dias - b.dias);
  const vencidos = comDias.filter(c => c.dias < 0).length;
  const vencendo = comDias.length - vencidos;
  const titulo = [vencidos ? plural(vencidos, ' certificado vencido', ' certificados vencidos') : '', vencendo ? vencendo + (vencendo === 1 ? ' vence' : ' vencem') + ' em até 30 dias' : ''].filter(Boolean).join(' e ');
  const p = comDias[0];
  const quando = p.dias < 0 ? ' venceu há ' + plural(-p.dias, ' dia', ' dias') : p.dias === 0 ? ' vence hoje' : ' vence em ' + plural(p.dias, ' dia', ' dias');
  const texto = (p.codigo != null ? p.codigo + ' · ' : '') + p.empresa + quando + (comDias.length > 1 ? ' e mais ' + (comDias.length - 1) : '');
  return { mostrar: true as const, titulo, texto, fechar };
}
