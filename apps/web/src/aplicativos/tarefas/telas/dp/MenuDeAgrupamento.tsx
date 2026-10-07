// O agrupamento do cliente no menu suspenso padrão (Vitor, 07/10/2026: "a opção de criar o agrupamento digitando"), como
// o MenuDeConta do Creditor: aberto, a busca e os agrupamentos que já existem; digitou um que não existe: o Criar.
import { Icone, MenuSuspenso } from '@nads/ui';
import { useRef, useState } from 'react';

export function MenuDeAgrupamento({ valor, agrupamentos, onEscolher }: { valor: string; agrupamentos: readonly string[]; onEscolher: (v: string) => void }) {
  const [busca, setBusca] = useState('');
  const campo = useRef<HTMLInputElement>(null);
  const q = busca.trim();
  const achados = q ? agrupamentos.filter(a => a.toLowerCase().includes(q.toLowerCase())) : agrupamentos;
  const novo = q && !agrupamentos.some(a => a.toLowerCase() === q.toLowerCase()) ? q : '';
  const escolher = (fechar: () => void, v: string) => { fechar(); setBusca(''); if (v !== valor) onEscolher(v); };
  return (
    <MenuSuspenso rotulo={valor || 'Sem agrupamento'} className="btn btn-outline" titulo="Agrupamento" direita largura={280}
      conteudo={fechar => (
        <>
          <label className="busca-curta">
            <Icone nome="search" />
            <input ref={campo} type="text" placeholder="Buscar ou criar agrupamento" aria-label="Buscar ou criar agrupamento" value={busca} autoFocus
              onChange={e => setBusca(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (novo || achados[0])) escolher(fechar, novo || achados[0]); }} />
          </label>
          {/* o Criar sempre à vista (Vitor, 07/10/2026: "cadê a opção de criação?"): sem nada digitado, leva ao campo */}
          {!q && (
            <button type="button" className="popover-item" role="menuitem" onClick={() => campo.current?.focus()}>
              <span className="popover-marca" /><Icone nome="plus" /><span className="popover-texto">Criar agrupamento</span>
            </button>
          )}
          {novo && (
            <button type="button" className="popover-item" role="menuitem" onClick={() => escolher(fechar, novo)}>
              <span className="popover-marca" /><Icone nome="plus" /><span className="popover-texto">Criar “{novo}”</span>
            </button>
          )}
          {achados.map(a => (
            <button key={a} type="button" className="popover-item" role="menuitem" onClick={() => escolher(fechar, a)}>
              <span className="popover-marca">{a === valor && <Icone nome="check" />}</span><span className="popover-texto">{a}</span>
            </button>
          ))}
          {valor && !q && (
            <>
              <hr className="popover-sep" />
              <button type="button" className="popover-item" role="menuitem" onClick={() => escolher(fechar, '')}>
                <span className="popover-marca" /><span className="popover-texto">Sem agrupamento</span>
              </button>
            </>
          )}
        </>
      )} />
  );
}
