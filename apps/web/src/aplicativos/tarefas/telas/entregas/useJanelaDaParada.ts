// ViewModel da janela da parada (16/10/2026, a entrega de documentos trazida do Entregas): confirmar a entrega que está na
// rota, com as exigências de lá — entregue com a assinatura (colhida aqui) ou a foto; entregue sem a assinatura (a foto
// vale como comprovante); ou não entregue (o motivo, num toque, e a foto). Só honorário em dinheiro, ou só notas, não pede
// comprovante. Com mais paradas no mesmo lugar, confirma todas juntas com o mesmo comprovante. Não entregue: oferece pôr
// de volta na rota (a tentativa seguinte). Tirar da rota: quem pôs (enquanto não foi entregue) ou o admin.
import { entregas, formatos, tarefas as t } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useMemo, useState } from 'react';
import { useOperador } from '../../casca/operador';
import { useEntregasDeDocumentos } from '../../dados/repo';
import { imagemDoArquivo } from './imagemDaEntrega';

export const MANEIRAS: { valor: entregas.ComoFoi; rotulo: string }[] = [
  { valor: 'entregue', rotulo: 'Entregue' },
  { valor: 'sem_assinatura', rotulo: 'Sem assinatura' },
  { valor: 'falha', rotulo: 'Não entregue' },
];

