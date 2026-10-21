---
status: Active
maintainer: pacoxu
last_updated: 2026-10-15
tags: inference, model-switching, aegaeon, vllm, sleep-mode, optimization, fma, dynamo
canonical_path: docs/inference/model-switching.md
source_path: docs/inference/model-switching.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="model-switching-and-dynamic-scheduling"></a>

# 模型切换与动态调度

本文介绍 LLM 推理系统中的高级模型切换技术，包括 token 级调度、动态模型切换和快速模型启用。这些技术能够在生产环境中实现高效的多模型服务、降低延迟并优化资源利用率。

> **译者注：** 本文忠实翻译所标注提交的原文快照；项目状态、发布时间、配置 API、性能数字及适用性均未独立验证。原文中的版本声明与技术描述予以保留，不代表当前事实确认。

<a id="table-of-contents"></a>

## 目录

- [概述](#overview)
- [阿里巴巴 Aegaeon：token 级调度](#alibaba-aegaeon-token-level-scheduling)
- [vLLM 睡眠模式：快速模型切换](#vllm-sleep-mode-fast-model-switching)
- [模型切换方法比较](#comparison-of-model-switching-approaches)
- [生产用例](#production-use-cases)
- [最佳实践](#best-practices)
- [参考资料](#references)

---

<a id="overview"></a>

## 概述

模型切换是现代 LLM 推理系统中的一项关键操作，能够实现：

- 在有限 GPU 资源上提供**多模型服务**
- 根据请求模式进行**动态资源分配**
- 通过高效利用 GPU 实现**成本优化**
- 为多租户推理平台**降低延迟**

传统模型切换需要：

- 重启 Python 进程
- 重新初始化 CUDA 上下文
- 重新编译 GPU 内核
- 重新捕获 CUDA 图

这导致每次模型变更产生 30-100 秒的切换开销，使频繁切换模型难以实际应用。

**现代方法**通过以下手段优化模型切换：

1. **token 级调度**——每个 token 之后做出切换决策
2. **睡眠模式**——释放 GPU 显存的同时保留进程状态
3. **组件复用**——共享编译后的内核与 CUDA 图
4. **KV 缓存同步**——高效传输缓存数据

这些技术使模型切换开销**最高降低 97%**，支持切换延迟低于一秒的实时多模型服务。

---

<a id="alibaba-aegaeon-token-level-scheduling"></a>

## 阿里巴巴 Aegaeon：token 级调度

[Aegaeon](https://mp.weixin.qq.com/s/uJyk0HALKFZysTAgghjgpw) 是阿里巴巴的分布式 LLM 服务系统，率先采用 **token 级调度**，支持在每个 token 生成后动态决定是否切换模型。

<a id="key-innovation-token-level-scheduling"></a>

### 关键创新：token 级调度

传统推理系统在请求级别做出模型选择决策。Aegaeon 引入 **token 级粒度**，使系统能够：

- 在每个 token 生成后评估模型切换需求
- 根据延迟要求在推理中途切换模型
- 在满足 SLO 的同时并发服务多个模型
- 实时优化资源分配

<a id="architecture-and-components"></a>

### 架构与组件

Aegaeon 实现为分布式 LLM 服务系统，包含：

- **5,700 行** Python 和 CUDA/C++ 代码
- **控制平面**：基于 asyncio 构建，用于并发编排
- **数据平面**：使用 Ray 进行分布式数据管理
- **执行后端**：利用 vLLM 广泛支持多种架构

![Aegaeon 实现架构](https://github.com/user-attachments/assets/e3aea800-f62d-465a-b6f7-92753500f445)

*图 1：Aegaeon 实现——控制平面使用 asyncio 实现并发，数据平面使用 Ray 实现分布式处理，vLLM 提供模型执行后端，支持 FlashAttention 和 PagedAttention 等现代优化。*

<a id="core-capabilities"></a>

### 核心能力

<a id="1-accurate-execution-time-prediction"></a>

#### 1. 准确预测执行时间

Aegaeon 使用机器学习模型预测：

- 每个模型的 token 生成延迟
- 每个请求的资源需求
- 推理期间的最佳切换点

<a id="2-token-level-scheduling-algorithm"></a>

#### 2. token 级调度算法

调度器根据以下因素决定模型切换：

- 请求剩余的**当前延迟预算**
- 候选模型的**预测执行时间**
- 集群中的**资源可用性**
- 请求的 **SLO 要求**

<a id="3-model-switching-optimization"></a>

#### 3. 模型切换优化

Aegaeon 通过以下手段将切换开销降低 **97%**：

**组件复用：**

- 在切换之间保留编译后的 CUDA 内核
- 在兼容模型之间复用 CUDA 图
- 共享内存分配器和 GPU 上下文

**细粒度 GPU 显存管理：**

- 切换期间仅释放必要的显存
- 保留内核编译缓存
- 保留已初始化的 CUDA 上下文

**优化的 KV 缓存同步：**

- 在模型之间高效传输 KV 缓存
- 尽量减少切换期间的数据复制
- 选择性保留缓存

<a id="performance-characteristics"></a>

### 性能特征

- **切换延迟**：低于一秒（从 30-100s 降低）
- **开销降低**：与传统方法相比最高降低 97%
- **并发模型**：在同一组 GPU 资源上运行多个模型
- **SLO 达标**：通过动态调度满足延迟要求

<a id="use-cases"></a>

### 用例

Aegaeon 尤其适用于：

- **质量与延迟权衡**：出现延迟压力时切换到更快的模型
- **多租户服务**：为不同用户提供不同大小的模型
- **成本优化**：在质量要求允许时使用更小的模型
- **混合服务**：结合大小模型以获得最佳成本/质量

---

<a id="vllm-sleep-mode-fast-model-switching"></a>

## vLLM 睡眠模式：快速模型切换

[vLLM 睡眠模式](https://blog.vllm.ai/2025/10/26/sleep-mode.html)（2025 年 10 月发布）在释放 GPU 显存的同时保留进程状态，从而实现超快速模型切换。

<a id="the-challenge"></a>

### 挑战

多模型服务传统上面临两难：

- **同时加载**：GPU 显存爆炸 💸
- **频繁切换**：等待 30-100 秒 🐌

<a id="sleep-mode-solution"></a>

### 睡眠模式方案

vLLM 睡眠模式提供两个运行级别：

<a id="level-1-cpu-memory-offloading"></a>

#### Level 1：CPU 内存卸载

**特征：**

- 将模型权重移入 CPU RAM
- 保留 CUDA 上下文和编译后的内核
- 唤醒时间：**0.1-0.8 秒**
- 适合内存充裕的环境

**内存需求：**

- GPU 显存：释放（模型卸载）
- CPU 内存：保留完整模型权重
- 进程状态：完整保留

<a id="level-2-complete-weight-discarding"></a>

#### Level 2：完全丢弃权重

**特征：**

- 完全丢弃模型权重
- 仅保留进程状态
- 内存占用：**仅 MB 级**
- 适合成本敏感型部署

**内存需求：**

- GPU 显存：释放
- CPU 内存：最小化（仅进程状态）
- 重新加载要求：从存储完整重新加载模型

<a id="why-sleep-mode-is-fast"></a>

### 睡眠模式为何快

传统模型切换需要：

❌ 重启 Python 进程  
❌ 重新初始化 CUDA 上下文  
❌ 重新编译 GPU 内核  
❌ 重新捕获 CUDA 图

睡眠模式保留进程状态：

✅ 保留内存分配器  
✅ 保留 CUDA 图  
✅ 缓存 JIT 编译后的内核  
✅ 保持完整进程状态

<a id="performance-benchmarks"></a>

### 性能基准

<a id="a100-large-model-tests"></a>

#### A100 大模型测试

**Qwen3-235B (TP=4)：**

- 冷启动：97.7 秒 😫
- 睡眠唤醒：5.4 秒 ⚡
- **加速：快 18x**

**Qwen3-Coder-30B：**

- 冷启动：47.4 秒 😫
- 睡眠唤醒：2.9 秒 ⚡
- **加速：快 17x**

<a id="a4000-small-model-tests"></a>

#### A4000 小模型测试

**Qwen3-0.6B + Phi-3-vision：**

- 唤醒时间：0.1-0.8 秒
- 相当于打个响指 🫰
- **加速：快 58-203x**

<a id="multi-switch-scenarios"></a>

#### 多次切换场景

**5 次模型切换比较：**

- 传统方法：357 秒
- 睡眠模式：125 秒
- **节省时间：65%（232 秒）**

<a id="first-inference-optimization"></a>

### 首次推理优化

睡眠模式也能加速初始推理：

- **首 token 延迟**：快 61-88%
- 受益于保留的 CUDA 图
- 无内核重新编译开销

<a id="configuration-and-usage"></a>

### 配置与使用

```python
# vLLM sleep mode configuration
from vllm import EngineArgs

engine_args = EngineArgs(
    model="Qwen/Qwen3-Coder-30B",
    sleep_mode="level1",  # or "level2"
    sleep_timeout=300,    # 5 minutes idle before sleep
    preserve_kv_cache=True
)
```

**级别选择指南：**

- **Level 1**：CPU RAM 充足且需要最快唤醒时
- **Level 2**：内存成本关键且可以容忍轻微延迟时

<a id="ideal-use-cases"></a>

### 理想用例

✅ **多模型服务**（客服 + 翻译 + 代码助手）  
✅ **开发/测试**（频繁模型切换）  
✅ **成本优化**（小型 GPU 实例）  
✅ **云部署**（按使用量计费）

---

<a id="comparison-of-model-switching-approaches"></a>

## 模型切换方法比较

| 特性 | 传统方法 | Aegaeon | vLLM 睡眠模式 | llm-d FMA | Dynamo Snapshot |
| --- | --- | --- | --- | --- | --- |
| **切换 / 热路径延迟** | 30–100s | <1s | 0.1–5.4s | 热唤醒约数秒 | 恢复约 10s，冷启动约 1min |
| **粒度** | 请求 | token 级 | 引擎进程 | 双 Pod + 启动器 | 整进程 CRIU |
| **跳过引擎初始化** | 否 | 部分 | 是（唤醒） | 是（热/温启动） | 是（恢复） |
| **K8s GPU 资源核算** | 普通 Pod | 取决于框架 | 普通 Pod | 请求方预留 GPU | 普通 worker + 特权代理 |
| **最适合** | 偶尔切换 | 动态 QoS | 单 GPU 上的多模型 | 共享池切换 / 扩容 | Dynamo 副本横向扩容 |

编排层 FMA 和 Snapshot 的详情：
[模型生命周期——快速模型启用](./model-lifecycle.md#fast-model-actuation)以及 [Dynamo Snapshot](./model-lifecycle.md#dynamo-snapshot-checkpoint--restore)。

<a id="when-to-use-each-approach"></a>

### 各种方法的适用时机

**以下情况使用传统切换：**

- 运行单模型工作负载
- 模型变更不频繁（间隔数小时/数天）
- 内存不受限

**以下情况使用 Aegaeon token 级调度：**

- 需要在推理期间权衡质量与延迟
- 服务具有不同 SLO 的多样化请求模式
- 在保持质量阈值的同时优化成本
- 运行生产多模型服务

**以下情况使用 vLLM 睡眠模式：**

- 在相同硬件上支持多个模型
- 开发和测试环境
- 成本敏感型云部署
- 模型具有可预测的空闲时段

**以下情况使用 llm-d FMA：**

- 在共享池上切换模型时，需要符合 Kubernetes 资源核算的准确 GPU 预留（双 Pod）
- 结合睡眠/唤醒与常驻启动器，实现热/温模型启用

**以下情况使用 Dynamo Snapshot：**

- 扩展 Dynamo worker，且必须跳过完整冷启动（下载 + GPU 加载 + 引擎初始化）
- 可以运行特权快照代理，并满足预览版前提条件

---

<a id="production-use-cases"></a>

## 生产用例

<a id="multi-tenant-ai-platform"></a>

### 多租户 AI 平台

**场景**：为用户提供不同大小模型的 SaaS 平台

**方案**：结合 Aegaeon + 睡眠模式

- 使用 Aegaeon 实时优化质量与延迟
- 使用睡眠模式最大化 GPU 利用率
- 相同硬件上支持多 5-10x 的模型
- 在降低成本的同时保持 SLO

<a id="development-environment"></a>

### 开发环境

**场景**：ML 工程师测试多个模型变体

**方案**：vLLM 睡眠模式 Level 1

- 将模型保留在 CPU 内存中以便即时访问
- 在 0.1-0.8 秒内切换模型
- 不因空闲模型浪费 GPU 显存
- 为测试迭代保留 KV 缓存

<a id="cost-optimized-production"></a>

### 成本优化的生产环境

**场景**：GPU 预算有限的初创公司

**方案**：vLLM 睡眠模式 Level 2

- 每个模型的内存占用最小化
- 在单 GPU 上服务 10+ 个模型
- 接受 2-5 秒唤醒延迟
- 优先优化成本，而非绝对性能

<a id="hybrid-quality-serving"></a>

### 混合质量服务

**场景**：质量要求不一的应用

**方案**：Aegaeon token 级调度

- 对复杂请求从大模型开始
- 在延迟压力下切换到更小的模型
- 在 SLO 范围内保持可接受的质量
- 服务成本降低 30-50%

---

<a id="best-practices"></a>

## 最佳实践

<a id="architecture-design"></a>

### 架构设计

1. **选择合适粒度**
   - token 级用于动态优化
   - 请求级用于更简单的实现
   - 进程级用于资源效率

2. **规划内存层次**
   - GPU 显存：热模型
   - CPU 内存：温模型（睡眠模式 Level 1）
   - 磁盘/存储：冷模型（睡眠模式 Level 2）

3. **实现智能路由**
   - 将请求路由到合适模型
   - 考虑模型亲和性以复用 KV 缓存
   - 在可用实例间均衡负载

<a id="performance-optimization"></a>

### 性能优化

1. **监控切换指标**
   - 跟踪切换频率
   - 测量唤醒延迟（P50、P95、P99）
   - 监控 GPU 显存利用率

2. **调优睡眠超时**
   - 平衡延迟与资源利用率
   - 为不同模型层级使用不同超时
   - 选择超时时考虑使用模式

3. **优化 KV 缓存处理**
   - 为长对话保留缓存
   - 实现缓存淘汰策略
   - 考虑压缩缓存以便存储

<a id="reliability"></a>

### 可靠性

1. **妥善处理故障**
   - 实现唤醒失败后的回退
   - 监控唤醒成功率
   - 规划优雅降级

2. **保持服务质量**
   - 设置适当的 SLO 阈值
   - 监控切换后的质量指标
   - 对过高的切换延迟发出告警

3. **测试切换场景**
   - 验证负载下的切换
   - 测试边界情况（快速切换、并发唤醒）
   - 验证切换后的 KV 缓存正确性

---

<a id="references"></a>

## 参考资料

<a id="aegaeon"></a>

### Aegaeon

- [阿里巴巴 Aegaeon 文章（中文）](https://mp.weixin.qq.com/s/uJyk0HALKFZysTAgghjgpw)

<a id="vllm-sleep-mode"></a>

### vLLM 睡眠模式

- [vLLM 睡眠模式博文](https://blog.vllm.ai/2025/10/26/sleep-mode.html)
- [小红书上的 vLLM 睡眠模式（中文）](https://www.xiaohongshu.com/explore/6900caf20000000005001c46)
- [vLLM GitHub 仓库](https://github.com/vllm-project/vllm)

<a id="related-documentation"></a>

### 相关文档

- [模型生命周期管理](./model-lifecycle.md)
- [llm-d 快速模型启用](https://github.com/llm-d-incubation/llm-d-fast-model-actuation)
- [Dynamo Snapshot](./model-lifecycle.md#dynamo-snapshot-checkpoint--restore)
- [LLM 推理中的缓存](./caching.md)
- [AIBrix 平台](./aibrix.md)
- [Serverless AI 推理](./serverless.md)

---

**说明**：部分 Aegaeon 内容基于所引用的微信文章。vLLM 睡眠模式的基准数据来自 vLLM 官方博文。实施前请针对具体硬件与工作负载核实项目当前状态和性能特征。
