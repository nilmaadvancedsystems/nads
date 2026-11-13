// o ⚡ do modo desenvolvedor no Início (o de hoje e o novo), como nas telas das etapas: marcar põe os exemplos na tela; nada
// vai para o banco (13/11/2026: "SEMPRE desenvolver formas de preenchimento de dados ficticios para meu teste")
import { MenuSuspenso } from '@nads/ui';
import type { useTesteDoInicio } from '../../dados/repo';

export function DadosDeTesteDoInicio({ teste: t }: { teste: ReturnType<typeof useTesteDoInicio> }) {
  return (
    <MenuSuspenso rotulo="Dados de teste" icone="zap" className="btn btn-outline" direita largura={260} titulo="Modo desenvolvedor · nada vai para o banco"
      itens={[
        { rotulo: 'Tarefas de exemplo', icone: 'checklist', marcado: t.tarefas, onClick: () => t.ligar('tarefas', !t.tarefas) },
        { rotulo: 'Avisos de exemplo', icone: 'alert', marcado: t.avisos, onClick: () => t.ligar('avisos', !t.avisos) },
        'separador',
        { rotulo: 'Apagar os dados de teste', icone: 'x', desabilitado: !t.tarefas && !t.avisos, onClick: () => { t.ligar('tarefas', false); t.ligar('avisos', false); } },
      ]} />
  );
}
