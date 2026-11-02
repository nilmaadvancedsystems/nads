// ViewModel da janela "Salvando as notas" (Vitor, 27/10/2026: "coloca um feedback visual pro usuário saber o progresso de
// importação e não sair da tela"). A empresa grande (as 24 mil saídas da 237) sobe em pedaços e leva alguns segundos:
// enquanto isso, a janela no canto mostra quantos já chegaram e pede para não fechar nem atualizar a página (o navegador
// também pergunta, conferencia.firestore.ts). Terminou, ela fica verde até a pessoa fechar.
import { useState } from 'react';
import { useGravacaoNaNuvem as useGravacao } from '../dados/repo';

export function useGravacaoNaNuvem() {
  const g = useGravacao();
  // a que a pessoa fechou (a próxima gravação abre de novo)
  const [fechada, setFechada] = useState<typeof g>(null);
  if (!g || g === fechada) return null;
  const pct = Math.min(100, Math.round((g.feitos / g.total) * 100));
  return {
    pronto: !!g.pronto,
    pct,
    titulo: g.pronto ? 'Notas salvas na nuvem' : 'Salvando as notas na nuvem',
    subtitulo: g.pronto ? 'Pode sair da tela' : 'Não feche nem atualize a página',
    detalhe: g.notas.toLocaleString('pt-BR') + ' notas da ' + g.empresa + ' · ' + g.feitos + ' de ' + g.total + ' partes',
    fechar: () => setFechada(g),
  };
}
