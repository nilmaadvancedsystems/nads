// ViewModel da entrada do Concilia aí: a escolha de empresa comum (useEscolherEmpresa) com a
// lista da Conferência (empresas do escritório + as do banco) e o entrar() do original.
// Origem: conferencia.html candidatosBusca/renderBusca, Enter do #buscaTxt e entrar() (~L1620-1668, ~L2004).
import { conferencia as c, empresas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useNavigate } from 'react-router';
import { useEscolherEmpresa } from '../../../../comum/useEscolherEmpresa';
import { useRepo, useVersaoDoRepo } from '../../dados/repo';
import { caminho } from '../../casca/caminho';

export function useEntrada() {
  const repo = useRepo();
  useVersaoDoRepo();
  const navegar = useNavigate();
  const { toast } = useRetorno();

  function entrar(x: c.EmpresaDaLista) {
    const nome = x.nome;
    // entrar(): abre (ou cria) a empresa e marca a primeira abertura
    if (!repo.pronto()) return;
    const existente = repo.obter(nome);
    const e = c.aoEntrar(existente || c.empresaNova(nome));
    repo.salvar(e); // o entrar() original sempre salva
    const t = c.telaInicialEmpresa(e);
    // rota pelo código do ERP (ex.: /292/…); sem código, pelo nome
    navegar(caminho(empresas.rotaDaEmpresa(x) + '/' + t.secao + '/' + t.pagina));
  }

  const busca = useEscolherEmpresa(repo.listarEmpresas(), entrar);

  return {
    ...busca,
    carregando: !repo.pronto(),
    exemplos: repo.exemplos,
    restaurarExemplos: () => { repo.restaurarExemplos(); toast('Exemplos restaurados.'); },
  };
}
