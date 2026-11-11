// ViewModel do Novo ticket (11/11/2026, no padrão do Karbon, do Canopy e do G-Click da Omie): o ticket avulso que a equipe
// manda da Central, a partir de um modelo (os extratos do mês, o faturamento, a admissão ou uma pergunta livre). A
// empresa vem do Cadastro (o e-mail e o WhatsApp dela; sem eles, os do Entregas); os itens do modelo dá para mudar,
// tirar e somar. A regra (o texto do mês, o que impede de mandar) está no @nads/core (mandei.avulsoDoModelo).
import { mandei as m } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { useOperador } from '../../casca/operador';
import { criarTicket } from '../../dados/mandei';
import { useContatoDoEntregas, useTodosOsCadastros } from '../../dados/repo';

/** o mês passado, 'aaaa-mm' (o pedido do mês quase sempre é do mês que fechou) */
function mesPassado(hoje = new Date()): string {
  const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export function useNovoTicket(aoCriar: (id: string) => void) {
  const op = useOperador().operador;
  const { aviso } = useRetorno();
  const cadastros = useTodosOsCadastros();
  const empresas = useMemo(() => [...cadastros.porId.values()].sort((a, b) => a.nome.localeCompare(b.nome)), [cadastros]);
  const [nome, setNome] = useState('');
  const empresa = empresas.find(e => e.nome === nome) || null;
  const doEntregas = useContatoDoEntregas(empresa?.codigo ?? null);
  const [modeloId, setModeloId] = useState(m.MODELOS_DE_TICKET[0].id);
  const modelo = m.MODELOS_DE_TICKET.find(x => x.id === modeloId) || m.MODELOS_DE_TICKET[0];
  const [competencia, setCompetencia] = useState(mesPassado);
  const [para, setPara] = useState({ email: '', whatsapp: '' });
  const [mandando, setMandando] = useState(false);
  const base = () => ({ empresa: { nome: empresa?.nome || '', codigo: empresa?.codigo ?? null }, para: { nome: '', ...para }, criadoPor: { nome: op?.nome || '' }, competencia });
  const [avulso, setAvulso] = useState<m.TicketAvulso>(() => m.avulsoDoModelo(modelo, base()));

  // a empresa escolhida traz o contato dela (o do Cadastro; sem ele, o do Entregas)
  useEffect(() => {
    setPara({ email: empresa?.contato?.email || doEntregas?.email || '', whatsapp: empresa?.contato?.whatsapp || doEntregas?.whatsapp || '' });
  }, [empresa?.nome, empresa?.contato?.email, empresa?.contato?.whatsapp, doEntregas?.email, doEntregas?.whatsapp]);
  // trocou o modelo ou o mês: o assunto, a mensagem e os itens do modelo (o mês no texto)
  useEffect(() => { setAvulso(a => ({ ...m.avulsoDoModelo(modelo, { ...a, competencia }) })); }, [modelo, competencia]);

  const completo: m.TicketAvulso = { ...avulso, ...base(), assunto: avulso.assunto, mensagem: avulso.mensagem, itens: avulso.itens };
  const erro = m.erroDoAvulso(completo);
  const mudarItem = (n: number, f: (i: m.ItemDoModelo) => m.ItemDoModelo) => setAvulso(a => ({ ...a, itens: a.itens.map((x, k) => (k === n ? f(x) : x)) }));

  return {
    empresas: empresas.map(e => ({ valor: e.nome, rotulo: (e.codigo != null ? e.codigo + ' · ' : '') + e.nome })),
    nome, setNome,
    modelos: m.MODELOS_DE_TICKET.map(x => ({ id: x.id, nome: x.nome, descricao: x.descricao })),
    modeloId, setModeloId,
    mensal: modelo.mensal,
    competencia, setCompetencia,
    email: para.email, whatsapp: para.whatsapp,
    setEmail: (email: string) => setPara(p => ({ ...p, email })),
    assunto: avulso.assunto, setAssunto: (assunto: string) => setAvulso(a => ({ ...a, assunto })),
    mensagem: avulso.mensagem, setMensagem: (mensagem: string) => setAvulso(a => ({ ...a, mensagem })),
    itens: avulso.itens.map((i, n) => ({ n, titulo: i.titulo, detalhe: i.detalhe || '', tipo: i.tipo })),
    tipos: (Object.keys(m.ROTULO_DO_TIPO_DO_ITEM) as m.TipoDoItemDoModelo[]).map(t => ({ valor: t, rotulo: m.ROTULO_DO_TIPO_DO_ITEM[t] })),
    mudarTitulo: (n: number, titulo: string) => mudarItem(n, i => ({ ...i, titulo })),
    mudarDetalhe: (n: number, detalhe: string) => mudarItem(n, i => ({ ...i, detalhe })),
    mudarTipo: (n: number, tipo: m.TipoDoItemDoModelo) => mudarItem(n, i => ({ ...i, tipo })),
    tirarItem: (n: number) => setAvulso(a => ({ ...a, itens: a.itens.filter((_, k) => k !== n) })),
    somarItem: () => setAvulso(a => ({ ...a, itens: [...a.itens, { titulo: '', tipo: 'documento' }] })),
    erro, mandando,
    mandar: async () => {
      if (erro || mandando) return;
      setMandando(true);
      try {
        const t = await criarTicket(m.dadosDoAvulso(completo));
        aviso({ tom: 'ok', titulo: 'Ticket ' + m.rotuloDoNumero(t.numero) + ' mandado', texto: [t.para.email, t.para.whatsapp && 'WhatsApp ' + t.para.whatsapp].filter(Boolean).join(' e ') });
        aoCriar(t.id);
      } catch (e) {
        aviso({ tom: 'erro', titulo: 'O ticket não foi mandado', texto: e instanceof Error ? e.message : String(e) });
      } finally { setMandando(false); }
    },
  };
}
