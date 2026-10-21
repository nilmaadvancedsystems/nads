// ViewModel de Cadastro › a empresa › Fiscal › Parcelamentos (Heverton, 20/10/2026: "Parcelamento (inserir dados)"): os
// parcelamentos da empresa (os mesmos da página Parcelamentos do Entregas; o robô marca a parcela paga pelo comprovante),
// com o órgão, a modalidade, o número, as parcelas pagas, o valor, o vencimento e a próxima; cadastrar e editar. A
// empresa do nads chega ao cliente do Entregas pelo código.
import { entregas as e } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { empresaDaRota } from '../../../../../comum/empresaDaRota';
import { useGmailDoEntregas, useParcelamentos } from '../../../dados/repo';

const VAZIO: e.ParcelamentoDigitado = { orgao: 'simples', modalidade: '', numero: '', parcelas: '', primeira: '', valor: '', dia: 'util', obs: '' };
const brl = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mmaaaa = (c: string) => (/^\d{4}-\d{2}$/.test(c) ? c.slice(5) + '/' + c.slice(0, 4) : c);

export function useParcelamentosDaEmpresa(rota: string) {
  const empresa = empresaDaRota(rota);
  const repo = useParcelamentos();
  const gmail = useGmailDoEntregas();
  const { toast } = useRetorno();
  const clientes = gmail.clientes();
  const cliente = empresa?.codigo != null ? clientes.lista.find(c => Number(c.codigo) === empresa.codigo) || null : null;
  const lidos = cliente ? repo.doCliente(cliente.id) : null;
  // a janela de cadastrar ou editar (null = fechada; '' = novo)
  const [editando, setEditando] = useState<string | null>(null);
  const [form, setForm] = useState<e.ParcelamentoDigitado>(VAZIO);
  const [erro, setErro] = useState('');
  const [gravando, setGravando] = useState(false);
  const rotuloDoOrgao = (o: string) => e.ORGAOS_DO_PARCELAMENTO.find(x => x.id === o)?.rotulo || o;
  return {
    exemplos: repo.exemplos,
    carregando: !clientes.carregados || (!!lidos && !lidos.carregados),
    /** a empresa não está no Entregas (o parcelamento mora lá) */
    semCliente: clientes.carregados && !cliente,
    erroDeLeitura: lidos?.erro || '',
    linhas: (lidos?.lista || []).map(p => {
      const prox = e.proximaParcela(p);
      return {
        id: p.id, orgao: rotuloDoOrgao(p.orgao), modalidade: p.modalidade, numero: p.numero,
        parcelas: p.pagas.length + ' de ' + p.parcelas + ' pagas', valor: 'R$ ' + brl(p.valorParcela),
        vencimento: p.dia === 'util' ? 'Último dia útil' : 'Dia ' + p.dia,
        proxima: prox ? prox.numero + 'ª · ' + prox.vencimento : '',
        situacao: e.SITUACOES_DO_PARCELAMENTO.find(s => s.id === p.status)?.rotulo || p.status,
        aberto: p.aberto,
        primeira: mmaaaa(p.primeira),
      };
    }),
    orgaos: e.ORGAOS_DO_PARCELAMENTO.map(o => ({ valor: o.id as string, rotulo: o.rotulo })),
    situacoes: e.SITUACOES_DO_PARCELAMENTO.map(s => ({ valor: s.id as string, rotulo: s.rotulo })),
    editando, form, erro, gravando,
    mudar: (m: Partial<e.ParcelamentoDigitado>) => { setForm(f => ({ ...f, ...m })); setErro(''); },
    novo: () => { setForm(VAZIO); setErro(''); setEditando(''); },
    editar(id: string) {
      const p = lidos?.lista.find(x => x.id === id);
      if (!p) return;
      setForm({ orgao: p.orgao, modalidade: p.modalidade, numero: p.numero, parcelas: String(p.parcelas), primeira: mmaaaa(p.primeira), valor: brl(p.valorParcela), dia: p.dia === 'util' ? 'util' : String(p.dia), obs: p.obs, status: p.status });
      setErro('');
      setEditando(id);
    },
    fechar: () => setEditando(null),
    async gravar() {
      if (!cliente || editando == null || gravando) return;
      const r = e.camposDoParcelamento(form);
      if ('erro' in r) { setErro(r.erro); return; }
      setGravando(true);
      try {
        if (editando) await repo.salvar(editando, r.campos);
        else await repo.criar(cliente.id, cliente.nome, r.campos);
        toast(editando ? 'Parcelamento salvo.' : 'Parcelamento cadastrado.');
        setEditando(null);
      } catch (err) { setErro('Não gravou: ' + (err instanceof Error ? err.message : String(err))); } finally { setGravando(false); }
    },
  };
}
