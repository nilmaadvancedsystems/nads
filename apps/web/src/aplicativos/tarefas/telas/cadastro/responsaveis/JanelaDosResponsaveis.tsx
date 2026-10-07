// A janela "Empresas por responsável" (Vitor, 07/10/2026: em Cadastro › Usuários, "um botão que abra uma janela
// flutuante"): à esquerda as pessoas, com quantas empresas cada uma tem, e "Sem responsável"; à direita as empresas de
// quem estiver escolhido, com o Transferir. A mesma janela com painéis laterais do usuário.
import { useState } from 'react';
import { JanelaLateral, type TopicoDaJanela } from '../../janela/JanelaLateral';
import { EmpresasDaPessoa, EmpresasSemResponsavel } from './EmpresasDaPessoa';
import { useEmpresasPorResponsavel } from './useEmpresasPorResponsavel';

const SEM = '__sem__';

export function JanelaDosResponsaveis({ fechar }: { fechar: () => void }) {
  const vm = useEmpresasPorResponsavel();
  const [topico, setTopico] = useState<string>('');
  const topicos: TopicoDaJanela<string>[] = [
    ...vm.pessoas.map(p => ({ id: p.nome, rotulo: p.nome, icone: 'usuario' as const, contador: p.total })),
    { id: SEM, rotulo: 'Sem responsável', icone: 'alert' as const, contador: vm.semResponsavel('fiscal').length + vm.semResponsavel('contabil').length },
  ];
  const atual = topico || topicos[0]?.id || SEM;
  return (
    <JanelaLateral rotulo="Empresas por responsável" topicos={topicos} topico={atual} mudar={setTopico} fechar={fechar} classe="resp-janela" resumo={(
      <div className="usuario-quem">
        <b>Empresas por responsável</b>
      </div>
    )}>
      {atual === SEM ? <EmpresasSemResponsavel vm={vm} /> : <EmpresasDaPessoa pessoa={atual} vm={vm} />}
    </JanelaLateral>
  );
}
