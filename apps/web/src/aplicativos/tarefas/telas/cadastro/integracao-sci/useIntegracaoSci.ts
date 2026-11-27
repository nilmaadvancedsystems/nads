// ViewModel de Configurações › Integração SCI (24/11/2026; o dono: "monta o nads para suportar completamente a integracao do
// sci mesmo que nao vamos usar por agora"): as chaves de cada parte (tudo desligado até alguém ligar), as empresas com o SCI
// ligado e o código do relatório do SCI Report de cada guia. Mexer só muda o rascunho; "Gravar" manda para config/sci.
import { sci } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useMemo, useState } from 'react';
import { useConfigSci, useRhNet, useTodosOsCadastros } from '../../../dados/repo';

type Config = sci.integracao.ConfigDoSci;
export type ChaveDoSci = 'areaCliente' | 'publicarGuias' | 'lerDeVolta' | 'enviarXmls' | 'conferirXmls' | 'rhNet';

/** As partes, na ordem da tela, com o que cada uma faz em português simples. */
export const PARTES_DO_SCI: { chave: ChaveDoSci; titulo: string; texto: string; precisa?: ChaveDoSci }[] = [
  { chave: 'areaCliente', titulo: 'Guias do SCI Report na Área do Cliente', texto: 'O cliente vê, na aba Guias, as guias publicadas no SCI Report da empresa (busca na hora, pela função do Firebase).' },
  { chave: 'publicarGuias', titulo: 'Publicar no SCI Report pelo Enviar guias', texto: 'No Fiscal › Enviar guias, a via "SCI Report" publica de verdade cada guia na empresa, com o valor e o vencimento. O SCI avisa o cliente.' },
  { chave: 'lerDeVolta', titulo: 'Ler de volta se o cliente viu e pagou', texto: 'De hora em hora, das 8h às 20h, o robô pergunta ao SCI Report se o cliente abriu cada guia publicada e se informou o pagamento.', precisa: 'publicarGuias' },
  { chave: 'enviarXmls', titulo: 'Mandar os XMLs do SIEG ao Integra NET', texto: 'Depois de cada "Baixar XMLs" do SIEG, o robô do PC manda ao SCI as notas do mês que ainda não foram (a licença do Integra NET é por empresa).' },
  { chave: 'conferirXmls', titulo: 'Conferir as notas do mês com o SCI', texto: 'O robô compara as notas do SIEG com as do Integra NET e o Fiscal mostra quantas faltam no SCI.' },
  { chave: 'rhNet', titulo: 'RH NET (folha)', texto: 'O robô atende os pedidos do nads ao RH NET: buscar os cadastros da empresa, cadastrar admissões (sem liberar) e lançamentos da folha. O RH NET usa o token de cada empresa, não o do escritório.' },
];

