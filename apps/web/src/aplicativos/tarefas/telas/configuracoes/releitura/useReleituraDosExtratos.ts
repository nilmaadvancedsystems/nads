// ViewModel da Releitura dos extratos (Configurações › Admin, 10/11/2026: "eu quero que a correção de um bug valha para todas
// as empresas"). Relê com o leitor de agora os extratos do Drive de todas as empresas que têm extrato guardado, uma por vez,
// com as proteções da releitura automática (core: aplicarReleituras), e diz o que fez em cada uma. Os extratos importados do
// computador não têm o PDF ligado: esses são relidos quando a empresa é aberta, se o PDF do mês estiver no Drive.
import { extrator as x } from '@nads/core';
import { useRef, useState } from 'react';
import { useOperador } from '../../../casca/operador';
import { empresasComExtrato, esperarExtratorDaEmpresa, repoDoExtrator } from '../../../dados/extrator';
import { useDrive } from '../../../etapas/extrator/dados/repo';

/** O que a releitura fez numa empresa. */
export interface LinhaDaReleitura {
  empresa: string;
  relidos: number;
  /** os que ficaram com a leitura de antes, e o motivo */
  mantidos: { nome: string; motivo: string }[];
  /** os relidos que não fecham com o saldo que o banco imprime */
  naoFecham: string[];
  /** os de leitor antigo sem o PDF ligado (importados do computador): relidos ao abrir a empresa, se o PDF estiver no Drive */
  esperandoODrive: number;
  erros: { nome: string; erro: string }[];
}

const mensagem = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useReleituraDosExtratos() {
  const { operador } = useOperador();
  const { drive, acesso } = useDrive();
  const [rodando, setRodando] = useState(false);
  const [andamento, setAndamento] = useState<{ feitas: number; total: number; empresa: string; passo: string } | null>(null);
  const [linhas, setLinhas] = useState<LinhaDaReleitura[]>([]);
  const [erro, setErro] = useState('');
  const [terminou, setTerminou] = useState(false);
  const cancelado = useRef(false);

  async function relerUma(nome: string, passo: (texto: string) => void): Promise<LinhaDaReleitura> {
    const repo = repoDoExtrator();
    const linha: LinhaDaReleitura = { empresa: nome, relidos: 0, mantidos: [], naoFecham: [], esperandoODrive: 0, erros: [] };
    await esperarExtratorDaEmpresa(nome);
    const e = repo.obter(nome);
    if (!e) return linha;
    // as leituras novas primeiro (baixar e ler demora); a troca vai depois, sobre a empresa como estiver na hora de gravar
    const lidos = new Map<string, x.ArquivoLido>();
    for (const a of x.extratosParaReler(e)) {
      if (cancelado.current) break;
      if (!a.drive) continue;
      passo(a.nome);
      try {
        const lido = await x.lerArquivo(a.drive.nome, new Uint8Array(await drive.baixar(a.drive.id, a.drive.nome)), 'banco');
        // o erro de leitura (o robô fora, o PDF que não abriu) não marca o arquivo como relido: fica para a próxima vez
        if (lido.erro && !lido.faturaDeCartao && !lido.naoEExtrato) linha.erros.push({ nome: a.nome, erro: lido.erro });
        else lidos.set(a.id, lido);
      } catch (err) {
        linha.erros.push({ nome: a.nome, erro: mensagem(err) });
      }
    }
    const agora = repo.obter(nome);
    if (lidos.size && agora && repo.carregada(nome)) {
      const r = x.aplicarReleituras(agora, lidos, new Date());
      if (r.relidos) repo.salvar(r.empresa);
      linha.relidos = r.relidos;
      linha.mantidos = r.mantidos;
      linha.naoFecham = r.naoFecham;
    }
    linha.esperandoODrive = x.extratosParaRelerPeloDrive(repo.obter(nome) ?? e).length;
    return linha;
  }

  async function relerTodas() {
    if (rodando) return;
    cancelado.current = false;
    setRodando(true); setTerminou(false); setErro(''); setLinhas([]);
    try {
      const nomes = (await empresasComExtrato()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      for (const [i, nome] of nomes.entries()) {
        if (cancelado.current) break;
        const passo = (texto: string) => setAndamento({ feitas: i, total: nomes.length, empresa: nome, passo: texto });
        passo('carregando a empresa');
        let linha: LinhaDaReleitura;
        try {
          linha = await relerUma(nome, passo);
        } catch (err) {
          linha = { empresa: nome, relidos: 0, mantidos: [], naoFecham: [], esperandoODrive: 0, erros: [{ nome: 'a empresa', erro: mensagem(err) }] };
        }
        setLinhas(ls => [...ls, linha]);
      }
    } catch (err) {
      setErro('Não consegui listar as empresas com extrato: ' + mensagem(err));
    }
    setAndamento(null);
    setRodando(false);
    setTerminou(true);
  }

  const soma = (f: (l: LinhaDaReleitura) => number) => linhas.reduce((t, l) => t + f(l), 0);
  return {
    podeUsar: !!operador?.admin,
    /** o Drive do escritório precisa do login do Entregas */
    semDrive: acesso.pronto && !acesso.entrou,
    rodando, andamento, linhas, erro, terminou,
    cancelado: cancelado.current,
    totais: {
      empresas: linhas.length,
      relidos: soma(l => l.relidos),
      mantidos: soma(l => l.mantidos.length),
      naoFecham: soma(l => l.naoFecham.length),
      esperandoODrive: soma(l => l.esperandoODrive),
      erros: soma(l => l.erros.length),
    },
    relerTodas: () => { void relerTodas(); },
    parar: () => { cancelado.current = true; },
  };
}
