# Relatório Técnico e Auditoria de Segurança — PROJETO PSI

**Data da Atualização**: 30/10/2026  
**Versão**: 1.4.0-security-hardened-phase2  
**Escopo**: Segunda Etapa de Hardening do Firestore, Integridade de Dados e Blindagem Transacional  
**Ambiente**: SaaS Web Responsivo Multi-tenant (React 19 + TypeScript + Vite + Tailwind CSS + Firebase)  
**Database**: Firestore `ai-studio-projetopsi-5145c60e-456a-4133-8f60-cec68d0e9d78` (nam5)

---

## 1. RESUMO EXECUTIVO DAS IMPLEMENTAÇÕES DA ETAPA 2

Nesta segunda etapa de hardening, foram implementadas blindagens aprofundadas a nível de regras de segurança do Firestore (`firestore.rules`), modelo intermediário (`firebase-blueprint.json`), tipos e serviços de persistência e auditoria:

1. **Proteção Integral de Perfis de Usuário (`/users/{userId}`)**:
   - Bloqueio estrito de escalada de privilégios e alteração não autorizada de atributos no banco.
   - Um usuário comum está **impossibilitado** de alterar `role`, `uid`, `clinicId`, `professionalId`, `status`, `permissions` ou dados de controle administrativo.
   - Apenas campos de perfil expressamente autorizados (`displayName`, `phone`, `avatarUrl`, `photoURL`, `updatedAt`) podem ser modificados via `affectedKeys().hasOnly(...)`.
   - Modificações de vínculos institucionais e suspensão de contas são reservadas a procedimentos administrativos controlados (`isSuperAdmin()`).

2. **Integridade Estrutural e Imutabilidade em Agendamentos (`/appointments/{appId}`)**:
   - Campos de relacionamento central (`psychologistId`, `patientId`, `patientUserId`, `clinicId`, `roomId`) tornaram-se **estritamente imutáveis** em operações de atualização.
   - O paciente autenticado **não pode alterar livremente status administrativos** (`confirmed`, `completed`, `no_show`, `rejected`).
   - O paciente tem permissão apenas para cancelar ou solicitar cancelamento de sua própria sessão (`status in ['cancelled', 'cancellation_requested']`) e atualizar justificativa/notas.
   - O psicólogo titular pode gerenciar o fluxo de confirmação, recusa, conclusão e reagendamento conforme as regras de negócio.

3. **Notificações com Validação e Anti-Spoofing (`/notifications/{notifId}`)**:
   - Destinatário validado obrigatoriamente (`recipientUserId is string && size() > 0`).
   - Anti-spoofing implementado: o `senderId` é verificado contra `request.auth.uid`, impedindo que usuários forjem notificações falsas em nome de terceiros.
   - `recipientUserId` tornou-se estritamente imutável na atualização.
   - O destinatário só pode alterar o status de leitura (`read`) e data (`updatedAt`), sendo impedido de adulterar textos de avisos ou links.

4. **Isolamento Multi-tenant de Assinaturas SaaS (`/subscriptions/{subId}`)**:
   - Eliminada qualquer consulta genérica ou listagem pública de assinaturas (`allow get, list: if isSignedIn()` foi removido).
   - Usuários comuns só têm acesso de leitura ao documento de assinatura de sua própria conta ou clínica (`resource.data.targetId == request.auth.uid || resource.data.userId == request.auth.uid`).
   - Apenas o superadministrador tem permissão para cadastrar ou modificar dados contratuais e planos.

5. **Diretório de Profissionais (`/professionals/{profId}`)**:
   - Vínculo com a identidade do usuário (`userId`) protegido como imutável após a criação (`request.resource.data.userId == resource.data.userId`).
   - Bloqueio que impede qualquer usuário de alterar registros de outros psicólogos cadastrados.

6. **Blindagem e Não Mascaramento de Auditoria (`/audit_logs` e `persistAuditLog`)**:
   - A função `persistAuditLog` foi reescrita para **não engolir erros**. Falhas de persistência retornam feedback estruturado `{ success: false, error: string }`.
   - Função `sanitizeAuditLog` criada para filtrar e omitir proativamente quaisquer menções a senhas (`password`), evoluções clínicas (`evolutionNotes`), notas privadas (`privateNotes`) ou hipóteses diagnósticas (`diagnosticHypothesis`, `conductPlan`).
   - A coleção `/audit_logs` permanece estritamente append-only, com `update` e `delete` desabilitados por regra e consulta restrita a administradores.

