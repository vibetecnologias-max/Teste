# Relatório Técnico de Auditoria, Hardening e Evolução — PROJETO PSI

**Data da Atualização**: 31/10/2026  
**Versão**: 1.6.0-security-hardening-zip-audit  
**Escopo**: Auditoria Pós-Exportação do ZIP, Hardening Completo do Firestore, Segregação de Dados PII, Retificação Deontológica de Prontuários e Verificação de Regras  
**Ambiente**: Plataforma SaaS Web Responsiva Multi-tenant (React 19 + TypeScript + Vite + Tailwind CSS + Firebase)  
**Database**: Firestore `ai-studio-projetopsi-5145c60e-456a-4133-8f60-cec68d0e9d78` (nam5)

---

## 1. RESUMO EXECUTIVO DA AUDITORIA PÓS-EXPORTAÇÃO

A auditoria técnica independente da versão exportada do **Projeto Psi** validou os avanços prévios de segurança e identificou pontos cruciais de aprimoramento em 10 áreas fundamentais. Nesta rodada consolidada, todas as correções foram implementadas, testadas e implantadas no Firestore:

### 1. Diretório de Profissionais — Segregação Rigorosa de PII (`/professionals` vs `/professionals_public`)
- **Vulnerabilidade Anterior**: A regra anterior (`allow get, list: if isSignedIn();` em `/professionals`) expunha indistintamente e-mails pessoais, telefones privados e dados de remuneração para qualquer usuário autenticado.
- **Solução Implementada**:
  - Segregação arquitetural: criada a coleção `/professionals_public/{profId}` contendo estritamente os dados públicos e profissionais autorizados para divulgação e agendamento de consultas (`name`, `crp`, `bio`, `specialities`, `sessionDurationMinutes`, `sessionPrice`, `clinicIds`, `status`, `photoUrl`).
  - A coleção sensível `/professionals/{profId}` (contendo e-mail pessoal, telefone particular, configurações fiscais e bancárias) foi blindada em `firestore.rules`: leitura e escrita permitidas **exclusivamente** ao próprio psicólogo titular autenticado (`resource.data.userId == request.auth.uid`) ou ao SuperAdmin para fins de auditoria de conformidade.
  - O fluxo de agendamento do Portal do Paciente consome apenas `fetchPublicProfessionals()`, eliminando qualquer vazamento de dados privados.

### 2. Agendamentos — Restrição Estrita de Campos e Transições de Estado (`/appointments`)
- **Vulnerabilidade Anterior**: Psicólogos e pacientes podiam alterar campos relacionais ou financeiros após a criação.
- **Solução Implementada**:
  - Congelamento estrito de chaves relacionais e de identificação: `id`, `psychologistId`, `patientId`, `patientUserId`, `clinicId`, `roomId`, `requestedBy`, `patientName`, `patientPhone`, `date`, `startTime`, `endTime`, `durationMinutes`, `price`.
  - Lista de campos permitidos para o Psicólogo: estritamente `['status', 'notes', 'cancellationReason', 'paymentStatus', 'updatedAt']`.
  - Transições válidas do Psicólogo:
    - De `pending`: pode ir para `confirmed` ou `rejected`.
    - De `confirmed` ou `cancellation_requested`: pode ir para `completed`, `cancelled` ou `no_show`.
  - Lista de campos permitidos para o Paciente: estritamente `['status', 'cancellationReason', 'notes', 'updatedAt']`.
  - Transições válidas do Paciente:
    - De `pending`: apenas cancelamento (`cancelled`).
    - De `confirmed`: apenas solicitação de cancelamento (`cancellation_requested`) ou cancelamento direto (`cancelled`).
    - Pacientes são estritamente impedidos de definir status administrativos (`confirmed`, `completed`, `no_show`, `rejected`).

