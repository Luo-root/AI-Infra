---
status: Active
maintainer: pacoxu
last_updated: 2026-10-15
tags: inference, model-lifecycle, cold-start, offloading, optimization, checkpoint-restore
canonical_path: docs/inference/model-lifecycle.md
source_path: docs/inference/model-lifecycle.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="model-cold-starting-sleep-mode-and-lifecycle-management"></a>

# 模型冷启动、睡眠模式与生命周期管理

本文介绍 LLM 推理系统中的模型生命周期管理，重点关注冷启动优化、睡眠模式、模型卸载和快速模型启用。这些技术对于高效利用资源、降低成本以及在生产推理系统中保持低延迟至关重要。

> **译者注：** 本文忠实翻译所标注提交的原文快照；项目状态、发布时间、版本路线图、配置 API、硬件前提及性能数字未独立验证。原文的技术描述和版本声明均予以保留，不代表当前事实确认。

<a id="table-of-contents"></a>

## 目录

- [概述](#overview)
- [模型冷启动优化](#model-cold-start-optimization)
- [睡眠模式与唤醒](#sleep-mode-and-wake-up)
- [模型卸载](#model-offloading)
- [快速模型启用](#fast-model-actuation)
- [Dynamo Snapshot（检查点 / 恢复）](#dynamo-snapshot-checkpoint--restore)
- [KV 缓存持久化](#kv-cache-persistence)
- [生产实现](#production-implementations)
- [最佳实践](#best-practices)
- [参考资料](#references)

---

<a id="overview"></a>

## 概述

模型生命周期管理解决的是在 LLM 各种运行状态下高效管理资源的挑战：

- **冷启动**：从存储加载并初始化模型
- **活跃服务**：模型正在处理推理请求
- **睡眠模式**：临时暂停不活跃模型以释放资源
- **唤醒**：按需快速重新激活睡眠模型
- **卸载**：在存储层级（GPU、CPU、磁盘）之间移动模型
- **关闭**：从内存中完全卸载模型

![LLM 模型生命周期](https://github.com/user-attachments/assets/f45727ca-526e-4e78-8afc-b1b085a24fc1)

*图 1：LLM 模型生命周期状态图——模型从冷启动到关闭经历各种状态，其中睡眠模式和卸载是中间优化状态。*

**关键挑战：**

- 模型加载可能需要数秒到数分钟，取决于模型大小
- GPU 显存有限且昂贵
- 多个模型竞争相同资源
- 即使模型访问频率很低，用户仍期望低延迟
- 低效的生命周期管理导致资源浪费

**优化生命周期管理的益处：**

- 通过更好的资源利用率降低基础设施成本
- 在相同硬件上支持更多模型（超额订阅）
- 通过智能预加载和缓存降低延迟
- 以更快的模型切换改善用户体验
- 通过空闲模型的睡眠模式提高能源效率

---

<a id="model-cold-start-optimization"></a>

## 模型冷启动优化

**有关预热池、更快的序列化格式、延迟加载模式等完整 GPU Pod 冷启动策略，请参阅 [GPU Pod 冷启动优化](../kubernetes/gpu-pod-cold-start.md)。**

模型冷启动指从存储加载模型、将其初始化并准备好推理所需的时间。其中包括加载模型权重、初始化 GPU 显存、编译内核和预热缓存。本节重点介绍模型级优化，而 GPU Pod 冷启动指南涵盖容器和编排层策略。

<a id="cold-start-components"></a>

### 冷启动组成部分

总冷启动时间包含若干阶段：

1. **模型权重加载**（通常为 5-30 秒）
   - 从磁盘/对象存储读取模型权重
   - 将权重传输到 GPU 显存
   - 取决于模型大小和存储 I/O 速度

2. **模型初始化**（通常为 2-10 秒）
   - 初始化模型架构
   - 分配 GPU 显存缓冲区
   - 设置注意力机制与缓存

3. **内核编译**（通常为 1-5 秒）
   - 为特定 GPU 编译 CUDA 内核
   - 可以使用缓存的已编译内核
   - 首次编译的代价可能很高

4. **缓存预热**（通常为 0-2 秒）
   - 填充内部缓存
   - 运行初始推理轮次
   - 优化内存布局

<a id="optimization-strategies"></a>

### 优化策略

<a id="storage-tier-optimization"></a>

#### 存储层级优化

根据访问模式选择适当的存储层级：

![LLM 推理的模型存储层级](https://github.com/user-attachments/assets/8d2df23c-4dff-4100-952b-f6c95eb2e3b3)

*图 2：LLM 推理的模型存储层级——从 GPU VRAM（最快）到远程对象存储（最慢）的分层存储架构，以及层级之间的传输机制。*

- **VRAM（GPU 显存）**：最快，用于热模型
  - 已加载模型的冷启动延迟为零
  - 容量有限（每块 GPU 16GB-80GB）

- **RAM（主机内存）**：快，用于温模型
  - 通过 PCIe 在一秒以内传输到 GPU
  - 容量更大（每个节点 256GB-2TB）

- **SSD（本地存储）**：速度适中，用于已缓存模型
  - 加载时间 1-5 秒，取决于模型大小
  - 容量大（每个节点 1TB-16TB）

- **远程存储**：最慢，用于冷模型
  - 包含网络传输的加载时间为 5-30+ 秒
  - 通过对象存储实现不受限的容量

<a id="model-format-optimization"></a>

#### 模型格式优化

使用优化后的模型格式减少加载时间：

- **Safetensors**：比基于 pickle 的格式更快、更安全
- **内存映射文件**：避免将整个模型复制到内存
- **预编译内核**：缓存编译后的 CUDA 内核
- **量化模型**：体积更小、加载更快、内存用量更低

<a id="predictive-preloading"></a>

#### 预测性预加载

预判模型使用模式并预加载模型：

- **使用模式分析**：跟踪模型访问模式
- **基于时间的预加载**：在预期使用时段前加载模型
- **请求触发的预加载**：首批请求到达时开始加载
- **协同过滤**：根据用户模式预测模型使用情况

---

<a id="sleep-mode-and-wake-up"></a>

## 睡眠模式与唤醒

睡眠模式让推理系统临时暂停不活跃模型，释放 GPU 资源，同时保持快速重新激活的能力。

<a id="vllm-sleep-mode"></a>

### vLLM 睡眠模式

[vLLM](https://github.com/vllm-project/vllm) 在 2025 年 10 月引入睡眠模式，实现多模型服务的高效资源管理。与传统冷启动相比，睡眠模式使模型切换**快 18-200x**。

**主要特性：**

- **自动睡眠**：模型在不活跃后自动进入睡眠模式
- **GPU 显存释放**：在保留模型状态的同时释放 GPU 显存
- **快速唤醒**：从睡眠状态快速恢复模型
- **KV 缓存保留**：睡眠期间可选择保留 KV 缓存
- **可配置超时**：为每个模型自定义睡眠超时

**架构：**

睡眠模式通过状态机运行：

1. **活跃状态**：模型正在处理请求
2. **空闲检测**：监测不活跃时段（例如 5 分钟）
3. **睡眠准备**：序列化模型状态和 KV 缓存
4. **睡眠状态**：释放 GPU 显存，保留 CPU 状态
5. **唤醒触发**：新请求到达时恢复模型
6. **活跃状态**：恢复推理处理

**两个运行级别：**

<a id="level-1-cpu-memory-offloading"></a>

#### Level 1：CPU 内存卸载

- 将模型权重移入 CPU RAM
- 唤醒时间：0.1-0.8 秒
- 适合内存充裕的环境
- 唤醒性能最快

<a id="level-2-complete-weight-discarding"></a>

#### Level 2：完全丢弃权重

- 完全丢弃模型权重
- 内存占用：仅 MB 级
- 适合成本敏感型部署
- 唤醒时需要完整重新加载模型

**睡眠模式为何快：**

传统模型切换需要：

- ❌ 重启 Python 进程
- ❌ 重新初始化 CUDA 上下文
- ❌ 重新编译 GPU 内核
- ❌ 重新捕获 CUDA 图

睡眠模式保留进程状态：

- ✅ 保留内存分配器
- ✅ 保留 CUDA 图
- ✅ 缓存 JIT 编译后的内核
- ✅ 保持完整进程状态

**性能基准：**

*A100 大模型测试：*

- **Qwen3-235B (TP=4)**
  - 冷启动：97.7 秒
  - 睡眠唤醒：5.4 秒
  - **快 18x**

- **Qwen3-Coder-30B**
  - 冷启动：47.4 秒
  - 睡眠唤醒：2.9 秒
  - **快 17x**

*A4000 小模型测试：*

- **Qwen3-0.6B + Phi-3-vision**
  - 唤醒时间：0.1-0.8 秒
  - 比冷启动**快 58-203x**

*多次切换场景：*

- 5 次模型切换：357s → 125s
- **节省时间：65%（232 秒）**

**首次推理加速：**

- 首 token 延迟：**快 61-88%**
- 受益于保留的 CUDA 图
- 无内核重新编译开销

**益处：**

- 相同 GPU 硬件上支持多 5-10x 的模型
- 减少空闲模型造成的 GPU 显存浪费
- 与冷启动相比近乎即时唤醒
- 为返回的用户保留 KV 缓存

**配置示例：**

```python
# vLLM sleep mode configuration
engine_config = {
    "sleep_mode_enabled": True,
    "sleep_mode_level": "level1",  # or "level2"
    "sleep_timeout_seconds": 300,  # 5 minutes
    "preserve_kv_cache": True,
    "max_sleeping_models": 10
}
```

**用例：**

- ✅ 多模型服务（客服 + 翻译 + 代码助手）
- ✅ 开发与测试（频繁模型切换）
- ✅ 成本优化（小型 GPU 实例）
- ✅ 云部署（按使用量计费）

**级别选择指南：**

- 当 CPU RAM 充足且需要最快唤醒时间（0.1-0.8s）时，**选择 Level 1**
- 当内存成本关键且可以容忍稍长的唤醒时间时，**选择 Level 2**

完整的模型切换文档（包括阿里巴巴 Aegaeon 的 token 级调度），参阅[模型切换](./model-switching.md)。

更多详情参阅 [vLLM 睡眠模式博文](https://blog.vllm.ai/2025/10/26/sleep-mode.html)和[小红书文章（中文）](https://www.xiaohongshu.com/explore/6900caf20000000005001c46)。

<a id="wake-up-optimization"></a>

### 唤醒优化

快速唤醒对于保持低延迟至关重要：

- **部分状态恢复**：仅恢复必要的模型组件
- **渐进加载**：在完整恢复前开始推理
- **内存固定**：将模型权重保留在主机内存
- **状态压缩**：压缩睡眠状态以减少恢复时间

---

<a id="model-offloading"></a>

## 模型卸载

模型卸载根据访问模式和资源可用性在不同存储层级之间移动模型。这支持 GPU 资源超额订阅和具备成本效益的多模型服务。

<a id="offloading-strategies"></a>

### 卸载策略

<a id="full-model-offloading"></a>

#### 整模型卸载

在存储层级之间移动整个模型：

- **GPU 到 CPU 内存**：通过 PCIe 快速传输（低于一秒）
- **CPU 内存到 SSD**：速度适中，适用于长期存储
- **SSD 到远程存储**：较慢但容量不受限

**权衡：**

- 优点：完全释放 GPU 显存，状态管理简单
- 缺点：重新激活时间较长，采用全有或全无的方式

<a id="layer-by-layer-offloading"></a>

#### 逐层卸载

单独卸载模型层：

- 将频繁访问的层保留在 GPU 上
- 将不常访问的层移至 CPU 或磁盘
- 根据使用情况动态调整层的放置位置

**权衡：**

- 优点：细粒度控制，更好的 GPU 利用率
- 缺点：管理复杂，可能导致流水线停顿

<a id="adaptive-offloading"></a>

#### 自适应卸载

根据系统状态自动调整卸载：

- 监控 GPU 显存压力
- 跟踪模型访问模式
- 优化延迟与成本的权衡
- 实现淘汰策略（LRU、LFU、使用预测）

<a id="hardware-acceleration-for-offloading"></a>

### 卸载的硬件加速

现代硬件特性加速模型卸载：

- **PCIe Gen 4/5**：CPU-GPU 传输的双向带宽 16-32 GB/s
- **NVLink**：多 GPU 系统中为 300-900 GB/s
- **CXL（Compute Express Link）**：以内存语义访问远程内存
- **高速 RDMA**：节点间快速传输

---

<a id="fast-model-actuation"></a>

## 快速模型启用

快速模型启用（FMA）尽量缩短 GPU 切换所服务模型或使新副本上线所需的时间，但不改变稳态推理吞吐量。其价值在于**启用速度**，而非 tokens/sec。

目前有三条互补路径（根据关键路径上跳过的*内容*选择）：

| 方法 | 项目 | 机制 | 典型热路径 | 最适合 |
| --- | --- | --- | --- | --- |
| 引擎睡眠/唤醒 | [vLLM 睡眠模式](https://blog.vllm.ai/2025/10/26/sleep-mode.html) | 将张量暂存于 CPU RAM | 0.1–5 s 唤醒 | 单进程/GPU 上的多模型 |
| 应用层 FMA + 双 Pod | [llm-d FMA](https://github.com/llm-d-incubation/llm-d-fast-model-actuation) | 睡眠/唤醒 + 启动器 + K8s 双 Pod | 热唤醒约数秒（例如 64 GiB 约 3 s） | 共享 GPU 池、具备准确调度的模型切换 / 扩容 |
| 进程检查点/恢复 | [Dynamo Snapshot](https://github.com/ai-dynamo/dynamo/blob/main/docs/kubernetes/snapshot.md) | CRIU + `cuda-checkpoint` | 温恢复约 10 s，冷启动约 1 min | 跳过引擎初始化的 Dynamo 横向扩容 / 从零扩容 |

权重流式传输路径（Model Streamer / ModelExpress）加速*下载和 HBM 填充*，但仍需承担引擎初始化和 CUDA 图捕获成本——参阅 [dynamo.md](./dynamo.md#model-loading-plane-model-streamer-and-modelexpress)。

<a id="llm-d-fast-model-actuation"></a>

### llm-d 快速模型启用

[llm-d-fast-model-actuation](https://github.com/llm-d-incubation/llm-d-fast-model-actuation)（llm-d 孵化项目）通过**双 Pod** 设计，将 vLLM 睡眠/唤醒和常驻启动器接入 Kubernetes。官方概述：[快速模型启用 \| llm-d](https://llm-d.ai/docs/well-lit-paths/foundations/fast-model-actuation)。

**两项技术：**

1. **vLLM level-1 睡眠 / 唤醒**——将模型张量暂存于 CPU 内存，为另一个实例释放 GPU，然后通过 PCIe 将权重移回以唤醒（跳过重新加载和 CUDA 图编译）。
2. **vLLM 启动器**——长生命周期进程预加载 Python 模块，并通过网络 CRUDL API 生成 vLLM 子实例，减少每个新实例的导入时间。

**双 Pod（适配 Kubernetes）：**

| Pod 角色 | 职责 |
| --- | --- |
| **Server-requesting** | 通过调度器/kubelet 预留 GPU（容量核算保持正确），但不运行推理 |
| **Server-providing（启动器）** | 请求零个 GPU；FMA 控制器将 `CUDA_VISIBLE_DEVICES` 设置为请求方预留的 GPU |

**控制器 / CRD：**

- **dual-pods controller**——绑定请求方 ↔ 启动器 ↔ vLLM 实例；编排睡眠/唤醒
- **launcher-populator**——确保按照 `LauncherConfig` / `LauncherPopulationPolicy` 存在启动器 Pod
- CRD：`InferenceServerConfig`、`LauncherConfig`、`LauncherPopulationPolicy`

**启用路径（从快到慢）：**

- **热启动**——唤醒睡眠中的常驻实例（低于一秒到数秒）
- **温启动**——现有启动器使用预加载模块创建新实例（数十秒）
- **冷启动（带启动器）**——创建启动器 Pod 再初始化；仍比无 FMA 的冷启动开销更低（额外调度 + 镜像拉取）

通过统一 Helm chart `charts/fma-controllers` 部署。发布自动化（tag → 镜像 → chart）记录在 [release-process.md](https://github.com/llm-d-incubation/llm-d-fast-model-actuation/blob/main/docs/release-process.md)。发布 GitHub release 会运行 `publish-release`，构建：

| 制品 | 引用示例 |
| --- | --- |
| dual-pods-controller | `ghcr.io/llm-d-incubation/llm-d-fast-model-actuation/dual-pods-controller:v0.3.1` |
| launcher-populator | `…/launcher-populator:v0.3.1` |
| launcher | `…/launcher:v0.3.1` |
| requester | `…/requester:v0.3.1` |
| Helm chart (OCI) | `oci://ghcr.io/llm-d-incubation/llm-d-fast-model-actuation/charts/fma-controllers` |

路线图说明：里程碑 2（不带启动器的睡眠/唤醒）已完成；里程碑 3 / 0.6（启动器）已基本完成，并有补丁版本发布；预计 0.7 将在请求方 Pod 中添加 TCP 反向代理。

<a id="model-switching-techniques"></a>

### 模型切换技术

<a id="in-memory-switching"></a>

#### 内存中切换

将多个模型保留在 GPU 显存中并在它们之间切换：

- **多模型批处理**：在同一批次中运行不同模型
- **时间片切换**：按时间间隔交替运行模型
- **基于优先级的切换**：根据请求优先级切换

**权衡：**

- 优点：零切换延迟，高吞吐量
- 缺点：受 GPU 显存容量限制

<a id="lora-adapter-switching"></a>

#### LoRA 适配器切换

使用低秩适配（LoRA）快速切换模型：

- 基础模型保留在内存中
- 切换轻量 LoRA 适配器（通常为 10-100MB）
- 切换时间低于一秒
- 每个基础模型支持数百个适配器

**益处：**

- 每个变体的内存开销极小
- 在模型变体之间快速切换
- 具备成本效益的多租户服务

---

<a id="dynamo-snapshot-checkpoint--restore"></a>

## Dynamo Snapshot（检查点 / 恢复）

[Dynamo Snapshot](https://github.com/ai-dynamo/dynamo/blob/main/docs/kubernetes/snapshot.md) 是 NVIDIA Dynamo 用于**快速启动 GPU worker** 的基础设施：对已初始化进程创建检查点，后续 Pod 从该制品恢复——从关键路径中跳过模型下载、GPU 加载、引擎初始化和预热。与 llm-d FMA（活跃进程内部的应用睡眠/唤醒）相比，Snapshot 使用**进程级** CRIU 将完整初始化的 worker 恢复到新 Pod 中。

| 启动类型 | 时间量级 | 发生的操作 |
| --- | --- | --- |
| **冷启动** | 约 1 min | 下载模型，加载到 GPU，初始化引擎 |
| **温启动（恢复）** | 约 10 sec | 从就绪的检查点目录恢复 |

恢复时间仍取决于存储带宽、GPU 型号，以及是同节点还是跨节点恢复。

<a id="stack-and-prerequisites"></a>

### 技术栈与前提条件

- **CRIU**（Checkpoint/Restore In Userspace）+ NVIDIA [`cuda-checkpoint`](https://github.com/NVIDIA/cuda-checkpoint)
- 特权 `snapshot-agent` DaemonSet（工作负载 Pod 无需特权）
- 占位 worker 镜像，通过 `criu` / `cuda-checkpoint` / `nsrestore` 包装运行时
- x86_64 GPU 节点；NVIDIA 驱动 **580.xx+**（文档对多 GPU 实验引用了更高版本）
- 检查点存储：命名空间本地 PVC；跨节点 / 并发恢复优先选择 **ReadWriteMany**（`podMount` 可在同节点顺序流程中使用合适的 RWO）

<a id="operator--cr-flow"></a>

### Operator / CR 流程

1. 在 Dynamo 平台/operator 上启用检查点并安装 snapshot Helm chart：

   ```yaml
   dynamo-operator:
     checkpoint:
       enabled: true
   ```

2. 创建独立 `DynamoCheckpoint`（或让 DGD 自动创建），其 Job Pod 模板与 worker 匹配（`main` 容器 + 占位镜像）。等待 `status.phase=Ready`。
3. 部署启用检查点的 `DynamoGraphDeployment` worker：

| 配置 | 行为 | 适用情况 |
| --- | --- | --- |
| `checkpoint.enabled: true`，无 `checkpointRef` | DGD 为每一代 worker 创建并拥有一个自动检查点 | 常规 DGD 管理的捕获 |
| `checkpoint.enabled: true` + `checkpointRef: <name>` | 从指定检查点恢复；不创建检查点 | 预热 / 保留的检查点 |

可选的 `startupPolicy: WaitForCheckpoint` 在捕获完成前将服务副本数保持为零，然后从快照启动。默认的 `Immediate` 会在捕获的同时并行冷启动 worker；只有在制品 Ready 后创建的 Pod 才会恢复。

面向恢复的 worker 概念示例：

```yaml
apiVersion: nvidia.com/v1alpha1
kind: DynamoGraphDeployment
metadata:
  name: vllm-checkpointref-demo
spec:
  services:
    VllmDecodeWorker:
      componentType: worker
      replicas: 1
      checkpoint:
        enabled: true
        checkpointRef: qwen3-06b-bf16   # omit for DGD-managed auto capture
      extraPodSpec:
        mainContainer:
          image: registry.example.com/dynamo/vllm-placeholder:1.0.0
```

<a id="how-this-differs-from-fma-and-from-weight-streaming"></a>

### 与 FMA 和权重流式传输的区别

| 维度 | llm-d FMA | Dynamo Snapshot | Model Streamer / ModelExpress |
| --- | --- | --- | --- |
| 粒度 | 活跃进程睡眠/唤醒 + 启动器 | 整进程 CRIU 转储/恢复 | 权重 I/O / 对等传输 |
| 跳过引擎初始化 / CUDA 图 | 是（热唤醒时） | 是（恢复时） | 否 |
| K8s GPU 资源核算 | 双 Pod（请求方预留 GPU） | 普通 worker Pod + 特权代理 | 不适用 |
| 主要用途 | 共享池上的模型切换 | 快速副本横向扩容 | 更快首次加载 / 对等填充 |
| 成熟度 | 孵化中；Helm OCI 发布 | 实验性 / 预览 | 面向生产的加载路径 |

<a id="current-constraints-preview"></a>

### 当前限制（预览版）

- 主要面向**单 GPU** LLM decode/prefill worker（vLLM / SGLang；TRT-LLM 仅有有限实验性路径）
- 不对活跃 TCP 连接创建检查点
- 当前不涵盖多模态 / embedding / diffusion worker
- 需要特权 DaemonSet；投入生产前应验证安全态势与驱动匹配情况

背景：[NVIDIA Dynamo Snapshot：Kubernetes 上推理工作负载的快速启动](https://developer.nvidia.com/blog/nvidia-dynamo-snapshot-fast-startup-for-inference-workloads-on-kubernetes/)。
全景背景：[NVIDIA Dynamo：全景架构](./dynamo.md#dynamo-snapshot-fast-worker-startup)。
通用 GPU CRIU 背景：[工作负载隔离——检查点与恢复](../kubernetes/isolation.md#7-checkpoint-and-restore)。

---

<a id="kv-cache-persistence"></a>

## KV 缓存持久化

在模型生命周期状态转换期间保留 KV 缓存，对于保持用户体验和减少重新计算成本至关重要。

<a id="kv-cache-offloading"></a>

### KV 缓存卸载

[kvcached 项目](https://github.com/ovg-project/kvcached) 提供在模型转换期间持久化 KV 缓存的机制。

**主要特性：**

- **KV 缓存序列化**：将 KV 缓存保存到持久存储
- **快速恢复**：模型唤醒时快速恢复 KV 缓存
- **压缩**：减少缓存数据的存储需求
- **分布式存储**：在多个实例之间共享 KV 缓存

**架构：**

1. **缓存捕获**：睡眠前序列化活跃 KV 缓存
2. **存储后端**：写入快速存储层（SSD、对象存储）
3. **缓存索引**：维护已缓存对话的索引
4. **缓存恢复**：唤醒时重新加载相关缓存

**益处：**

- 无需重新计算历史即可恢复对话
- 降低模型唤醒后用户感知的延迟
- 通过持久缓存支持更长的上下文窗口
- 支持跨实例 KV 缓存共享

<a id="integration-with-sleep-mode"></a>

### 与睡眠模式集成

将 KV 缓存持久化与睡眠模式结合：

```python
# Conceptual sleep mode with KV cache persistence
async def sleep_model(model_id):
    # 1. Capture KV cache
    kv_cache = capture_kv_cache(model_id)
    
    # 2. Serialize and store
    cache_id = await store_kv_cache(kv_cache)
    
    # 3. Release GPU memory
    release_gpu_memory(model_id)
    
    # 4. Store wake-up metadata
    save_wake_metadata(model_id, cache_id)

async def wake_model(model_id):
    # 1. Load model to GPU
    await load_model_to_gpu(model_id)
    
    # 2. Restore KV cache
    metadata = load_wake_metadata(model_id)
    kv_cache = await restore_kv_cache(metadata.cache_id)
    
    # 3. Resume inference
    inject_kv_cache(model_id, kv_cache)
```

有关 KV 缓存管理的更全面信息，参阅 [LLM 推理中的缓存](./caching.md)。

---

<a id="production-implementations"></a>

## 生产实现

<a id="aibrix-multi-model-management"></a>

### AIBrix 多模型管理

[AIBrix](https://github.com/vllm-project/aibrix) 提供可用于生产的多模型生命周期管理：

- **动态模型加载**：按需加载模型
- **LoRA 多路复用**：高效切换 LoRA 适配器
- **资源优化**：智能 GPU 显存管理
- **网关集成**：具有模型亲和性的请求路由

<a id="kserve-model-server"></a>

### KServe 模型服务器

[KServe](https://github.com/kserve/kserve) 提供模型生命周期能力：

- **缩容到零**：自动缩容到零副本
- **快速扩容**：首个请求到达时快速加载模型
- **Knative 集成**：Serverless 模型服务
- **多框架支持**：适配多种推理引擎

<a id="kubernetes-native-solutions"></a>

### Kubernetes 原生方案

基于 Kubernetes 的模型生命周期管理平台：

- **Kthena**：基于 Volcano 的 LLM 推理平台，具有 ModelServing 修订控制、角色级滚动更新、协调的 P/D 自动伸缩和会话感知路由（v1.0.0+）
- **llm-d FMA**：双 Pod + vLLM 睡眠/唤醒 + 启动器，用于共享 GPU 池上的快速模型切换和扩容（[仓库](https://github.com/llm-d-incubation/llm-d-fast-model-actuation)、[发布流程](https://github.com/llm-d-incubation/llm-d-fast-model-actuation/blob/main/docs/release-process.md)）
- **Dynamo Snapshot**：使用 CRIU/`cuda-checkpoint` 对已初始化 worker 进行温恢复（约 10 s，冷启动约 1 min）
- **Kubeflow**：具有模型服务能力的综合 ML 平台

---

<a id="best-practices"></a>

## 最佳实践

<a id="when-to-use-each-technique"></a>

### 各种技术的适用时机

**以下情况使用睡眠模式：**

- 模型具有可预测的空闲时段（>5 分钟）
- 每块 GPU 支持多个模型
- 成本优化比绝对最低延迟更重要
- 用户可容忍 1-3 秒唤醒延迟

**以下情况使用模型卸载：**

- GPU 显存严重受限
- 需要支持非常庞大的模型目录
- 访问模式高度多变
- 基础设施成本是主要关注点

**以下情况使用快速模型启用（llm-d）：**

- 需要在共享 GPU 池上频繁切换模型
- 可以在 CPU RAM 中保留睡眠实例（热唤醒）或温启动器
- 在 Kubernetes 上运行 vLLM，希望 GPU 资源核算与调度器一致（双 Pod）

**以下情况使用 Dynamo Snapshot：**

- 横向扩容 / 从零扩容必须跳过完整冷启动（下载 + GPU 加载 + 引擎初始化）
- 可以运行特权快照代理，并满足驱动/后端前提条件
- 工作负载是（当前）Dynamo 上的单 GPU 文本 LLM worker

**以下情况使用 KV 缓存持久化：**

- 用户有长对话
- 模型经历睡眠/唤醒周期
- 上下文保留对用户体验至关重要
- 重新计算导致服务成本高

<a id="design-guidelines"></a>

### 设计指南

<a id="resource-planning"></a>

#### 资源规划

- 监控实际与理论 GPU 显存用量
- 在模型权重之外规划 20-30% 的内存开销
- 考虑 KV 缓存随上下文长度的增长
- 实现内存压力检测与响应

<a id="latency-management"></a>

#### 延迟管理

- 为睡眠模式设置适当的超时阈值
- 对常见模式实现预测性预加载
- 使用 LoRA 适配器实现亚秒级模型切换
- 监控唤醒操作的 P95/P99 延迟

<a id="reliability"></a>

#### 可靠性

- 为睡眠模型实现健康检查
- 监控唤醒成功率和故障模式
- 为关键模型保留备用副本
- 规划资源压力下的优雅降级

<a id="cost-optimization"></a>

#### 成本优化

- 平衡 GPU 利用率与延迟要求
- 在开发/测试环境使用睡眠模式
- 实现分层服务等级（高级与标准）
- 监控每次推理成本并相应优化

<a id="monitoring-and-observability"></a>

### 监控与可观测性

需要跟踪的关键指标：

- **冷启动延迟**：从请求到首 token 的时间
- **唤醒延迟**：从睡眠到活跃状态的时间
- **睡眠转换时间**：进入睡眠模式的时间
- **GPU 显存利用率**：生命周期转换前后
- **模型切换率**：模型变更频率
- **KV 缓存命中率**：恢复缓存相对于重新计算缓存的百分比

---

<a id="references"></a>

## 参考资料

- [vLLM 睡眠模式博文](https://blog.vllm.ai/2025/10/26/sleep-mode.html)
- [kvcached 项目](https://github.com/ovg-project/kvcached)
- [llm-d 快速模型启用](https://github.com/llm-d-incubation/llm-d-fast-model-actuation)
- [llm-d FMA 发布流程](https://github.com/llm-d-incubation/llm-d-fast-model-actuation/blob/main/docs/release-process.md)
- [快速模型启用（llm-d 文档）](https://llm-d.ai/docs/well-lit-paths/foundations/fast-model-actuation)
- [Dynamo Snapshot（Kubernetes）](https://github.com/ai-dynamo/dynamo/blob/main/docs/kubernetes/snapshot.md)
- [NVIDIA Dynamo Snapshot 博文](https://developer.nvidia.com/blog/nvidia-dynamo-snapshot-fast-startup-for-inference-workloads-on-kubernetes/)
- [NVIDIA cuda-checkpoint](https://github.com/NVIDIA/cuda-checkpoint)
- [vLLM GitHub 仓库](https://github.com/vllm-project/vllm)
- [AIBrix 简介](./aibrix.md)
- [LLM 推理中的缓存](./caching.md)
- [NVIDIA Dynamo：全景架构](./dynamo.md)
- [KServe 模型服务器](https://github.com/kserve/kserve)
- [Kubernetes Serving 工作组](https://github.com/kubernetes/community/blob/master/wg-serving/README.md)

**部分内容根据所提供的 GitHub 参考资料与博文整理。实施前请核实技术细节与项目当前状态。**
