// A rota de uma empresa no Concilia aí, no Conciliadorzinho e no Extratudo (29/10/2026): só abre a empresa de quem é o
// responsável dela (useEmpresasDaConta). Pelo link direto, a empresa de outra pessoa volta para a escolha de empresa,
// com o aviso. Enquanto o Cadastro (de onde vem o responsável) não chega, não mostra nada; se a leitura dele falhou, avisa
// e espera a nova tentativa, sem dizer que a empresa é de outra pessoa (30/10/2026: a Clara barrada nas empresas dela).
import { useRetorno } from '@nads/ui';
import { useEffect, type ReactNode } from 'react';
import { Navigate } from 'react-router';
import { useEmpresasDaConta } from './useEmpresasDaConta';

export function SoMinhaEmpresa({ empresa, voltar, children }: {
  empresa: { nome: string; codigo: number | null };
  /** para onde vai quem não é o responsável (a escolha de empresa do aplicativo) */
  voltar: string;
  children: ReactNode;
}) {
  const permitidas = useEmpresasDaConta();
  const { toast } = useRetorno();
  const fora = permitidas.carregada && !permitidas.pode(empresa);
  // o aviso diz o que foi conferido (30/10/2026), para quem recebe saber se o Cadastro está certo
  const x = fora ? permitidas.explicar(empresa) : null;
  const detalhe = x ? ' (' + (x.voce || 'sem nome') + ', ' + x.setor + '; responsável no ' + x.setor + ': ' + (x.responsavel || 'ninguém')
    + (x.noCadastro ? '' : '; o Cadastro veio vazio') + ')' : '';
  useEffect(() => {
    if (fora) toast('Você não é o responsável por ' + empresa.nome + detalhe + '. O admin escolhe o responsável em Tarefas › Cadastro.');
  }, [fora, empresa.nome, detalhe, toast]);
  if (permitidas.falhou) {
    return <p className="hint" role="status" style={{ padding: 24 }}>Não consegui conferir agora quem é o responsável por {empresa.nome}. Tentando de novo…</p>;
  }
  if (!permitidas.carregada) return null;
  if (fora) return <Navigate to={voltar} replace />;
  return <>{children}</>;
}
