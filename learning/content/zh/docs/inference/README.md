---
status: Active
maintainer: pacoxu
last_updated: 2026-10-20
tags: inference, llm, vllm, serving, optimization
canonical_path: docs/inference/README.md
source_path: docs/inference/README.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="llm-inference-platforms--engines"></a>
# LLM 推理平台与引擎

全面概述面向 Kubernetes 原生部署的 LLM 推理平台、引擎和优化技术。

有关具体平台和技术的更多详情：

- [DaoCloud 开源推理销售 PPTX（英文）](./DaoCloud-Open-Source-Inference-Sales.pptx)
- [导入指南 → Google Slides](./DaoCloud-Open-Source-Inference-Sales-IMPORT.md)
- [多模态单页介绍（vLLM + Omni）](./daocloud-multimodal-onepager.md)
- [DaoCloud vLLM / llm-d / Dynamo 贡献单页（售前 PPT）](./daocloud-vllm-dynamo-onepager.md)
- [模型架构（Llama、Qwen、DeepSeek、Flux）](./model-architectures.md)
- [DeepInfer 与 deepseek-recipe](./deepseek-serving.md)
- [NVIDIA Dynamo：全景架构](./dynamo.md)
- [LoRA：用于高效 LLM 服务的低秩适配](./lora.md)
- [Grove：用于推理编排的 Kubernetes API](./grove.md)
- [kube-agentic-networking：智能体网络治理](./kube-agentic-networking.md)
- [OME：用于 LLM 管理的 Kubernetes Operator](./ome.md)
- [无服务器 AI 推理（Knative、AWS SageMaker、平台比较）](./serverless.md)
- [模型切换与动态调度（Aegaeon、vLLM 睡眠模式）](./model-switching.md)
- [LLM 推理中的缓存](./caching.md)
- [AI 智能体的内存、上下文与数据库](./memory-context-db.md)
- [大规模专家（MoE 模型）](./large-scale-experts.md)
- [模型生命周期管理（冷启动、睡眠模式、FMA、Dynamo Snapshot）](./model-lifecycle.md)
- [一张图看懂模型分发（HF、MatrixHub、Harbor、Dragonfly、ModelPack、ModelExpress）](./model-distribution-stack.md)
- [性能测试与基准测试工具](./performance-testing.md)
- [超节点架构（Vera Rubin NVL72、Shanghai Cube）](../hardware/supernode.md)
- [推理一致性与预检门禁](./inference-conformance.md)

<a id="inference-platform-landscape"></a>
## 推理平台全景

推理平台生态可以分为三个层次：

<a id="inference-engines-底座引擎"></a>
### 推理引擎（底座引擎）

执行 LLM 推理的核心服务引擎：

