---
status: Active
maintainer: pacoxu
last_updated: 2026-09-02
tags: inference, model-distribution, registry, huggingface, oci
canonical_path: docs/inference/model-distribution-stack.md
source_path: docs/inference/model-distribution-stack.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="one-diagram-for-model-distribution-hugging-face-matrixhub-harbor-dragonfly-modelpack-and-modelexpress"></a>

# 一张图看懂模型分发：Hugging Face、MatrixHub、Harbor、Dragonfly、ModelPack 和 ModelExpress

本页将几个经常被混淆的项目放在同一张图中，目的是区分**模型来源**、**私有仓库**、**集群分发**和**运行时加速**这几个层次。

> **译者注：** 本文忠实翻译所标注提交的原文快照；项目定位、能力及状态未独立验证。图中的代码与文字逐字保留原文，不代表对当前项目能力的确认。

<a id="the-stack-in-one-diagram"></a>

## 用一张图展示技术栈

```mermaid
flowchart TB
  classDef oci fill:#e8f3ff,stroke:#2b6cb0,color:#0f172a;
  classDef model fill:#fff1e6,stroke:#c2410c,color:#111827;
  classDef runtime fill:#ecfdf5,stroke:#047857,color:#111827;
  classDef neutral fill:#f8fafc,stroke:#64748b,color:#111827;

  subgraph S["1. Provider / Server View"]
    direction LR

    subgraph OCI_LANE["Docker image / OCI artifact lane"]
      direction TB
      DH["Docker Hub<br/>public image registry"]
      MP["ModelPack<br/>package model as OCI artifact"]
      HB["Harbor<br/>local Docker Hub / distribution<br/>private OCI registry"]
      DH -->|"sync / replicate / private image management"| HB
      MP -->|"upload packaged model"| HB
    end

    subgraph MODEL_LANE["Model distribution lane"]
      direction TB
      HF["Hugging Face<br/>public model hub"]
      MS["ModelScope<br/>public model / dataset / API platform"]
      MX["MatrixHub<br/>private Hugging Face<br/>HF-compatible private hub"]
      HF -->|"mirror / cache"| MX
    end
  end

  subgraph C["2. Client / Download View"]
    direction LR
    PULL["Download modes 1 / 2<br/>HF-compatible SDK / CLI / API"]
    DF["Download mode 3 + file distribution<br/>Dragonfly<br/>node-to-node P2P only"]
  end

  subgraph U["3. End User / Runtime View"]
    direction LR
    APP["End users / apps"]
    SVC["Inference service<br/>vLLM / SGLang / Dynamo"]
    ME["ModelExpress<br/>worker-to-worker / GPU-to-GPU P2P"]

    subgraph N1["Node 1"]
      direction TB
      F1["Local image / model file cache"]
      subgraph G1["GPU workers"]
        W11["GPU 0 worker"]
        W12["GPU 1 worker"]
      end
    end

    subgraph N2["Node 2"]
      direction TB
      F2["Local image / model file cache"]
      subgraph G2["GPU workers"]
        W21["GPU 0 worker"]
        W22["GPU 1 worker"]
      end
    end
  end

  HF -->|"1. direct HF"| PULL
  MX -->|"2. local MatrixHub"| PULL
  HF -->|"hf:// file pull"| DF
  MS -->|"modelscope:// file pull"| DF
  HB -->|"3. OCI pull"| DF

  PULL --> F1
  PULL --> F2
  DF --> F1
  DF --> F2
  F1 <-->|"Dragonfly: node-level P2P file chunks"| F2

  F1 --> W11
  F1 --> W12
  F2 --> W21
  F2 --> W22

  APP --> SVC
  SVC --> W11
  SVC --> W21

  ME -. "weight reuse / hot replica propagation" .-> W11
  ME -. "weight reuse / hot replica propagation" .-> W12
  ME -. "weight reuse / hot replica propagation" .-> W21
  ME -. "weight reuse / hot replica propagation" .-> W22

  W11 <-->|"same-node GPU / NVLink"| W12
  W12 <-->|"cross-node RDMA / UCX / NIXL"| W21
  W21 <-->|"same-node GPU / NVLink"| W22

  class DH,HB oci;
  class HF,MS,MX,MP,PULL model;
  class DF,F1,F2 neutral;
  class APP,SVC,ME,W11,W12,W21,W22 runtime;

  style OCI_LANE fill:#e8f3ff,stroke:#2b6cb0,stroke-width:2px
  style MODEL_LANE fill:#fff1e6,stroke:#c2410c,stroke-width:2px
  style N1 fill:#f0fdf4,stroke:#16a34a,stroke-width:1px
  style N2 fill:#f0fdf4,stroke:#16a34a,stroke-width:1px
  linkStyle 2,3,4,5,6,8,9 stroke:#c2410c,stroke-width:3px,color:#c2410c
  linkStyle 0,1,7 stroke:#2b6cb0,stroke-width:3px,color:#2b6cb0
```

