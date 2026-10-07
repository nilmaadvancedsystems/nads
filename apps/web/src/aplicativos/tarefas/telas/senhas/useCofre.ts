// ViewModel do cofre (Vitor, 07/10/2026: "algo como a criptografia do WhatsApp"): em que pé está o cofre para quem está
// usando — ainda não existe (criar), este navegador não tem chave (pedir acesso), pediu e espera, ou aberto — e as ações:
// criar (gera o código de recuperação), pedir acesso, recuperar pelo código, liberar e recusar pedidos, tirar o acesso
// (troca a chave do cofre e gera um código novo), um código de recuperação novo, ler e gravar os segredos de uma empresa.
// A chave do cofre aberta fica só na memória desta aba (todas as telas usam a mesma).
import { cofre as c, formatos } from '@nads/core';
import { useRetorno } from '@nads/ui';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { guardarChavePrivada, idDaChave, lerChavePrivada } from '../../dados/chaveLocal';
import { useCofreRepo } from '../../dados/repo';
import { imprimirCodigoDoCofre } from './imprimirCodigo';
import { modoDesenvolvedor } from '../../../../comum/modoDesenvolvedor';

/** No modo desenvolvedor nada vai para o banco: o cofre não grava (Vitor, 07/10/2026: criou o cofre no modo e não abriu). */
const AVISO_DEV = 'Modo desenvolvedor ligado: o cofre não grava nada. Desligue no avatar › Modo desenvolvedor para usar o cofre.';

// a chave aberta é de quem abriu (trocou de pessoa na mesma aba: fecha)
let aberta: { versao: number; chave: CryptoKey; dono: string } | null = null;
let verAberta = 0;
const ouvintes = new Set<() => void>();
function abrirCom(v: { versao: number; chave: CryptoKey; dono: string } | null) { aberta = v; verAberta++; for (const f of ouvintes) f(); }
const assinarAberta = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };

export type EstadoDoCofre = 'carregando' | 'erro' | 'novo' | 'sem-chave' | 'aguardando' | 'aberto';

