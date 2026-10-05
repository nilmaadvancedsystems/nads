// A conta do título, no menu suspenso padrão (MN-01; Vitor, 05/10/2026: "faça o dropdown padrão", no lugar da lista do
// navegador): o botão com a conta escolhida e o ▾; aberto, a busca e as contas de clientes do balancete (o código e,
// embaixo, o nome). Digitou um código que não está na lista: o "Usar" grava assim mesmo (fica aprendida).
import { Icone, MenuSuspenso } from '@nads/ui';
import { useState } from 'react';

export function MenuDeConta({ valor, contas, onEscolher }: {
  valor: string;
  contas: readonly { codigo: string; nome: string }[];
  onEscolher: (codigo: string) => void;
}) {
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  const achadas = (q ? contas.filter(c => (c.codigo + ' ' + c.nome).toLowerCase().includes(q)) : contas).slice(0, 80);
  const codigoDigitado = /^\d+$/.test(busca.trim()) && !contas.some(c => c.codigo === busca.trim()) ? busca.trim() : '';
  return (
    <MenuSuspenso rotulo={valor || 'Conta'} className="btn btn-outline" largura={340} dica="Escolher a conta do cliente"
      conteudo={fechar => (
        <>
          <label className="busca-curta">
            <Icone nome="search" />
            <input type="text" placeholder="Buscar conta ou cliente" aria-label="Buscar conta ou cliente" value={busca} autoFocus
              onChange={e => setBusca(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && codigoDigitado) { fechar(); onEscolher(codigoDigitado); setBusca(''); } }} />
          </label>
          {codigoDigitado && (
            <button type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); onEscolher(codigoDigitado); setBusca(''); }}>
              <span className="popover-texto">Usar {codigoDigitado}</span>
            </button>
          )}
          {achadas.map(c => (
            <button key={c.codigo} type="button" className="popover-item" role="menuitem" onClick={() => { fechar(); onEscolher(c.codigo); setBusca(''); }}>
              <span className="popover-texto">{c.codigo}</span>
              <span className="popover-dica">{c.nome}</span>
            </button>
          ))}
          {!achadas.length && !codigoDigitado && <p className="hint">Nenhuma conta com essa busca.</p>}
        </>
      )} />
  );
}