<a id="read-the-diagram-by-role"></a>

## 按角色阅读图示

- **提供方 / 服务端视角**：蓝色通道是 Docker 镜像 / OCI 制品路径。在这里，将 Harbor 理解为本地 Docker Hub / Distribution 风格的私有仓库最容易，而 ModelPack 是将模型转换为 OCI 制品的打包步骤。橙色通道是模型分发路径，Hugging Face、ModelScope 和 MatrixHub 位于这一侧。
- **下载视角**：在这个框架下有三种下载模式：`1. direct Hugging Face`、`2. local MatrixHub` 和 `3. OCI pull from Docker Hub / Harbor after OCI adaptation`。Dragonfly 位于文件分发层，仅处理节点级 P2P。
- **最终用户 / 运行时视角**：模型文件首先落入节点本地缓存，然后供给 GPU worker。ModelExpress 位于路径的后段，加速 worker 间和 GPU 间的权重复用，包括通过 RDMA 进行跨节点传输。

连线颜色也具有含义：

- **橙色连线**：HF 兼容或公共模型中心的下载路径
- **蓝色连线**：OCI 拉取路径
- **灰色节点间连线**：Dragonfly 节点级文件分块传播
- **绿色 GPU 间连线**：与 ModelExpress 相关的运行时权重共享路径

一句话概括：

- **三种模型下载模式**：
  `1. direct HF`、`2. local MatrixHub`、`3. OCI-adapted Docker Hub / Harbor`
- **两种 P2P 分发模式**：
  `Dragonfly = node-to-node only`、`ModelExpress = worker-to-worker / GPU-to-GPU`

<a id="focused-reference-diagrams"></a>

## 专项参考图

<a id="1-dragonfly-path-harbor-plus-public-model-hubs"></a>

### 1. Dragonfly 路径：Harbor 加公共模型中心

```mermaid
flowchart LR
  classDef oci fill:#e8f3ff,stroke:#2b6cb0,color:#0f172a;
  classDef model fill:#fff1e6,stroke:#c2410c,color:#111827;
  classDef neutral fill:#f8fafc,stroke:#64748b,color:#111827;

  HF["Hugging Face / ModelScope<br/>public model hub"]
  HB["Harbor<br/>private OCI registry"]
  DF["Dragonfly<br/>seed peer + scheduler + peers<br/>node-to-node only"]

  subgraph CL["Cluster nodes"]
    direction LR
    N1["Node 1<br/>local file cache"]
    N2["Node 2<br/>local file cache"]
    N3["Node 3<br/>local file cache"]
  end

  HF -->|"hf:// / modelscope://"| DF
  HB -->|"OCI pull"| DF
  DF --> N1
  DF --> N2
  DF --> N3
  N1 <-->|"node-level P2P file chunks"| N2
  N2 <-->|"node-level P2P file chunks"| N3

  class HB oci;
  class HF model;
  class DF,N1,N2,N3 neutral;
  linkStyle 0 stroke:#c2410c,stroke-width:3px,color:#c2410c
  linkStyle 1 stroke:#2b6cb0,stroke-width:3px,color:#2b6cb0
```

<a id="2-matrixhub-path-private-hugging-face-style-access"></a>

### 2. MatrixHub 路径：私有 Hugging Face 风格访问

