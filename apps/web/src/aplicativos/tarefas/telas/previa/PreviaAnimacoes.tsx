// Prévia das animações (/tarefas/previa/animacoes): os três jeitos de animar o app (marca, viva, suave) com as peças
// de verdade — janela, aviso, menu, gaveta, lista, página, alerta e o toque nos botões. Escolher um jeito já vale para
// o app todo neste navegador (fica guardado); o escolhido de vez vira o padrão no código.
// Não pede login: só mostra as animações (os dados são de mentira).
import { Icone, JEITOS, jeitoAtual, definirJeito, MenuSuspenso, sairComo, useEntradaAnimada, useRetorno, type Jeito } from '@nads/ui';
import { useRef, useState } from 'react';

const LINHAS = [
  ['58', 'TORNEARIA SÃO JOSÉ LTDA', 'Contábil', 'Hoje 09:12'],
  ['112', 'FITO ALIMENTOS LTDA', 'Fiscal', 'Hoje 08:40'],
  ['7', 'PADARIA BOM PÃO', 'Contábil', 'Ontem'],
  ['301', 'AUTO PEÇAS CENTRAL', 'Fiscal', 'Ontem'],
  ['44', 'CLÍNICA VIDA SAUDÁVEL', 'Contábil', '29/09'],
  ['89', 'MERCADO DO BAIRRO', 'Fiscal', '28/09'],
];

export function PreviaAnimacoes() {
  const [jeito, setJeito] = useState<Jeito>(jeitoAtual);
  const [vezLista, setVezLista] = useState(0);
  const [vezPagina, setVezPagina] = useState(0);
  const [gaveta, setGaveta] = useState(false);
  const [alerta, setAlerta] = useState(0);
  const { toast, modal } = useRetorno();
  const gavetaEl = useRef<HTMLElement>(null);
  const fundoEl = useRef<HTMLDivElement>(null);
  const lista = useEntradaAnimada<HTMLDivElement>('tbody > tr', [vezLista, jeito], 'lista');
  const pagina = useEntradaAnimada<HTMLDivElement>(null, [vezPagina, jeito], 'pagina');

  const escolher = (j: Jeito) => { definirJeito(j); setJeito(j); };
  const fecharGaveta = () => {
    if (fundoEl.current) void sairComo('fundo', fundoEl.current);
    if (gavetaEl.current) void sairComo('gaveta', gavetaEl.current).then(() => setGaveta(false));
  };
  const janela = () => void modal({ titulo: 'Enviar para o Claudio Secretário?', texto: 'O arquivo vai para a pasta dele e entra na próxima rodada de arquivamento.', icone: 'arquivo',
    botoes: [{ rotulo: 'Enviar', valor: true, variante: 'btn-primary' }, { rotulo: 'Cancelar', valor: false }] });
  const sucesso = () => void modal({ titulo: 'Pronto!', texto: 'Os extratos foram conferidos.', tom: 'ok', icone: 'check',
    botoes: [{ rotulo: 'Ok', valor: true, variante: 'btn-primary' }], fecharEm: { ms: 3500, valor: true } });
  const tudo = () => {
    setVezPagina(v => v + 1);
    setTimeout(() => setVezLista(v => v + 1), 300);
    setTimeout(() => setAlerta(v => v + 1), 700);
    setTimeout(() => toast('Mapa do Drive atualizado.'), 1100);
  };

  return (
    <div className="previa-anim">
      <header className="previa-anim-topo">
        <h1>Prévia das animações</h1>
        <p className="fraco">Escolha um jeito: ele já passa a valer no app todo, neste navegador. Depois me diga qual fica de vez.</p>
        <div className="previa-anim-jeitos" role="radiogroup" aria-label="Jeito de animar">
          {JEITOS.map(j => (
            <button key={j.id} type="button" role="radio" aria-checked={jeito === j.id} className={'card previa-anim-jeito' + (jeito === j.id ? ' on' : '')} onClick={() => escolher(j.id)}>
              <b>{j.nome}{jeito === j.id && <Icone nome="check" />}</b>
              <span className="fraco">{j.dica}</span>
            </button>
          ))}
        </div>
        <div className="previa-anim-botoes">
          <button type="button" className="btn btn-primary" onClick={tudo}><Icone nome="play" />Ver tudo</button>
          <button type="button" className="btn btn-outline" onClick={janela}>Janela</button>
          <button type="button" className="btn btn-outline" onClick={sucesso}>Sucesso</button>
          <button type="button" className="btn btn-outline" onClick={() => toast('Arquivo enviado para o Claudio Secretário.')}>Aviso</button>
          <MenuSuspenso rotulo="Menu" itens={[{ rotulo: 'Abrir', onClick: () => {} }, { rotulo: 'Baixar', onClick: () => {} }, { rotulo: 'Copiar caminho', onClick: () => {} }, { rotulo: 'Propriedades', onClick: () => {} }]} />
          <button type="button" className="btn btn-outline" onClick={() => setGaveta(true)}>Gaveta ☰</button>
          <button type="button" className="btn btn-outline" onClick={() => setVezLista(v => v + 1)}>Lista</button>
          <button type="button" className="btn btn-outline" onClick={() => setVezPagina(v => v + 1)}>Página</button>
          <button type="button" className="btn btn-outline" onClick={() => setAlerta(v => v + 1)}>Alerta</button>
        </div>
      </header>

      <div ref={pagina} className="card previa-anim-pagina">
        <h3>Uma página</h3>
        <p className="fraco">É assim que o conteúdo chega quando você troca de página ou de etapa.</p>
        {alerta > 0 && (
          <div key={alerta} className="alert"><Icone nome="alert" /><div><p className="alert-text">O robô terminou de ler a caixa do contábil.</p></div></div>
        )}
        <div ref={lista} className="table-wrap">
          <table className="tabela-empresas">
            <thead><tr><th>Código</th><th>Empresa</th><th>Setor</th><th>Atualizado</th></tr></thead>
            <tbody>
              {LINHAS.map(l => <tr key={l[0]}><td className="num">{l[0]}</td><td>{l[1]}</td><td>{l[2]}</td><td className="fraco">{l[3]}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {gaveta && <div ref={fundoEl} className="drawer-overlay" onClick={fecharGaveta} />}
      {gaveta && (
        <aside ref={gavetaEl} className="drawer" aria-label="Menu">
          <div className="drawer-head">
            <b>Menu</b>
            <button className="drawer-x" type="button" aria-label="Fechar menu" onClick={fecharGaveta}><Icone nome="x" /></button>
          </div>
          {['Início', 'Tarefas', 'Extratudo', 'Concilia aí', 'Conciliadorzinho'].map(n => (
            <button key={n} className="drawer-item" type="button" onClick={fecharGaveta}><Icone nome="home" />{n}</button>
          ))}
        </aside>
      )}
    </div>
  );
}
