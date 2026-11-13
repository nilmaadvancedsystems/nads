// o ⚡ do modo desenvolvedor no Início, como nas telas das etapas: marcar põe os exemplos na tela; nada vai para o banco
// (13/11/2026: "SEMPRE desenvolver formas de preenchimento de dados ficticios para meu teste"). E a saudação simulada: o turno,
// a segunda-feira, o aniversário e o "Outra frase" ("No ⚡ Dados de teste, uma opção para simular hora, dia e aniversário").
import { MenuSuspenso } from '@nads/ui';
import type { useTesteDoInicio } from '../../dados/repo';
import { simularSaudacao, useSaudacaoSimulada } from './saudacaoSimulada';

export function DadosDeTesteDoInicio({ teste: t }: { teste: ReturnType<typeof useTesteDoInicio> }) {
  const s = useSaudacaoSimulada();
  const turno = (x: 'manha' | 'tarde' | 'noite') => () => simularSaudacao({ turno: s.turno === x ? undefined : x, troca: 0 });
  return (
    <MenuSuspenso rotulo="Dados de teste" icone="zap" className="btn btn-outline" direita largura={280} titulo="Modo desenvolvedor · nada vai para o banco"
      itens={[
        // tudo de uma vez (Vitor, 13/11/2026: "Coloca mais dados de teste, de notificações e tudo")
        { rotulo: 'Tudo de exemplo', icone: 'zap', marcado: t.tarefas && t.avisos, onClick: () => { const ligar = !(t.tarefas && t.avisos); t.ligar('tarefas', ligar); t.ligar('avisos', ligar); } },
        'separador',
        { rotulo: 'Tarefas de exemplo', icone: 'checklist', marcado: t.tarefas, onClick: () => t.ligar('tarefas', !t.tarefas) },
        { rotulo: 'Avisos de exemplo', icone: 'alert', marcado: t.avisos, onClick: () => t.ligar('avisos', !t.avisos) },
        'separador',
        { rotulo: 'Saudação: manhã', icone: 'sun', marcado: s.turno === 'manha', onClick: turno('manha') },
        { rotulo: 'Saudação: tarde', icone: 'sun', marcado: s.turno === 'tarde', onClick: turno('tarde') },
        { rotulo: 'Saudação: noite', icone: 'moon', marcado: s.turno === 'noite', onClick: turno('noite') },
        { rotulo: 'Saudação: segunda-feira', icone: 'calendar', marcado: !!s.segunda, onClick: () => simularSaudacao({ segunda: !s.segunda, troca: 0 }) },
        { rotulo: 'Saudação: mês do aniversário', icone: 'trofeu', marcado: s.aniversario === 'mes', onClick: () => simularSaudacao({ aniversario: s.aniversario === 'mes' ? undefined : 'mes', troca: 0 }) },
        { rotulo: 'Saudação: dia do aniversário', icone: 'trofeu', marcado: s.aniversario === 'dia', onClick: () => simularSaudacao({ aniversario: s.aniversario === 'dia' ? undefined : 'dia', troca: 0 }) },
        { rotulo: 'Saudação: outra frase', icone: 'repeat', onClick: () => simularSaudacao({ troca: (s.troca || 0) + 1 }) },
        'separador',
        // o nível nas Notificações: o Sênior pede reunião, o Diretor aprova, os outros ficam com Delegar documentos e Nova tarefa
        { rotulo: 'Nível: Sênior', icone: 'usuario', marcado: s.nivel === 'senior', onClick: () => simularSaudacao({ nivel: s.nivel === 'senior' ? undefined : 'senior' }) },
        { rotulo: 'Nível: Diretor', icone: 'usuario', marcado: s.nivel === 'diretor', onClick: () => simularSaudacao({ nivel: s.nivel === 'diretor' ? undefined : 'diretor' }) },
        { rotulo: 'Nível: Pleno', icone: 'usuario', marcado: s.nivel === 'pleno', onClick: () => simularSaudacao({ nivel: s.nivel === 'pleno' ? undefined : 'pleno' }) },
        'separador',
        { rotulo: 'Apagar os dados de teste', icone: 'x', desabilitado: !t.tarefas && !t.avisos && !Object.keys(s).length, onClick: () => { t.ligar('tarefas', false); t.ligar('avisos', false); simularSaudacao(null); } },
      ]} />
  );
}
