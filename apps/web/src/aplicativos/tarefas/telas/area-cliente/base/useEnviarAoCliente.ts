// Mandar um arquivo ao cliente (26/11/2026: "tem que ter a opcao de subir um arquivo por aqui" e "nao tem como eu enviar um
// arquivo via area do cliente por aqui"; o dono escolheu "Pelo Drive"). O arquivo vai pelo mesmo caminho do "Enviar para o
// Claudio Secretário" (enviosSecretario, em pedaços), com o campo cliente = "@area-do-cliente/<área>": o robô da nuvem grava
// em ÁREA DO CLIENTE\DO ESCRITÓRIO\<ÁREA> da empresa e o robô do PC publica na Central de documentos › Do escritório do
// cliente (em até 30 min). Usado pela seção Documentos e pelo Anexar da resposta da solicitação.
import { areaCliente as ac, entregas as e } from '@nads/core';
import { useState } from 'react';
import { useDriveDoEntregas } from '../../../dados/repo';

/** quanto a tela espera o robô gravar no Drive */
const ESPERA_MS = 3 * 60 * 1000;

export interface EmpresaParaEnviar { codigo: number; nome: string }

export type AndamentoDoEnvioAoCliente =
  | { fase: 'parado' }
  | { fase: 'enviando'; texto: string }
  | { fase: 'pronto'; nomeFinal: string; pasta: string }
  | { fase: 'erro'; texto: string };

/** O texto do andamento (enviando as partes, na fila, gravando). */
function textoDoAndamento(a: e.AndamentoDoEnvio): string {
  if (a.status === 'enviando') return a.partes ? 'Subindo o arquivo… (' + (a.enviadas ?? 0) + ' de ' + a.partes + ')' : 'Subindo o arquivo…';
  if (a.status === 'gravando') return 'O robô está gravando no Drive…';
  return 'Na fila do robô…';
}

/** "@area-do-cliente/dp" → a área; os outros envios não são ao cliente. */
export const areaDoEnvioFeito = (cliente: string): ac.AreaDoEscritorio | null =>
  cliente.startsWith(ac.MARCA_DO_ENVIO_AO_CLIENTE) ? (ac.AREAS_DO_ESCRITORIO.find(a => a.valor === cliente.slice(ac.MARCA_DO_ENVIO_AO_CLIENTE.length))?.valor ?? null) : null;

export function useEnviarAoCliente() {
  const drive = useDriveDoEntregas();
  const [andamento, setAndamento] = useState<AndamentoDoEnvioAoCliente>({ fase: 'parado' });

  /** Sobe o arquivo e espera o robô gravar. Resolve com o nome final no Drive; rejeita com o motivo em português. */
  function enviar(arquivo: File, empresa: EmpresaParaEnviar, area: ac.AreaDoEscritorio): Promise<{ nomeFinal: string; pasta: string }> {
    const erro = ac.erroDoEnvioAoCliente({ nome: arquivo.name, tamanho: arquivo.size });
    if (erro) { setAndamento({ fase: 'erro', texto: erro }); return Promise.reject(new Error(erro)); }
    if (drive.exemplos) {
      const r = { nomeFinal: arquivo.name, pasta: empresa.codigo + ' - ' + empresa.nome + '/ÁREA DO CLIENTE/DO ESCRITÓRIO/' + ac.SUBPASTA_DA_AREA[area] };
      setAndamento({ fase: 'pronto', ...r });
      return Promise.resolve(r);
    }
    setAndamento({ fase: 'enviando', texto: 'Lendo o arquivo…' });
    return arquivo.arrayBuffer().then(buf => new Promise((ok, falha) => {
      const competencia = e.competenciaDe(new Date());
      let parar = () => {};
      // o robô parado não pode deixar a tela presa em "enviando" (revisão de 26/11/2026)
      const prazo = setTimeout(() => {
        parar();
        const texto = 'O robô não respondeu em 3 minutos. O arquivo pode chegar depois; confira em Enviados por mim.';
        setAndamento({ fase: 'erro', texto });
        falha(new Error(texto));
      }, ESPERA_MS);
      parar = drive.enviar({ nome: arquivo.name, bytes: new Uint8Array(buf) }, { competencia, cliente: ac.clienteDoEnvioAoCliente(area), codigo: String(empresa.codigo) }, a => {
        if (a.status === 'pronto') {
          clearTimeout(prazo); parar();
          const r = { nomeFinal: a.nomeFinal || arquivo.name, pasta: a.pasta || '' };
          setAndamento({ fase: 'pronto', ...r });
          ok(r);
        } else if (a.status === 'erro') {
          clearTimeout(prazo); parar();
          const texto = 'Não foi: ' + (a.erro || 'erro do robô') + '.';
          setAndamento({ fase: 'erro', texto });
          falha(new Error(texto));
        } else setAndamento({ fase: 'enviando', texto: textoDoAndamento(a) });
      });
    }), (err: Error) => { setAndamento({ fase: 'erro', texto: 'Não consegui ler o arquivo: ' + err.message }); throw err; });
  }

  return { andamento, enviar, limpar: () => setAndamento({ fase: 'parado' }), ocupado: andamento.fase === 'enviando' };
}