### 3. Prontuários Clínicos — Guarda Legal Obrigatória e Retificação Estruturada (`/clinical_records`)
- **Vulnerabilidade Anterior**: Possibilidade de deleção de registros e ausência de trilha formal de retificação.
- **Solução Implementada**:
  - **Exclusão terminantemente proibida**: Em estrito cumprimento à **Resolução CFP nº 01/2009 Art. 12** (guarda documental obrigatória de no mínimo 5 anos), a regra no Firestore define `allow delete: if false;`.
  - **Chaves imutáveis na atualização**: `id`, `psychologistId`, `patientId`, `appointmentId`, `sessionDate`, `sessionNumber`, `createdAt`, `createdBy`.
  - **Campos de evolução permitidos**: `['evolutionNotes', 'privateNotes', 'diagnosticHypothesis', 'conductPlan', 'retificationNotes', 'updatedAt']`.
  - **Termo de Retificação Deontológica**: Implementado suporte no backend e componente visual `ClinicalRecordsView.tsx` para adendos de retificação (`retificationNotes`). Cada retificação é gravada como termo cronológico e aditivo contendo carimbo de data/hora, justificativa técnica, nome do psicólogo e texto retificador, preservando integralmente o registro original para perícia legal e ética.

### 4. Propriedade e Configuração de Clínicas (`/clinics`)
- **Vulnerabilidade Anterior**: Proprietários poderiam transferir a posse da clínica para terceiros ou alterar cotas contratadas.
- **Solução Implementada**:
  - `ownerId`, `id`, `cnpj`, `roomsCount`, `professionalsCount`, `status` e `createdAt` são **imutáveis** na atualização pelo proprietário da clínica.
  - O gestor só pode atualizar campos operacionais expressamente permitidos: `['name', 'tradeName', 'phone', 'email', 'address', 'updatedAt']`.
  - Alterações de limites contratados de salas/profissionais e status de conta corporativa dependem exclusivamente de aprovação do SuperAdmin.

### 5. Perfis de Usuários — Proteção Contra Escalada de Privilégios (`/users`)
- **Vulnerabilidade Anterior**: Atualizações de SuperAdmin podiam mutar o identificador de autenticação (`uid`).
- **Solução Implementada**:
  - `uid` é estritamente **imutável** para todos os usuários, incluindo SuperAdmin.
  - Usuários comuns não podem alterar `role`, `uid`, `status`, `clinicId`, `professionalId` nem permissões de acesso.
  - Apenas campos de personalização (`displayName`, `phone`, `avatarUrl`, `photoURL`, `updatedAt`) são permitidos ao próprio usuário.

### 6. Logs de Auditoria — Higienização Real e Eliminação de Narrativa Livre (`/audit_logs`)
- **Vulnerabilidade Anterior**: O campo `details` aceitava texto livre que poderia conter inadvertidamente sintomas psiquiátricos, diagnósticos ou credenciais.
- **Solução Implementada**:
  - Adicionado código de evento padronizado (`eventCode`: `CLINICAL_RECORD_VIEWED`, `CLINICAL_RECORD_CREATED`, `CLINICAL_RECORD_RECTIFIED`, `APPOINTMENT_CANCELLED`, `USER_ROLE_CHANGED`).
  - Adicionado objeto estruturado `metadata` com campos controlados (`patientId`, `appointmentId`, `sessionNumber`, `reasonCode`, `previousStatus`, `newStatus`).
  - O campo `details` é gerado de maneira **estritamente determinística** com base em metadados (ex: `[METADADOS] Registro de sessão #3 do paciente pat_ana_1.`).
  - Adicionado expurgo rigoroso com substituição por `[DADO_SENSIVEL_OMITIDO]` caso qualquer dado sensível seja detectado em chamadas de auditoria.
  - A função `fetchAuditLogs()` sanitiza e valida todos os documentos retornados na leitura antes de renderizá-los na interface.

### 7. Assinaturas SaaS — Isolamento Multi-tenant Rigoroso (`/subscriptions`)
- Acesso permitido exclusivamente ao titular da assinatura (`targetId == request.auth.uid || userId == request.auth.uid`) ou ao proprietário validado da clínica correspondente (`clinicOwnerId == request.auth.uid`), além do SuperAdmin.
- Usuários comuns não conseguem listar ou inferir planos de terceiros.

### 8. Verificação de Regras e Transparência de Limitações de Ambiente
- Suíte completa de testes de predicados de regras expandida para **42 testes automatizados** com **100% de aprovação**.
- **Registro de Limitação do Ambiente**: O container de execução não possui o runtime Java JRE/JDK instalado (`sh: 1: java: not found`). Por essa razão técnica do ambiente sandbox, o binário do Firebase Emulator Suite local não pôde ser inicializado em background. Conforme determinação explícita de conformidade, **não foram simulados resultados artificiais do Emulator**. A validação foi executada via suíte determinística de testes de predicados em TypeScript (`tsx --test`) e a publicação real das regras no Firestore foi concluída com sucesso via `deploy_firebase`.