```mermaid
flowchart LR
  classDef public fill:#fff1e6,stroke:#c2410c,color:#111827;
  classDef private fill:#ecfdf5,stroke:#047857,color:#111827;
  classDef client fill:#f8fafc,stroke:#64748b,color:#111827;

  DEV["Model provider / fine-tune team"]
  HF["Hugging Face<br/>public model hub"]
  MX["MatrixHub<br/>private Hugging Face<br/>HF-compatible endpoint"]
  CLI["HF-compatible clients<br/>transformers / vLLM / SDK / CLI"]
  N1["Training / eval / inference node A"]
  N2["Training / eval / inference node B"]

  DEV -->|"private upload"| MX
  HF -->|"mirror / cache"| MX
  CLI -. "can also use public HF directly" .-> HF
  CLI -->|"private HF endpoint"| MX
  MX --> N1
  MX --> N2

  class HF public;
  class MX private;
  class DEV,CLI,N1,N2 client;
  linkStyle 1,2,3 stroke:#c2410c,stroke-width:3px,color:#c2410c
```

<a id="3-modelexpress-path-runtime-weight-sharing-after-initial-pull"></a>

### 3. ModelExpress 路径：首次拉取后的运行时权重共享

```mermaid
flowchart LR
  classDef public fill:#fff1e6,stroke:#c2410c,color:#111827;
  classDef runtime fill:#ecfdf5,stroke:#047857,color:#111827;
  classDef neutral fill:#f8fafc,stroke:#64748b,color:#111827;

  HF["Hugging Face<br/>public model hub"]
  ME["ModelExpress<br/>metadata + runtime weight P2P<br/>worker-to-worker / GPU-to-GPU"]

  subgraph N1["Source node"]
    direction TB
    F1["local model cache"]
    W11["GPU 0 worker"]
    W12["GPU 1 worker"]
  end

  subgraph N2["Target node"]
    direction TB
    F2["local model cache / fallback"]
    W21["GPU 0 worker"]
    W22["GPU 1 worker"]
  end

  HF -->|"first pull / seed load"| F1
  F1 --> W11
  F1 --> W12
  F2 --> W21
  F2 --> W22

  ME -. "coordination" .-> W11
  ME -. "coordination" .-> W12
  ME -. "coordination" .-> W21
  ME -. "coordination" .-> W22

  W11 <-->|"same-node NVLink"| W12
  W12 <-->|"cross-node RDMA / UCX / NIXL"| W21
  W21 <-->|"same-node NVLink"| W22

  class HF public;
  class ME,W11,W12,W21,W22 runtime;
  class F1,F2 neutral;
```

<a id="read-the-diagram-from-left-to-right"></a>

## 从左到右阅读图示

<a id="1-hugging-face"></a>

### 1. Hugging Face

Hugging Face 是公共上游模型中心。对于使用 `huggingface_hub`、`transformers`、`vLLM` 及类似客户端的许多训练和推理工作流，它都是默认来源。

<a id="2-private-hugging-face"></a>

### 2. 私有 Hugging Face

私有 Hugging Face 是一种**目标状态**，而不是单一产品。它意味着：

- 私有模型托管
- 访问控制与治理
- 与现有 HF 风格工作流低摩擦兼容
- 在企业或隔离网络环境内实现可预测的分发

<a id="3-matrixhub"></a>

### 3. MatrixHub

在这个技术栈中，MatrixHub 是实现上述目标状态最直接的路径。它充当 **HF 兼容的私有模型中心**，使团队在迁移到受治理的内部端点时，仍能保留 Hugging Face 的交互方式。

在实践中，MatrixHub 这一层负责：

- 私有模型仓库与生命周期治理
- 透明 HF 代理行为
- 按需缓存公共 Hugging Face 的内容
- 多区域或隔离网络分发工作流

<a id="4-modelpack--harbor--dragonfly"></a>

### 4. ModelPack + Harbor + Dragonfly

这条路径有所不同：它是 **OCI 优先**，而非 HF 优先。

- `ModelPack` 提供基于 OCI 的模型制品打包/规范路径。
- `Harbor` 提供私有 OCI 仓库，包含 RBAC、签名、复制和保留等企业治理功能。一个有用的理解方式是，将其视为管理能力更强的企业本地 Docker Hub / Distribution 风格系统。
- `Dragonfly` 使用预热和 P2P 传输模式，加速从仓库到节点的分发。

这一技术栈能很好地解决**私有模型制品管理**问题，但它本身不提供原生兼容 Hugging Face 的端点。

<a id="5-modelexpress"></a>

### 5. ModelExpress