export function useCofre() {
  const repo = useCofreRepo();
  useSyncExternalStore(assinarAberta, () => verAberta, () => verAberta);
  const { toast, modal } = useRetorno();
  const eu = repo.eu();
  const id = eu ? idDaChave(eu.uid) : '';
  const carregado = repo.carregado();
  const config = repo.config();
  const pessoas = repo.pessoas();
  const minha = pessoas.find(p => p.id === id) || null;
  const [temPrivada, setTemPrivada] = useState<boolean | null>(null);
  const [ocupado, setOcupado] = useState(false);

  // abre sozinho: a chave privada deste navegador destranca a cópia desta pessoa
  useEffect(() => {
    if (!id) return;
    let vale = true;
    void lerChavePrivada(id).then(async k => {
      if (!vale) return;
      setTemPrivada(!!k);
      if (k && config && minha?.trancada && minha.versao === config.versao && (aberta?.versao !== config.versao || aberta.dono !== id)) {
        try { abrirCom({ versao: config.versao, chave: await c.destrancar(minha.trancada, k), dono: id }); } catch { /* a cópia não é desta chave: pedir de novo */ }
      }
    });
    return () => { vale = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, minha?.trancada, minha?.versao, config?.versao]);

  const estado: EstadoDoCofre = !carregado ? 'carregando' : repo.erro() ? 'erro' : !config ? 'novo'
    : aberta && aberta.versao === config.versao && aberta.dono === id ? 'aberto' : minha && temPrivada && !minha.trancada ? 'aguardando' : 'sem-chave';

  /** mostra o código até a pessoa dizer que guardou; o Imprimir abre a folha para imprimir e volta para cá */
  async function mostrarCodigo(codigo: string, titulo: string) {
    for (;;) {
      const r = await modal<'imprimir' | 'guardei'>({ icone: 'lock', titulo, texto: codigo + ' — guarde fora do sistema (impresso). É a única forma de abrir o cofre se todos perderem o acesso.',
        botoes: [{ rotulo: 'Imprimir', valor: 'imprimir', variante: 'btn-outline' }, { rotulo: 'Guardei o código', valor: 'guardei', variante: 'btn-primary' }] });
      if (r !== 'imprimir') return;
      if (!imprimirCodigoDoCofre(codigo, titulo)) toast('O navegador bloqueou a janela de impressão: libere as janelas deste site.');
    }
  }
  async function tentar(f: () => Promise<void>) {
    if (ocupado) return;
    if (modoDesenvolvedor()) { toast(AVISO_DEV); return; }
    setOcupado(true);
    try { await f(); } catch (e) { toast('Não deu: ' + (e instanceof Error ? e.message : String(e))); } finally { setOcupado(false); }
  }
  async function minhaChaveNova() {
    const par = await c.novoParDaPessoa();
    await guardarChavePrivada(id, par.privada);
    setTemPrivada(true);
    return par;
  }
  const agora = () => new Date().toISOString();

  return {
    estado,
    ocupado,
    /** o modo desenvolvedor está ligado (o cofre não grava) */
    dev: modoDesenvolvedor(),
    avisoDev: AVISO_DEV,
    exemplos: repo.exemplos,
    erro: repo.erro(),
    eu: eu?.nome || '',
    meuId: id,
    /** quem tem acesso (a cópia na versão atual) e os pedidos (sem cópia, ou de uma chave antiga) */
    comAcesso: pessoas.filter(p => p.trancada && p.versao === config?.versao),
    pedidos: pessoas.filter(p => !p.trancada || p.versao !== config?.versao),
    itens: repo.itens(),
    criar: () => tentar(async () => {
      if (!eu) return;
      const chave = await c.novaChaveDoCofre();
      const par = await minhaChaveNova();
      const codigo = c.novoCodigoDeRecuperacao();
      await repo.criar(
        { versao: 1, criadoEm: agora(), criadoPor: eu.nome, recuperacao: await c.trancarComCodigo(chave, codigo) },
        { id, nome: eu.nome, publica: par.publica, criadaEm: agora(), trancada: await c.trancarPara(chave, par.publica), versao: 1, liberadoPor: eu.nome, liberadoEm: agora() },
      );
      abrirCom({ versao: 1, chave, dono: id });
      await mostrarCodigo(codigo, 'Cofre criado: o código de recuperação');
    }),
    pedirAcesso: () => tentar(async () => {
      if (!eu) return;
      const par = await minhaChaveNova();
      await repo.registrarChave({ id, nome: eu.nome, publica: par.publica, criadaEm: agora() });
      toast('Pedido enviado: alguém com acesso libera em Senhas › Acesso.');
    }),
    recuperar: (codigo: string) => tentar(async () => {
      if (!eu || !config) return;
      let chave: CryptoKey;
      try { chave = await c.destrancarComCodigo(config.recuperacao, codigo); } catch { toast('Código de recuperação errado.'); return; }
      const par = await minhaChaveNova();
      await repo.registrarChave({ id, nome: eu.nome, publica: par.publica, criadaEm: agora(), trancada: await c.trancarPara(chave, par.publica), versao: config.versao, liberadoPor: eu.nome + ' (código)', liberadoEm: agora() });
      abrirCom({ versao: config.versao, chave, dono: id });
    }),
    liberar: (p: c.ChaveDaPessoa) => tentar(async () => {
      if (!aberta || !config || !eu) return;
      await repo.liberar(p.id, await c.trancarPara(aberta.chave, p.publica), config.versao, eu.nome);
      toast(p.nome + ' liberado no cofre.');
    }),
    recusar: (p: c.ChaveDaPessoa) => tentar(() => repo.apagarChave(p.id)),
    /** tira o acesso: o cofre troca de chave (quem saiu não abre mais nada) e sai um código de recuperação novo */
    tirarAcesso: (p: c.ChaveDaPessoa) => tentar(async () => {
      if (!aberta || !config || !eu) return;
      const ok = await modal({ icone: 'alert', titulo: 'Tirar o acesso de ' + p.nome + '?', texto: 'O cofre troca de chave e sai um código de recuperação novo.',
        botoes: [{ rotulo: 'Cancelar', valor: false, variante: 'btn-outline' }, { rotulo: 'Tirar o acesso', valor: true, variante: 'btn-primary' }] });
      if (!ok) return;
      const nova = await c.novaChaveDoCofre();
      const versao = config.versao + 1;
      const itens: { id: string; doc: c.DocDoCofre }[] = [];
      for (const [k, d] of repo.itens()) {
        const segredos = await c.decifrar<c.SegredosDaEmpresa>(aberta.chave, d);
        itens.push({ id: k, doc: { ...d, ...(await c.cifrar(nova, segredos)), versao } });
      }
      const ficam = pessoas.filter(x => x.id !== p.id && x.trancada && x.versao === config.versao);
      const chaves = await Promise.all(ficam.map(async x => ({ id: x.id, trancada: await c.trancarPara(nova, x.publica) })));
      const codigo = c.novoCodigoDeRecuperacao();
      await repo.trocarChave({ ...config, versao, recuperacao: await c.trancarComCodigo(nova, codigo) }, chaves, itens);
      await repo.apagarChave(p.id);
      abrirCom({ versao, chave: nova, dono: id });
      await mostrarCodigo(codigo, 'Acesso tirado: o código de recuperação novo');
    }),
    novoCodigo: () => tentar(async () => {
      if (!aberta || !config) return;
      const codigo = c.novoCodigoDeRecuperacao();
      await repo.salvarConfig({ ...config, recuperacao: await c.trancarComCodigo(aberta.chave, codigo) });
      await mostrarCodigo(codigo, 'O código de recuperação novo');
    }),
    /** as contas gov.br de pessoas (importadas da planilha) */
    contasGov: [...repo.itens()].filter(([, d]) => d.tipo === 'gov').map(([k, d]) => ({ id: k, nome: d.empresa, nivel: d.nivel || '', atualizadoEm: d.atualizadoEm, atualizadoPor: d.atualizadoPor })),
    /** embaralha cada conta da planilha com a chave do cofre (no navegador) e grava; devolve quantas */
    async importarContasGov(contas: readonly c.ContaGovDaPlanilha[]): Promise<number> {
      if (!aberta || aberta.dono !== id || !config || !eu) return 0;
      if (modoDesenvolvedor()) { toast(AVISO_DEV); return 0; }
      const itens: { id: string; doc: c.DocDoCofre }[] = [];
      for (const k of contas) {
        const segredos: c.SegredosDaEmpresa = { gov: { login: k.cpf, senha: k.senha, ...(k.obs ? { obs: k.obs } : {}) } };
        itens.push({ id: await c.idDaContaGov(k.cpf), doc: {
          tipo: 'gov', empresa: k.nome, codigo: null, nivel: k.nivel, versao: config.versao, ...(await c.cifrar(aberta.chave, segredos)),
          temGov: true, temCertificado: false, atualizadoEm: agora(), atualizadoPor: eu.nome,
        } });
      }
      await repo.salvarVarios(itens);
      return itens.length;
    },
    /** os segredos de um documento do cofre pelo id (as contas gov.br) */
    async lerPorId(docId: string): Promise<c.SegredosDaEmpresa | null> {
      const d = repo.itens().get(docId);
      if (!d || !aberta || aberta.dono !== id) return null;
      return c.decifrar<c.SegredosDaEmpresa>(aberta.chave, d);
    },
    async salvarConta(docId: string, gov: c.SenhaGov) {
      const d = repo.itens().get(docId);
      if (!d || !aberta || aberta.dono !== id || !config || !eu) return;
      if (modoDesenvolvedor()) { toast(AVISO_DEV); return; }
      await repo.salvar(docId, { ...d, versao: config.versao, ...(await c.cifrar(aberta.chave, { gov })), atualizadoEm: agora(), atualizadoPor: eu.nome });
      toast('Guardado no cofre.');
    },
    /** os segredos de uma empresa (null = ainda não tem nada no cofre) */
    async ler(empresa: string): Promise<c.SegredosDaEmpresa | null> {
      const d = repo.itens().get(formatos.slug(empresa));
      if (!d || !aberta || aberta.dono !== id) return null;
      return c.decifrar<c.SegredosDaEmpresa>(aberta.chave, d);
    },
    async salvar(empresa: string, codigo: number | null, segredos: c.SegredosDaEmpresa, avisar = true) {
      if (!aberta || aberta.dono !== id || !config || !eu) return;
      if (modoDesenvolvedor()) { toast(AVISO_DEV); return; }
      const cifrado = await c.cifrar(aberta.chave, segredos);
      await repo.salvar(formatos.slug(empresa), { empresa, codigo, versao: config.versao, ...cifrado, ...c.metaDosSegredos(segredos), atualizadoEm: agora(), atualizadoPor: eu.nome });
      if (avisar) toast('Guardado no cofre.');
    },
  };
}

export type VmCofre = ReturnType<typeof useCofre>;