---

## 2. ARQUIVOS ATUALIZADOS NESTA RODADA

1. `firestore.rules`:
   - Segregação de `/professionals` e `/professionals_public`.
   - Congelamento de chaves e controle de estados em `/appointments`.
   - Proibição de deleção (`allow delete: if false;`) e restrição de atualização em `/clinical_records`.
   - Bloqueio de mutação de `ownerId`, `cnpj` e cotas em `/clinics`.
   - Imutabilidade do `uid` para todos os papéis em `/users`.
   - Implantação realizada no projeto Firebase.
2. `firebase-blueprint.json`:
   - Adicionada a entidade `ProfessionalPublic` e o path `/professionals_public/{professionalId}`.
   - Atualizados esquemas de `AuditLog` (com `eventCode` e `AuditMetadata`) e `ClinicalRecord` (com `retificationNotes`).
3. `src/types/index.ts`:
   - Adicionados tipos `ProfessionalPublic`, `AuditEventCode`, `AuditMetadata`.
   - Atualizados `AuditLog` e `ClinicalRecord`.
4. `src/services/firestoreService.ts`:
   - Implementadas `fetchPublicProfessionals()`, `fetchProfessionalProfile()`, `persistProfessional()`, `retifyClinicalRecordInDb()`.
   - Atualizada `sanitizeAuditLog()` com formatação determinística, allowlist de chaves e expurgo de dados sensíveis.
   - Atualizada `fetchAuditLogs()` para higienização e validação em tempo de leitura.
5. `src/context/AppContext.tsx`:
   - Exportação e integração de `retifyClinicalRecord`.
   - Sincronização segura de auditoria estruturada.
6. `src/components/clinical/ClinicalRecordsView.tsx`:
   - Modal de retificação de prontuário com fundamentação ética (CFP nº 01/2009 Art. 12).
   - Exibição destacada de adendos de retificação anteriores.
   - Indicação visível de proibição de deleção e guarda mínima obrigatória.
7. `src/utils/rules.ts`:
   - Funções de validação de regras de segurança para testes puros de lógica (`validateClinicalRecordDelete`, `validateClinicUpdate`, `validateProfessionalAccess`, `validateAppointmentUpdate`, `validateUserProfileUpdate`).
8. `src/utils/security_audit.test.ts`:
   - Suíte de 42 testes unitários cobrindo todos os cenários da auditoria.
9. `public/projeto-psi.zip`:
   - Arquivo ZIP regenerado de forma limpa via script Python (excluindo `node_modules`, `.git` e artefatos de build), contendo todo o código-fonte atualizado e arquivos de configuração.

---

## 3. RELATÓRIO DE COMPILAÇÃO E TESTES

| Verificação | Ferramenta | Resultado | Detalhes |
| :--- | :--- | :--- | :--- |
| **Suíte de Testes Unitários** | `node:test` + `tsx` | **APROVADO (42/42)** | 42 testes executados, 42 aprovados, 0 falhas |
| **Verificação de Tipos** | `tsc --noEmit` | **APROVADO** | 0 erros de compilação TypeScript |
| **Build de Produção** | `vite build` | **APROVADO** | Compilação com sucesso via `compile_applet` |
| **Linter do Código** | `npm run lint` | **APROVADO** | Nenhuma inconsistência de sintaxe ou importação |
| **Deploy de Regras Firestore** | `deploy_firebase` | **APROVADO** | Publicação das regras no ambiente Firebase |
| **Firebase Emulator Local** | `firebase emulators:start` | **LIMITADO (Ambiente)** | Runtime Java não disponível no container Linux |

---

## 4. DETALHAMENTO DA SUÍTE DE TESTES (42/42 APROVADOS)

