// O "empresa ▾" da barra de cima do Cadastro (como o "main ▾" do GitHub): mostra a empresa aberta e abre a busca
// para trocar, ficando na mesma página.
import type { empresas } from '@nads/core';
import { MenuSuspenso } from '@nads/ui';
import { ListaDeEmpresas } from './ListaDeEmpresas';
import { useEscolherNoCadastro } from './useEscolherNoCadastro';

export function TrocarEmpresa({ empresa, rota, pagina }: { empresa: empresas.EmpresaDoEscritorio; rota: string; pagina: string }) {
  const vm = useEscolherNoCadastro(pagina, rota);
  return (
    <MenuSuspenso icone="briefcase" titulo="Empresa" dica="Trocar a empresa" largura={420} className="btn btn-outline cad-empresa"
      rotulo={<><b>{empresa.codigo ?? '—'}</b><span className="cad-empresa-nome">{empresa.nome}</span></>}
      conteudo={fechar => <ListaDeEmpresas vm={vm} focar aoEntrar={fechar} />} />
  );
}
