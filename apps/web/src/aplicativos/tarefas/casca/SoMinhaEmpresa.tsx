// A rota de uma empresa no Concilia aí, no Conciliadorzinho e no Extratudo (29/10/2026): só abre a empresa de quem é o
// responsável dela (useEmpresasDaConta). Pelo link direto, a empresa de outra pessoa volta para a escolha de empresa,
// com o aviso. Enquanto o Cadastro (de onde vem o responsável) não chega, não mostra nada.
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
  useEffect(() => {
    if (fora) toast('Você não é o responsável por ' + empresa.nome + '. O admin escolhe o responsável em Tarefas › Cadastro.');
  }, [fora, empresa.nome, toast]);
  if (!permitidas.carregada) return null;
  if (fora) return <Navigate to={voltar} replace />;
  return <>{children}</>;
}
