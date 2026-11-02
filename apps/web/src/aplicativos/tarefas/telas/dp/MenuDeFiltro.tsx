// Um filtro da barra do DP no padrão do resto do app (revisão da UI, 16/10/2026: "os 8 <select> com rótulo passam para
// menus suspensos numa linha, com a busca de lupa"): o MenuSuspenso do catálogo com o nome do filtro; escolhido, mostra
// "Nome: valor" e fica marcado (o .ativo da Situação da Minhas empresas). "Todos" volta ao vazio.
import { Icone, MenuSuspenso } from '@nads/ui';

type Opcao = string | { valor: string; rotulo: string };

/**
 * O mesmo filtro, com mais de uma escolha (29/10/2026: "tenha como selecionar mais de um filtro"): marca e desmarca cada
 * opção com o ✓ e o menu continua aberto; "Todos" limpa. Escolhido um só, mostra "Nome: valor"; mais de um, "Nome: 2 escolhidos".
 */
export function MenuDeFiltroVarios({ rotulo, valores, mudar, opcoes, todos = 'Todos' }: {
  rotulo: string; valores: readonly string[]; mudar: (v: string[]) => void; opcoes: readonly Opcao[];
  /** o texto da opção vazia (ex.: "Todas as partes") */
  todos?: string;
}) {
  const lista = opcoes.map(o => (typeof o === 'string' ? { valor: o, rotulo: o } : o));
  const escolhidos = lista.filter(o => valores.includes(o.valor));
  const texto = escolhidos.length === 0 ? rotulo : escolhidos.length === 1 ? rotulo + ': ' + escolhidos[0].rotulo : rotulo + ': ' + escolhidos.length + ' escolhidos';
  const alternar = (v: string) => mudar(valores.includes(v) ? valores.filter(x => x !== v) : [...valores, v]);
  return (
    <MenuSuspenso rotulo={texto} titulo={rotulo} dica={rotulo + ' (pode escolher mais de um)'}
      className={'btn btn-outline' + (escolhidos.length ? ' ativo' : '')}
      conteudo={() => (
        <>
          <button type="button" role="menuitemcheckbox" aria-checked={!escolhidos.length} className="popover-item" onClick={() => mudar([])}>
            <span className="popover-marca">{!escolhidos.length && <Icone nome="check" />}</span>
            <span className="popover-texto">{todos}</span>
          </button>
          <hr className="popover-sep" />
          {lista.map(o => (
            <button key={o.valor} type="button" role="menuitemcheckbox" aria-checked={valores.includes(o.valor)} className="popover-item" onClick={() => alternar(o.valor)}>
              <span className="popover-marca">{valores.includes(o.valor) && <Icone nome="check" />}</span>
              <span className="popover-texto">{o.rotulo}</span>
            </button>
          ))}
        </>
      )} />
  );
}

export function MenuDeFiltro({ rotulo, valor, mudar, opcoes, todos = 'Todos', direita }: {
  rotulo: string; valor: string; mudar: (v: string) => void; opcoes: readonly Opcao[];
  /** o texto da opção vazia (ex.: "Todas as partes") */
  todos?: string;
  direita?: boolean;
}) {
  const lista = opcoes.map(o => (typeof o === 'string' ? { valor: o, rotulo: o } : o));
  const atual = valor ? lista.find(o => o.valor === valor) : undefined;
  return (
    <MenuSuspenso rotulo={atual ? rotulo + ': ' + atual.rotulo : rotulo} titulo={rotulo} dica={rotulo} direita={direita}
      className={'btn btn-outline' + (atual ? ' ativo' : '')}
      itens={[
        { rotulo: todos, marcado: !atual, onClick: () => mudar('') },
        ...lista.map(o => ({ rotulo: o.rotulo, marcado: o.valor === valor, onClick: () => mudar(o.valor) })),
      ]} />
  );
}
