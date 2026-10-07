// O que perguntar no Mandei (Vitor, 07/10/2026: "como não vamos mais digitar para o cliente… coloque um +, para o usuário
// colocar qual nota ele quer ver o que aconteceu… seja pegando o cliente todo ou uma nota em específico, e que ele veja o
// que está adicionando"). No lugar da observação digitada, com as mesmas peças dela: o balão mostra o que vai (o cliente
// todo ou as notas) e o "+ Perguntar" (o MenuSuspenso do catálogo) liga e desliga o cliente todo ou cada nota/pagamento.
import { Icone, MenuSuspenso } from '@nads/ui';

export interface VmDoQuePerguntar {
  /** o cliente (ou fornecedor) todo vai */
  todos: boolean;
  /** o que vai, em poucas palavras: "NF 9971 · NF 10111" */
  rotulo: string;
  opcoes: { chave: string; rotulo: string; marcado: boolean }[];
}

export function OQuePerguntar({ nome, quem, vm, desabilitado, onAlternar }: {
  nome: string; quem: 'cliente' | 'fornecedor'; vm: VmDoQuePerguntar; desabilitado: boolean; onAlternar: (chave: string | null) => void;
}) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
      <span className="msg-balao" title={'O que vai para o ' + quem + ' responder no Mandei'}>
        <Icone nome="caixaEntrada" />{vm.todos ? 'O ' + quem + ' todo' : vm.rotulo}
      </span>
      {vm.opcoes.length > 0 && (
        <MenuSuspenso rotulo="Perguntar" icone="plus" className="btn btn-outline" dica={'Escolher o que perguntar sobre ' + nome} largura={320}
          itens={[
            { rotulo: 'O ' + quem + ' todo', marcado: vm.todos, desabilitado, onClick: () => onAlternar(null) },
            'separador' as const,
            ...vm.opcoes.map(o => ({ rotulo: o.rotulo, marcado: o.marcado, desabilitado, onClick: () => onAlternar(o.chave) })),
          ]} />
      )}
    </span>
  );
}