ModelExpress 位于路径的后段。它不是主要的模型中心，其主要职责是**集群内部运行时权重移动和冷启动缩减**。

这通常意味着：

- 协调推理集群中的缓存使用
- 减少重复的模型拉取和加载
- 支持 worker 间传输
- 加速从存储或缓存到服务 worker 的最后一段路径

官方文档重点介绍的是**集群内多节点协调**，而不是全局多集群控制平面。

<a id="the-most-common-architecture-patterns"></a>

## 最常见的架构模式

<a id="pattern-a-public-hugging-face"></a>

### 模式 A：公共 Hugging Face

当便利性比控制更重要时使用。

`Clients -> Hugging Face`

权衡：

- 工作流最简单
- 治理最少
- 重复从公网下载
- 不太适合隔离网络或受监管环境

<a id="pattern-b-private-hugging-face-with-matrixhub"></a>

### 模式 B：通过 MatrixHub 实现私有 Hugging Face

当现有 HF 工作流应保持几乎不变时使用。

`Clients -> MatrixHub -> Hugging Face or private storage`

权衡：

- 对 HF 优先的团队迁移成本最低
- 非常适合内部镜像与治理
- 与 Harbor 相比，和 OCI 优先的平台标准化契合度较低

<a id="pattern-c-private-model-registry-with-harbor--modelpack--dragonfly"></a>

### 模式 C：通过 Harbor + ModelPack + Dragonfly 实现私有模型仓库

当平台已经以 OCI 制品和 Kubernetes 为中心时使用。

`Build/package -> ModelPack -> Harbor -> Dragonfly -> cluster nodes`

权衡：

- 标准化与企业管控能力强
- 与 OCI 原生平台团队自然契合
- 如果用户期望原生 HF 语义，就需要更多工作流转换

<a id="pattern-d-matrixhub--modelexpress"></a>

### 模式 D：MatrixHub + ModelExpress

当同时需要**私有 Hugging Face 风格访问**和**更快的集群运行时加载**时使用。

`Clients -> MatrixHub -> cluster cache/source -> ModelExpress -> workers`

职责划分：

- `MatrixHub` 是上游权威记录系统和受治理的分发层。
- `ModelExpress` 是集群内的运行时加速层。

这种方式特别适合多集群环境：每个集群运行自己的运行时加速路径，共享的上游模型来源则保持版本和访问策略一致。

<a id="quick-positioning-table"></a>

## 快速定位表

| 组件 | 主要层次 | 最适合 |
| --- | --- | --- |
| Hugging Face | 公共上游模型中心 | 公共模型发现与默认客户端工作流 |
| 私有 Hugging Face | 能力 / 目标状态 | 内部 HF 风格体验 |
| MatrixHub | 私有模型中心 | HF 兼容的内部分发与治理 |
| ModelPack | 打包/规范 | 基于 OCI 的模型制品定义 |
| Harbor | 私有仓库 | OCI 制品治理与复制 |
| Dragonfly | 集群分发 | 大规模节点级拉取加速 |
| ModelExpress | 运行时加速 | 集群内冷启动与权重传输优化 |

<a id="practical-rule-of-thumb"></a>

## 实用经验法则

- 如果问题是**“模型应该存在哪里、在哪里治理？”**，考虑 `MatrixHub` 或 `Harbor`。
- 如果问题是**“我们想要 HF 兼容的开发体验，还是 OCI 优先的制品工作流？”**，在 `MatrixHub` 与 `Harbor + ModelPack` 之间选择。
- 如果问题是**“如何减少集群冷启动和重复的权重移动？”**，考虑 `Dragonfly` 和 `ModelExpress`。
- 如果问题是**“如何在保留 HF 风格访问的同时，改善最后一段运行时加载？”**，结合 `MatrixHub` 和 `ModelExpress`。

<a id="references"></a>

## 参考资料

- [MatrixHub](https://github.com/matrixhub-ai/matrixhub)
- [Dynamo：从 MatrixHub 加载模型](https://docs.nvidia.com/dynamo/dev/kubernetes/model-deployment/model-loading/matrix-hub)
- [ModelExpress](https://github.com/ai-dynamo/modelexpress)
- [Harbor](https://goharbor.io/)
- [Dragonfly](https://d7y.io/)
- [ModelPack](https://modelpack.org/)
- [Hugging Face](https://huggingface.co/)