7. **Prontuários Clínicos (`/clinical_records/{recordId}`) — Sigilo Profissional Absoluto**:
   - Padrão Master Gate implementado na criação: exige validação relacional de que o paciente existe no Firestore e pertence legitimamente àquele psicólogo (`exists(...) && get(...).data.psychologistId == request.auth.uid`).
   - Campos `psychologistId` e `patientId` tornados imutáveis na atualização.
   - Acesso estritamente negado a superadministradores, gestores e pacientes.

---

## 2. ARQUIVOS ALTERADOS NO PROJETO

1. `firestore.rules`:
   - Regras atualizadas com verificação de campos permitidos (`affectedKeys().hasOnly`), imutabilidade relacional em `appointments`, `users`, `clinical_records`, `professionals`, isolamento em `subscriptions` e anti-spoofing em `notifications`. Regras implantadas no Firebase via `DeployRules` RPC.
2. `firebase-blueprint.json`:
   - Atualizado o esquema de `Notification` para registrar `senderId` com limite de 128 caracteres.
3. `src/types/index.ts`:
   - Adicionado o campo opcional `senderId?: string` na interface `AppNotification`.
4. `src/services/firestoreService.ts`:
   - Refatorada a função `persistAuditLog` para retornar `{ success: boolean; error?: string }` e tratar erros com `handleFirestoreError`.
   - Adicionada a função `sanitizeAuditLog` para higienização de logs antes do envio ao banco.
5. `src/context/AppContext.tsx`:
   - Incluído `senderId: currentUser.uid` na geração de notificações em solicitações, confirmações e cancelamentos de agendamentos.
   - Conectado o retorno estruturado de persistência de auditoria.
6. `src/utils/rules.ts`:
   - Implementadas as funções lógicas de validação de regras de segurança: `validateUserProfileUpdate`, `validateAppointmentUpdate`, `validateNotificationCreate`, `validateNotificationUpdate`, `validateSubscriptionAccess`, `validateClinicalRecordWrite`.
7. `src/utils/security_audit.test.ts`:
   - Suíte de testes expandida de 20 para 30 testes unitários automatizados, cobrindo integralmente todos os novos requisitos de segurança.

---

## 3. SEPARAÇÃO E RESULTADOS DOS TESTES

Em cumprimento rigoroso à transparência técnica requerida:

### 3.1 Testes Unitários Executados com Sucesso (30/30)
Executados diretamente no ambiente com `npx tsx --test src/utils/*.test.ts`:

