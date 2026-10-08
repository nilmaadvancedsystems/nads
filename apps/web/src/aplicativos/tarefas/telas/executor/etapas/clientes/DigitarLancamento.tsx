// Digitar o lançamento à mão (Vitor, 08/10/2026: "dê a opção de digitar manualmente e preencher caso não queira upar o
// razão: adicionar lançamento, com os parâmetros que estabelecemos"): os mesmos campos da relação do razão — a data, a
// nota fiscal, a descrição, o valor e o que é (em aberto, apenas pagamento ou devolução). Abre embaixo da linha do
// cliente; o "Adicionar" põe o lançamento na relação (e no que vai ser questionado). Só peças do catálogo: os campos da
// barra (busca-curta), o MenuSuspenso e os botões.
import type { clientes as cl } from '@nads/core';
import { Icone, MenuSuspenso } from '@nads/ui';
import { useState } from 'react';

const TIPOS: { valor: cl.StatusDoItem; rotulo: string }[] = [
  { valor: 'aberto', rotulo: 'Em aberto' },
  { valor: 'pagamento', rotulo: 'Apenas pagamento' },
  { valor: 'devolucao', rotulo: 'Devolução' },
];

/** "1.234,56", "1234,56" ou "1234.56" → número (0 = inválido). */
function valorDigitado(t: string): number {
  const s = t.trim().replace(/^R\$\s*/i, '');
  const n = /,\d{1,2}$/.test(s) ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s.replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
}

export function DigitarLancamento({ nome, onAdicionar, onFechar }: {
  nome: string; onAdicionar: (l: cl.LancamentoDigitado) => void; onFechar: () => void;
}) {
  const [data, setData] = useState('');
  const [nf, setNf] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [status, setStatus] = useState<cl.StatusDoItem>('aberto');
  const v = valorDigitado(valor);
  const pode = /^\d{4}-\d{2}-\d{2}$/.test(data) && v > 0;
  const adicionar = () => {
    if (!pode) return;
    onAdicionar({ data, nf, descricao, valor: v, status });
    setNf(''); setDescricao(''); setValor('');
  };
  const enter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') adicionar(); if (e.key === 'Escape') onFechar(); };
  return (
    <div className="tarefas-barra-topo" style={{ flexWrap: 'wrap', gap: 8 }} role="group" aria-label={'Digitar um lançamento de ' + nome}>
      <label className="busca-curta" title="A data do lançamento">
        <Icone nome="calendar" />
        <input type="date" aria-label="Data" value={data} onChange={e => setData(e.target.value)} onKeyDown={enter} autoFocus />
      </label>
      <label className="busca-curta" title="A nota fiscal (sem nota, deixe em branco)">
        <Icone nome="hash" />
        <input type="text" inputMode="numeric" aria-label="Nota fiscal" placeholder="Nota fiscal" value={nf} onChange={e => setNf(e.target.value)} onKeyDown={enter} />
      </label>
      <label className="busca-curta" title="A descrição (sem nada, vai o tipo)">
        <Icone nome="lapis" />
        <input type="text" aria-label="Descrição" placeholder="Descrição" value={descricao} onChange={e => setDescricao(e.target.value)} onKeyDown={enter} />
      </label>
      <label className="busca-curta" title="O valor, em reais">
        <span aria-hidden="true">R$</span>
        <input type="text" inputMode="decimal" aria-label="Valor" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} onKeyDown={enter} />
      </label>
      <MenuSuspenso rotulo={TIPOS.find(t => t.valor === status)?.rotulo} className="btn btn-outline" dica="O que é o lançamento"
        itens={TIPOS.map(t => ({ rotulo: t.rotulo, marcado: t.valor === status, onClick: () => setStatus(t.valor) }))} />
      <button type="button" className="btn btn-primary" disabled={!pode} onClick={adicionar}
        title={pode ? 'Pôr o lançamento na relação (já vai para o questionar)' : 'Preencha a data e o valor'}>
        <Icone nome="plus" />Adicionar
      </button>
      <button type="button" className="btn" onClick={onFechar}>Fechar</button>
    </div>
  );
}
