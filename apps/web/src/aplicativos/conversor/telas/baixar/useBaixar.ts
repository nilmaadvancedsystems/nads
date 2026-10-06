// ViewModel da etapa Baixar do Conversor: o nome do arquivo ("BANCO BRASIL 09.2026.xls") e os bytes do .xls, gerados
// na hora no navegador (nada vai para o banco de dados).
import { conversor as cv } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useSessao } from '../../casca/sessao';

export function useBaixar() {
  const { estado } = useSessao();
  const { toast } = useRetorno();
  const linhas = estado.extrato?.linhas || [];
  const nome = cv.nomeDoXls(estado.banco, linhas);
  return {
    nome,
    aba: cv.nomeDaAba(estado.banco),
    qtd: linhas.length,
    arquivo: () => ({ bytes: cv.planilhaDoExtrato(estado.banco, linhas), nome, tipo: cv.TIPO_XLS }),
    baixou: () => toast('Baixado: ' + nome),
  };
}