- `AUDIT 1`: Sessão não autenticada é estritamente nula e bloqueada.
- `AUDIT 2`: Alternância fictícia de perfil (`switchUserRole`) ausente e proibida.
- `AUDIT 3`: Auto-cadastro com privilégio de superadministrador é rejeitado com exceção.
- `AUDIT 4`: Superadministrador estritamente bloqueado de prontuários clínicos.
- `AUDIT 5`: Psicólogo A não acessa prontuários do Psicólogo B.
- `AUDIT 6`: Gestor de clínica não acessa dados clínicos.
- `AUDIT 7`: Paciente não acessa evoluções clínicas ou prontuários internos.
- `AUDIT 8`: Isolamento multi-tenant de salas e agendamentos entre clínicas.
- `AUDIT 9`: Coleções vazias no Firestore retornam listas vazias (`[]`), sem dados simulados.
- `AUDIT 10`: Falhas de persistência não são mascaradas e retornam erro estruturado.
- `AUDIT 11`: Detecção de conflito de sala física e profissional no agendamento com buffer.
- `AUDIT 12`: Máquina de estados de agendamentos impede transições ilegais ou atalhos.
- `AUDIT 13`: Integridade e imutabilidade do esquema de logs de auditoria.
- `AUDIT 14`: Usuário comum **não consegue** alterar `role`, `uid`, `status`, `clinicId`, `professionalId` (somente campos seguros de perfil).
- `AUDIT 15`: Superadministrador tem permissão para ajustes administrativos de perfil.
- `AUDIT 16`: Identificadores centrais de agendamento (`psychologistId`, `patientId`, `patientUserId`, `clinicId`, `roomId`) são estritamente imutáveis.
- `AUDIT 17`: Paciente não pode definir status administrativos (`confirmed`, `completed`, `no_show`), mas pode cancelar ou solicitar cancelamento.
- `AUDIT 18`: Criação de notificação bloqueia falsificação de remetente (`senderId`) e exige destinatário.
- `AUDIT 19`: Destinatário da notificação é imutável e usuário só pode alterar status de leitura (`read`).
- `AUDIT 20`: Assinaturas SaaS não podem ser consultadas entre diferentes inquilinos/usuários.
- `AUDIT 21`: Prontuário clínico exige vínculo relacional legítimo com paciente e proíbe alteração de `psychologistId`/`patientId`.
- `AUDIT 22`: Higienização de auditoria expurga senhas, hipóteses diagnósticas e anotações clínicas de logs.
- `AUDIT 23`: Persistência de auditoria retorna erro estruturado em caso de falha de permissão ou rede.
- (E mais 7 testes de cálculo financeiro, conversão de horários, cálculo de slots livres e intervalos de agenda).

**Resultado**: 30 aprovados, 0 falhas (tempo de execução: ~950ms).

### 3.2 Testes de Integração Executados com Sucesso
- Compilação completa do TypeScript sem erros (`npx tsc --noEmit` exit code 0).
- Compilação bem-sucedida do frontend via Vite (`compile_applet` exit code 0).
- Verificação do tratamento de erros do Firestore através do interceptor padronizado `handleFirestoreError`.

### 3.3 Testes de Regras de Segurança do Firestore
- Regras revisadas, validadas e publicadas no projeto Firebase ativo (`ai-studio-projetopsi-5145c60e-456a-4133-8f60-cec68d0e9d78`, região `nam5`) através do método `DeployRules` RPC do FAX service, retornando sucesso `RPC action fax.DeployRules succeeded: {}`.
- Predicados e restrições booleanas testados e validados nas funções de autorização do domínio.

### 3.4 Verificações que Não Puderam ser Executadas pelo Ambiente
- **Firebase Local Emulator Suite (Java Runtime)**: O ambiente de execução do container Linux não dispõe de Java JRE/JDK instalado (`sh: 1: java: not found`). O executável do emulador local do Firestore depende de Java 11+. Por esse motivo, os testes de regras foram realizados via testes unitários dos predicados de validação e implantação direta no banco provisionado na nuvem.
- **Auditoria Externa Independente de Segurança (Pentest Terceirizado)**: A realização de testes de penetração externa com tentativa de exploração de vulnerabilidades por consultoria de segurança independente não foi realizada e é requisito obrigatório pré-produção.
- **Testes de Carga e Estresse Concorrente**: Testes de volume de requisições simultâneas para validação dos limites do plano gratuito Spark (50.000 leituras/dia, 20.000 gravações/dia).

---

## 4. LIMITAÇÕES CONHECIDAS E PENDÊNCIAS

1. **Plano Spark (Custo Zero)**: A aplicação opera estritamente sob as cotas gratuitas do Firebase Spark. Não há cobrança, APIs externas pagas ou gateways de SMS/WhatsApp.
2. **Cloud Functions para Operações Sensíveis**: Embora as regras do Firestore barrem com eficácia escalada de privilégios e violações relacionais no cliente, a emissão de faturas automáticas e a sincronização periódica de status de assinatura devem preferencialmente residir em Cloud Functions quando o sistema for publicado para comercialização.
3. **Certificação Jurídica de Conformidade**: Este sistema incorpora arquitetura aderente às diretrizes do CFP (Resolução nº 01/2009) e LGPD (Lei 13.709/2018, Art. 11), porém a conformidade legal formal de um SaaS de saúde requer parecer emitido por encarregado de dados (DPO) e assessoria jurídica especializada antes da abertura ao público em geral.