export function useIntegracaoSci() {
  const repo = useConfigSci();
  const { toast } = useRetorno();
  const { carregada, config } = repo.atual();
  // o rascunho só existe depois da primeira mudança; até lá, a tela mostra o que está gravado
  const [rascunho, setRascunho] = useState<Config | null>(null);
  const [empresasTexto, setEmpresasTexto] = useState<string | null>(null);
  // (27/11/2026: "cria a lista para esconder a guia de teste da área") os números das publicações que a Área não mostra
  const [ocultasTexto, setOcultasTexto] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const atual = rascunho ?? config;
  // o RH NET (25/11/2026): o teste só de leitura por empresa ligada, pela fila do robô
  const rh = useRhNet();
  const pedidosRh = config.rhNet ? rh.pedidos().lista : [];
  const [pedindo, setPedindo] = useState(0);
  // (26/11/2026: "vai ter uma maneira mais simples de cadastrar token de api de clientes?") o token de cada empresa colado aqui
  const { tokens, testes } = repo.tokens();
  const [editando, setEditando] = useState(0);
  const [tokenTexto, setTokenTexto] = useState('');
  const [gravandoToken, setGravandoToken] = useState(false);
  async function gravarToken(codigo: number, tirar = false) {
    const erro = tirar ? '' : sci.integracao.erroDoToken(tokenTexto);
    if (erro) { toast(erro); return; }
    setGravandoToken(true);
    try {
      await repo.gravarToken(codigo, tirar ? null : tokenTexto.trim());
      setEditando(0); setTokenTexto('');
      toast(tirar ? 'Token tirado. Se houver um no robô, ele volta a valer.' : 'Token gravado. O robô testa em até 1 minuto.');
    } catch { toast('Não deu para gravar o token. Confira a internet e se você é administrador.'); }
    finally { setGravandoToken(false); }
  }
  // (26/11/2026: "como que eu adiciono mais de uma empresa?" / "melhora isso, nao da para entender nada") o "+ Adicionar
  // empresa" do cartão RH NET: o código e o token num passo só; põe a empresa na lista gravada e grava o token
  const cadastros = useTodosOsCadastros();
  const nomes = useMemo(() => { const m = new Map<number, string>(); for (const c of cadastros.porId.values()) if (c.codigo != null) m.set(c.codigo, c.nome); return m; }, [cadastros.porId]);
  const [adicionando, setAdicionando] = useState(false);
  const [novoCodigo, setNovoCodigo] = useState('');
  async function adicionarEmpresa() {
    const codigo = Number(novoCodigo.trim());
    if (!Number.isInteger(codigo) || codigo <= 0) { toast('Escreva o código da empresa (só números).'); return; }
    const erro = sci.integracao.erroDoToken(tokenTexto);
    if (erro) { toast(erro); return; }
    setGravandoToken(true);
    try {
      if (!config.empresas.includes(codigo)) await repo.salvar({ ...config, empresas: [...config.empresas, codigo] });
      // o rascunho que estiver aberto também ganha a empresa (para o Gravar de baixo não tirá-la)
      if (rascunho && !rascunho.empresas.includes(codigo)) { setRascunho({ ...rascunho, empresas: [...rascunho.empresas, codigo] }); setEmpresasTexto(null); }
      await repo.gravarToken(codigo, tokenTexto.trim());
      setAdicionando(false); setNovoCodigo(''); setTokenTexto('');
      toast('Empresa ' + codigo + ' adicionada. O robô testa o token em até 1 minuto.');
    } catch { toast('Não deu para adicionar. Confira a internet e se você é administrador.'); }
    finally { setGravandoToken(false); }
  }
  async function testarRhNet(codigo: number) {
    setPedindo(codigo);
    try { await rh.pedirCadastros(codigo); toast('Pedido ao RH NET na fila do robô.'); }
    catch (e) { toast(e instanceof Error ? e.message : 'Não deu para pedir agora.'); }
    finally { setPedindo(0); }
  }

  const mudar = (f: (c: Config) => Config) => setRascunho(f(atual));
  const alternar = (chave: ChaveDoSci) => mudar(c => {
    const ligado = !c[chave];
    // sem publicar, não há o que ler de volta
    return { ...c, [chave]: ligado, ...(chave === 'publicarGuias' && !ligado ? { lerDeVolta: false } : {}) };
  });
  const mudarRelatorio = (chave: sci.integracao.ChaveDaGuiaNoSci, valor: string) =>
    mudar(c => ({ ...c, relatorios: { ...c.relatorios, [chave]: valor.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 4) } }));
  const mudarEmpresas = (texto: string) => { setEmpresasTexto(texto); mudar(c => ({ ...c, empresas: sci.integracao.empresasDoTexto(texto) })); };
  const mudarOcultas = (texto: string) => { setOcultasTexto(texto); mudar(c => ({ ...c, ocultas: sci.integracao.publicacoesDoTexto(texto) })); };

  async function gravar() {
    setGravando(true);
    try {
      await repo.salvar(atual);
      setRascunho(null);
      setEmpresasTexto(null);
      setOcultasTexto(null);
      toast('Integração SCI gravada.');
    } catch {
      toast('Não deu para gravar. Confira a internet e se você é administrador.');
    } finally { setGravando(false); }
  }

  return {
    carregando: !carregada, exemplos: repo.exemplos, config: atual, mudado: !!rascunho, gravando,
    partes: PARTES_DO_SCI.map(p => ({ ...p, ligado: atual[p.chave], bloqueado: !!p.precisa && !atual[p.precisa] })),
    alternar, gravar, descartar: () => { setRascunho(null); setEmpresasTexto(null); setOcultasTexto(null); },
    ocultasTexto: ocultasTexto ?? atual.ocultas.join(', '), mudarOcultas,
    empresasTexto: empresasTexto ?? atual.empresas.join(', '), mudarEmpresas,
    guias: sci.integracao.GUIAS_DO_SCI.map(g => ({ ...g, codigo: atual.relatorios[g.chave] ?? '' })), mudarRelatorio,
    algumaLigada: PARTES_DO_SCI.some(p => atual[p.chave]),
    /** o RH NET: só com a chave GRAVADA ligada (o robô lê o que está gravado); uma linha por empresa da lista */
    rhNet: config.rhNet ? config.empresas.map(codigo => {
      const ultimo = pedidosRh.find(p => p.codigo === codigo) ?? null;
      const situacao = !ultimo ? 'Ainda não testada' : ultimo.status === 'erro' ? 'Não deu: ' + ultimo.erro : ultimo.status === 'concluido' ? ultimo.resumo : 'Na fila do robô…';
      const token = sci.integracao.situacaoDoToken(tokens[String(codigo)], testes[String(codigo)]);
      return {
        codigo, nome: nomes.get(codigo) ?? '', situacao, tom: !ultimo ? '' : ultimo.status === 'erro' ? 'bad' : ultimo.status === 'concluido' ? 'ok' : 'warn', pedindo: pedindo === codigo,
        token: token.texto, tomDoToken: token.tom, temToken: !!tokens[String(codigo)], editando: editando === codigo,
      };
    }) : null,
    testarRhNet: (codigo: number) => void testarRhNet(codigo),
    tokenTexto, gravandoToken, adicionando, novoCodigo, mudarNovoCodigo: (v: string) => setNovoCodigo(v.replace(/\D/g, '').slice(0, 6)),
    abrirAdicionar: () => { setAdicionando(true); setEditando(0); setNovoCodigo(''); setTokenTexto(''); },
    fecharAdicionar: () => { setAdicionando(false); setNovoCodigo(''); setTokenTexto(''); },
    adicionarEmpresa: () => void adicionarEmpresa(),
    nomeDoNovo: nomes.get(Number(novoCodigo)) ?? '',
    mudarToken: setTokenTexto,
    editarToken: (codigo: number) => { setEditando(codigo); setAdicionando(false); setTokenTexto(''); },
    cancelarToken: () => { setEditando(0); setTokenTexto(''); },
    gravarToken: (codigo: number) => void gravarToken(codigo),
    tirarToken: (codigo: number) => void gravarToken(codigo, true),
    atualizado: config.atualizadoEm ? new Date(config.atualizadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) + (config.atualizadoPor ? ' por ' + config.atualizadoPor : '') : '',
  };
}
