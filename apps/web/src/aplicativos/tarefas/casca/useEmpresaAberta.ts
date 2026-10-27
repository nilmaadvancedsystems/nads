// ViewModel da empresa aberta (27/10/2026: "ao fazer isso vai ser escolhido uma empresa e entrar no setor vai confirmar vai
// abrir ela, variando de cada setor (tirando dp), vai abrir a parte de tarefas, visão geral, dentre outras informações na
// barra lateral como a pagina do drive dela"): a empresa pela rota, as páginas do setor na barra lateral e, ao entrar no
// Drive e nas ferramentas do Fiscal, a empresa já escolhida nelas (a pasta dela, ?c=; a empresa da ferramenta, ?empresa=).
// O setor vem no endereço (?dep=) como no executor; trocar de página mantém o endereço (o setor e a competência).
import { empresas } from '@nads/core';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useDriveDoEntregas, useRepo } from '../dados/repo';
import { useDepartamentoDaTela } from './departamento';
import { caminhoDaPaginaDaEmpresa, paginasDaEmpresa } from './navegacao';

/** as páginas que trabalham com uma empresa só e a recebem pelo endereço (?empresa=código) */
const FERRAMENTAS = new Set(['rateio-frete', 'simples', 'antecipacao-es']);

export function useEmpresaAberta(rota: string, pagina: string) {
  const repo = useRepo();
  const drive = useDriveDoEntregas();
  const navegar = useNavigate();
  const { search } = useLocation();
  const [params, setParams] = useSearchParams();
  const { dep } = useDepartamentoDaTela();
  const empresa = empresas.empresaPelaRota(repo.listarEmpresas(), rota);
  const paginas = paginasDaEmpresa(dep);
  const valida = paginas.some(p => p.id === pagina);
  const mapa = drive.mapa();
  const pastaDoCliente = empresa?.codigo != null ? mapa.clientes.find(c => c.codigo === String(empresa.codigo)) || null : null;

  // ao entrar na página (uma vez por página e empresa): a empresa já escolhida. Depois, se a pessoa trocar lá dentro, vale
  // a troca dela.
  const posta = useRef('');
  useEffect(() => {
    if (!empresa) return;
    const chave = rota + '/' + pagina;
    if (posta.current === chave) return;
    if (FERRAMENTAS.has(pagina) && empresa.codigo != null) {
      posta.current = chave;
      if (params.get('empresa') !== String(empresa.codigo)) setParams(p => { const n = new URLSearchParams(p); n.set('empresa', String(empresa.codigo)); return n; }, { replace: true });
    } else if (pagina === 'drive') {
      // o mapa do Drive chega depois: espera ele para achar a pasta (sem pasta, fica a lista de clientes)
      if (!mapa.carregado) return;
      posta.current = chave;
      if (pastaDoCliente && !params.get('c')) setParams(p => { const n = new URLSearchParams(p); n.set('c', pastaDoCliente.id); return n; }, { replace: true });
    } else posta.current = chave;
  }, [empresa, rota, pagina, mapa.carregado, pastaDoCliente, params, setParams]);

  // trocando de página: só o setor e a competência seguem (a pasta do Drive é de cada página); a ferramenta já recebe a
  // empresa no endereço, porque ela lê só ao abrir
  const seguir = (id = '') => {
    const n = new URLSearchParams();
    for (const k of ['dep', 'competencia']) { const v = new URLSearchParams(search).get(k); if (v) n.set(k, v); }
    if (FERRAMENTAS.has(id) && empresa?.codigo != null) n.set('empresa', String(empresa.codigo));
    const q = n.toString();
    return q ? '?' + q : '';
  };

  return {
    empresa,
    valida,
    /** a primeira página (as Tarefas), mantendo o endereço, quando a pedida não existe no setor */
    paginaInicial: caminhoDaPaginaDaEmpresa(rota, 'tarefas') + seguir(),
    casca: empresa ? {
      codigo: empresa.codigo, nome: empresa.nome, rota,
      paginas, pagina,
      onPagina: (id: string) => navegar(caminhoDaPaginaDaEmpresa(rota, id) + seguir(id)),
    } : null,
  };
}
