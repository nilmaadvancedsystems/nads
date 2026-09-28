// ViewModel da entrada: busca da empresa por nome ou código.
// Origem: conferencia.html candidatosBusca/renderBusca e o Enter do #buscaTxt (~L1620-1668).
import { conferencia as c, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useRepo, useVersaoDoRepo } from '../../../dados/repo';

export const LIMITE_LISTA = 50;

export function useEntrada() {
  const repo = useRepo();
  useVersaoDoRepo();
  const navegar = useNavigate();
  const { toast } = useRetorno();
  const [busca, setBusca] = useState('');
  const [aberta, setAberta] = useState(false);
  const q = busca.trim().toLowerCase();
  const candidatos = repo.listarEmpresas();

  const achadas = useMemo(() => {
    if (!q) return [];
    // código digitado exatamente vem primeiro, depois códigos que começam com ele, depois o resto
    const peso = (x: c.EmpresaDaLista) => { const cod = x.codigo != null ? String(x.codigo) : ''; return cod === q ? 0 : cod.indexOf(q) === 0 ? 1 : 2; };
    return candidatos
      .filter(x => x.nome.toLowerCase().indexOf(q) > -1 || (x.codigo != null && String(x.codigo).indexOf(q) > -1))
      .map((x, i) => [x, i] as const)
      .sort((a, b) => peso(a[0]) - peso(b[0]) || a[1] - b[1])
      .map(x => x[0]);
  }, [candidatos, q]);

  function entrar(x: c.EmpresaDaLista) {
    const nome = x.nome;
    // entrar(): abre (ou cria) a empresa e marca a primeira abertura
    if (!repo.pronto()) return;
    const existente = repo.obter(nome);
    const e = c.aoEntrar(existente || c.empresaNova(nome));
    repo.salvar(e); // o entrar() original sempre salva
    setBusca('');
    setAberta(false);
    const t = c.telaInicialEmpresa(e);
    // rota pelo código do ERP (ex.: /292/…); sem código, pelo nome
    navegar('/' + (x.codigo != null ? String(x.codigo) : formatos.slug(nome)) + '/' + t.secao + '/' + t.pagina);
  }

  /** Enter: código exato entra direto; uma só empresa achada entra nela. */
  function confirmar() {
    if (!q) return;
    let alvo = candidatos.find(x => x.codigo != null && String(x.codigo) === q);
    if (!alvo) {
      if (achadas.length === 1) alvo = achadas[0];
      else { toast(achadas.length ? 'Mais de uma empresa com isso — escolha na lista.' : 'Nenhuma empresa com esse código ou nome.'); return; }
    }
    entrar(alvo);
  }

  return {
    busca, setBusca: (v: string) => { setBusca(v); setAberta(true); },
    listaAberta: aberta && !!q,
    abrirLista: () => setAberta(true),
    fecharLista: () => setTimeout(() => setAberta(false), 150),
    achadas: achadas.slice(0, LIMITE_LISTA),
    total: achadas.length,
    entrar, confirmar,
    carregando: !repo.pronto(),
    exemplos: repo.exemplos,
    restaurarExemplos: () => { repo.restaurarExemplos(); toast('Exemplos restaurados.'); },
  };
}
