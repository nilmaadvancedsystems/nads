// ViewModel do Início da Tarefas (27/10/2026: "a parte de inicio, vai ser informações do escritorio como avisos, ultima
// empresa que foi mexida e progresso dela"): o mural de avisos (o admin e o diretor escrevem, fixam e apagam; todos leem),
// a última empresa em que a pessoa mexeu na competência, com o progresso dela, e o progresso das empresas dela no mês.
import { empresas, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAvisos } from '../../dados/repo';
import { caminhoDaPagina, caminhoDaPaginaDaEmpresa } from '../../casca/navegacao';
import { useOperador, type Operador } from '../../casca/operador';
import { useAndamento } from '../empresas/andamento';

export function useInicio() {
  const op = useOperador().operador as Operador;
  const navegar = useNavigate();
  const { toast, aviso, modal } = useRetorno();
  const repo = useAvisos();
  const a = useAndamento();
  const [texto, setTexto] = useState('');
  const [publicando, setPublicando] = useState(false);
  const agora = new Date();
  const escreve = op.admin || op.nivel === 'diretor';
  const mural = repo.lista();

  // a última em que a pessoa mexeu nesta competência (a mais recente)
  const ultima = a.linhas.filter(l => l.mexiEm).sort((x, y) => (y.mexiEm as string).localeCompare(x.mexiEm as string))[0] || null;
  const resumo = t.resumoDoProgresso(a.linhas);

  return {
    nome: op.nome.split(/[ .]/)[0],
    rotuloCompetencia: t.rotuloCompetencia(a.competencia),
    carregando: a.carregando,
    temRotina: a.temRotina,
    // o mural
    carregandoAvisos: !mural.carregados,
    avisos: t.ordenarAvisos(mural.avisos).map(x => ({ ...x, quando: t.quandoFoi(x.em, agora), quandoCompleto: new Date(x.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) })),
    escreve,
    texto, setTexto,
    faltam: t.MAIOR_AVISO - t.limparAviso(texto).length,
    podePublicar: !publicando && !t.problemaDoAviso(texto),
    publicando,
    async publicar() {
      const problema = t.problemaDoAviso(texto);
      if (problema) { aviso({ tom: 'erro', titulo: problema }); return; }
      setPublicando(true);
      try { await repo.publicar(texto, op.nome); setTexto(''); toast('Aviso publicado.'); }
      catch (e) { aviso({ tom: 'erro', titulo: 'O aviso não foi publicado', texto: e instanceof Error ? e.message : String(e) }); }
      finally { setPublicando(false); }
    },
    async fixar(id: string, fixado: boolean) {
      try { await repo.fixar(id, fixado); toast(fixado ? 'Aviso fixado no alto.' : 'Aviso solto.'); }
      catch (e) { aviso({ tom: 'erro', titulo: 'Não deu para mudar o aviso', texto: e instanceof Error ? e.message : String(e) }); }
    },
    async apagar(id: string) {
      const ok = await modal({ icone: 'alert', titulo: 'Apagar o aviso?', texto: 'Ele sai do mural de todo o escritório.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Apagar', valor: true, variante: 'btn-primary' }] });
      if (!ok) return;
      try { await repo.apagar(id); toast('Aviso apagado.'); }
      catch (e) { aviso({ tom: 'erro', titulo: 'O aviso não foi apagado', texto: e instanceof Error ? e.message : String(e) }); }
    },
    // a última empresa
    ultima: ultima ? {
      codigo: ultima.codigo, nome: ultima.nome, situacao: ultima.situacao, rotuloSituacao: ultima.rotuloSituacao,
      etapaAtual: ultima.etapaAtual, concluidas: ultima.concluidas, total: ultima.total,
      porcentagem: t.porcentagemDe(ultima.concluidas, ultima.total), acao: ultima.acao,
      quando: t.quandoFoi(ultima.mexiEm as string, agora),
      abrir: () => navegar(caminhoDaPaginaDaEmpresa(empresas.rotaDaEmpresa(ultima.empresa), 'tarefas') + '?competencia=' + a.competencia),
    } : null,
    // o mês das empresas da pessoa
    resumo,
    verEmpresas: () => navegar(caminhoDaPagina('minhas-empresas', 'empresas') + '?competencia=' + a.competencia),
  };
}
