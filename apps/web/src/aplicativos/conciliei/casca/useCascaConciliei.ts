// ViewModel da casca do Conciliei: as ferramentas na caixa à esquerda (a aberta marcada), a empresa
// no cabeçalho e para onde vão o início, o sair e a gaveta ☰. As abas do cabeçalho e o título são
// de cada ferramenta (ferramentas/<id>/casca).
import { useNavigate } from 'react-router';
import { menuAplicativos, rotaDoAplicativo } from '../../../comum/menuAplicativos';
import { VERSAO_SISTEMA } from '../../../versao';
import { caminho, caminhoDaFerramenta } from './caminho';
import { FERRAMENTAS, ferramentaPorId, type IdFerramenta } from './ferramentas';

export function useCascaConciliei(ferramenta: IdFerramenta, empresa: { nome: string; codigo: number | null }, rota: string) {
  const navegar = useNavigate();
  return {
    empresa: { codigo: empresa.codigo != null ? String(empresa.codigo) : empresa.nome, nome: empresa.nome },
    versao: VERSAO_SISTEMA,
    ferramentas: FERRAMENTAS.map(f => ({ id: f.id, rotulo: f.nome, icone: f.icone, grupo: 1, ativa: f.id === ferramenta })),
    abrirFerramenta: (id: string) => {
      const f = ferramentaPorId(id);
      if (f && f.id !== ferramenta) navegar(caminhoDaFerramenta(rota, f.id, f.inicial));
    },
    sair: () => navegar(caminho()),
    aplicativos: () => navegar('/'),
    menuAplicativos: menuAplicativos('conciliei'),
    abrirAplicativo: (id: string) => navegar(rotaDoAplicativo(id)),
  };
}
