---
status: Active
maintainer: pacoxu
last_updated: 2025-10-29
tags: inference, memory, context, ai-agents, database
canonical_path: docs/inference/memory-context-db.md
source_path: docs/inference/memory-context-db.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="memory-context-and-database-for-ai-agents"></a>

# AI 智能体的记忆、上下文与数据库

本文介绍 AI 智能体与 LLM 推理系统的记忆管理、上下文处理和数据库方案，重点关注短期与长期记忆策略。

> **译者注：** 本文忠实翻译所标注提交的原文快照；项目状态、成熟度声明、API 及技术能力未独立验证。原文目录的 `#vector-databases` 与“向量数据库实现”章节标题不一致，链接目标按原文保留；该目标对应前面的同名小节。

<a id="table-of-contents"></a>

## 目录

- [概述](#overview)
- [短期记忆与长期记忆](#short-term-vs-long-term-memory)
- [智能体记忆架构](#agent-memory-architecture)
- [记忆后端](#memory-backends)
- [向量数据库](#vector-databases)
- [状态管理方案](#state-management-solutions)
- [智能体专用数据库系统](#agent-specific-database-systems)
- [一致性与垃圾回收](#consistency-and-garbage-collection)
- [项目实现](#project-implementations)
- [参考资料](#references)

---

<a id="overview"></a>

## 概述

记忆与上下文管理是 AI 智能体和 LLM 应用的关键组成部分。随着智能体变得更加复杂，它们需要高效机制，来存储、检索和管理短期对话上下文以及跨会话的长期知识。

**关键挑战：**

- 管理不断增长的上下文窗口和 KV 缓存
- 平衡短期聊天历史与长期知识
- 确保数千个并发智能体之间的一致性
- 对不活跃的智能体会话进行垃圾回收
- 记忆操作的 API 标准化

---

<a id="short-term-vs-long-term-memory"></a>

## 短期记忆与长期记忆

<a id="short-term-memory-chat-context"></a>

### 短期记忆（聊天上下文）

短期记忆指活跃会话内即时的对话上下文，通常存放在 KV 缓存或工作内存中。

**特征：**

- **持续时间**：仅限活跃会话（数秒到数小时）
- **存储**：GPU VRAM、主机 RAM 或高速缓存
- **大小**：受上下文窗口限制（通常为 4K-128K token）
- **访问模式**：顺序、高频读写
- **持久性**：通常易失，会话结束后清除

**用例：**

- 多轮对话
- 会话内上下文跟踪
- 即时响应生成
- 重复前缀的提示词缓存

**技术：**

- KV 缓存（参阅 [LLM 推理中的缓存](./caching.md)）
- 内存缓冲区
- 会话专用存储

<a id="long-term-memory-knowledge-base"></a>

### 长期记忆（知识库）

长期记忆指能够跨会话保留的持久知识，使智能体能够回忆过往交互和学到的信息。

**特征：**

- **持续时间**：跨会话持久保留（数天到数年）
- **存储**：数据库、向量存储、对象存储
- **大小**：潜在不受限（随数据库容量扩展）
- **访问模式**：随机访问、基于检索的查询
- **持久性**：具备备份与恢复的持久存储

**用例：**

- 跟踪用户偏好
- 检索历史对话
- 领域专用知识库
- 跨会话个性化
- 多智能体协作状态

**技术：**

- 向量数据库（Milvus、Chroma、Pinecone）
- 传统数据库（PostgreSQL、MySQL）
- 对象存储（S3、GCS、MinIO）
- 用于关系跟踪的图数据库

---

<a id="agent-memory-architecture"></a>

## 智能体记忆架构

现代 AI 智能体通常采用分层记忆架构，结合多个存储层以获得最佳性能。

<a id="memory-hierarchy"></a>

### 记忆层次

```text
┌─────────────────────────────────────────────────────────┐
│                    Agent Application                     │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
   ┌──────────┐    ┌──────────┐    ┌──────────┐
   │Short-Term│    │ Working  │    │Long-Term │
   │ Memory   │    │ Memory   │    │ Memory   │
   └──────────┘    └──────────┘    └──────────┘
        │               │               │
   ┌────────┐    ┌──────────┐    ┌──────────┐
   │KV Cache│    │In-Memory │    │Vector DB │
   │ GPU/RAM│    │  State   │    │ Object   │
   └────────┘    └──────────┘    │  Store   │
                                  └──────────┘
```

<a id="api-shapes-for-agent-memory"></a>

### 智能体记忆的 API 形式

根据 CNCF TOC 的讨论，以下方面需要标准化的 API 形式：

- **状态持久化**：保存和恢复智能体状态
- **记忆检索**：查询历史交互
- **上下文注入**：向提示词添加外部知识
- **记忆更新**：增量更新智能体知识
- **垃圾回收**：清理不活跃或过期的记忆

**API 操作示例：**

```text
GET    /agent/{id}/memory/recent       # Get recent conversation
POST   /agent/{id}/memory/store        # Store new memory
GET    /agent/{id}/memory/search       # Semantic search in memory
DELETE /agent/{id}/memory/prune        # Garbage collect old entries
GET    /agent/{id}/state               # Get full agent state
POST   /agent/{id}/state/restore       # Restore agent state
```

---

<a id="memory-backends"></a>

## 记忆后端

不同后端系统服务于不同的记忆管理需求。

<a id="object-store-s3-gcs-minio"></a>

### 对象存储（S3、GCS、MinIO）

**最适合**：长期存储大上下文窗口和对话日志

**特征：**

- 可无限扩展
- 冷存储成本效益高
- 高持久性与可用性
- 访问速度比数据库慢

**用例：**

- 对话历史归档
- 长时间运行智能体的检查点存储
- 备份与灾难恢复
- 合规与审计日志

<a id="redis-in-memory-cache"></a>

### Redis（内存缓存）

**最适合**：快速访问近期状态和会话数据

**特征：**

- 亚毫秒级延迟
- 临时或持久化存储模式
- 用于实时更新的发布/订阅
- 基于 TTL 的自动过期

**用例：**

- 活跃会话状态
- 近期对话历史
- 智能体状态的分布式缓存
- 限流与请求跟踪

<a id="vector-databases"></a>

### 向量数据库

**最适合**：语义搜索与基于相似度的检索

**特征：**

- 基于嵌入的搜索
- 相似度评分
- 元数据过滤
- 水平扩展能力

**用例：**

- 语义记忆搜索
- RAG（检索增强生成）
- 相似对话检索
- 知识库查询

---

<a id="vector-database-implementations"></a>

## 向量数据库实现

向量数据库是智能体记忆系统中语义搜索的重要基础。

<a id="key-projects"></a>

### 主要项目

<a id="chroma"></a>

#### Chroma

[`Chroma`](https://github.com/chroma-core/chroma) 是面向 AI 应用设计的开源嵌入数据库。

**主要特性：**

- 易于集成 LangChain 和 LlamaIndex
- 本地或服务端部署
- Python 和 JavaScript 客户端
- 元数据过滤与混合搜索

<a id="milvus"></a>

#### Milvus

<a href="https://github.com/milvus-io/milvus">`Milvus`</a> 是为可扩展相似度搜索构建的云原生向量数据库。

**主要特性：**

- CNCF 毕业项目
- 混合搜索（稠密 + 稀疏向量）
- 多租户支持
- Kubernetes 原生部署

<a id="qdrant"></a>

#### Qdrant

<a href="https://github.com/qdrant/qdrant">`Qdrant`</a> 是使用 Rust 编写的向量相似度搜索引擎，面向高性能和生产用途设计。

**主要特性：**

- 使用 Rust 构建，实现高性能与可靠性
- 载荷过滤与混合搜索
- 支持分布式部署
- REST 和 gRPC API

<a id="weaviate"></a>

#### Weaviate

<a href="https://github.com/weaviate/weaviate">`Weaviate`</a> 是具有文本向量化器和混合搜索能力的开源向量数据库。

**主要特性：**

- 提供文本和多模态向量化器
- GraphQL 和 REST API
- 通过 operator 实现 Kubernetes 原生部署

<a id="faiss"></a>

#### FAISS

<a href="https://github.com/facebookresearch/faiss">`FAISS`</a>（Facebook AI Similarity Search）是用于稠密向量相似度搜索的本地索引库。

**主要特性：**

- 高度优化的 CPU/GPU 相似度搜索
- 多种索引类型（IVF、HNSW、PQ）
- Python 和 C++ 接口
- 适合离线索引与本地嵌入搜索

<a id="pgvector"></a>

#### pgvector

<a href="https://github.com/pgvector/pgvector">`pgvector`</a> 是 PostgreSQL 扩展，为 Postgres 添加向量相似度搜索。

**主要特性：**

- 原生 PostgreSQL 集成
- 精确和近似最近邻搜索（HNSW、IVFFlat）
- 将向量搜索与关系查询结合
- 对已使用 Postgres 的团队部署简单

<a id="kubernetes-operators"></a>

### Kubernetes Operator

专用 operator 简化了 Kubernetes 上向量数据库的部署：

- **Milvus Operator**：[自动化 Milvus 集群管理](https://github.com/milvus-io/milvus-operator)
- **Chroma Operator**：[管理 Chroma 部署](https://github.com/chroma-core/chroma-operator)（社区驱动，仓库已归档）
- **Weaviate Operator**：[处理 Weaviate 向量数据库集群](https://github.com/weaviate/weaviate-operator)

---

<a id="state-management-solutions"></a>

## 状态管理方案

<a id="dapr-state-components"></a>

### Dapr 状态组件

<a href="https://github.com/dapr/dapr">`Dapr`</a>（Distributed Application Runtime，分布式应用运行时）为多个后端提供统一的状态管理 API。

**主要特性：**

- 支持多个后端（Redis、PostgreSQL、CosmosDB 等）
- 不同存储使用一致的 API
- 事务支持
- 状态加密与并发控制

**对智能体系统的益处：**

- 抽象后端差异
- 不同环境中易于切换后端
- 提供重试和韧性模式
- 服务网格集成

**状态存储示例：**

- Redis：快速、临时状态
- PostgreSQL：持久、事务性状态
- CosmosDB：全球分布式状态
- Azure Blob Storage：大对象状态

<a id="model-context-protocol-mcp"></a>

### 模型上下文协议（MCP）

模型上下文协议旨在标准化 LLM 与外部上下文来源（包括记忆系统）的交互方式。

**目标：**

- 标准化上下文注入
- 不依赖提供方的记忆访问
- 高效上下文检索
- 多模态上下文支持

---

<a id="agent-specific-database-systems"></a>

## 智能体专用数据库系统

<a id="memu"></a>

### memU

<a href="https://github.com/NevaMind-AI/memU">`memU`</a> 是专为 AI 智能体设计的记忆管理方案。

**主要特性：**

- 跨智能体会话的持久记忆
- 分层记忆组织
- 高效检索机制
- 与主流智能体框架集成

**架构：**

- 用于快速检索的记忆索引
- 用于语义搜索的向量相似度
- 用于上下文过滤的元数据标签
- 自动记忆整合

<a id="db-gpt"></a>

### DB-GPT

<a href="https://github.com/eosphoros-ai/DB-GPT">`DB-GPT`</a> 是实验性的 AI 原生数据库框架，提供智能体记忆支持。

**主要特性：**

- AI 原生数据管理
- 自然语言查询接口
- 智能体记忆原语
- 知识图谱集成

**用例：**

- 共享知识的多智能体系统
- 结构化数据上的复杂推理
- 以数据库支撑的对话智能体
- 企业知识管理

---

<a id="consistency-and-garbage-collection"></a>

## 一致性与垃圾回收

在数千个并发智能体之间管理状态一致性和记忆清理，带来了独特挑战。

<a id="consistency-challenges"></a>

### 一致性挑战

**问题领域：**

- **多智能体协调**：智能体读写共享状态
- **分布式部署**：状态分布在多个节点
- **会话交接**：在副本间传输智能体状态
- **并发更新**：多个请求修改同一个智能体状态

**方案：**

- **乐观锁**：基于版本的冲突检测
- **事件溯源**：仅追加的状态变更
- **CQRS**：分离读写模型以实现扩展
- **分布式事务**：关键操作使用两阶段提交

<a id="garbage-collection-strategies"></a>

### 垃圾回收策略

自动清理不活跃或过期的智能体记忆，对系统健康至关重要。

**基于 TTL 的过期：**

- 为记忆条目设置生存时间
- 过期后自动删除
- Redis 原生支持 TTL
- 适合基于会话的状态

**引用计数：**

- 跟踪智能体状态的活跃引用
- 引用计数归零时删除
- 适用于智能体之间的共享记忆

**LRU/LFU 淘汰：**

- 最近最少使用或最不经常使用
- 将热数据保留在缓存中，淘汰冷数据
- 容量受限的内存缓存

**手动清理：**

- 显式终止智能体会话
- 用户发起的数据删除
- 合规驱动的数据保留策略

**后台任务：**

- 定期扫描不活跃会话
- 批量删除旧条目
- 在低峰期执行以尽量减少影响

---

<a id="project-implementations"></a>

## 项目实现

<a id="llm-d-with-lmcache"></a>

### llm-d 与 LMCache

<a href="https://llm-d.ai/blog/kvcache-wins-you-can-see">`看得见的 KV 缓存收益：从 vLLM 的前缀缓存到 llm-d 的分布式调度`</a> 展示了实际的 KV 缓存管理。

**关键见解：**

- 前缀缓存显著降低 TTFT
- 分布式调度实现高效缓存利用
- 解耦推理的生产部署策略
- 集成 LMCache 实现跨节点缓存共享

**实现细节：**

- 集成 LMCache 实现持久 KV 缓存
- 使用路由 sidecar 进行智能请求分发
- 通过缓存感知调度最大化命中率
- 监控与观测缓存性能

有关 LMCache 集成的更多详情，请参阅：

- [GKE 上的 LMCache](https://blog.lmcache.ai/2025-10-07-LMCache-on-GKE/)
- [Dynamo LMCache 集成](https://blog.lmcache.ai/2025-09-18-dynamo-lmcache/)

<a id="cncf-toc-discussion-on-agent-memory"></a>

### CNCF TOC 关于智能体记忆的讨论

CNCF 技术监督委员会正在 <a href="https://github.com/cncf/toc/issues/1746">TOC Issue #1746</a> 中讨论智能体记忆需求。

**主要议题：**

- **状态与记忆后端**：哪些后端（对象存储、向量数据库、Redis）和 API 形式适合智能体的短期与长期记忆
- **一致性**：如何确保数千个智能体之间的一致性
- **垃圾回收**：清理不活跃智能体状态的策略
- **缺口识别**：当前生态系统中缺少的部分，例如：
  - 标准化智能体记忆 API
  - MCP-Kubernetes 发现机制
  - 状态管理集成模式

**提议的方案：**

- 使用 Dapr 状态组件抽象后端
- 使用向量数据库 operator（Chroma、Milvus）进行语义搜索
- 使用 S3/GCS 进行长期存储
- 使用 Redis 存储热状态和缓存

---

<a id="references"></a>

## 参考资料

<a id="projects"></a>

### 项目

- [memU (NevaMind-AI)](https://github.com/NevaMind-AI/memU)
- [DB-GPT (eosphoros-ai)](https://github.com/eosphoros-ai/DB-GPT)
- [NIXL (ai-dynamo)](https://github.com/ai-dynamo/nixl)
- [LMCache](https://github.com/LMCache/lmcache)
- [Chroma](https://github.com/chroma-core/chroma)
- [Milvus](https://github.com/milvus-io/milvus)
- [Dapr](https://github.com/dapr/dapr)

<a id="blog-posts-and-articles"></a>

### 博文与文章

- [看得见的 KV 缓存收益（llm-d）](https://llm-d.ai/blog/kvcache-wins-you-can-see)
- [GKE 上的 LMCache](https://blog.lmcache.ai/2025-10-07-LMCache-on-GKE/)
- [Dynamo LMCache 集成](https://blog.lmcache.ai/2025-09-18-dynamo-lmcache/)

<a id="community-discussions"></a>

### 社区讨论

- [CNCF TOC Issue #1746：智能体记忆与状态管理](https://github.com/cncf/toc/issues/1746)

<a id="related-documentation"></a>

### 相关文档

- [LLM 推理中的缓存](./caching.md)——KV 缓存与前缀缓存
- [Prefill-Decode 解耦](./pd-disaggregation.md)——分布式推理架构
- [模型生命周期管理](./model-lifecycle.md)——冷启动、睡眠模式与卸载

---

**说明**：本文档整合了 GitHub 仓库、博文和社区讨论等多个来源的信息。部分技术和 API 正处于积极开发中。投入生产实施前，请核实项目当前状态和能力。