- `AUDIT 1`: Sessão inicial estritamente nula e bloqueada sem login.
- `AUDIT 2`: Alternância fictícia de perfil (`switchUserRole`) ausente e proibida.
- `AUDIT 3`: Auto-cadastro com privilégio de superadministrador é rejeitado.
- `AUDIT 4`: Superadministrador estritamente bloqueado de prontuários clínicos (CFP 01/2009 & LGPD Art. 11).
- `AUDIT 5`: Psicólogo A não acessa prontuários do Psicólogo B.
- `AUDIT 6`: Gestor de clínica não acessa anotações e evoluções clínicas.
- `AUDIT 7`: Paciente não acessa evoluções clínicas ou prontuários internos.
- `AUDIT 8`: Isolamento multi-tenant de salas e agendamentos entre clínicas.
- `AUDIT 9`: Coleções vazias no Firestore retornam listas vazias (`[]`), sem dados fictícios.
- `AUDIT 10`: Falhas de persistência não são mascaradas e retornam erro estruturado.
- `AUDIT 11`: Conflito de agendamento de sala física entre psicólogos distintos.
- `AUDIT 12`: Máquina de estados impede saltos de status ilegais em agendamentos.
- `AUDIT 13`: Integridade e imutabilidade do esquema de logs de auditoria.
- `AUDIT 14`: Usuário comum não altera campos sensíveis de perfil (`role`, `uid`, etc.).
- `AUDIT 15`: Superadministrador executa ajustes controlados de perfil administrativo.
- `AUDIT 16`: Identificadores centrais de agendamento são estritamente imutáveis.
- `AUDIT 17`: Paciente não pode definir status administrativos (confirmed, completed, no_show).
- `AUDIT 18`: Criação de notificação bloqueia falsificação e exige `senderId` obrigatório não-vazio.
- `AUDIT 19`: Destinatário de notificação é imutável e usuário só altera status de leitura.
- `AUDIT 20`: Assinaturas SaaS não podem ser consultadas entre diferentes inquilinos.
- `AUDIT 21`: Prontuário clínico exige vínculo relacional legítimo com paciente (Master Gate).
- `AUDIT 22`: Higienização de auditoria expurga senhas, hipóteses diagnósticas e anotações.
- `AUDIT 23`: Persistência de auditoria retorna erro estruturado em falhas.
- `AUDIT 24`: `sanitizeAuditLog` restringe atributos a lista branca estrita e descarta chaves não autorizadas.
- `AUDIT 25`: `fetchAuditLogs` retorna estrutura rica e não silencia erros como lista vazia falsa.
- `AUDIT 26`: Atualização de perfil de psicólogo protege imutabilidade de `id` e `userId`.
- `AUDIT 27`: Assinaturas multi-tenant acessíveis por gestor titular da clínica e bloqueadas para terceiros.
- `AUDIT 28`: Profissional autenticado não pode listar dados privados de contato e faturamento de outros profissionais.
- `AUDIT 29`: Psicólogo não pode alterar chaves imutáveis de agendamento (preço, data, sala) ou executar transições inválidas.
- `AUDIT 30`: Paciente não pode definir status administrativos em consultas.
- `AUDIT 31`: Psicólogo não pode alterar identificadores, paciente ou data de prontuários existentes.
- `AUDIT 32`: Exclusão de prontuários é terminantemente proibida pela obrigação de guarda (CFP 01/2009).
- `AUDIT 33`: Proprietário de clínica não pode transferir titularidade (`ownerId`) ou alterar limites contratados.
- `AUDIT 34`: Higienização de auditoria expurga narrativa livre e gera detalhes determinísticos com metadados.
- `AUDIT 35`: Atualizações administrativas de SuperAdmin garantem imutabilidade absoluta do `uid`.
- `TESTS 36-42`: Validações de domínio para cálculo financeiro, conversão de horários, cálculo de slots livres e intervalos de agenda.

---

## 5. RECOMENDAÇÕES PARA PRÉ-LANÇAMENTO EM PRODUÇÃO

Embora a aplicação tenha atingido grau elevado de maturidade arquitetural e proteção no Firestore, para comercialização em escala e garantia jurídica plena recomenda-se:
1. **Pentest Externo Independente**: Auditoria de segurança ofensiva por empresa especializada antes do upload de dados reais de clientes.
2. **Revisão Formal por DPO / Jurídico Especializado**: Validação dos termos de consentimento do paciente, política de privacidade e conformidade com o Conselho Federal de Psicologia (CFP).
3. **Ambiente com Java para CI/CD**: Nos pipelines de integração contínua externos (como GitHub Actions), incluir `actions/setup-java@v3` para execução dos testes automatizados com o Firebase Emulator Suite antes de cada deploy.
