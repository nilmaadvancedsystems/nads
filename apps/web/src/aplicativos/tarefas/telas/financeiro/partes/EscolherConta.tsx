// A conta do plano de contas nas janelas do Financeiro (Vitor, 12/11/2026: "deixe nosso dropdown padrão, tá muito feia
// essa selecao de contas"): o MenuSuspenso no lugar da lista do navegador, por cima da janela (flutuante: a janela corta)
import { MenuSuspenso } from '@nads/ui';

interface ContaDaLista { id: string; codigo: string; descricao: string }

export function EscolherConta({ valor, contas, onEscolher, titulo, vazio = 'Sem conta', travada, className = 'btn btn-ghost registro-escolha' }: {
  valor: string;
  contas: readonly ContaDaLista[];
  onEscolher: (id: string) => void;
  titulo: string;
  /** o item de não escolher nenhuma */
  vazio?: string;
  travada?: boolean;
  className?: string;
}) {
  const nome = (c: ContaDaLista) => c.codigo + ' · ' + c.descricao;
  const atual = contas.find(c => c.id === valor);
  return (
    <MenuSuspenso rotulo={atual ? nome(atual) : vazio} className={className + (atual ? '' : ' vazio')} titulo={titulo} flutuante largura={360}
      itens={[
        { rotulo: vazio, marcado: !atual, desabilitado: travada, onClick: () => onEscolher('') },
        ...contas.map(c => ({ rotulo: nome(c), marcado: c.id === valor, desabilitado: travada, onClick: () => onEscolher(c.id) })),
      ]} />
  );
}
