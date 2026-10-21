---
status: Active
maintainer: pacoxu
last_updated: 2025-10-30
tags: inference, llm, model-architecture, moe, dense, llama, qwen, deepseek, flux
canonical_path: docs/inference/model-architectures.md
source_path: docs/inference/model-architectures.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="llm-model-architectures"></a>

# LLM 模型架构

本文概述主要的 LLM 模型架构，涵盖稠密架构和 Mixture-of-Experts（MoE，混合专家）方法。理解这些架构，对于为部署选择合适的模型并优化推理性能至关重要。

<a id="table-of-contents"></a>

## 目录

- [架构概览](#architecture-overview)
- [稠密模型](#dense-models)
  - [Llama 3](#llama-3)
- [Mixture-of-Experts（MoE）模型](#mixture-of-experts-moe-models)
  - [Llama 4](#llama-4)
  - [Qwen 3](#qwen-3)
  - [DeepSeek-V3](#deepseek-v3)
- [扩散模型](#diffusion-models)
  - [Flux](#flux)
- [架构比较](#architecture-comparison)
- [MoE 的主要优势](#moe-key-benefits)
- [参考资料](#references)

---

<a id="architecture-overview"></a>

## 架构概览

现代 LLM 架构大体可分为两种主要方法：

**稠密模型：** 传统 Transformer 架构，每个 token 都会激活全部参数。这些模型性能可预测、部署较简单，但开销随参数数量线性增长。

**Mixture-of-Experts（MoE）模型：** 一种先进架构，每个 token 仅激活一部分专门化的“专家”网络。MoE 模型具有更高的参数效率，能够扩展至大得多的总参数量，同时保持快速推理。

---

<a id="dense-models"></a>

## 稠密模型

稠密模型对每个输入 token 激活全部参数，提供一致且可预测的行为。人们对其理解充分，推理引擎广泛支持，且在对应参数规模下具有出色的质量。

<a id="llama-3"></a>

### Llama 3

[`Llama 3`](https://github.com/meta-llama/llama3) 是 Meta 的第三代稠密 Transformer 架构，代表了开源稠密模型的领先性能。

**架构特征：**

- **模型类型：** 稠密 Transformer（仅解码器）
- **可用规模：** 8B、70B 和 405B 参数
- **上下文长度：** 最长 128K token（扩展上下文版本）
- **训练数据：** 跨多种领域的 15+ 万亿 token
- **分词器：** 增强分词器，词表大小为 128K
- **架构特性：**
  - 使用 Grouped Query Attention（GQA，分组查询注意力）实现高效推理
  - 使用 RoPE（Rotary Position Embeddings，旋转位置嵌入）进行位置编码
  - 前馈层使用 SwiGLU 激活函数
  - 使用 RMSNorm 的预归一化

**关键规格（Llama 3.1）：**

| 模型 | 参数量 | 隐藏维度 | 层数 | 注意力头数 | KV 头数 |
|-------|-----------|-------------|--------|-----------------|----------|
| Llama 3.1 8B | 8B | 4096 | 32 | 32 | 8 |
| Llama 3.1 70B | 70B | 8192 | 80 | 64 | 8 |
| Llama 3.1 405B | 405B | 16384 | 126 | 128 | 8 |

**优势：**

- **质量：** 开源稠密模型中的领先性能
- **效率：** GQA 减小 KV 缓存并提高吞吐量
- **长上下文：** 原生支持扩展上下文长度
- **生态：** 广泛的工具和推理引擎支持

**推理考量：**

- 单 GPU 或多 GPU 环境中部署直接明了
- 所有主流推理引擎（vLLM、SGLang、TensorRT-LLM）均提供良好支持
- 内存需求随模型规模线性增长
- 最适合要求延迟一致的应用

**使用场景：**

- 通用聊天和助手应用
- 高质量内容生成
- 代码生成与分析
- 长文档理解与摘要

---

<a id="mixture-of-experts-moe-models"></a>

## Mixture-of-Experts（MoE）模型

MoE 模型通过引入稀疏激活的专家网络革新了 LLM 架构。它不再让每个 token 经过全部参数处理，而是将 token 路由到少量专门化专家，大幅提高参数效率和推理速度。

**MoE 核心原理：**

1. **稀疏激活：** 每个 token 仅激活模型的一小部分参数（通常为 10-20% 的专家）
2. **专家专门化：** 不同专家学习处理不同类型的输入（语言、领域、任务类型）
3. **动态路由：** 门控网络学习为每个输入 token 选择最相关的专家
4. **参数效率：** 每个 token 使用更少活跃参数，即可达到与大得多的稠密模型相当的质量

MoE 架构的完整细节请参阅[大规模专家（MoE 模型）](./large-scale-experts.md)。

<a id="llama-4"></a>

### Llama 4

**注意：** Llama 4 尚未发布，但备受期待。此处所有规格均为假设，依据是从 Llama 3 向 MoE 演进的预期架构趋势。模型发布后，应对照官方文档核实这些细节。

预计 Llama 4 将代表 Meta 向 Mixture-of-Experts 架构的演进，将 Llama 3 的架构进展与稀疏专家激活结合，提高效率并扩大规模。

**架构特征：**

- **模型类型：** MoE Transformer（仅解码器）
- **专家配置：** 多个专门化专家网络
- **路由策略：** 每个 token 选择 Top-K 专家
- **总参数量：** 显著大于 Llama 3，但每个 token 的活跃参数量相当
- **核心特性：**
  - 继承 Llama 3 架构的 GQA
  - RoPE 位置嵌入
  - 专家网络中的 SwiGLU 激活
  - 用于专家利用的负载均衡路由

**MoE 设计：**

```text
Input Token
    ↓
Shared Self-Attention Layer (Dense)
    ↓
Router Network
    ↓
Top-K Expert Selection
    ↓
[Expert 1] [Expert 2] ... [Expert N] (only top-K activated)
    ↓
Weighted Expert Output Aggregation
    ↓
Output
```

**相较稠密 Llama 3 的优势：**

- **推理速度：** 相似质量水平下推理快 2-3x
- **内存效率：** 每个 token 的活跃参数量更少
- **可扩展性：** 可以扩展到更大的总参数量
- **专门化：** 专家可以针对不同领域/语言进行专门化

**推理考量：**

- 需要感知专家的推理引擎（vLLM、SGLang、TensorRT-LLM）
- 专家路由采用 All-to-all 通信模式
- 多 GPU 部署需要专家并行
- 专家之间进行动态负载均衡

**使用场景：**

- 高吞吐量服务应用
- 多领域和多语言应用
- 要求最高效率的成本敏感部署
- 推理速度至关重要的应用

<a id="qwen-3"></a>

### Qwen 3

阿里云的 [`Qwen 3`](https://github.com/QwenLM/Qwen)（Qwen2.5 系列）实现灵活的混合架构，同时支持稠密与 MoE 配置，为不同使用场景提供部署灵活性。

**架构特征：**

- **模型类型：** 混合——同时提供稠密和 MoE 变体
- **可用配置：**
  - **稠密模型：** 0.5B、1.5B、3B、7B、14B、32B、72B 参数
  - **MoE 模型：** 具有多种专家配置的 Qwen2.5-MoE
- **上下文长度：** 最长 32K token（部分变体为 128K）
- **多语言：** 强大的中英文支持
- **训练：** 在代码、数学和多语言数据上进行大量训练

**MoE 配置（Qwen2.5-MoE）：**

| 模型 | 总参数量 | 活跃参数量 | 专家数 | 每 token 专家数 |
|-------|-------------|---------------|---------|---------------|
| Qwen2.5-MoE-A2.7B | ~14B | 2.7B | 60 | 8 |
| Qwen2.5-MoE-A14B | ~65B | 14B | 64 | 8 |

**独特特性：**

- **混合方法：** 稠密与 MoE 变体具有一致的 API
- **细粒度专家：** 大量较小专家实现更好的专门化
- **代码优化：** 针对编程任务的专门化专家
- **多专家路由：** 每个 token 路由到多个（8 个）专家以提高质量

**架构亮点：**

- Grouped Query Attention（GQA）实现高效 KV 缓存
- 支持扩展上下文的 RoPE
- 支持多语言的增强分词器
- 带辅助损失的负载均衡专家路由

**优势：**

- **灵活性：** 根据部署需要选择稠密或 MoE
- **质量：** 在中文和代码基准测试中表现领先
- **效率：** MoE 变体具有出色的质量成本比
- **部署：** 稠密与 MoE 版本之间具有平滑迁移路径

**推理考量：**

- 稠密模型：标准部署模式
- MoE 模型：60+ 个专家，需要专家并行
- 为常用专家考虑专家缓存策略
- 专家数量多，负载均衡至关重要

**使用场景：**

- **稠密变体：** 单 GPU 部署、延迟关键型应用
- **MoE 变体：** 高吞吐量服务、多语言应用
- 针对不同端点的混合部署
- 代码生成与分析任务

<a id="deepseek-v3"></a>

### DeepSeek-V3

[`DeepSeek-V3`](https://github.com/deepseek-ai/DeepSeek-V3) 代表了大规模 MoE 架构的领先水平，通过 256 个专家和先进路由机制，推进高效扩展的边界。

**架构特征：**

- **模型类型：** 大规模 MoE Transformer（仅解码器）
- **总参数量：** 总计 671B，每个 token 活跃 37B
- **专家配置：** 256 个专家，具有多 token 预测能力
- **上下文长度：** 最长 128K token
- **训练：** 具有专家专门化的多阶段训练
- **路由策略：** 带辅助损失的先进负载均衡路由

**高级 MoE 特性：**

- **多 token 预测：** 专家可以预测多个未来 token
- **分层专家组织：** 按专门化方向对专家分组
- **动态专家容量：** 为每个专家自适应分配容量
- **细粒度负载均衡：** 通过复杂路由算法防止专家坍塌

**架构规格：**

```text
Total Parameters: 671B
Active Parameters per Token: 37B (~5.5% activation rate)
Number of Experts: 256
Experts Activated per Token: Variable (typically 6-8)
Expert Size: ~2.6B parameters each
Hidden Dimensions: 7168
Number of Layers: 61
Attention Heads: 128 (16 KV heads with GQA)
```

**关键创新：**

1. **大规模专家并行：**
   - 256 个专家实现前所未有的专门化
   - 在 GPU 之间分层分布专家
   - 优化的 All-to-all 通信模式

2. **多 token 预测：**
   - 专家可以同时预测多个未来 token
   - 提高自回归生成吞吐量
   - 减少解码中的顺序依赖

3. **专家专门化：**
   - 领域专用专家（数学、代码、推理）
   - 支持多语言的语言专用专家
   - 任务类型专家（问答、生成、分析）

4. **负载均衡：**
   - 通过辅助损失函数鼓励均衡使用专家
   - 动态容量分配防止专家过载
   - 推理期间进行监控和调整

**性能特征：**

| 指标 | DeepSeek-V3 | GPT-4 | 说明 |
|--------|------------|-------|-------|
| 活跃参数量 | 37B | ~1.7T（估计） | 活跃参数量约少 46x |
| 推理速度 | 快 3x | 基线 | 相似质量下 |
| 每 token 内存 | 低 65% | 基线 | 源于稀疏激活 |
| 训练效率 | 快 4x | 等效稠密模型 | 按每训练 FLOP 计 |

**优势：**

- **极高效率：** 以极少的活跃计算提供庞大总容量
- **质量：** 仅用一小部分活跃参数成本实现 GPT-4 级性能
- **专门化：** 256 个专家提供细粒度领域专长
- **可扩展性：** 已验证的架构，可扩展到万亿以上参数
- **成本效益：** 服务成本显著低于等效稠密模型

**推理考量：**

- 高效部署需要 32+ 块 GPU
- 必须使用专家并行（分布 256 个专家）
- 高带宽互联至关重要（NVLink、InfiniBand）
- 需要复杂的负载均衡和监控
- 为频繁激活的专家考虑专家缓存

**部署模式：**

```yaml
# Example: DeepSeek-V3 multi-node deployment
# Conceptual configuration
apiVersion: v1
kind: Service
metadata:
  name: deepseek-v3
spec:
  replicas: 8  # Data parallelism: 8 replicas
  template:
    spec:
      containers:
      - name: vllm
        args:
        # Each replica uses 32 GPUs for expert parallelism
        - --tensor-parallel-size=2  # Shared layers
        - --expert-parallel-size=16  # 256/16 = 16 experts per GPU
        resources:
          limits:
            nvidia.com/gpu: "32"
```

**使用场景：**

- **企业 LLM 服务：** 需要以较低成本获得 GPT-4 质量的组织
- **多领域应用：** 处理多样化查询类型的系统
- **高吞吐量推理：** 每秒服务数千个请求
- **研究平台：** 探索大规模 MoE 架构
- **多语言服务：** 需要多种语言的全球化应用

**挑战：**

- 部署复杂，需要大量基础设施
- 需要感知专家的编排和监控
- 负载均衡与专家利用率优化
- 相比稠密模型，初始设置更复杂

---

<a id="diffusion-models"></a>

## 扩散模型

基于 Transformer 的 LLM 主导文本生成，而扩散模型已成为图像生成及其他模态的领先方法。

<a id="flux"></a>

### Flux

[`Flux`](https://github.com/black-forest-labs/flux) 是 Black Forest Labs 开发的领先文本生成图像扩散模型，代表了图像生成质量与效率的最新进展。

**架构特征：**

- **模型类型：** 潜空间扩散 Transformer
- **可用变体：**
  - **Flux.1 [pro]：** 最高质量，仅通过 API 提供
  - **Flux.1 [dev]：** 开放权重，非商业许可证
  - **Flux.1 [schnell]：** 快速变体，Apache 2.0 许可证
- **总参数量：** 12B 参数
- **架构：** 具有并行注意力路径的 Flow-matching Transformer

**主要特性：**

- **混合架构：** 将扩散过程与 Transformer 层结合
- **Flow Matching：** 用于提高质量的先进训练技术
- **并行注意力：** 分离的文本和图像注意力路径
- **引导蒸馏：** schnell 变体无需 CFG（Classifier-Free Guidance，无分类器引导）即可实现高质量生成

**架构组件：**

```text
Text Input
    ↓
Text Encoder (T5 or CLIP)
    ↓
[Transformer Blocks with Parallel Attention]
    ├─ Text Attention Path
    └─ Image Latent Attention Path
    ↓
Flow Matching Diffusion Process
    ↓
VAE Decoder
    ↓
Generated Image
```

**各变体规格：**

| 变体 | 步数 | 速度 | 质量 | 许可证 |
|---------|-------|-------|---------|---------|
| Flux.1 [pro] | 50 | 较慢 | 最高 | 专有（API） |
| Flux.1 [dev] | 50 | 中等 | 高 | 非商业 |
| Flux.1 [schnell] | 4 | 快 | 良好 | Apache 2.0 |

**优势：**

- **质量：** 领先的图像生成质量
- **提示词遵循：** 对复杂提示词有出色理解
- **效率：** Schnell 变体 4 步即可生成（SD 为 50+ 步）
- **开放权重：** Dev 和 schnell 变体可用于部署
- **灵活性：** 多种变体满足不同的速度/质量权衡

**推理考量：**

- 需要大量 GPU 显存（12B 参数 + VAE）
- 将多个请求组成批次可提高吞吐量
- Schnell 变体适用于实时应用
- 可以与 LoRA 结合微调风格
- 支持多种宽高比与分辨率

**部署模式：**

```python
# Example: Flux inference with Diffusers library
from diffusers import FluxPipeline

pipe = FluxPipeline.from_pretrained(
    "black-forest-labs/FLUX.1-schnell",
    torch_dtype=torch.bfloat16
)
pipe.to("cuda")

# Fast generation (4 steps)
image = pipe(
    prompt="A serene landscape with mountains",
    num_inference_steps=4,
    guidance_scale=0.0  # Guidance distilled, not needed
).images[0]
```

**使用场景：**

- **创意工具：** AI 艺术生成、设计辅助
- **营销：** 产品可视化、广告创意生成
- **游戏：** 资产生成、概念艺术
- **电子商务：** 产品图像生成与变体
- **实时应用：** 实时图像生成（使用 schnell 变体）

**与 LLM 基础设施集成：**

Flux 模型可以与 LLM 推理基础设施一起部署：

- 多模态应用共享 GPU 池
- 将 LLM 提示词增强与文本生成图像流水线结合
- 文本和图像生成使用统一 API 网关
- 资源调度同时考虑 LLM 和扩散工作负载

---

<a id="architecture-comparison"></a>

## 架构比较

理解不同架构之间的权衡，有助于为使用场景选择合适模型。

<a id="dense-vs-moe-comparison"></a>

### 稠密与 MoE 比较

| 方面 | 稠密（Llama 3） | MoE（DeepSeek-V3、Llama 4） |
|--------|----------------|---------------------------|
| **活跃参数量** | 全部参数 | 总参数量的 5-20% |
| **推理速度** | 基线 | 快 2-3x（相同质量） |
| **每 token 内存** | 100% | 35-40% |
| **部署复杂度** | 简单 | 中等至高 |
| **延迟可预测性** | 一致 | 可变（路由开销） |
| **多领域质量** | 良好 | 出色（专门化） |
| **吞吐量扩展** | 随 GPU 数量线性增长 | 超线性（专家并行） |
| **每 token 成本** | 基线 | 低 40-60% |

<a id="model-selection-guide"></a>

### 模型选择指南

<a id="choose-dense-models-when"></a>

#### 以下情况选择稠密模型

- **简单部署：** 单 GPU 或简单多 GPU 环境
- **延迟一致：** 可预测性能至关重要
- **小规模：** 请求量有限
- **单一领域：** 专注于特定应用领域
- **调试：** 更易理解和排障

**推荐：** Llama 3（8B、70B）

<a id="choose-moe-models-when"></a>

#### 以下情况选择 MoE 模型

- **高吞吐量：** 每秒服务数千个请求
- **多领域：** 处理多样化查询类型
- **成本效率：** 优先优化服务成本
- **规模：** 具有多 GPU 集群的大型部署
- **质量优先：** 需要每个活跃参数提供最高质量

**推荐：**

- **中等规模：** Llama 4、Qwen2.5-MoE-A2.7B
- **大规模：** DeepSeek-V3、Qwen2.5-MoE-A14B

<a id="choose-hybrid-approaches-when"></a>

#### 以下情况选择混合方法

- **灵活部署：** 不同端点有不同需求
- **迁移路径：** 从稠密逐步过渡到 MoE
- **混合工作负载：** 结合延迟关键型与批处理工作负载

**推荐：** Qwen 3（同时提供稠密与 MoE 变体）

<a id="performance-comparison"></a>

### 性能比较

基于公开基准测试与生产部署：

| 模型 | 类型 | 活跃参数量 | 吞吐量（相对值） | 延迟（TTFT） |
|-------|------|--------------|---------------------|---------------|
| Llama 3 8B | 稠密 | 8B | 1.0x | 50ms |
| Llama 3 70B | 稠密 | 70B | 0.3x | 180ms |
| Llama 4（估计） | MoE | ~10B | 2.5x | 45ms |
| Qwen2.5-MoE-A2.7B | MoE | 2.7B | 3.0x | 35ms |
| DeepSeek-V3 | MoE | 37B | 2.5x | 60ms |

*注意：吞吐量和延迟为近似值，极大程度取决于硬件、批量大小与工作负载特征。*

---

<a id="moe-key-benefits"></a>

## MoE 的主要优势

Mixture-of-Experts 架构相较传统稠密模型具有显著优势，尤其适合大规模部署。以下是 DeepSeek-V3 和 Llama 4 等模型展示的主要优势：

<a id="1-sparse-activation"></a>

### 1. 稀疏激活

**工作原理：**

MoE 模型为每个 token 仅激活一部分专家，通常占总参数量的 5-20%。这种稀疏激活在维持模型容量的同时，大幅减少计算需求。

**示例（DeepSeek-V3）：**

```text
Total Parameters: 671B
Active Parameters per Token: 37B
Activation Rate: 5.5%

Comparison with Dense Model:
- Dense 671B: 671B FLOPs per token
- DeepSeek-V3: 37B FLOPs per token
- Reduction: 94.5% fewer FLOPs
```

**优势：**

- **更低延迟：** 每个 token 的计算更少，生成更快
- **更高吞吐量：** 相同硬件每秒处理更多 token
- **能源效率：** 计算减少意味着耗电更低
- **节省成本：** 相比等效稠密模型，服务成本低 40-60%

<a id="2-handling-larger-parameter-counts"></a>

### 2. 支持更大的参数量

**挑战：**

稠密模型的开销线性扩展——质量翻倍往往需要 4-10x 的参数，直接增加内存、计算和成本。

**MoE 方案：**

MoE 架构将总参数量与活跃计算解耦，使模型可拥有数千亿乃至数万亿参数，同时保持可控的推理成本。

**实际示例：**

| 模型 | 总参数量 | 活跃参数量 | 内存（FP16） | 推理速度 |
|-------|-------------|---------------|---------------|----------------|
| 稠密 GPT-4（估计） | ~1.7T | ~1.7T | ~3.4TB | 基线 |
| DeepSeek-V3 | 671B | 37B | ~1.3TB | 快 3x |
| 质量 | 相当 | 相当 | 少 62% | - |

*注意：内存数据仅代表模型权重。实际推理内存还包括 KV 缓存、激活和运行时缓冲区的额外开销。*

**MoE 如何实现：**

1. **专家专门化：** 不同专家学习互补技能
2. **选择性激活：** 每个 token 仅由相关专家处理
3. **高效存储：** 专家可以分布到多个 GPU
4. **动态加载：** 按需加载专家以提高内存效率

**优势：**

- **庞大规模：** 1T+ 参数模型变得切实可行
- **内存效率：** 在分布式内存中存储专家
- **灵活部署：** 通过增加携带更多专家的 GPU 扩展
- **面向未来：** 架构可扩展至当前硬件限制之外

<a id="3-improved-training-speed-and-higher-accuracy"></a>

### 3. 更快的训练速度与更高的准确率

**训练效率：**

相比稠密模型，MoE 模型每个训练 FLOP 能取得更好的质量，从而加快迭代并降低训练成本。

**训练速度比较：**

| 模型类型 | 达到目标质量的 FLOPs | 训练时间 | 成本 |
|------------|------------------------|---------------|------|
| 稠密 | 1.0x（基线） | 100 天 | $10M |
| MoE（相似总参数量） | 0.25x | 25 天 | $2.5M |
| MoE（4x 总参数量） | 0.4x | 40 天 | $4M（更好质量） |

**MoE 训练更快的原因：**

1. **稀疏梯度：** 只有激活的专家接收梯度更新
2. **并行学习：** 不同专家同时学习不同技能
3. **高效容量：** 参数更多，而计算成本不成比例增加
4. **更好的泛化：** 专家专门化提高整体质量

**准确率改进：**

MoE 模型通过专门化提高准确率：

```text
Benchmark Performance (normalized to 100):

Dense 70B:
├─ Code: 75
├─ Math: 72
├─ Reasoning: 78
└─ Average: 75

MoE (DeepSeek-V3, 37B active):
├─ Code: 88 (Code-specialized experts)
├─ Math: 85 (Math-specialized experts)
├─ Reasoning: 90 (Reasoning-specialized experts)
└─ Average: 88 (17% improvement)
```

**MoE 准确率更高的原因：**

- **专门化：** 专家专注特定领域/技能
- **容量：** 更多总参数捕获更多知识
- **效率：** 每项任务的参数利用率更高
- **多样性：** 不同专家提供互补能力

<a id="combined-impact"></a>

### 综合影响

稀疏激活、更大参数量和改进训练的结合带来乘数效应：

**ROI 示例（DeepSeek-V3 与等效稠密模型）：**

```text
To achieve similar quality as DeepSeek-V3 with dense model:

Dense Model Required:
- Parameters: ~200B (active)
- Training Cost: $15M
- Inference Cost per 1M tokens: $15
- Latency: 200ms TTFT

DeepSeek-V3 (MoE):
- Parameters: 37B (active), 671B (total)
- Training Cost: $6M (60% savings)
- Inference Cost per 1M tokens: $5 (67% savings)
- Latency: 60ms TTFT (70% faster)

Total 3-Year TCO Savings: ~$50M for serving-focused deployment
```

<a id="when-moe-benefits-are-maximized"></a>

### 何时 MoE 优势最大

MoE 在以下场景中的优势最显著：

1. **大请求量服务：** 每秒数千个请求
2. **多领域应用：** 多样化查询类型受益于专门化
3. **成本敏感部署：** 优先优化 $/token
4. **质量要求：** 需要领先性能
5. **长期部署：** 初始复杂性随时间带来回报

<a id="implementation-considerations"></a>

### 实施考量

要实现这些优势，请考虑：

- **推理引擎：** 使用感知 MoE 的引擎（vLLM、SGLang、TensorRT-LLM）
- **硬件：** 用于专家通信的高带宽互联
- **监控：** 跟踪专家利用率与负载均衡
- **优化：** 调优专家并行与缓存策略

详细实施指导请参阅：

- [大规模专家（MoE 模型）](./large-scale-experts.md)
- [模型生命周期管理](./model-lifecycle.md)

---

<a id="references"></a>

## 参考资料

<a id="official-model-documentation"></a>

### 官方模型文档

- [Llama 3 模型卡](https://github.com/meta-llama/llama3)
- [Qwen 3 文档](https://github.com/QwenLM/Qwen)
- [DeepSeek-V3 技术报告](https://github.com/deepseek-ai/DeepSeek-V3)
- [Flux 模型仓库](https://github.com/black-forest-labs/flux)

<a id="research-papers"></a>

### 研究论文

- [Llama 3.1 模型卡](https://github.com/meta-llama/llama-models)
- DeepSeek-V3 技术报告（查看 DeepSeek-AI 仓库获取更新）
- Qwen 技术报告（查看 QwenLM 仓库获取更新）
- [Flow Matching for Generative Modeling](
  https://arxiv.org/abs/2210.02747)

<a id="model-weights-and-deployment"></a>

### 模型权重与部署

- [Hugging Face - Meta Llama 模型](https://huggingface.co/meta-llama)
- [Hugging Face - Qwen 模型](https://huggingface.co/Qwen)
- [Hugging Face - DeepSeek 模型](https://huggingface.co/deepseek-ai)
- [Hugging Face - Flux 模型](https://huggingface.co/black-forest-labs)

<a id="inference-engines-and-tools"></a>

### 推理引擎与工具

- [vLLM - 高吞吐量 LLM 服务](https://github.com/vllm-project/vllm)
- [SGLang - 高效 LLM 服务](https://github.com/sgl-project/sglang)
- [TensorRT-LLM - NVIDIA 推理](
  https://github.com/NVIDIA/TensorRT-LLM)
- [Diffusers - Flux 集成](
  https://github.com/huggingface/diffusers)

<a id="related-documentation"></a>

### 相关文档

- [大规模专家（MoE 模型）](./large-scale-experts.md) - 深入介绍 MoE 架构
- [推理引擎比较](./README.md) - LLM 服务平台概览
- [模型生命周期管理](./model-lifecycle.md) - 冷启动、休眠模式与卸载策略

---

**注意**：本文介绍截至 2025 年 10 月的现有模型架构。LLM 架构领域正在快速演进。请始终参考官方模型文档，获取最新规格与部署指导。

> **译者注（原文快照）：** 本文按所标注 source_commit 的原文翻译；包括 Llama 4 的假设规格、Qwen 命名、模型架构描述、版本状态、性能和成本数据，均为原文快照，未独立验证，不代表当前状态或实测结果。原文对 Llama 3 系列不同版本的规模、上下文长度等规格使用了系列口径，不能据此视为同一版本同时具备全部规格；具体模型版本与规格仍需核对官方文档。
