// ViewModel do histórico do robô do Gmail: as últimas leituras (quantos e-mails, marcados, anexos, sem cliente, erros).
import { useGmailDoEntregas } from '../../dados/repo';

export function useHistoricoDoRobo() {
  const repo = useGmailDoEntregas();
  const estado = repo.estado();
  return {
    carregando: !estado.carregado,
    erro: estado.erro || '',
    linhas: estado.execucoes.map(x => ({
      ...x,
      quando: x.em ? new Date(x.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '',
      duracao: x.duracaoMs ? Math.round(x.duracaoMs / 1000) + ' s' : '',
    })),
  };
}
