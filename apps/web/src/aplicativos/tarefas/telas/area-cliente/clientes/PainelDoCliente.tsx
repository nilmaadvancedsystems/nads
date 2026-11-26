// Uma empresa na seção Clientes (26/11/2026, o módulo Área do Cliente refeito), na janela da empresa do Cadastro
// (cad-janela, com as abas à esquerda; "nao gostei dessa side bar pra essas config"; "essas telas… ta toda fora dos
// elementos predefinidos do nads"). As abas: Link e senhas (só o admin: "isso aqui do link da empresa deve aparecer apenas
// para admim"; as peças BlocoDoLink e PessoasComSenha, as mesmas de antes no Cadastro), Atividade (as guias que o cliente
// abriu) e Documentos do escritório (a pasta do Drive, só leitura). Só desenha; tudo vem de usePainelDoCliente.
import { Esqueleto, Icone, Vazio } from '@nads/ui';
import { useState } from 'react';
import { JanelaGrande, Selo } from '../base/Base';
import { BlocoDoLink } from '../partes/BlocoDoLink';
import { PessoasComSenha } from '../partes/PessoasComSenha';
import { usePainelDoCliente } from './usePainelDoCliente';

type Aba = 'acesso' | 'atividade' | 'documentos';

export function PainelDoCliente({ codigo, nome, onFechar }: { codigo: number; nome: string; onFechar: () => void }) {
  const vm = usePainelDoCliente(codigo, nome);
  const l = vm.link;
  const abas = [
    ...(vm.pode ? [{ id: 'acesso' as Aba, rotulo: 'Link e senhas', icone: 'link' as const }] : []),
    { id: 'atividade' as Aba, rotulo: 'Atividade', icone: 'clock' as const },
    { id: 'documentos' as Aba, rotulo: 'Documentos do escritório', icone: 'pasta' as const, conta: vm.documentos.lista.length },
  ];
  const [aba, setAba] = useState<Aba>(vm.pode ? 'acesso' : 'atividade');
  const e = { codigo, nome };
  return (
    <JanelaGrande codigo={codigo} titulo={nome} rotulo={'Área do Cliente de ' + nome} onFechar={onFechar} abas={abas} aba={aba} onAba={setAba}
      selo={vm.carregando ? undefined : vm.temLink ? <Selo tom="ok">Com link</Selo> : <Selo tom="neutro">Sem link</Selo>}>
      {aba === 'acesso' && vm.pode && <>
        <h2 className="cfg-titulo">Link e senhas</h2>
        <BlocoDoLink endereco={l.endereco} data={l.data} podeMexer={l.acoes.pode} carregando={l.carregando} ocupado={l.acoes.ocupada === codigo}
          aoGerar={() => void l.acoes.gerar(e)} aoCopiar={() => l.link && l.acoes.copiar(l.link.token)} aoWhatsApp={() => l.link && l.acoes.whatsapp(e, l.link.token)}
          aoTrocar={() => void l.acoes.trocar(e)} aoRevogar={() => void l.acoes.revogar(e)}
          logo={l.logo} gravandoLogo={l.gravandoLogo} aoEnviarLogo={l.enviarLogo} aoTirarLogo={l.tirarLogo} />
        <PessoasComSenha vm={vm.pessoas} />
        {vm.verComoCliente && (
          <button type="button" className="btn btn-outline" onClick={vm.verComoCliente} title="Abre a área desta empresa como o cliente vê (modo desenvolvedor: nada é gravado)">
            <Icone nome="olho" width={16} height={16} />Ver como o cliente
          </button>
        )}
      </>}

      {aba === 'atividade' && <>
        <h2 className="cfg-titulo">Atividade</h2>
        {!vm.temLink ? <Vazio icone="link" titulo="Sem acesso à Área do Cliente" texto="Esta empresa ainda não tem link." />
          : vm.guiasAbertas.erro ? <p className="hint registro-dica-erro">{vm.guiasAbertas.erro}</p>
          : vm.guiasAbertas.lista.length ? (
            <div className="card">
              <div className="card-head"><h3>Guias que o cliente abriu</h3></div>
              <ul className="ent-linhas">
                {vm.guiasAbertas.lista.map(g => <li key={g.chave}><div><b>{g.rotulo}</b></div><span className="fraco">{g.quando}</span></li>)}
              </ul>
            </div>
          ) : <Vazio icone="fileText" titulo="Nenhuma guia aberta" texto="O cliente ainda não abriu nenhuma guia pelo link (nos últimos 4 meses)." />}
      </>}

      {aba === 'documentos' && <>
        <h2 className="cfg-titulo">Documentos do escritório</h2>
        <p className="hint" style={{ marginBottom: 12 }}>O que está na pasta ÁREA DO CLIENTE › DO ESCRITÓRIO da empresa no Drive: o cliente vê em “Do escritório”.</p>
        {vm.documentos.erro ? <p className="hint registro-dica-erro">{vm.documentos.erro}</p>
          : vm.documentos.carregando ? <Esqueleto linhas={3} />
          : vm.documentos.semPasta ? <Vazio icone="pasta" titulo="Sem pasta no Drive" texto="O mapa do Drive ainda não tem a pasta desta empresa no ano." />
          : vm.documentos.lista.length ? (
            <div className="table-wrap">
              <table className="table-compact">
                <thead><tr><th>Arquivo</th><th>Área</th><th>Data</th><th className="num">Tamanho</th></tr></thead>
                <tbody>
                  {vm.documentos.lista.map(d => (
                    <tr key={d.id}><td className="wrap">{d.nome}</td><td><Selo tom="neutro">{d.area}</Selo></td><td className="fraco">{d.data}</td><td className="num">{d.tamanho}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Vazio icone="pasta" titulo="Nenhum documento" texto="Nenhum arquivo na pasta DO ESCRITÓRIO. Mande pela seção Documentos › Enviar ao cliente." />}
      </>}
    </JanelaGrande>
  );
}
