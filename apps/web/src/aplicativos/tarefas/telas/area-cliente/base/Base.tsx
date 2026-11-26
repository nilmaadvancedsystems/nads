// As peças comuns do módulo Área do Cliente refeito (26/11/2026: "quero que esse modulo seja completamente refeito… o mais
// bonito e de facil entendimento possivel"). Só peças do catálogo do nads (26/11/2026: "essas telas que voce esta fazendo
// ta toda fora dos elementos predefinidos do nads"): a janela grande é a da empresa do Cadastro (cad-janela), a pequena é
// o modal de sempre, os selos são os badge e a lista vazia é o Vazio. Só desenham.
import './area.css';
import { Alerta, BotaoFechar, Icone, useJanela, type NomeIcone } from '@nads/ui';
import { useEffect, useRef, type ReactNode } from 'react';

/** O aviso dos dados de exemplo e o erro de leitura, sempre no mesmo lugar. */
export function AvisosDaArea({ exemplos, erro, oQue }: { exemplos?: boolean; erro?: string; oQue: string }) {
  return (
    <>
      {exemplos && <div className="alerta-linha"><Alerta titulo="Dados de exemplo" texto="Nada aqui é de verdade e nada é gravado no banco." /></div>}
      {erro && <div className="alerta-linha"><Alerta titulo={'O banco não deixou ler ' + oQue} texto={erro} /></div>}
    </>
  );
}

/** O tom do selo nos badge do nads. */
export type TomDoSelo = 'ok' | 'aviso' | 'perigo' | 'neutro' | 'conferido';
const CLASSE_DO_SELO: Record<TomDoSelo, string> = { ok: 'badge badge-ok', aviso: 'badge badge-warn', perigo: 'badge badge-bad', neutro: 'badge badge-neutral', conferido: 'badge badge-conferido' };
export function Selo({ tom, children, title }: { tom: TomDoSelo; children: ReactNode; title?: string }) {
  return <span className={CLASSE_DO_SELO[tom]} title={title}>{children}</span>;
}

/** A empresa na tabela: o código em negrito e o nome (a regra da tabela padrão). */
export function EmpresaDaLinha({ codigo, nome }: { codigo: number | string | null | undefined; nome: string }) {
  return <>{codigo != null && codigo !== '' && <b className="num">{codigo}</b>}{codigo != null && codigo !== '' ? ' · ' : ''}{nome}</>;
}

/**
 * A janela grande, no layout da janela da empresa do Cadastro (cad-janela): no meio da tela, a página aparecendo ao fundo
 * (26/11/2026: "faz o chat no meio da tela ou deixe a tela aparecendo de fundo"). Com abas, elas ficam à esquerda.
 */
export function JanelaGrande<T extends string>({ codigo, titulo, selo, abas, aba, onAba, onFechar, rotulo, children }: {
  codigo?: number | string | null; titulo: string; selo?: ReactNode;
  abas?: readonly { id: T; rotulo: string; icone: NomeIcone; conta?: number }[]; aba?: T; onAba?: (id: T) => void;
  onFechar: () => void; rotulo?: string; children: ReactNode;
}) {
  // a página de trás não rola com a janela aberta (como a do Cadastro)
  useEffect(() => {
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = antes; };
  }, []);
  const janela = useRef<HTMLDivElement>(null);
  useJanela(janela, onFechar);
  return (
    <div className="cad-janela-fundo" onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div ref={janela} className={'cad-janela' + (abas ? '' : ' area-janela-sem-abas')} role="dialog" aria-modal="true" aria-label={rotulo || titulo}>
        <header className="cad-janela-topo">
          <span className="cad-janela-empresa">
            {codigo != null && codigo !== '' && <b className="num">{codigo}</b>}
            <span className="cad-janela-nome">{titulo}</span>
            {selo}
          </span>
          <BotaoFechar onClick={onFechar} />
        </header>
        <div className="cad-janela-corpo">
          {abas && (
            <nav className="cad-janela-abas" aria-label="Abas">
              {abas.map(a => (
                <button key={a.id} type="button" className={'cad-janela-aba' + (a.id === aba ? ' ativa' : '')} aria-current={a.id === aba ? 'page' : undefined} onClick={() => onAba?.(a.id)}>
                  <Icone nome={a.icone} width={16} height={16} />{a.rotulo}
                  {!!a.conta && <span className="cad-janela-pendente">{a.conta}</span>}
                </button>
              ))}
            </nav>
          )}
          <div className="cad-janela-conteudo">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** A janela pequena das ações (enviar, recusar): o modal de sempre, com o título, o corpo e os botões embaixo. */
export function JanelaPequena({ titulo, sub, rodape, onFechar, larga, children }: {
  titulo: string; sub?: ReactNode; rodape?: ReactNode; onFechar: () => void; larga?: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useJanela(ref, onFechar);
  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onFechar(); }}>
      <div ref={ref} className={'modal area-modal' + (larga ? ' larga' : '')} role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="area-modal-topo">
          <div className="area-modal-titulo"><b>{titulo}</b>{sub && <span className="hint">{sub}</span>}</div>
          <BotaoFechar onClick={onFechar} />
        </header>
        <div className="area-modal-corpo">{children}</div>
        {rodape && <footer className="area-modal-rodape">{rodape}</footer>}
      </div>
    </div>
  );
}
