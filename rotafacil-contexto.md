# RotaFácil — Contexto do Projeto

## 1. Visão geral

O **RotaFácil** é um projeto pessoal de planejamento de rotas e gerenciamento de entregas.

A proposta é desenvolver uma aplicação web onde o usuário possa definir uma origem, adicionar vários destinos e visualizar no mapa o percurso entre eles, incluindo informações de distância e tempo estimado.

O objetivo inicial é construir um MVP funcional, mesmo que a interface seja simples e visualmente básica.

**Importante:** neste primeiro momento, o projeto será exclusivamente Front-end, executado localmente. Não haverá backend.

Futuramente, a aplicação deverá receber um backend em Java com Spring Boot e banco de dados PostgreSQL/PostGIS.

---

## 2. Objetivos do MVP

Desenvolver uma aplicação que permita:

- Visualizar um mapa interativo.
- Definir um endereço de origem.
- Pesquisar endereços.
- Adicionar destinos à rota.
- Listar os destinos adicionados.
- Remover destinos.
- Reordenar destinos manualmente.
- Exibir marcadores no mapa.
- Desenhar a rota entre origem e destinos.
- Calcular distância total e duração estimada.
- Persistir os destinos localmente (LocalStorage).

Não implementar funcionalidades avançadas antes de concluir esse fluxo principal.

---

## 3. Stack tecnológica

### Front-end

- React
- Vite
- TypeScript
- CSS
- Mapbox GL JS — renderização do mapa interativo
- Mapbox Geocoding API — pesquisa e conversão de endereços em coordenadas
- Mapbox Directions API — cálculo de rotas, distância e duração

### Persistência

- LocalStorage

### Futuro (fora do escopo atual)

- Java 17+
- Spring Boot
- Spring Data JPA
- PostgreSQL + PostGIS
- APIs REST

---

## 4. Integração com Mapbox

Utilizar três produtos da Mapbox:

| Produto | Responsabilidade |
|---|---|
| **Mapbox GL JS** | Renderizar o mapa interativo na tela |
| **Geocoding API** | Pesquisar endereços e converter texto em coordenadas |
| **Directions API** | Calcular rota entre pontos, retornar distância e duração |

Os três operam sob o mesmo access token.

### Configuração do token

Criar um arquivo `.env.local` na raiz do projeto:

```env
VITE_MAPBOX_ACCESS_TOKEN=seu_token_aqui
```

- Nunca inserir o token diretamente no código.
- Adicionar `.env.local` ao `.gitignore`.
- O token público deve possuir as restrições adequadas de uso.

---

## 5. Arquitetura desejada

Organizar o código de maneira modular, evitando componentes excessivamente grandes.

```text
src/
├── components/
│   ├── map/
│   ├── destinations/
│   └── layout/
├── pages/
│   └── RoutePlanner.tsx
├── services/
│   ├── mapbox/
│   │   ├── geocoding.ts
│   │   └── directions.ts
│   └── storage/
│       └── destinationStorage.ts
├── hooks/
├── types/
├── utils/
├── App.tsx
└── main.tsx
```

A estrutura pode ser refinada conforme as necessidades reais da implementação.

---

## 6. Modelo de dados

### Destino

```typescript
export interface Destination {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  order: number;
}
```

### Origem

Deve possuir endereço e coordenadas (mesma estrutura de localização do destino).

### Rota

Deve manter:

- Origem
- Lista ordenada de destinos
- Distância total
- Duração estimada
- Geometria do percurso (GeoJSON retornado pela Directions API)

---

## 7. Interface

A aplicação terá uma tela principal dividida em duas áreas:

### Sidebar

- Nome/logo RotaFácil.
- Campo para pesquisar endereço de origem.
- Campo para pesquisar novos destinos.
- Lista de destinos adicionados.
- Botão para adicionar destino.
- Ações para remover e reordenar destinos.
- Botão para calcular rota.
- Informações de distância e duração.

### Área do mapa

- Mapa ocupando o espaço restante da tela.
- Marcador diferente para origem e destinos.
- Identificação numérica da sequência dos destinos.
- Linha representando o percurso.
- Ajuste automático do enquadramento para mostrar toda a rota.

A interface pode ser simples no primeiro momento. A prioridade é funcionalidade e estabilidade.

---

## 8. Regras de desenvolvimento

1. Priorizar um MVP funcional antes de trabalhar em refinamentos visuais.
2. Não implementar backend nesta etapa.
3. Não criar autenticação neste momento.
4. Não utilizar dados fictícios como se fossem resultados reais de rotas.
5. Tratar erros de pesquisa, ausência de resultados e falhas da API.
6. Evitar dependências desnecessárias.
7. Manter separação entre componentes, regras de negócio e serviços externos.
8. Não acoplar a persistência LocalStorage aos componentes visuais.
9. Utilizar TypeScript corretamente, evitando `any`.
10. Não antecipar funcionalidades que não fazem parte do MVP.

---

## 9. Roadmap

**Fase 1 — Fundação**
- Criar projeto React + Vite + TypeScript.
- Instalar e configurar Mapbox GL JS.
- Exibir mapa interativo.

**Fase 2 — Gerenciamento de destinos**
- Pesquisar origem via Geocoding API.
- Pesquisar destinos via Geocoding API.
- Adicionar e remover destinos.
- Reordenar lista.
- Exibir marcadores no mapa.
- Persistir destinos no LocalStorage.

**Fase 3 — Planejamento de rotas**
- Integrar Directions API.
- Desenhar percurso no mapa.
- Calcular distância total e duração estimada.
- Atualizar rota automaticamente quando a lista mudar.

**Fase 4 — Refinamento**
- Melhorar interface.
- Tratar estados de carregamento e erros.
- Responsividade.
- Testes das principais funcionalidades.

---

## 10. Diretriz para desenvolvimento

Antes de começar a implementar:

1. Analise este contexto.
2. Apresente uma proposta de arquitetura e dependências.
3. Identifique possíveis limitações das APIs do Mapbox.
4. Sugira melhorias na estrutura inicial.
5. Divida a implementação em pequenas etapas.
6. Aguarde aprovação antes de executar alterações estruturais significativas.

Não tente construir o projeto inteiro de uma só vez.

Trabalhe incrementalmente, validando cada etapa antes de avançar.

---

## 11. Visão futura

O RotaFácil poderá evoluir para uma plataforma de gerenciamento de entregas, com:

- Cadastro de usuários e entregadores.
- Múltiplas rotas simultâneas.
- Otimização da sequência de entregas.
- Rastreamento em tempo real.
- Histórico de entregas.
- Dashboard de desempenho.
- Backend Java com Spring Boot.
- Banco de dados geográfico PostgreSQL/PostGIS.

Essas funcionalidades são apenas possibilidades futuras e não fazem parte do escopo atual.

---

**Objetivo principal:** entregar uma primeira versão local, simples e funcional, capaz de pesquisar endereços via Mapbox Geocoding, gerenciar destinos e desenhar rotas reais via Mapbox Directions.