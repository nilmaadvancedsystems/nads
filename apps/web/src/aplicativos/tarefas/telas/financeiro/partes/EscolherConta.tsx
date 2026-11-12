// A conta do plano de contas nas janelas do Financeiro (Vitor, 12/11/2026: "deixe nosso dropdown padrão, tá muito feia
// essa selecao de contas"; depois "tá meio feio, melhora isso"): o MenuSuspenso no lugar da lista do navegador, com a
// largura do campo, a busca no topo (código ou nome), as contas agrupadas pelo tipo (Ativo, Passivo…) com o código em
// cinza à esquerda e o ✓ na escolhida. Por cima da janela (flutuante: a janela corta) e com rolagem dentro.
import { financeiro } from '@nads/core';
import { Icone, MenuSuspenso } from '@nads/ui';
import { Fragment, useLayoutEffect, useRef, useState } from 'react';

type ContaDaLista = Pick<financeiro.ContaDoPlano, 'id' | 'codigo' | 'descricao' | 'tipo'>;

interface Props {
  valor: string;
  contas: readonly ContaDaLista[];
  onEscolher: (id: string) => void;
  titulo: string;
  /** o item de não escolher nenhuma */
  vazio?: string;
  travada?: boolean;
  /** a classe do botão */
  className?: string;
  /** a classe a mais da caixa em volta (a largura do campo, quando não é a linha toda) */
  caixa?: string;
}

export function EscolherConta({ valor, contas, onEscolher, titulo, vazio = 'Sem conta', travada, className = 'btn btn-ghost registro-escolha', caixa = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [largura, setLargura] = useState(360);
  // o menu com a largura do campo (e nunca estreito demais para ler o nome da conta)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(300, el.offsetWidth));
    medir();
    const obs = typeof ResizeObserver === 'function' ? new ResizeObserver(medir) : null;
    obs?.observe(el);
    return () => obs?.disconnect();
  }, []);
  const atual = contas.find(c => c.id === valor);
  return (
    <div ref={ref} className={'fin-escolher-conta' + (caixa ? ' ' + caixa : '')}>
      <MenuSuspenso rotulo={atual ? atual.codigo + ' · ' + atual.descricao : vazio} className={className + (atual ? '' : ' vazio')} titulo={titulo}
        flutuante largura={largura}
        conteudo={fechar => <ListaDeContas valor={atual ? valor : ''} contas={contas} vazio={vazio} travada={travada} escolher={id => { fechar(); onEscolher(id); }} />} />
    </div>
  );
}

/** O que abre: a busca e as contas por tipo (a busca recomeça a cada vez que abre). */
function ListaDeContas({ valor, contas, vazio, travada, escolher }: { valor: string; contas: readonly ContaDaLista[]; vazio: string; travada?: boolean; escolher: (id: string) => void }) {
  const [busca, setBusca] = useState('');
  const q = busca.trim().toLowerCase();
  const achadas = contas.filter(c => !q || c.codigo.toLowerCase().startsWith(q) || c.descricao.toLowerCase().includes(q));
  const grupos = financeiro.TIPOS_DE_CONTA.map(t => ({ rotulo: t.rotulo, contas: achadas.filter(c => c.tipo === t.valor) })).filter(g => g.contas.length);
  const item = (id: string, texto: string, codigo?: string) => (
    <button key={id || 'vazio'} type="button" className="popover-item" role="menuitem" disabled={travada} onClick={() => escolher(id)}>
      <span className="popover-marca">{valor === id && <Icone nome="check" />}</span>
      {codigo !== undefined && <span className="fin-escolher-conta-codigo">{codigo}</span>}
      <span className="popover-texto">{texto}</span>
    </button>
  );
  return (
    <>
      <label className="busca-curta larga">
        <Icone nome="search" />
        <input type="text" autoFocus placeholder="Buscar pelo código ou nome" aria-label="Buscar conta" value={busca} onChange={e => setBusca(e.target.value)}
          // Enter escolhe a primeira que sobrou
          onKeyDown={e => { const primeira = grupos[0]?.contas[0]; if (e.key === 'Enter' && primeira && !travada) { e.preventDefault(); escolher(primeira.id); } }} />
      </label>
      <div className="fin-escolher-conta-lista">
        {!q && item('', vazio)}
        {grupos.map(g => (
          <Fragment key={g.rotulo}>
            <div className="popover-label">{g.rotulo}</div>
            {g.contas.map(c => item(c.id, c.descricao, c.codigo))}
          </Fragment>
        ))}
        {q && !grupos.length && <div className="popover-label">Nenhuma conta com "{busca.trim()}"</div>}
      </div>
    </>
  );
}
