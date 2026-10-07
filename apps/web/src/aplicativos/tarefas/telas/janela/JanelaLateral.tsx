// A janela flutuante com painéis laterais, no desenho da Minha página (o Notion): à esquerda um resumo e os tópicos, à
// direita o tópico escolhido (o título, o ×, o conteúdo que rola e um pé opcional). Fecha no ×, no Esc e clicando fora.
// Usada em Cadastro › Usuários (a pessoa e o novo usuário) e no Drive (o Arquivar agora). Linha e Cartao: os cartões
// com uma opção por linha (o rótulo e a explicação à esquerda, o controle à direita).
import { Icone, type NomeIcone } from '@nads/ui';
import { useEffect, type ReactNode } from 'react';

export interface TopicoDaJanela<T extends string> { id: T; rotulo: string; icone: NomeIcone; alerta?: boolean; contador?: number; /** no lugar do ícone (a foto da pessoa) */ foto?: ReactNode }

export function Linha({ rotulo, dica, children }: { rotulo: ReactNode; dica?: ReactNode; children?: ReactNode }) {
  return (
    <div className="pessoal-linha">
      <div className="pessoal-linha-texto"><b>{rotulo}</b>{dica && <span className="fraco">{dica}</span>}</div>
      {children != null && <div className="pessoal-linha-controle">{children}</div>}
    </div>
  );
}

export function Cartao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <section className="card pessoal-cartao"><div className="card-head"><h3>{titulo}</h3></div>{children}</section>;
}

export function JanelaLateral<T extends string>({ rotulo, resumo, topicos, topico, mudar, pe, fechar, classe, children }: {
  rotulo: string; resumo: ReactNode; topicos: TopicoDaJanela<T>[]; topico: T; mudar: (t: T) => void; pe?: ReactNode; fechar: () => void;
  classe?: string; children: ReactNode;
}) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [fechar]);
  const atual = topicos.find(t => t.id === topico) || topicos[0];
  return (
    <div className="modal-overlay pessoal-fundo" onMouseDown={e => { if (e.target === e.currentTarget) fechar(); }}>
      <div className={'pessoal-janela usuario-janela' + (classe ? ' ' + classe : '')} role="dialog" aria-modal="true" aria-label={rotulo}>
        <aside className="pessoal-lado usuario-lado">
          {resumo}
          <nav aria-label="Tópicos">
            {topicos.map(t => (
              <button key={t.id} type="button" className={'pessoal-topico' + (t.id === topico ? ' ativo' : '')} aria-current={t.id === topico ? 'page' : undefined} onClick={() => mudar(t.id)}>
                {t.foto ?? <Icone nome={t.icone} />}{t.rotulo}
                {t.contador != null && t.contador > 0 && <span className="gh-counter">{t.contador}</span>}
                {t.alerta && <span className="usuario-topico-alerta" aria-label="falta preencher" />}
              </button>
            ))}
          </nav>
        </aside>
        <section className="pessoal-conteudo">
          <header className="pessoal-topo">
            <h2>{atual.rotulo}</h2>
            <button type="button" className="drawer-x" aria-label="Fechar" onClick={fechar}><Icone nome="x" /></button>
          </header>
          <div className="pessoal-rola">{children}</div>
          {pe && <footer className="usuario-pe">{pe}</footer>}
        </section>
      </div>
    </div>
  );
}
