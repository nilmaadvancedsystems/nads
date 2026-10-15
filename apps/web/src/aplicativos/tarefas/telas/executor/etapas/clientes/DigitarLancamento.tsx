// Digitar o lançamento à mão (Vitor, 08/10/2026: "dê a opção de digitar manualmente e preencher caso não queira upar o
// razão: adicionar lançamento, com os parâmetros que estabelecemos"): os mesmos campos da relação do razão — a data, a
// nota fiscal, a descrição, o valor e o que é (em aberto, apenas pagamento ou devolução). Abre embaixo da linha do
// cliente; o "Adicionar" põe o lançamento na relação (e no que vai ser questionado). Só peças do catálogo: os campos com
// o nome em cima, a data com a máscara (CampoData), o MenuSuspenso e os botões, numa linha alinhada.
import type { clientes as cl } from '@nads/core';
import { CampoData, Icone, MenuSuspenso } from '@nads/ui';
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

/** O nome do campo em cima dele (a mesma altura para todos: tudo na mesma linha). */
const ROTULO: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink-muted)', marginBottom: 4 };

export function DigitarLancamento({ nome, onAdicionar, onFechar }: {
  nome: string; onAdicionar: (l: cl.LancamentoDigitado) => void; onFechar: () => void;
}) {
  const [data, setData] = useState('');
  const [nf, setNf] = useState('');
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [status, setStatus] = useState<cl.StatusDoItem>('aberto');
  const v = valorDigitado(valor);
  // a data digitada dd/mm/aaaa (a máscara do catálogo) → aaaa-mm-dd
  const m = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = m ? m[3] + '-' + m[2] + '-' + m[1] : '';
  const pode = !!iso && v > 0;
  const adicionar = () => {
    if (!pode) return;
    onAdicionar({ data: iso, nf, descricao, valor: v, status });
    setNf(''); setDescricao(''); setValor('');
  };
  const enter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') adicionar(); if (e.key === 'Escape') onFechar(); };
  // tudo numa linha, alinhado pelo pé: cada campo com o nome em cima (Vitor, 15/10/2026: "tá feio demais, tudo torto")
  return (
    <div role="group" aria-label={'Digitar um lançamento de ' + nome}
      style={{ display: 'grid', gridTemplateColumns: '130px 130px minmax(160px, 1fr) 130px auto auto auto', gap: 12, alignItems: 'end', padding: '8px 0' }}>
      <label><span style={ROTULO}>Data</span>
        <CampoData valor={data} onMudar={setData} rotulo="Data" onEnter={adicionar} />
      </label>
      <label><span style={ROTULO}>Nota fiscal</span>
        <input type="text" inputMode="numeric" placeholder="Sem nota: vazio" value={nf} onChange={e => setNf(e.target.value)} onKeyDown={enter} />
      </label>
      <label><span style={ROTULO}>Descrição</span>
        <input type="text" placeholder="Vazio: vai o tipo" value={descricao} onChange={e => setDescricao(e.target.value)} onKeyDown={enter} />
      </label>
      <label><span style={ROTULO}>Valor (R$)</span>
        <input type="text" inputMode="decimal" placeholder="0,00" value={valor} onChange={e => setValor(e.target.value)} onKeyDown={enter} style={{ textAlign: 'right' }} />
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
