// ViewModel das paradas assinadas juntas (16/10/2026, a cópia fiel do openConfirmLoteModal_ do Entregas): o mesmo cliente
// com várias guias (ou empresas aglutinadas no mesmo endereço) confirmadas com UMA assinatura. Cada entrega com os
// documentos e o valor de cada um, para conferir antes de assinar; desmarcar tira do lote. Não realizada: o motivo e a
// foto; depois, "Tentar de novo?" para todas. Entregue: os lembretes das empresas do lote.
import { entregas } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { useEntregasDeDocumentos } from '../../dados/repo';
import { fotoComprimida } from './arquivosDaEntrega';
import { useJanelasDasEntregas } from './contextoDasJanelas';
import { capturarPosicao } from './localizacao';
import { oferecerTentarDeNovo, textoDoErro } from './useJanelaDaParada';

type Entrega = ReturnType<typeof entregas.entregaDoDocumento>;
type Geo = NonNullable<ReturnType<typeof entregas.geoDoBanco>>;

export function useJanelaDasJuntas(titulo: string, lista: Entrega[]) {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const janelas = useJanelasDasEntregas();
  const clientes = repo.clientes();
  const [fora, setFora] = useState<string[]>([]);
  const [falha, setFalha] = useState(false);
  const [motivoFalha, setMotivoFalha] = useState('');
  const [recebedor, setRecebedor] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [historico, setHistorico] = useState<Entrega[]>([]);
  const [erros, setErros] = useState<{ escolha?: string; foto?: string; motivo?: string; assinatura?: string }>({});
  const [salvando, setSalvando] = useState(false);
  const primeiro = lista[0]?.clienteId || null;
  useEffect(() => {
    let vivo = true;
    capturarPosicao().then(g => { if (vivo) setGeo(g); });
    if (primeiro) repo.recentesDoCliente(primeiro).then(l => { if (vivo) setHistorico(l); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [primeiro, repo]);
  // as que outra pessoa já confirmou somem do lote
  const naRota = repo.naRota();
  const vivas = naRota.carregada ? lista.filter(e => naRota.lista.some(x => x.id === e.id)) : lista;
  const mistura = vivas.some(e => e.clienteNome !== vivas[0]?.clienteNome);
  const escolhidas = vivas.filter(e => !fora.includes(e.id));
  const sugeridos = useMemo(() => entregas.recebedoresSugeridos(historico), [historico]);
  const dica = useMemo(() => entregas.dicaDoCliente(historico), [historico]);
  const avisar = (t: string, tom: 'ok' | 'erro' | 'info' = 'ok') => retorno.aviso({ tom, titulo: t });

  return {
    titulo,
    sub: vivas.length + ' entregas na rota · uma assinatura para todas',
    dica,
    linhas: vivas.map(e => ({
      e, marcada: !fora.includes(e.id), competencia: entregas.rotuloDaCompetencia(e.competencia), empresa: mistura ? e.clienteNome : '',
      fichas: e.itens.map(entregas.fichaDoItem), total: e.itens.filter(i => i.valor != null).length > 1 ? 'Total ' + entregas.dinheiro(entregas.totalDosItens(e.itens)) : '',
    })),
    alternar: (id: string) => setFora(f => (f.includes(id) ? f.filter(x => x !== id) : [...f, id])),
    falha, setFalha(v: boolean) { setFalha(v); setErros({}); },
    motivos: entregas.MOTIVOS_DE_FALHA,
    motivoFalha, setMotivoFalha,
    usarMotivo: (m: string) => setMotivoFalha(x => entregas.motivoComToque(x, m)),
    motivoMarcado: entregas.MOTIVOS_DE_FALHA.find(m => motivoFalha.startsWith(m)) || '',
    recebedor, setRecebedor, sugeridos,
    rotuloDaFoto: falha ? 'Foto (obrigatória)' : 'Foto (opcional se colher assinatura)',
    foto,
    async anexarFoto(arquivos: File[]) {
      const a = arquivos[0];
      if (!a) return;
      try { setFoto(await fotoComprimida(a)); } catch { avisar('Não foi possível processar a foto.', 'erro'); }
    },
    tirarFoto: () => setFoto(null),
    assinatura, setAssinatura,
    erros, salvando,
    rotuloDoBotao: falha ? 'Registrar como não realizada' : 'Confirmar todas',
    fechar: janelas.fechar,
    async confirmar() {
      if (salvando) return;
      const c: entregas.ConfirmacaoEmLote = { falha, recebedor, motivoFalha, assinatura: falha ? null : assinatura, foto, geo };
      const faltas = entregas.faltasNoLote(c, escolhidas.length);
      setErros(faltas);
      if (faltas.escolha) { avisar(faltas.escolha, 'erro'); return; }
      if (Object.keys(faltas).length) return;
      setSalvando(true);
      // as empresas aglutinadas copiam o ponto uma da outra: a primeira vale para todas
      const cli = escolhidas[0]?.clienteId ? clientes.lista.find(x => x.id === escolhidas[0].clienteId) : null;
      const avaliacao = falha ? { aprender: false, divergente: false, distancia: null } : entregas.avaliarLocalDaEntrega(cli, geo);
      try {
        const r = await repo.confirmarJuntas(escolhidas, c, avaliacao);
        avisar(r === 'aparelho' ? 'Salvo no aparelho. Sobe sozinho quando voltar o sinal.'
          : falha ? escolhidas.length + ' entregas registradas como não realizadas.' : escolhidas.length + ' entregas confirmadas de uma vez.');
        if (!falha && avaliacao.divergente) retorno.aviso({ tom: 'info', titulo: 'Fora do local do cliente', texto: entregas.textoDoLocalDivergente(avaliacao, titulo) });
        janelas.fechar();
        const comLembrete = escolhidas.filter(e => e.clienteId && repo.lembretes().lista.some(l => l.clienteId === e.clienteId));
        if (!falha && comLembrete.length) setTimeout(() => janelas.abrir({ tipo: 'lembretes', clientes: escolhidas.filter(e => e.clienteId).map(e => ({ id: e.clienteId as string, nome: e.clienteNome })) }), 260);
        // cliente ausente com 4 guias não pode obrigar a remontar as 4 à mão amanhã
        if (falha) await oferecerTentarDeNovo(escolhidas, motivoFalha.trim(), repo, retorno);
      } catch (err) {
        const explicacao = (err as { code?: string })?.code === 'permission-denied' ? await repo.explicarRecusa(escolhidas[0].id) : '';
        if (explicacao) { avisar(explicacao, 'erro'); janelas.fechar(); } else avisar(textoDoErro(err, 'Não foi possível confirmar.'), 'erro');
      } finally {
        setSalvando(false);
      }
    },
  };
}