| 引擎 | 组织 | 核心功能 |
| --- | --- | --- |
| [vLLM](https://github.com/vllm-project/vllm) | vLLM Project（LF AI） | PagedAttention、连续批处理、最广泛的模型支持 |
| [SGLang](https://github.com/sgl-project/sglang) | SGLang 团队 | RadixAttention、快速结构化输出、推测解码 |
| [TensorRT-LLM](https://github.com/NVIDIA/TensorRT-LLM) | NVIDIA | CUDA 优化，在 NVIDIA 硬件上具有最高吞吐量 |
| [Triton Inference Server](https://github.com/triton-inference-server/server) | NVIDIA | 多框架、动态批处理、模型集成 |
| [TGI (Text Generation Inference)](https://github.com/huggingface/text-generation-inference) | Hugging Face | 生产就绪、Flash Attention、Paged Attention |
| [MindIE](https://www.hiascend.com/software/mindie) | 华为 | 针对 Ascend NPU 优化的推理引擎 |
| [lmdeploy](https://github.com/InternLM/lmdeploy) | 上海人工智能实验室 | Turbomind 内核、连续批处理、量化 |
| [llama.cpp](https://github.com/ggml-org/llama.cpp) | ggml-org | CPU/GPU 推理、GGUF 格式、边缘部署 |
| [Ollama](https://github.com/ollama/ollama) | Ollama | 开发者友好、本地部署、模型库 |
| [ONNX Runtime](https://github.com/microsoft/onnxruntime) | Microsoft | 跨平台、多框架、硬件加速 |
| [OpenVINO](https://github.com/openvinotoolkit/openvino) | Intel | Intel 硬件优化、模型优化工具包 |
| [DeepInfer](https://github.com/deepseek-ai/DeepInfer) | DeepSeek | DeepSeek-V4.1-Flash 的离线推理；Attention DP / CP、MoE EP、DSpark；SM100 和 Ascend 950 |

<a id="inference-platforms-推理平台"></a>
### 推理平台（推理平台）

用于大规模编排 LLM 推理的 Kubernetes 原生平台：

| 平台 | 组织 | 架构 | 核心功能 |
| --- | --- | --- | --- |
| [AIBrix](https://github.com/vllm-project/aibrix) | vLLM Project | StormService + RoleSet CRD | 高密度 LoRA、网关、自动扩缩容、P/D 解耦 |
| [Grove](https://github.com/ai-dynamo/grove) | NVIDIA（ai-dynamo） | PodCliqueSet CRD | 分层成组调度、拓扑感知、多级自动扩缩容、启动顺序 |
| [Kthena](https://github.com/volcano-sh/kthena) | Volcano（CNCF Sandbox） | Serving Group / LWS | 成组调度、拓扑感知、修订版本控制 |
| [NVIDIA Dynamo](https://github.com/ai-dynamo/dynamo) | NVIDIA | Grove + Kubernetes 集成（LWS / RBG） | NVIDIA 优化、解耦式服务、KV 路由 |
| [OME](https://github.com/sgl-project/ome) | SGLang Project | Operator 模式 | 模型管理、生命周期、多引擎支持 |
| [KServe](https://github.com/kserve/kserve) | CNCF 孵化项目 | InferenceService CRD | 多框架、金丝雀、可解释性、无服务器 |
| [llm-d](https://github.com/llm-d/llm-d) | Red Hat / IBM | 双 LWS + KServe | P/D 解耦参考实现 |
| [vLLM production-stack](https://github.com/vllm-project/production-stack) | vLLM Project | 基于 Helm | 路由器、多实例、KV 感知路由 |
| [Kaito](https://github.com/kaito-project/kaito) | Microsoft（CNCF Sandbox） | Workspace CRD | GPU 自动供应、预设模型、AKS 集成 |
| [Ray Serve](https://github.com/ray-project/ray) | Anyscale / Ray | 基于 Ray | 在线服务、自动扩缩容、模型组合、多副本 |
| [BentoML](https://github.com/bentoml/BentoML) | BentoML | BentoService | 模型打包、多框架、云部署 |

<a id="orchestration--routing-编排与路由"></a>
### 编排与路由（编排与路由）

处理请求路由、负载均衡和 P/D 解耦的组件：

| 组件 | 项目 | 用途 |
| --- | --- | --- |
| Gateway API Inference Extension | Kubernetes SIG | 通过 Gateway API 实现推理感知路由 |
| AIBrix Gateway | AIBrix | LLM 感知路由、负载均衡、前缀缓存 |
| kube-agentic-networking | Kubernetes SIGs | 面向智能体到工具/API 流量的智能体网络策略与治理 |
| Kthena Router | Kthena | 拓扑感知 P/D 路由 |
| LMCache | [LMCache](https://github.com/LMCache/LMCache) | KV 缓存卸载与复用 |
| Mooncake | [Moonshot AI](https://github.com/kvcache-ai/Mooncake) | 以 KV 缓存为中心的解耦推理 |
| RBG | [SGLang](https://github.com/sgl-project/rbg) | 用于多角色推理编排的 RoleBasedGroup CRD |
| SGLang Router | [SGLang](https://github.com/sgl-project/sglang) | SGLang 的推理路由与负载均衡 |

<a id="protocol-adapters-协议适配"></a>
### 协议适配器（协议适配）

位于 API 网关和推理引擎之间的库。它们渲染模型特定的提示词并解析输出，但不路由流量，也不运行模型。

| 组件 | 项目 | 用途 |
| --- | --- | --- |
| deepseek-recipe | [DeepSeek](https://github.com/deepseek-ai/deepseek-recipe) | Messages / Chat Completions / Responses ↔ DeepSeek V4 和 V4.1 提示词与 token ID |

DeepInfer 是该契约另一侧的引擎。开源版本止于离线推理：KV 缓存系统、VE / prefill / decode 解耦，以及 DP 副本负载均衡仍然是平台工作。参阅 [DeepInfer 与 deepseek-recipe](./deepseek-serving.md)。

<a id="featured-projects"></a>
## 重点项目

<a id="aibrix"></a>
### AIBrix

[`AIBrix`](https://github.com/vllm-project/aibrix) 是一个开源云原生解决方案，针对企业环境中大语言模型（LLM）推理的部署、管理和扩缩容进行了优化。作为 vLLM 项目生态的一部分，AIBrix 为构建可扩展的 GenAI 推理基础设施提供必要的基础组件。

**核心亮点：**

- 高密度 LoRA 管理与动态切换
- LLM 感知网关与智能路由
- 针对 LLM 工作负载按应用定制的自动扩缩容
- 分布式推理与 KV 缓存能力
- 具备 SLO 保证、成本高效的异构服务

详情请参阅 [AIBrix 简介](./aibrix.md)。

<a id="grove"></a>
### Grove

[`Grove`](https://github.com/ai-dynamo/grove) 是一个 Kubernetes API，提供统一的声明式接口，用于编排任意 AI 推理工作负载——从简单的单 Pod 部署，到复杂的多节点解耦系统。Grove 将整个推理服务系统（prefill、decode、路由等）描述为一个 `PodCliqueSet` 自定义资源，平台据此协调分层成组调度、拓扑感知放置、多级自动扩缩容和显式启动顺序。

**核心亮点：**

- **分层成组调度**——跨多个角色和扩缩容组，原子地调度所有必需的 Pod
- **拓扑感知放置**——将 Pod 放置在 NVLink 域或 RDMA 网络内，以最小化通信延迟
- **多级自动扩缩容**——独立扩缩 PodClique，同时遵守成组约束
- **启动顺序**——保证正确的初始化顺序（例如 worker 在 leader 之前）
- **单一 CRD**——用一个 `PodCliqueSet` CR 描述整个推理系统

详情请参阅 [Grove：Kubernetes 推理编排](./grove.md)。

<a id="kube-agentic-networking"></a>
### kube-agentic-networking

[`kube-agentic-networking`](https://github.com/kubernetes-sigs/kube-agentic-networking)
专注于 Kubernetes 上智能体工作流的网络策略与治理。这帮助平台团队控制和审计多租户环境中智能体访问工具、API 及推理端点的方式。

**核心亮点：**

- **智能体感知网络治理**：智能体到工具/API 流量的策略边界
- **Kubernetes 原生体系**：旨在融入现有集群策略和平台运维
- **契合安全与合规要求**：改善智能体系统的最小权限控制与可审计性

详情请参阅 [kube-agentic-networking：智能体网络治理](./kube-agentic-networking.md)。

<a id="kthena"></a>
### Kthena

[`Kthena`](https://github.com/volcano-sh/kthena) 是 Kubernetes 原生 LLM 推理平台，改变组织在生产环境中部署和管理大语言模型的方式。Kthena 是 Volcano 生态的一部分，为可扩展的 LLM 推理提供全面基础设施。**最新版本：v1.0.0** 新增协调式角色级 P/D 自动扩缩容、会话感知路由、更安全的角色级滚动更新，以及更丰富的缓存感知可观测能力。

**核心亮点：**

- **LeaderWorkerSet 集成**：原生支持 leader-worker 拓扑的分布式推理
- **拓扑感知调度**：通过角色级成组调度和网络拓扑感知优化 P/D 解耦（需要 Volcano v1.14+）
- **ModelServing 修订版本控制**：原生 ModelServing 版本控制，支持回滚
- **路由器可观测性**：通过全面指标、调试端口和 E2E 测试保障生产可靠性
- **增强的滚动更新**：可配置 maxUnavailable，加快发布
- **协调式 P/D 自动扩缩容**：独立的角色指标，可选 prefill/decode 副本比例约束
- **Session Boost**：优先处理后续请求，以提高热 KV 缓存复用率
- **插件框架**：可扩展架构，支持自定义配置逻辑
- **vLLM 数据并行**：支持 vLLM 数据并行部署模式

<a id="llm-d"></a>
### llm-d

[`llm-d`](https://github.com/llm-d/llm-d) 是一个生产就绪的 LLM 推理平台，使用双 LeaderWorkSet（LWS）架构实现 Prefill-Decode 解耦。llm-d 展示了在 Kubernetes 上编排解耦推理工作负载的最佳实践。

**核心亮点：**

- 用于 P/D 解耦的双 LWS 架构
- **KServe 集成**：基于 KServe 的 InferenceService 抽象构建，用于云原生模型服务
- 集成 LMCache，实现高效 KV 缓存管理
- 用于智能请求路由的路由边车
- 生产级 P/D 解耦参考实现

有关 KServe + llm-d 联合架构的详细讲解，请参阅[两全其美：使用 KServe 和 llm-d 实现大规模云原生 AI 推理](https://kserve.github.io/website/blog/cloud-native-ai-inference-kserve-llm-d)。

有关 P/D 解耦实现的详细信息，请参阅 [Prefill-Decode 解耦](./pd-disaggregation.md)。

<a id="nvidia-dynamo"></a>
### NVIDIA Dynamo

[`Dynamo`](https://github.com/ai-dynamo/dynamo) 是 NVIDIA 面向 AI 工厂优化的开源分布式推理框架。Dynamo 支持解耦式 prefill-decode 架构，并与 NVIDIA 软硬件栈深度集成。

**核心亮点：**

- **解耦式服务**：原生 P/D 解耦与 KV 缓存路由
- **双部署模式**：Grove（NVIDIA 原生）和 Kubernetes 原生模式（包括 LWS 与正在兴起的 RBG 工作流）
- **智能 KV 路由**：基于 KV 缓存局部性的智能路由
- **NIXL 传输**：高性能 KV 缓存传输协议
- **AIConfigurator**：数据驱动的 P/D 配置优化工具
- **Snapshot（检查点/恢复）**：通过 CRIU + `cuda-checkpoint` 对已初始化的 worker 进行热启动（约 ~10 s，而冷启动约 ~1 min）；参阅[模型生命周期](./model-lifecycle.md#dynamo-snapshot-checkpoint--restore)
- **RBG 生态进展**：配套示例已合入 [sgl-project/rbg#255](https://github.com/sgl-project/rbg/pull/255)，而 Dynamo 侧集成指南在 [ai-dynamo/dynamo#5457](https://github.com/ai-dynamo/dynamo/pull/5457) 中跟踪

要自上而下了解 Dynamo 如何与 Grove、Planner、KVBM、NIXL 及底层硬件和存储层协作，请参阅 [NVIDIA Dynamo：全景架构](./dynamo.md)。

<a id="kserve"></a>
### KServe

[`KServe`](https://github.com/kserve/kserve) 是一个 CNCF 孵化项目，提供用于大规模部署 ML 模型的 Kubernetes 原生平台，并不断增强对 LLM 推理工作负载的支持。

**核心亮点：**

- **InferenceService CRD**：跨框架模型服务的统一 API
- **LLMInferenceService CRD**：面向 LLM 服务和 P/D 解耦的专用 API，原生集成 vLLM/LMCache
- **LMCache 集成**：面向 LLM 服务的 KV 缓存卸载
- **金丝雀部署**：通过流量拆分实现安全发布
- **无服务器服务**：基于 Knative 的缩容至零支持
- **llm-d 集成**：通过双 LWS 架构，为解耦式 LLM 服务提供基础

KServe + llm-d 的组合可实现大规模云原生 AI 推理。完整架构概述请参阅[两全其美：使用 KServe 和 llm-d 实现大规模云原生 AI 推理](https://kserve.github.io/website/blog/cloud-native-ai-inference-kserve-llm-d)。

有关 P/D 解耦详情，请参阅 [Prefill-Decode 解耦](./pd-disaggregation.md)。

<a id="kernel-optimization-算子与内核优化"></a>
## 内核优化（算子与内核优化）

加速 LLM 推理操作的底层 GPU 内核库：

<a id="kernel-dsl--codegen"></a>
### 内核 DSL 与代码生成

- [`Triton (triton-lang)`](https://github.com/triton-lang/triton)：用于编写自定义 GPU 内核的类 Python DSL，广泛用于 vLLM 和 SGLang
- [`tilelang`](https://github.com/tile-ai/tilelang)：面向 AI 工作负载的高性能分块内核生成 DSL

<a id="transformer-kernels"></a>
### Transformer 内核

- [`FlashInfer`](https://github.com/flashinfer-ai/flashinfer)：高性能推理侧内核（attention、MoE 等），由 vLLM 和 SGLang 使用
- [`FlashAttention`](https://github.com/Dao-AILab/flash-attention)：经典的内存高效 attention 内核
- [`xFormers`](https://github.com/facebookresearch/xformers)：优化的 transformer 基础组件与相关内核（Meta）
- [`FlashMLA`](https://github.com/deepseek-ai/FlashMLA)：DeepInfer 使用的 MLA 解码内核，vLLM 和 SGLang 也为 DeepSeek 模型集成了该内核
- [`DeepSelect`](https://github.com/deepseek-ai/DeepSelect)：用于 DeepSeek 稀疏 attention 的 top-k 选择

<a id="math-primitives"></a>
### 数学原语

- [`CUTLASS`](https://github.com/NVIDIA/cutlass)：NVIDIA 面向 CUDA 的 GEMM/算子基础组件
- [`DeepGEMM`](https://github.com/deepseek-ai/DeepGEMM)：DeepSeek 提供的高性能 GEMM 实现
- [`TileKernels`](https://github.com/deepseek-ai/TileKernels)：DeepInfer 与仓库内 TileLang 算子一起使用的分块内核

<a id="moe-communication"></a>
### MoE 通信

- [`DeepEP`](https://github.com/deepseek-ai/DeepEP)：专家并行分发与合并，使 MoE 通信与计算重叠

<a id="quantization-量化与低精度"></a>
## 量化（量化与低精度）

模型量化工具可减少内存占用并提高推理速度：

| 工具 | 组织 | 描述 |
| --- | --- | --- |
| [bitsandbytes](https://github.com/bitsandbytes-foundation/bitsandbytes) | bitsandbytes | 8-bit/4-bit 训练与推理量化 |
| [GPTQ](https://github.com/IST-DASLab/gptq) / [AutoGPTQ](https://github.com/AutoGPTQ/AutoGPTQ) | IST-DASLab | GPT 模型的训练后量化 |
| [AWQ](https://github.com/mit-han-lab/llm-awq) | MIT Han Lab | 激活感知权重量化 |
| [AMD Quark](https://quark.docs.amd.com/) | AMD | AMD 生态的模型优化与量化 |
| [LLM Compressor](https://github.com/vllm-project/llm-compressor) | vLLM Project | LLM 压缩/量化工具链 |
| [NVIDIA ModelOpt](https://github.com/NVIDIA/TensorRT-Model-Optimizer) | NVIDIA | NVIDIA 生态的模型优化与量化 |

<a id="cost-optimization"></a>
## 成本优化

GPU 基础设施成本高昂。有效优化推理工作负载的成本涉及多种策略：

<a id="gpu-sharing"></a>
### GPU 共享

在单块 GPU 上运行多个工作负载以提高利用率：

| 方法 | 机制 | 最适用场景 |
| --- | --- | --- |
| **时间切片** | Pod 之间的 CUDA 时间复用 | 小模型、开发/测试 |
| **MIG（多实例 GPU）** | 硬件 GPU 分区（A100/H100） | 隔离、可预测的工作负载 |
| **MPS（多进程服务）** | 具有内存隔离的 CUDA 上下文共享 | 批量推理、高吞吐量 |
| **HAMi** | 软件 GPU 显存/核心配额与调度 | 灵活分割、异构加速器 |
| **vGPU** | 带显存限制的虚拟化 GPU | 企业多租户 |

**通过 NVIDIA GPU Operator 配置 MIG：**

```yaml
# Enable MIG on a node with NVIDIA A100
# 7 equal slices of 1/7 A100 each (10GB per slice)
kubectl label node <node> nvidia.com/mig.config=all-1g.10gb
```

MIG 设置请参阅 [NVIDIA GPU Operator](../kubernetes/nvidia-gpu-operator.md)，平台级取舍请参阅 [HAMi / MIG / GPU 共享](../kubernetes/hami-gpu-sharing.md)。

<a id="spot--preemptible-instances"></a>
### Spot / 可抢占实例

对启用了检查点的**容错训练**工作负载使用 Spot 实例。云厂商针对可中断计算提供 60–80% 的折扣：

- **AWS**：EC2 Spot Instances，配合 Karpenter 自动重新供应资源
- **GCP**：Spot VM，配合 GKE 自动供应资源
- **Azure**：Azure Spot VM，配合 AKS 节点池

安全使用 Spot 进行训练的关键要求：

- 定期保存检查点（每 5–15 分钟）
- 优雅关闭处理（`SIGTERM` → 检查点 → 退出）
- 使用支持抢占感知作业重新入队的 Kueue 或 Volcano

<a id="inference-cost-optimization"></a>
### 推理成本优化

- **量化**：INT8/INT4 将 GPU 显存用量降低 2–4x，使每块 GPU 可运行更多副本。参阅上文[量化](#quantization-量化与低精度)章节。
- **推测解码**：使用小型草稿模型加速主模型（降低 TPOT，提高吞吐量）
- **连续批处理**：vLLM/SGLang 的默认批处理机制可最大化并发请求间的 GPU 利用率
- **前缀缓存**：缓存重复提示词前缀的 KV 状态（参阅[缓存策略](./caching.md)）
- **模型混部**：使用 Koordinator 的混部模式，在同一节点上调度推理 + 批处理工作负载

<a id="rightsizing"></a>
### 合理配置资源规模

分析实际 GPU 利用率，识别资源过度配置的工作负载：

- **DCGM Exporter** 指标：`DCGM_FI_DEV_GPU_UTIL`、`DCGM_FI_DEV_FB_USED`
- **vLLM 指标**：`vllm:gpu_cache_usage_perc`、`vllm:num_requests_running`
- 将资源请求设为实际 P95 利用率（而非峰值）

**参考资料：**

- [推理成本优化指南](../archive-blog/2026-01-15/2026-01-15-inference-cost-optimization_zh.md)（中文）——详细的 5 策略框架
- [无服务器推理](./serverless.md)——利用 KEDA 缩容至零，应对变化的流量模式
