// Um filtro da barra do DP no padrão do resto do app (revisão da UI, 16/10/2026: "os 8 <select> com rótulo passam para
// menus suspensos numa linha, com a busca de lupa"): o MenuSuspenso do catálogo com o nome do filtro; escolhido, mostra
// "Nome: valor" e fica marcado (o .ativo da Situação da Minhas empresas). "Todos" volta ao vazio.
import { MenuSuspenso } from '@nads/ui';

type Opcao = string | { valor: string; rotulo: string };

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
