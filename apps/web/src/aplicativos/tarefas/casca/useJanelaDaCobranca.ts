// ViewModel da janela da cobrança (Vitor, 16/11/2026: "deixa mais explicito que foi cobrado, tome a tela inicial toda...,
// assim que cobrar, não deixa o usuario sair enquanto nao responder a cobrança, faça uma bela popup. Deixa com a opção 'Mais
// 5 minutos, + 10minutos', para o usuario responder"): quem faz a tarefa vê a cobrança aberta por cima de qualquer tela da
// Tarefas, uma de cada vez (a mais antiga primeiro), até responder; o mais tempo pede a justificativa e a janela volta quando
// o tempo acaba. Na novidade 'cobranca-notificada' (só no modo desenvolvedor). As regras são do core (tarefas.delegadas).
import { tarefas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useState } from 'react';
import { useTarefasDelegadas } from '../dados/repo';
import { useNovidade } from '../../../comum/novidades';

const d = tarefas.delegadas;
type TarefaDelegada = tarefas.delegadas.TarefaDelegada;

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const hora = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const nomeDoCliente = (c: tarefas.delegadas.ClienteVinculado) => (c.codigo != null ? c.codigo + ' · ' : '') + c.nome;
/** a cobrança aberta da tarefa: a tarefa e a hora da cobrança (outra cobrança na mesma tarefa é outra janela) */
const chaveDa = (t: TarefaDelegada) => t.id + '|' + (d.cobrancaAberta(t)?.em || '');

export function useJanelaDaCobranca() {
  const ligada = useNovidade('cobranca-notificada');
  const repo = useTarefasDelegadas();
  const { toast } = useRetorno();
  const uid = repo.eu()?.uid || '';
  const { tarefas: lista } = repo.lista();
  // o relógio da janela: acorda quando o tempo pedido acaba
  const [agora, setAgora] = useState(() => Date.now());
  // o que a pessoa já respondeu (para sempre) ou adiou (até quando) nesta tela: no modo desenvolvedor a gravação é de
  // mentira e a cobrança continua aberta na lista; sem isto, a janela não sairia mais
  const [dispensadas, setDispensadas] = useState<Record<string, number>>({});
  const [form, setForm] = useState({ chave: '', resposta: '', justificativa: '', erro: '' });
  const [ocupado, setOcupado] = useState<'' | 'responder' | 5 | 10>('');

  const pendentes = ligada && uid ? lista.filter(t => d.deveResponderCobranca(t, uid)) : [];
  const voltaEm = (t: TarefaDelegada) => Math.max(Date.parse(d.cobrancaAdiadaAte(t) || '') || 0, dispensadas[chaveDa(t)] ?? 0);
  const aMostrar = pendentes.filter(t => voltaEm(t) <= agora)
    .sort((a, b) => (d.cobrancaAberta(a)?.em || '').localeCompare(d.cobrancaAberta(b)?.em || ''));
  const proxima = Math.min(...pendentes.map(voltaEm).filter(x => x > agora && Number.isFinite(x)));
  useEffect(() => {
    if (!Number.isFinite(proxima)) return;
    const id = window.setTimeout(() => setAgora(Date.now()), Math.max(0, proxima - Date.now()) + 500);
    return () => window.clearTimeout(id);
  }, [proxima]);

  const t = aMostrar[0] || null;
  const c = t ? d.cobrancaAberta(t) : null;
  const chave = t ? chaveDa(t) : '';
  // o formulário é o desta cobrança (outra cobrança começa vazia)
  const f = form.chave === chave ? form : { chave, resposta: '', justificativa: '', erro: '' };
  const mudar = (x: Partial<typeof form>) => setForm({ ...f, ...x });
  const dispensar = (ate: number) => { setDispensadas(x => ({ ...x, [chave]: ate })); setAgora(Date.now()); };

  async function responder() {
    if (!t) return;
    const problema = d.problemaDaResposta(t, uid, f.resposta);
    if (problema) { mudar({ erro: problema }); return; }
    setOcupado('responder');
    try {
      await repo.responderCobranca(t.id, f.resposta);
      dispensar(Infinity);
      toast('Resposta enviada para ' + t.criadaPor.nome + '.');
    } catch (e) { mudar({ erro: 'Não enviei a resposta: ' + (e instanceof Error ? e.message : String(e)) }); } finally { setOcupado(''); }
  }
  async function adiar(minutos: 5 | 10) {
    if (!t) return;
    const problema = d.problemaDoAdiamento(t, uid, minutos, f.justificativa);
    if (problema) { mudar({ erro: problema }); return; }
    setOcupado(minutos);
    try {
      await repo.adiarCobranca(t.id, minutos, f.justificativa);
      dispensar(Date.now() + minutos * 60_000);
      toast('A cobrança volta em ' + minutos + ' minutos. ' + t.criadaPor.nome + ' vai ver a sua justificativa.');
    } catch (e) { mudar({ erro: 'Não pedi mais tempo: ' + (e instanceof Error ? e.message : String(e)) }); } finally { setOcupado(''); }
  }

  return {
    /** a cobrança na tela, ou null (nada esperando, ou a novidade desligada) */
    cobranca: t && c ? {
      chave,
      por: c.por, quando: quando(c.em), texto: c.texto,
      tarefa: t.titulo,
      cliente: t.clientes.map(nomeDoCliente).join(', '),
      /** os pedidos de mais tempo desta cobrança, que já acabaram */
      adiamentos: d.andamentoDaCobranca(t).filter(n => n.tipo === 'adiamento').map(n => 'Às ' + hora(n.em) + ', você pediu mais ' + (n.minutos || 0) + ' minutos: ' + n.texto),
      /** as outras cobranças esperando depois desta */
      outras: aMostrar.length - 1,
    } : null,
    resposta: f.resposta, setResposta: (resposta: string) => mudar({ resposta, erro: '' }),
    justificativa: f.justificativa, setJustificativa: (justificativa: string) => mudar({ justificativa, erro: '' }),
    erro: f.erro,
    ocupado,
    minutos: d.MINUTOS_DE_ADIAMENTO,
    maiorTexto: d.MAIOR_PARECER,
    responder, adiar,
  };
}