export function useJanelaDaParada(id: string, fechar: () => void) {
  const repo = useEntregasDeDocumentos();
  const retorno = useRetorno();
  const { operador } = useOperador();
  const naRota = repo.naRota();
  const clientes = repo.clientes();
  const parada = naRota.lista.find(e => e.id === id) || null;
  const [como, setComo] = useState<entregas.ComoFoi>('entregue');
  const [recebedor, setRecebedor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [assinatura, setAssinatura] = useState<string | null>(null);
  const [foto, setFoto] = useState<string | null>(null);
  const [lendoFoto, setLendoFoto] = useState(false);
  const [juntas, setJuntas] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  /** a guia (ou foto) que foi junto quando a parada entrou na rota */
  const [guia, setGuia] = useState<string>('');

  const porId = useMemo(() => new Map(clientes.lista.map(c => [c.id, c])), [clientes.lista]);
  const outras = parada ? naRota.lista.filter(e => e.id !== parada.id && entregas.chaveDaParada(e, porId) === entregas.chaveDaParada(parada, porId)) : [];
  const temFoto = !!parada?.temFoto;

  useEffect(() => {
    if (!temFoto) return;
    let vivo = true;
    repo.comprovante(id).then(c => { if (vivo) setGuia(c.foto); }).catch(() => undefined);
    return () => { vivo = false; };
  }, [id, temFoto, repo]);

  // a parada saiu da rota enquanto a janela estava aberta (outra pessoa confirmou ou tirou): fecha
  const sumiu = naRota.carregada && !parada && !salvando;
  useEffect(() => {
    if (!sumiu) return;
    retorno.aviso({ tom: 'info', titulo: 'Essa parada já saiu da rota', texto: 'Outra pessoa confirmou ou tirou da rota.' });
    fechar();
  }, [sumiu, fechar, retorno]);

  const lista = parada ? (juntas ? [parada, ...outras] : [parada]) : [];
  const itensDeTodas = lista.flatMap(e => e.itens);
  const confirmacao: entregas.Confirmacao = { como, recebedor, motivo, assinatura, foto };
  const quem = repo.quem();

  return {
    parada,
    exemplos: repo.exemplos,
    competencia: parada ? t.rotuloCompetencia(parada.competencia || '2026-01') : '',
    regiao: parada ? entregas.rotuloDaZona(parada.zona) : '',
    total: parada ? entregas.totalDosItens(parada.itens) : 0,
    reais: formatos.reais,
    aviso: parada ? entregas.avisoDaParada(parada) : '',
    guia,
    outras, juntas, setJuntas,
    maneiras: MANEIRAS,
    como, setComo(c: entregas.ComoFoi) { setComo(c); setErros([]); },
    recebedor, setRecebedor,
    motivo, setMotivo,
    motivosRapidos: entregas.MOTIVOS_DE_FALHA,
    /** o motivo num toque: troca o motivo do começo e mantém o que a pessoa escreveu depois (como no Entregas) */
    usarMotivo(m: string) {
      let resto = motivo;
      for (const x of entregas.MOTIVOS_DE_FALHA) if (resto.startsWith(x)) resto = resto.slice(x.length).replace(/^[\s.,;:–-]+/, '');
      setMotivo(m + (resto ? '. ' + resto : ''));
    },
    assinatura, setAssinatura,
    foto, lendoFoto,
    async anexarFoto(arquivos: File[]) {
      const a = arquivos[0];
      if (!a) return;
      setLendoFoto(true);
      try { setFoto((await imagemDoArquivo(a)).imagem); } catch (e) {
        retorno.aviso({ tom: 'erro', titulo: 'Não consegui ler a foto', texto: (e as Error).message });
      } finally { setLendoFoto(false); }
    },
    tirarFoto: () => setFoto(null),
    dispensa: entregas.dispensaComprovante(itensDeTodas),
    erros,
    salvando,
    rotuloDoBotao: como === 'falha' ? 'Registrar não entregue' : lista.length > 1 ? 'Confirmar as ' + lista.length : 'Confirmar entrega',
    async confirmar() {
      if (!parada || salvando) return;
      const faltas = entregas.faltasNaConfirmacao(confirmacao, itensDeTodas);
      if (faltas.length) { setErros(['Falta ' + faltas.join(' e ') + '.']); return; }
      setSalvando(true);
      try {
        await repo.confirmar(lista, confirmacao);
        fechar();
        if (como === 'falha') {
          // cliente ausente quase sempre é "volto outro dia": a parada volta para a rota com tudo preenchido
          const tentativa = Math.max(...lista.map(e => e.tentativa)) + 1;
          const sim = await retorno.modal({
            icone: 'repeat', titulo: 'Tentar de novo?',
            texto: 'Volta para a rota com os mesmos documentos, como ' + tentativa + 'ª tentativa. A de hoje fica registrada como não entregue.',
            botoes: [{ rotulo: 'Pôr de volta na rota', valor: true, variante: 'btn-primary' }, { rotulo: 'Agora não', valor: false }],
          });
          if (sim) {
            await repo.novaTentativa(lista, motivo.trim());
            retorno.aviso({ tom: 'ok', titulo: 'De volta na rota', texto: parada.clienteNome + ' · ' + tentativa + 'ª tentativa.' });
          }
        } else {
          retorno.aviso({ tom: 'ok', titulo: lista.length > 1 ? lista.length + ' entregas confirmadas' : 'Entrega confirmada', texto: parada.clienteNome });
        }
      } catch (e) {
        setErros(['Não consegui confirmar: ' + (e as Error).message]);
      } finally {
        setSalvando(false);
      }
    },
    podeTirar: !!parada && entregas.podeExcluir(parada, { admin: !!operador?.admin, email: quem?.email || '' }),
    async tirarDaRota() {
      if (!parada) return;
      const sim = await retorno.modal({
        icone: 'alert', titulo: 'Tirar da rota?', texto: 'A parada de ' + parada.clienteNome + ' é excluída (com a guia anexada).',
        botoes: [{ rotulo: 'Tirar da rota', valor: true, variante: 'btn-danger' }, { rotulo: 'Cancelar', valor: false }],
      });
      if (!sim) return;
      setSalvando(true);
      try {
        await repo.excluir(parada);
        fechar();
        retorno.aviso({ tom: 'ok', titulo: 'Saiu da rota', texto: parada.clienteNome });
      } catch (e) {
        setErros(['Não consegui tirar da rota: ' + (e as Error).message]);
      } finally {
        setSalvando(false);
      }
    },
  };
}
