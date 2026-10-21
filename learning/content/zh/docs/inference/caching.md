---
status: Active
maintainer: pacoxu
last_updated: 2026-10-10
tags: inference, caching, kv-cache, prefix-caching, kvcr, llm-optimization
canonical_path: docs/inference/caching.md
source_path: docs/inference/caching.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

# LLM 推理中的缓存

本文介绍大语言模型（LLM）推理中的缓存机制，重点关注通过跨请求复用已计算的键值（KV）缓存来优化性能的前缀缓存方法。

关于 KV 缓存之外的智能体记忆与长期上下文存储，请参阅 [AI 智能体的记忆、上下文与数据库](./memory-context-db.md)。

## 目录

- [什么是前缀缓存](#what-is-prefix-caching)
- [KV 缓存卸载与存储层次](#kv-cache-offloading-and-storage-hierarchy)
- [共享前缀缓存](#shared-prefix-caching)
- [独立前缀缓存](#independent-prefix-caching)
- [分布式 KV 缓存方案](#distributed-kv-cache-solutions)
- [KV 缓存传输的网络加速](#network-acceleration-for-kv-cache-transfer)
- [面向 KV 缓存的下一代硬件](#next-generation-hardware-for-kv-cache)
- [KV 缓存方案比较](#kv-cache-solutions-comparison)
- [项目实现](#project-implementations)
- [参考资料](#references)

---

<a id="what-is-prefix-caching"></a>

## 什么是前缀缓存

LLM 推理中的前缀缓存通过存储和复用此前计算过的键值（KV）缓存数据来优化性能。当多个请求共享相同前缀（例如系统提示词、聊天历史）时，可以缓存并复用这些共享部分的计算结果，从而显著缩短首 token 时间（TTFT）并提高吞吐量。

**优势：**

- 减少重复前缀的计算
- 缩短首 token 时间（TTFT）
- 提高整体吞吐量
- 改善资源利用率
- 降低服务场景中的成本

---

<a id="kv-cache-offloading-and-storage-hierarchy"></a>

## KV 缓存卸载与存储层次

随着 LLM 上下文窗口不断扩大，KV 缓存的存储需求呈指数增长。为应对这种增长，现代推理系统采用分层存储方法，根据访问模式和性能要求，将 KV 缓存数据卸载到多个存储层级。

> **译者注：** 上文及下文 Mooncake 段落中的“指数增长”忠实对应原文。固定模型、批量大小和精度时，常规 KV 缓存容量随缓存 token 数近似线性增长；静态缓存会预分配容量，滑动窗口缓存的增长范围受窗口限制，行为有所不同。参阅 [Hugging Face Transformers 缓存说明](https://huggingface.co/docs/transformers/cache_explanation)。

![dynamo](../../diagrams/dynamo-memory.png)

### 存储层次

KV 缓存存储层次通常按以下模式排列，排序依据为访问速度与成本：

1. **VRAM（GPU 显存）**：访问最快，成本最高，容量有限
   - 推理期间活跃 KV 缓存的主要存储位置
   - 注意力计算延迟最低
   - 典型容量：每块 GPU 16GB - 80GB

2. **RAM（主机内存）**：访问速度快，成本适中，容量更大
   - 温 KV 缓存的中间存储层
   - 同一节点上的多个 GPU 共享
   - 典型容量：每个节点 256GB - 2TB

3. **SSD（固态硬盘）**：访问速度适中，成本较低
   - 存储需要高速访问的冷 KV 缓存
   - 系统重启后仍可保留
   - 典型容量：每个节点 1TB - 16TB

4. **本地磁盘（HDD）**：访问较慢，成本低，容量大
   - 对不常访问的 KV 缓存进行归档存储
   - 长期持久化
   - 典型容量：每个节点 4TB - 100TB

5. **远程对象存储**：基于网络，成本最低，规模不受限
   - 跨集群共享 KV 缓存的分布式存储
   - 支持跨节点共享 KV 缓存
   - 示例：S3、OSS、Ceph、MinIO

### 卸载策略

有效的 KV 缓存卸载需要智能管理：

- **自动分层**：根据访问模式在不同层级之间移动 KV 缓存
- **预取**：在需要之前从较慢层级加载 KV 缓存
- **压缩**：降低存储需求与传输带宽
- **去重**：在请求之间共享相同的 KV 缓存块
- **淘汰策略**：LRU、LFU 或感知应用的淘汰策略

**优势：**

- 减少重复前缀的计算
- 缩短首 token 时间（TTFT）
- 提高整体吞吐量
- 改善资源利用率
- 降低服务场景中的成本

---

<a id="shared-prefix-caching"></a>

## 共享前缀缓存

共享前缀缓存允许多个请求在不同会话或用户之间共享公共前缀的 KV 缓存。

### NIXL

[`NIXL`](https://github.com/ai-dynamo/nixl) 为 LLM 推理系统提供共享前缀缓存能力。

**主要特性：**

- 跨请求共享前缀
- 与多种推理引擎集成
- 高效缓存管理

### DCN（分布式计算节点）

DCN 架构支持跨多个计算节点的分布式前缀缓存。DCN 最初来自 Red Hat OpenStack Platform，提供：

- **分布式计算节点（DCN）架构**：面向边缘场景，允许在远端部署计算和存储节点，同时共享一个集中式控制平面
- **策略性工作负载布局**：允许将工作负载部署到更贴近实际运行需求的位置，以提高性能
- **共享缓存层**：支持在分布式节点之间共享前缀缓存

更多详情请参阅 [Red Hat DCN 文档](https://docs.redhat.com/en/documentation/red_hat_openstack_platform/17.1/html/deploying_a_distributed_compute_node_dcn_architecture/understanding_dcn)。

> **注意**：此处引用的 DCN（分布式计算节点）架构主要是 OpenStack 云基础设施概念。虽然分布式缓存原理可能适用于 LLM 推理场景，但该文档链接介绍的是通用边缘计算部署模式，而非 LLM 专用缓存实现。还需要进一步研究，以验证 DCN 在 LLM 推理前缀缓存中的具体应用。

---

<a id="distributed-kv-cache-solutions"></a>

## 分布式 KV 缓存方案

分布式 KV 缓存系统跨多个节点管理 KV 缓存，实现高效共享并卸载到远程存储。这些方案对于扩展 LLM 推理以支持大上下文窗口和高吞吐量服务场景至关重要。

### Mooncake

[`Mooncake`](https://github.com/kvcache-ai/Mooncake) 是一种分布式 KV 缓存服务，旨在缓解 LLM 推理系统中的存储压力。它应对模型上下文窗口扩大时 KV 缓存存储需求的指数增长。

**主要特性：**

- **分布式 KV 缓存管理**：在多个节点之间共享 KV 缓存
- **L3 KV 缓存存储**：在 GPU 显存和主机内存之外提供额外缓存层
- **高吞吐量传输**：针对跨节点数据移动进行优化
- **与推理引擎集成**：可与 SGlang 及其他推理框架配合使用
- **持久化存储**：服务重启后仍可保留 KV 缓存

**架构：**

Mooncake 实现了一种将缓存存储与计算节点分离的分布式架构：

- **缓存存储节点**：专门存储 KV 缓存数据的节点
- **计算节点**：生成和使用 KV 缓存的推理节点
- **元数据管理**：跟踪 KV 缓存位置与访问模式
- **传输优化**：尽量降低跨节点数据传输开销

**性能考量：**

虽然 Mooncake 和类似的分布式 KV 缓存服务降低了存储压力，但跨节点数据传输仍是主要性能瓶颈。网络延迟和带宽限制会影响系统整体吞吐量，长上下文场景尤为明显。

### 下一代硬件集成

现代分布式 KV 缓存方案越来越多地利用下一代硬件能力克服网络瓶颈：

- **超高带宽（UB）互联**：以 400Gbps+ 带宽实现高速跨节点通信
- **CXL（Compute Express Link）**：以低延迟按内存语义访问远程内存
- **灵桥超节点共享内存**：跨节点的硬件加速共享内存
- **机架级超节点**：Vera Rubin NVL72 和 Shanghai Cube 等 NVLink / Mesh 域。参阅[超节点架构](../hardware/supernode.md)

这些硬件进展与分布式 KV 缓存管理需求高度契合，可提供：

- 面向大型 KV 缓存传输的高带宽
- 面向实时推理工作负载的低延迟
- 与 KV 缓存使用方式匹配的内存语义访问模式
- 跨分布式节点的统一内存视图

**行业举措：**

中国 AI 基础设施社区正在积极开发将下一代硬件与分布式 KV 缓存服务集成的方案。例如，已有提案建议将灵桥超节点共享内存能力集成到 Mooncake，利用下一代硬件特性为推理服务提供通用加速。

### 其他分布式 KV 缓存方案

还有一些项目提供分布式 KV 缓存能力：

- **AIBrix**：在 vLLM 生态中提供分布式推理和 KV 缓存能力
- **Vineyard**：AIBrix 使用它进行分布式 KV 缓存管理
- **Ray 分布式运行时**：为多节点推理提供分布式内存管理

---

<a id="independent-prefix-caching"></a>

## 独立前缀缓存

独立前缀缓存系统为每个会话或服务独立管理 KV 缓存，在提供隔离的同时，仍能针对各自上下文内的重复模式进行优化。

### LMCache

[`LMCache`](https://github.com/LMCache/lmcache) 是一种 LLM 服务引擎扩展，用于缩短 TTFT 并提高吞吐量，尤其适用于长上下文场景。

![nixl-design](../../diagrams/nixl-design.png)

- GPU-GPU 传输
- GPU-CPU 卸载
- CPU-CPU 传输
- 存储卸载

**主要特性：**

- 支持非前缀 KV 缓存
- 与 vLLM 生产软件栈、llm-d 和 KServe 集成
- 针对长上下文场景进行优化
- 稳定支持多种缓存模式

### Dynamo KVBM

Dynamo 的键值块管理器（KVBM）在 Dynamo 生态中提供高效的 KV 缓存管理。

**主要特性：**

- 基于块的 KV 缓存管理
- 与 Dynamo 的解耦式服务架构集成
- 高效内存利用

架构细节请参阅 [KVBM README](https://github.com/ai-dynamo/dynamo/blob/main/lib/bindings/kvbm/README.md)。

### KV Cache Runner（KVCR）

[`KV Cache Runner（KVCR）`](https://github.com/ai-dynamo/kvcr) 将 KV 缓存视为跨内存和存储层级的分布式资源。感知 KV 的路由器维护全局缓存清单并发送来源提示，而每个 KVCR 实例管理本地驻留、策略和数据移动。

**主要特性：**

- 由路由器引导缓存复用、负载均衡和预取
- 可插拔的准入、淘汰、放置与暂存策略
- 通过 NIXL 实现跨层级与点对点移动
- 可选的 `KVCR-Guard`，在引擎故障时保留 KVCR 所拥有的主机内存
- 不依赖特定框架或路由器的集成模型

KVCR 正在积极开发中，尚不建议用于生产。应将其视为与 Dynamo KVBM 并列的新兴设计，而非已经验证、可直接替换的方案。

### 主机内存缓存

主机内存缓存利用系统 RAM 存储 KV 缓存数据，可提供：

- 相比 GPU 显存更低的成本
- 更大的缓存容量
- 跨 GPU 共享能力
- 模型重新加载后仍可保留

---

<a id="network-acceleration-for-kv-cache-transfer"></a>

## KV 缓存传输的网络加速

分布式 KV 缓存系统在节点之间移动数据时，网络性能变得至关重要。现代推理系统利用高性能网络技术尽量降低传输延迟并最大化吞吐量。

### RDMA（远程直接内存访问）

RDMA 允许一台计算机直接访问另一台计算机的内存，而无需任一端操作系统参与，从而降低延迟和 CPU 开销。

**对 KV 缓存传输的优势：**

- **零拷贝传输**：无需 CPU 参与，直接在内存之间复制
- **内核旁路**：消除操作系统开销
- **低延迟**：内存访问延迟低于一微秒
- **高带宽**：100Gbps 至 400Gbps+ 的吞吐量
- **CPU 卸载**：释放 CPU 资源供推理计算使用

**RDMA 技术：**

- **InfiniBand**：专为高性能计算设计
  - 最低延迟和最高带宽
  - 常见于 AI/ML 集群与数据中心
  - 典型带宽：200Gbps（HDR）、400Gbps（NDR）、800Gbps（XDR，新兴）

- **RoCE（融合以太网上的 RDMA）**：在以太网网络上实现 RDMA
  - 比 InfiniBand 更具成本效益
  - 利用现有以太网基础设施
  - 典型带宽：100Gbps、200Gbps、400Gbps

- **iWARP**：互联网广域 RDMA 协议
  - 在标准 TCP/IP 网络上工作
  - 更适合广域网场景

**实现考量：**

要实现有效的基于 RDMA 的 KV 缓存传输：

- 使用 verbs API 执行直接 RDMA 操作
- 为多个推理请求实现连接池
- 对频繁访问的缓存考虑内存注册开销
- 优化缓冲区管理以尽量减少复制
- 监控网络拥塞并调整传输模式

### 用于 LLM 推理的 InfiniBand

InfiniBand 特别适合分布式 LLM 推理，原因包括：

- **低延迟**：对于 SLO 要求严格的实时推理至关重要
- **高带宽**：支持长上下文的大型 KV 缓存传输
- **原生 RDMA 支持**：针对直接内存访问进行了硬件优化
- **可扩展性**：支持拥有数千节点的大规模集群
- **可靠性**：内建错误检测与恢复机制

**典型部署：**

在生产 LLM 服务集群中：

- InfiniBand 连接同一数据中心内的 GPU 节点
- 支持分布式推理工作进程之间高效共享 KV 缓存
- 支持预填充与解码解耦的架构
- 促进模型并行和张量并行

---

<a id="next-generation-hardware-for-kv-cache"></a>

## 面向 KV 缓存的下一代硬件

除了传统 RDMA 和 InfiniBand，新兴硬件技术正通过内存语义访问和超高带宽改变分布式 KV 缓存管理。

### CXL（Compute Express Link）

CXL 是一种开放标准互联，可在 CPU、内存、加速器和其他设备之间实现高速、高效通信。

**面向 KV 缓存的关键能力：**

- **内存池化**：跨多个主机共享内存池
- **缓存一致性**：由硬件管理的一致性内存访问
- **低延迟**：以接近本地内存的速度访问远程内存
- **带宽**：每条链路 64-256 GB/s（CXL 2.0/3.0）
- **内存扩展**：动态扩展可用内存容量

**对分布式 KV 缓存的优势：**

- 以极低延迟将远程 KV 缓存当作本地内存使用
- 硬件管理的一致性消除软件开销
- 在分布式节点之间灵活分配内存
- 无需完整系统升级即可经济地扩展内存

### 超高带宽（UB）互联

下一代互联为数据移动提供前所未有的带宽：

- **400GbE 及以上**：400Gbps、800Gbps 的下一代以太网
- **800G InfiniBand（XDR）**：新兴 InfiniBand 标准
- **定制 AI 互联**：厂商专有的高带宽方案

**对 KV 缓存性能的影响：**

更高带宽的互联可实现：

- 更快地传输长上下文场景中的 KV 缓存
- 降低传输时间占总推理时间的比例
- 通过分布式缓存支持更大的批量大小
- 高效预取与后台缓存移动

### 灵桥超节点共享内存

灵桥超节点技术在物理分布的节点之间提供硬件加速共享内存，创建统一内存空间。Vera Rubin NVL72 和 Shanghai Cube 等机架级系统另见[超节点架构](../hardware/supernode.md)。

**主要特性：**

- **内存语义访问**：像访问本地内存一样访问远程内存
- **硬件加速**：用于内存虚拟化的专用硬件
- **低延迟**：针对实时推理需求优化
- **高带宽**：支持大规模 KV 缓存传输

**与分布式 KV 缓存集成：**

已有提案建议将灵桥超节点能力与 Mooncake 等服务集成，以实现：

- 无需显式数据传输即可跨节点无缝共享 KV 缓存
- 降低分布式缓存管理的软件复杂度
- 为推理加速提供硬件优化性能
- 为下一代推理基础设施提供通用方案

---

<a id="kv-cache-solutions-comparison"></a>

## KV 缓存方案比较

下表比较三种主要 KV 缓存方案：NIXL、LMCache 和 Mooncake。

<!-- markdownlint-disable MD013 -->
| 特性 | NIXL | LMCache | Mooncake |
| --------- | ------ | --------- | ---------- |
| **项目类型** | 共享前缀缓存 | 独立前缀缓存 | 分布式 KV 缓存服务 |
| **主要使用场景** | 跨请求共享前缀 | 缩短长上下文 TTFT | 分布式存储管理 |
| **缓存范围** | 跨请求/用户共享 | 每会话/服务独立 | 集群级分布式 |
| **集成** | 多种推理引擎 | vLLM、llm-d、KServe | SGlang、推理框架 |
| **存储层** | L2 缓存（前缀共享） | L2 缓存（会话缓存） | L3 缓存（分布式存储） |
| **分布方式** | 单节点/多节点 | 单节点/多节点 | 多节点分布式 |
| **上下文窗口** | 短到中等 | 针对长上下文优化 | 超长上下文 |
| **RDMA 支持** | 可能支持 | 可能支持 | 专为高速网络设计 |
| **硬件加速** | 标准 | 标准 | 可适配下一代硬件（CXL、UB） |
| **持久化** | 内存中 | 可配置 | 持久化分布式存储 |
| **最适合** | 公共前缀场景 | 长上下文推理 | 大规模分布式推理 |
| **成熟度** | 可用于生产 | 可用于生产 | 积极开发中 |
<!-- markdownlint-enable MD013 -->

**选择合适的方案：**

- **何时使用 NIXL**：有大量请求共享公共前缀（例如系统提示词、公共上下文）
- **何时使用 LMCache**：需要优化长上下文场景的 TTFT，并与 vLLM 生产软件栈稳定集成
- **何时使用 Mooncake**：需要跨多个节点进行分布式 KV 缓存管理，以支持极大规模
- **组合使用**：许多生产系统结合多种方法（例如使用 LMCache 进行本地缓存，使用 Mooncake 进行分布式存储）

---

<a id="project-implementations"></a>

## 项目实现

### SGlang 存储选项

[`SGlang`](https://github.com/sgl-project/sglang) 为 KV 缓存管理提供多种存储后端：

- **hf3fs deepseek HF3FS**：基于 HuggingFace 的分布式文件系统
- **mooncake_store**：集成 Mooncake，以提供 L3 KV 缓存分布式存储
  - 支持跨节点共享 KV 缓存
  - 支持服务重启后的持久化存储
  - 针对大规模推理部署优化
- **nixl**：集成 NIXL，以实现共享前缀缓存

存储实现可在 [SGlang 内存缓存存储目录](https://github.com/sgl-project/sglang/tree/9b5f0f64f52033f5965d5b593df5df45c9be8c24/python/sglang/srt/mem_cache/storage)中找到。

### llm-d 路由边车

[`llm-d 路由边车`](https://github.com/llm-d/llm-d-routing-sidecar) 支持多种缓存代理：

- **NIXL 集成**：通过 NIXL v2 连接器
- **LMCache 支持**：直接与 LMCache 集成
- **路由优化**：基于缓存命中率的智能路由

实现细节可参阅 [NIXL v2 连接器](https://github.com/llm-d/llm-d-routing-sidecar/blob/d84279a5eecfe098b7250df731576c69aa21505c/internal/proxy/connector_nixlv2.go)。

---

<a id="references"></a>

## 参考资料

- [NIXL GitHub 仓库](https://github.com/ai-dynamo/nixl)
- [LMCache GitHub 仓库](https://github.com/LMCache/lmcache)
- [Mooncake GitHub 仓库](https://github.com/kvcache-ai/Mooncake)
- [Dynamo KVBM README](https://github.com/ai-dynamo/dynamo/blob/main/lib/bindings/kvbm/README.md)
- [KVCR GitHub 仓库](https://github.com/ai-dynamo/kvcr)
- [KVCR 设计概述](https://github.com/ai-dynamo/kvcr/blob/main/docs/design_overview.md)
- [SGlang 内存缓存存储](https://github.com/sgl-project/sglang/tree/9b5f0f64f52033f5965d5b593df5df45c9be8c24/python/sglang/srt/mem_cache/storage)
- [llm-d 路由边车](https://github.com/llm-d/llm-d-routing-sidecar)
- [Red Hat DCN 文档](https://docs.redhat.com/en/documentation/red_hat_openstack_platform/17.1/html/deploying_a_distributed_compute_node_dcn_architecture/understanding_dcn)
- [InfiniBand 行业协会](https://www.infinibandta.org/)
- [CXL 联盟](https://www.computeexpresslink.org/)
- [RDMA 编程指南](https://www.rdmamojo.com/)

**部分内容根据所提供的 GitHub 参考资料整理。实施之前，请核实技术细节和项目当前状态。**

> **译者注（原文版本状态，未独立核实）：** 本文对 NIXL、LMCache、Mooncake 的分类、成熟度和功能比较，HF3FS 的归属描述，以及 CXL、RDMA、灵桥超节点等硬件能力、性能数值与集成提案，均按原文保留，不代表已独立核实的当前事实。
