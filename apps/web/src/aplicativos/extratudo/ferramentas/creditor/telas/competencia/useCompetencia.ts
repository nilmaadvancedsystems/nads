// ViewModel da etapa Competência (a primeira): escolher o mês e, ao abrir, buscar o relatório de
// liquidação na pasta da empresa no Drive (CONTÁBIL › RECEBIMENTO DE CLIENTES), baixar pelo robô do
// Entregas, ler e seguir para o Relatório do banco já preenchido. Sem o Drive (não entrou, não achou,
// deu erro), a pessoa anexa à mão na etapa seguinte.
import { creditor as cr } from '@nads/core';
import { useCarregando } from '@nads/ui';
import { useState } from 'react';
import { useSessao } from '../../casca/sessao';
import { useDrive } from '../../dados/repo';
import { lerRelatorio, mensagemDeErro } from '../../leitura';

type Fase = 'parado' | 'procurando' | 'baixando' | 'problema';

export function useCompetencia() {
  const s = useSessao();
  const { drive, acesso } = useDrive();
  const [mes, setMes] = useState(s.estado.competencia || cr.competenciaPadrao(new Date()));
  const [login, setLogin] = useState({ usuario: '', senha: '' });
  const [entrando, setEntrando] = useState(false);
  const [erroLogin, setErroLogin] = useState('');
  const [busca, setBusca] = useState<{ fase: Fase; texto: string; candidatos: cr.ArquivoAchado[] }>({ fase: 'parado', texto: '', candidatos: [] });
  const valida = cr.competenciaValida(mes);
  const jaCarregado = !!s.estado.relatorio && s.estado.competencia === mes;

  async function entrar() {
    setEntrando(true);
    setErroLogin('');
    try { await drive.entrarComGoogle(); setLogin({ usuario: '', senha: '' }); }
    catch (e) { setErroLogin(mensagemDeErro(e)); }
    finally { setEntrando(false); }
  }

  /** Guarda a competência (antes de qualquer outra coisa: é ela que libera a etapa seguinte). */
  const fixar = () => s.mudar(e => (e.competencia === mes ? e : { ...e, competencia: mes }));

  async function usarDoDrive(a: cr.ArquivoAchado, candidatos: cr.ArquivoAchado[]) {
    fixar();
    setBusca({ fase: 'baixando', texto: 'Baixando ' + a.nome + '…', candidatos });
    try {
      const buf = await drive.baixar(a.id, a.nome, passo => setBusca(b => ({ ...b, texto: a.nome + ': ' + passo + '…' })));
      s.usarRelatorio(await lerRelatorio(a.nome, buf), 'Drive · ' + a.caminho);
      s.avancarPara('banco');
    } catch (e) {
      setBusca({ fase: 'problema', texto: mensagemDeErro(e), candidatos });
    }
  }

  async function abrir() {
    if (!valida) return;
    fixar();
    if (jaCarregado || !acesso.entrou) { s.avancarPara('banco'); return; }
    setBusca({ fase: 'procurando', texto: 'Procurando o relatório de ' + cr.rotuloCompetencia(mes) + ' no Drive…', candidatos: [] });
    try {
      const pasta = await drive.pastaDoCliente(s.empresa.codigo);
      const b = cr.acharRelatorioNoDrive(pasta?.itens || [], pasta?.raiz || null, mes);
      if (b.situacao === 'achou' && b.arquivo) await usarDoDrive(b.arquivo, b.candidatos);
      else setBusca({ fase: 'problema', texto: cr.mensagemDaBusca(b, cr.rotuloCompetencia(mes)), candidatos: b.candidatos });
    } catch (e) {
      setBusca({ fase: 'problema', texto: mensagemDeErro(e), candidatos: [] });
    }
  }

  const ocupado = busca.fase === 'procurando' || busca.fase === 'baixando';
  useCarregando(ocupado);
  return {
    mes, setMes: (v: string) => { setMes(v); setBusca({ fase: 'parado', texto: '', candidatos: [] }); },
    porExtenso: cr.competenciaPorExtenso(mes),
    valida,
    /** não concilia mês que ainda não começou */
    maximo: new Date().toISOString().slice(0, 7),
    drive: {
      exemplos: drive.exemplos,
      loginDeFora: !!drive.loginDeFora,
      pronto: acesso.pronto,
      entrou: acesso.entrou,
      quem: acesso.quem,
      login, setLogin, entrando, erroLogin, entrar,
      sair: () => { void drive.sair(); },
    },
    caminho: (s.empresa.codigo != null ? s.empresa.codigo + ' - …' : '<código> - …') + ' › CONTÁBIL › RECEBIMENTO DE CLIENTES',
    busca: { ...busca, ocupado },
    rotuloAbrir: jaCarregado ? 'Continuar' : acesso.entrou ? 'Abrir e buscar no Drive' : 'Continuar sem o Drive',
    podeAbrir: valida && !ocupado,
    abrir: () => { void abrir(); },
    usar: (a: cr.ArquivoAchado) => { void usarDoDrive(a, busca.candidatos); },
    anexarAMao: () => { fixar(); s.avancarPara('banco'); },
    origemCarregada: jaCarregado ? s.estado.origemBanco : '',
  };
}
