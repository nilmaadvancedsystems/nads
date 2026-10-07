# robo/ — o robô do escritório

Movido do repositório do Entregas (pasta `scripts/`) em 07/10/2026. Não é o app: é o serviço que roda fora do navegador.

- **Na máquina do Google** (`robo-nilma`): `vigia-robo.js` — Gmail, avisos no celular, cobranças, Drive, backups e o FGTS Digital (`fgts-digital.js`). A máquina se prepara com `nuvem/iniciar-maquina.sh` (o metadado `startup-script`) e puxa este repositório, ramo `desenvolvimento`. Atualizar: push + trocar o metadado `robo-versao`.
- **No PC do escritório**: `arquivador.js` (o "Arquivar agora" e o SIEG), ligado pela pasta Inicializar do Windows (`iniciar-arquivador.cmd`).
- Credenciais, memória do robô e registros ficam só no disco de quem roda (ver `.gitignore`).
- Teste: `node teste-robo.js`.
