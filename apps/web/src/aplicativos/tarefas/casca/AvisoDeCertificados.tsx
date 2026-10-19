// A faixa dos certificados digitais (Vitor, 19/10/2026: "quero que notifique quando o certificado venceu ou está próximo de
// vencer"): o admin abre a Tarefas e vê quantos certificados do cofre estão vencidos ou vencem em até 30 dias, com o
// botão para Senhas › Certificados. Lê o resumo que o robô grava todo dia (robo/certificados), não o cofre inteiro.
// Fechar esconde até o dia seguinte, neste navegador. O celular e o e-mail são do robô (robo/certificados-do-cofre.js).
import { cofre } from '@nads/core';
import { Alerta } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { certificadosParaOAviso } from '../dados/fonte';
import { caminhoDaPagina } from './navegacao';

const CHAVE = 'nads-aviso-certificados';
const hoje = () => new Date().toISOString().slice(0, 10);
const fechadoHoje = () => { try { return localStorage.getItem(CHAVE) === hoje(); } catch { return false; } };

export function AvisoDeCertificados({ ligado }: { ligado: boolean }) {
  const ir = useNavigate();
  const [lista, setLista] = useState<{ empresa: string; codigo: number | null; validade: string }[]>([]);
  const [fechado, setFechado] = useState(fechadoHoje);
  useEffect(() => {
    if (!ligado || fechado) return;
    let vivo = true;
    void certificadosParaOAviso().then(l => { if (vivo) setLista(l); });
    return () => { vivo = false; };
  }, [ligado, fechado]);
  if (!ligado || fechado || !lista.length) return null;
  const agora = new Date();
  const comDias = lista.map(c => ({ ...c, dias: cofre.situacaoDoCertificado(c.validade, agora).dias ?? 0 })).sort((a, b) => a.dias - b.dias);
  const vencidos = comDias.filter(c => c.dias < 0).length;
  const vencendo = comDias.length - vencidos;
  const titulo = [vencidos ? vencidos + (vencidos === 1 ? ' certificado vencido' : ' certificados vencidos') : '', vencendo ? vencendo + (vencendo === 1 ? ' vence' : ' vencem') + ' em até 30 dias' : ''].filter(Boolean).join(' e ');
  const primeiro = comDias[0];
  const texto = (primeiro.codigo != null ? primeiro.codigo + ' · ' : '') + primeiro.empresa + (primeiro.dias < 0 ? ' venceu há ' + -primeiro.dias + (primeiro.dias === -1 ? ' dia' : ' dias') : primeiro.dias === 0 ? ' vence hoje' : ' vence em ' + primeiro.dias + (primeiro.dias === 1 ? ' dia' : ' dias')) + (comDias.length > 1 ? ' e mais ' + (comDias.length - 1) : '');
  const fechar = () => { try { localStorage.setItem(CHAVE, hoje()); } catch { /* só agora */ } setFechado(true); };
  return (
    // pergunta: a faixa fica até a pessoa agir (sozinha ela some em 3 s e o aviso passaria sem ninguém ver)
    <Alerta titulo={titulo} texto={texto} pergunta>
      <button type="button" className="btn btn-outline" onClick={() => { fechar(); ir(caminhoDaPagina('senhas', 'certificados')); }}>Ver os certificados</button>
      <button type="button" className="btn btn-ghost" onClick={fechar}>Fechar até amanhã</button>
    </Alerta>
  );
}
