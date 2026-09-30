// ViewModel da casca da empresa aberta: seções e páginas com as travas, título da página,
// sair (Apagar ao sair), voltar pro início e a pergunta "presta serviços?".
// Origem: conferencia.html renderNav (~L1789), aplicarBloqueios (~L1838), entrar/sair
// (~L2004-2039), perguntarPrestaServico (~L1781), telaInicialEmpresa (~L1712).
import { conferencia as c } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { VERSAO_SISTEMA } from '../../../versao';
import { useRepo } from '../dados/repo';
import { PAGINAS_ESCONDIDAS, paginaPorId, SECOES, secaoDaPagina, type IdSecao } from './navegacao';
import { MSG_CADASTRO_BLOQ, useSessao } from './sessao';
import { caminho } from './caminho';


export function useCascaConciliaAi() {
  const s = useSessao();
  const repo = useRepo();
  const navegar = useNavigate();
  const { modal } = useRetorno();
  const e = s.empresa;
  const pag = paginaPorId(s.pagina);
  const secAtual = secaoDaPagina(s.pagina);
  const ok = c.importacoesOk(e);
  const semNotas = !c.temNotas(e);
  const tem = c.disponivel(e);
  const semP = c.semPrest(e);
  const lista = repo.listarEmpresas().find(x => x.nome === s.nome);

  // "Essa empresa presta serviço?" — uma vez por empresa, obrigatória, fundo embaçado
  const perguntou = useRef(false);
  useEffect(() => {
    if (perguntou.current || e.prestaServico !== undefined) return;
    perguntou.current = true;
    void modal<boolean>({
      obrigatoria: true, icone: 'briefcase', titulo: 'Seja bem-vindo(a) ao Concilia aí!',
      html: 'Para melhorarmos a sua experiência: a empresa <b>' + escapar((lista?.codigo != null ? lista.codigo + ' — ' : '') + s.nome) + '</b> presta serviços?',
      botoes: [{ rotulo: 'Não', valor: false, variante: 'btn-outline' }, { rotulo: 'Sim', valor: true, variante: 'btn-primary' }],
    }).then(sim => {
      s.aplicar(x => c.definirPrestaServico(x, sim));
      if (!sim && s.abaCadastro === 'prestados') s.setAbaCadastro('entradas');
    });
  }, [e.prestaServico, modal, s, lista]);

  const secoes = SECOES.map(sec => {
    const req = sec.id === 'cadastro' && !ok ? 'todas' : sec.id === 'movimento' && semNotas ? 'notas' : '';
    // a Importação foi para a primeira etapa da Tarefas: dentro da etapa (Conferência fiscal), ela não aparece aqui
    return { id: sec.id, rotulo: sec.rotulo, icone: sec.icone, grupo: sec.grupo, ativa: sec.id === secAtual?.id, travada: !!req, req, foraDaEtapa: sec.id === 'importacao' };
  });

  const abaAcesa = pag?.acendeAba || s.pagina;
  const paginas = (secAtual?.paginas || []).map(p => ({
    id: p.id, rotulo: p.rotulo, icone: p.icone, ativa: p.id === abaAcesa,
    // "Prestados" some com "não presta serviço"
    oculta: p.id === 'importacao/prestados' && semP,
  }));

  /** Menu lateral: sempre abre a primeira página da seção, já na primeira aba interna. */
  function onSecao(id: string) {
    const sec = secoes.find(x => x.id === id);
    if (sec?.req) { s.avisoImportar(sec.req as 'todas' | 'notas'); return; }
    if (id === 'cadastro' && !ok) { s.avisoImportar('todas'); return; }
    const primeira = SECOES.find(x => x.id === (id as IdSecao))?.paginas[0].id;
    if (!primeira) return;
    if (primeira === 'cadastro/configuracoes') s.setAbaCadastro(tem.entradas ? 'entradas' : tem.saidas ? 'saidas' : tem.tomados ? 'tomados' : 'entradas');
    if (primeira === 'movimento/relatorio') s.setAbaRelatorio('geral');
    s.irPara(primeira);
  }

  /** Abas de cima: voltam onde a pessoa parou (a aba interna fica como estava). */
  function onPagina(id: string) {
    s.irPara(id);
  }

  function sair() {
    s.aplicar(x => c.aoSair(x, new Date()));
    navegar(caminho());
  }

  function voltarInicioDaEmpresa() {
    const t = c.telaInicialEmpresa(e);
    s.irPara(t.secao + '/' + t.pagina);
  }

  return {
    empresa: { codigo: s.codigo != null ? String(s.codigo) : lista?.codigo != null ? String(lista.codigo) : s.nome, nome: s.nome },
    titulo: pag?.titulo || '',
    versao: VERSAO_SISTEMA,
    secoes, paginas,
    onSecao, onPagina, sair, voltarInicioDaEmpresa,
    msgCadastro: MSG_CADASTRO_BLOQ,
    paginaExiste: !!pag || PAGINAS_ESCONDIDAS.some(p => p.id === s.pagina),
  };
}

function escapar(t: string): string {
  return t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] as string));
}
