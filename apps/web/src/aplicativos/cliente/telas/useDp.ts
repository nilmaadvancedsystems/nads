// ViewModel do Departamento pessoal (Vitor, 16/10/2026, do protótipo): a lista de funcionários com a ficha de cada um e os
// pedidos de admissão, férias e demissão. Por enquanto cada pedido vira um chamado do tipo certo com os dados no texto; na
// versão de exemplo só aparece o recibo.
import { formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { ROTULO_DAS_FERIAS, type Empregado } from '../dados/areaCliente';
import { repoAreaCliente } from '../dados/repo';
import {
  dataBr, erroDaAdmissao, erroDaDemissao, erroDasFerias, textoDaAdmissao, textoDaDemissao, textoDasFerias,
  type PedidoDeAdmissao, type PedidoDeDemissao, type PedidoDeFerias,
} from '../dados/regras';
import type { DaCasca } from './useAreaCliente';

export type Pedido = 'admissao' | 'ferias' | 'demissao';
const ADMISSAO: PedidoDeAdmissao = { nome: '', cpf: '', cargo: '', salario: '', inicio: '', contrato: 'Prazo indeterminado', observacoes: '' };
const FERIAS: PedidoDeFerias = { empregado: '', inicio: '', dias: '30 dias', adiantar13: false, observacoes: '' };
const DEMISSAO: PedidoDeDemissao = { empregado: '', ultimoDia: '', motivo: '', aviso: 'Trabalhado', observacoes: '' };

export function useDp({ token, area, irPara }: DaCasca) {
  const { toast } = useRetorno();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [admissao, setAdmissao] = useState(ADMISSAO);
  const [ferias, setFerias] = useState(FERIAS);
  const [demissao, setDemissao] = useState(DEMISSAO);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [recibo, setRecibo] = useState<{ titulo: string; id: string } | null>(null);

  function abrir(p: Pedido, empregado = '') {
    setPedido(p); setErro(''); setRecibo(null);
    if (p === 'admissao') setAdmissao(ADMISSAO);
    if (p === 'ferias') setFerias({ ...FERIAS, empregado });
    if (p === 'demissao') setDemissao({ ...DEMISSAO, empregado });
  }

  async function enviar() {
    if (!pedido) return;
    const problema = pedido === 'admissao' ? erroDaAdmissao(admissao) : pedido === 'ferias' ? erroDasFerias(ferias) : erroDaDemissao(demissao);
    setErro(problema);
    if (problema) return;
    const texto = pedido === 'admissao' ? textoDaAdmissao(admissao) : pedido === 'ferias' ? textoDasFerias(ferias) : textoDaDemissao(demissao);
    setEnviando(true);
    try {
      const id = await repoAreaCliente.abrirChamado(token, { tipo: pedido, texto });
      if (!id) { toast('Não deu para mandar o pedido. Tente de novo.'); return; }
      setRecibo({ titulo: texto.split('\n')[0], id });
      setPedido(null);
    } finally { setEnviando(false); }
  }

  const empregados = [...area.empregados].sort((a, b) => a.nome.localeCompare(b.nome));
  return {
    empregados, total: area.empregados.length, nomes: area.empregados.map(e => e.nome).sort(),
    pedido, abrir, fechar: () => setPedido(null), erro, enviando, enviar,
    admissao, mudarAdmissao: (m: Partial<PedidoDeAdmissao>) => setAdmissao(a => ({ ...a, ...m })),
    ferias, mudarFerias: (m: Partial<PedidoDeFerias>) => setFerias(a => ({ ...a, ...m })),
    demissao, mudarDemissao: (m: Partial<PedidoDeDemissao>) => setDemissao(a => ({ ...a, ...m })),
    recibo, fecharRecibo: () => setRecibo(null), verChamados: () => irPara('chamados'),
    rotuloDasFerias: (e: Empregado) => e.ferias === 'em ferias' && e.retornoEm ? 'De férias, volta em ' + dataBr(e.retornoEm) : ROTULO_DAS_FERIAS[e.ferias],
    dataBr, reais: formatos.reais,
  };
}
