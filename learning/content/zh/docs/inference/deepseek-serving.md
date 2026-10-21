---
status: Active
maintainer: pacoxu
last_updated: 2026-10-20
tags: inference, deepseek, deepinfer, protocol, serving
canonical_path: docs/inference/deepseek-serving.md
source_path: docs/inference/deepseek-serving.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="deepinfer-and-deepseek-recipe"></a>
# DeepInfer 与 deepseek-recipe

[DeepInfer](https://github.com/deepseek-ai/DeepInfer) 和 [deepseek-recipe](https://github.com/deepseek-ai/deepseek-recipe) 是 DeepSeek 服务链路中的两个部分，以独立仓库发布。它们并不替代 Kubernetes 推理平台。两者共同覆盖模型运行时和 API 到提示词的契约。它们周围的缓存、解耦式服务和副本路由仍然是平台的工作。

<a id="where-they-sit"></a>
## 它们所处的位置

本仓库将 AI 基础设施视为三个闭环：训练、推理（prefill / decode、KV 缓存、解耦、路由），以及必须保持训练与服务一致的 RL。这两个项目位于推理闭环中，分别处于引擎边界两侧：

| 层 | 项目 | 此次发布提供的能力 | 此领域中的相邻组件 |
| --- | --- | --- | --- |
| API 与网关 | — | HTTP、认证、限流、副本选择 | [Gateway API Inference Extension](https://github.com/kubernetes-sigs/gateway-api-inference-extension)、AIBrix Gateway、Kthena Router |
| 协议适配器 | [deepseek-recipe](https://github.com/deepseek-ai/deepseek-recipe) | Messages / Chat Completions / Responses ↔ 对话 ↔ 提示词与 token ID | 位于 API 进程中；示例使用模拟推理 |
| 引擎 | [DeepInfer](https://github.com/deepseek-ai/DeepInfer) | 离线推理：调度器、采样器、并行机制、内核 | vLLM、SGLang、TensorRT-LLM |
| 服务系统 | 不包含在 DeepInfer 此次发布中 | KV 缓存、VE / prefill / decode 解耦、DP 负载均衡 | [缓存](./caching.md)、[P/D 解耦](./pd-disaggregation.md)、[Grove](./grove.md)、[Dynamo](./dynamo.md) |
| 内核与集合通信 | 独立的 DeepSeek 仓库 | Attention、GEMM、MoE 分发、top-k | [内核章节](./README.md#kernel-optimization-算子与内核优化) |
| 集群放置 | — | 成组调度、scale-up 域、设备分配 | LWS、Grove、DRA、[超节点](../hardware/supernode.md) |

```text
Client / Agent
    │  Chat Completions, Responses, or Messages
    ▼
AI Gateway                 routing, auth, DP replica selection
    │
    ▼
deepseek-recipe            protocol ↔ conversation ↔ prompt / token ids
    │                      sampling params, output constraint
    ▼
DeepInfer                  scheduler, sampler, Attention DP / CP, MoE EP
    │
    ├── still required for a full service:
    │     KV cache, VE/prefill/decode disaggregation, DP load balancing
    ▼
FlashMLA · DeepGEMM · DeepEP · TileKernels · DeepSelect · TileLang
    ▼
NVIDIA SM100 or Huawei Ascend 950, inside one scale-up domain
```

DeepInfer 自己的 README 划定了这一边界。完整的推理服务仍然需要 KV 缓存系统、VE / prefill / decode 解耦，以及 prefill 和 decode 两个阶段的数据并行副本间负载均衡。引擎侧的大部分解耦功能已经实现；围绕它的服务并不包含在此次发布中。deepseek-recipe 则从上层明确了相应边界：调用方必须提供模型推理、工具执行和 HTTP 传输。

<a id="deepinfer"></a>
## DeepInfer

[DeepInfer](https://github.com/deepseek-ai/DeepInfer) 是支撑 DeepSeek 大规模生产服务的高性能推理框架。此次开源版本（仓库创建于 2026-10-16，Apache-2.0）提供针对单一模型 DeepSeek-V4.1-Flash 的**离线推理**。默认检查点为 [`deepseek-ai/DeepSeek-V4.1-Flash-1017`](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017)。

它主要基于 [vLLM](https://github.com/vllm-project/vllm) 构建，并借鉴了 SGLang 和 TensorRT-LLM 的其他思路。这一渊源对于 AI 基础设施很重要：DeepInfer 是专用引擎，而不是另一个编排平台。在这一领域中，vLLM 和 SGLang 仍然是通用引擎；DeepInfer 则是针对 DeepSeek 模型、直接暴露生产并行机制和内核选择的路径。

<a id="what-the-engine-includes"></a>
### 引擎包含哪些能力

| 功能 | 在服务链路中的作用 |
| --- | --- |
| 优化内核 | [FlashMLA](https://github.com/deepseek-ai/FlashMLA)、[DeepGEMM](https://github.com/deepseek-ai/DeepGEMM)、[DeepEP](https://github.com/deepseek-ai/DeepEP)、[TileKernels](https://github.com/deepseek-ai/TileKernels)、[DeepSelect](https://github.com/deepseek-ai/DeepSelect)，以及仓库内的 TileLang 内核 |
| Attention DP / 均衡 CP | 数据并行 attention，以及将批次均匀分配到 CP 单元的上下文并行 |
| MoE EP + EPLB | 专家并行与专家并行负载均衡。冗余专家默认为 32，并会调整取整，使专家数能整除 `ep_size` |
| DSpark | 草稿 token 加上按置信度调度的验证。`DEEPINFER_ENABLE_MTP_VARLEN=1`；`DEEPINFER_USE_NEXTN_DECODE` 设置最大草稿长度（默认为 5） |
| SWA 有界重放 | 解码器 prefill 重放有界后缀，而不是整个窗口。V4.1 默认值：`DEEPINFER_YOCO_PREFILL_TRUNCATION_MODE=compact`、`DEEPINFER_YOCO_PREFILL_KEEP_TOKENS=140` |
| 异步调度 | CPU 批次调度与设备执行重叠。默认开启 |
| 批次不变推理 | 不同批次组成下结果相同。`DEEPINFER_BATCH_INVARIANT=1`，仅限 NVIDIA |
| 确定性采样 | 相同 token 和采样参数生成相同输出。需启用批次不变模式、关闭 MTP varlen，并固定 `seq_seed`。仅限 NVIDIA |
| 结构化输出 | 通过 `SamplingParams.so_args` 支持正则表达式、JSON schema 或 EBNF |

> 译者注：上表按原文“expert count divides ep_size”保留整除方向；原文的这一方向可能需要对照实现核实，此处不确定实际约束。

已公布的帕累托曲线使用 4 块 SM100 GPU 测量 prefill，使用 64 块测量 decode，两者各自都位于单个 scale-up 域内。这是放置约束，而不是 Kubernetes 功能：参与通信的组必须位于 scale-up 互连网络内部。有关这些域在 GB200 / Vera Rubin 级机架和国产超节点中的体现，请参阅[超节点](../hardware/supernode.md)。

<a id="runtime-boundary"></a>
### 运行时边界

此次发布支持的硬件：

- NVIDIA SM100（CUDA 13）
- 华为 Ascend 950（CANN 9.2）

主机前提条件：Linux、GCC >= 13、Python 3.12。在构建前选择加速器，并在运行时保持该导出环境变量：

```bash
export DEEPINFER_ACCELERATOR=nvidia   # or ascend
./build.sh
python examples/offline_inference.py
```

离线示例覆盖 EP、attention DP 和 CP（`--ep`、`--dp`、`--cp`）。基准测试将 prefill 与 decode 解耦：prefill 分块大小和未缓存后缀长度不决定 decode 批次，而 decode 会复用 prefill 产生的共享前缀 KV。视觉编码可以单独做参数扫描（`prompt_mode=image`、编码器扫描），无需加载完整 LLM，这与解耦流水线中的 VE 角色相对应。

仍需在进程外构建的部分：

- **KV 缓存系统。** 基准测试在单次运行内复用共享前缀。跨请求、跨节点或基于 SSD 的 KV 是独立系统。参阅[缓存](./caching.md)。
- **将 VE / prefill / decode 作为服务提供。** 引擎可以拆分这些工作，并且已经包含大部分所需的引擎功能。将它们转变为可独立扩缩容的角色，是 LWS、Grove、llm-d、Dynamo 或 KServe 的工作。参阅 [P/D 解耦](./pd-disaggregation.md)。
- **DP 副本之间的负载均衡**，同时适用于 prefill 和 decode。这是网关与路由器的工作，而不是采样器的工作。

<a id="deepseek-recipe"></a>
## deepseek-recipe

[deepseek-recipe](https://github.com/deepseek-ai/deepseek-recipe)（仓库创建于 2026-09-10，MIT，Rust 实现并提供 Python 绑定；2026-10-20 在 PyPI 发布 `0.2.0`）将 API 请求转换为 DeepSeek 模型所需的对话格式，渲染提示词，编码 token ID，并将模型输出解析回调用方的协议。

它是 API 服务器与推理后端之间的契约。它不运行模型、不执行工具，也不处理 HTTP。`server-rs`（Axum）和 `server-py`（FastAPI）是使用模拟推理的示例，因此无需 GPU 即可开发协议。

<a id="what-the-adapter-includes"></a>
### 适配器包含哪些能力

- **协议：** Messages、Chat Completions 和 Responses，包括流式及完整响应。支持文本、图像、思考模式、客户端工具调用，以及 Chat Completions `prefix` 续写。
- **提示词：** DeepSeek V4 和 V4.1 渲染，以及在接入 tokenizer 后进行 token 编码。默认模型名为 `DeepSeek-V4-Pro` 和 `DeepSeek-V4.1-Flash`；其他名称通过 `ConversionOptions::with_model_alias` 注册。
- **生成设置：** 思考模式、推理强度、`temperature`、`top_p` 和输出限制。在检查提示词是否超出上下文限制之后，如果请求省略 `max_tokens`，默认值在非思考模式下为 8192，思考模式下为 65536，而推理强度为 `max` 的思考模式下为 131072。
- **输出解析：** 推理内容、工具调用、JSON 对象输出和停止序列。接入 tokenizer 后，用量信息可以报告 `reasoning_tokens`。
- **结构化输出：** 验证 JSON schema 并将其写入提示词，或者将正则表达式作为 `ResponseFormat::Regex` 透传。它会选择 `InferenceOptions` 上的 `OutputConstraint`。后端决定是否强制执行该约束。DeepInfer 是能够执行约束的后端之一：其采样器接受正则表达式、JSON schema 和 EBNF。
- **图像：** base64 或 URL，使用 OpenCV 为 V4.1 进行预处理。V4 不接受图像；每张图像会变为文本 `[Unsupported Image]`。除非服务安装 `DestinationFilter`，否则 URL 抓取可连接到任意地址。
- **工具：** 函数工具；Responses 还支持工具命名空间和 `apply_patch` 自定义工具。V4.1 支持 Messages 中的延迟工具加载，以及 Responses 中由客户端执行的工具搜索。该库不调用工具。
- **对数概率：** 请求字段会复制到 `InferenceOptions`。调用方填充 `InferenceChunk::Tokens`。该库不计算概率。

| 包 | 用途 |
| --- | --- |
| `deepseek-recipe` | 协议转换与模型输出解析 |
| `deepseek-recipe-core` | 对话、消息、图像和工具类型 |
| `deepseek-recipe-encoding` | V4 和 V4.1 提示词渲染与 token 编码 |
| `deepseek-recipe-image` | 图像抓取与预处理 |
| `deepseek-recipe-python` | Python 绑定，以 `deepseek_recipe` 导入 |
| `encoding-decoding-demo` | 用于提示词渲染和输出解析的本地 Web UI |
| `server-rs` / `server-py` | 使用模拟推理的 API 示例 |

Python 3.10+ 可通过 `pip install deepseek-recipe` 安装绑定。图像处理路径的源码构建需要 Rust、OpenCV 4.x 和 libclang。

<a id="how-a-request-crosses-the-two"></a>
## 请求如何穿过这两个组件

1. 网关接收 Chat Completions、Responses 或 Messages 请求，并选择一个 prefill 或 decode 副本。
2. deepseek-recipe 将请求体转换为对话，渲染 V4 或 V4.1 提示词，并可选地编码 token ID。它还会确定采样默认值和结构化输出约束。
3. 调用方将提示词或 token ID 交给推理后端。对于 DeepInfer，这对应离线引擎上的 `SamplingParams`（需要强制执行约束时包含 `so_args`），或者由调用方仍需自行运维的服务所封装的同一引擎。
4. DeepInfer 在 Attention DP / CP 和 MoE EP 下运行内核，可选地使用 DSpark 草稿和 SWA 有界重放，然后返回 token。
5. deepseek-recipe 将这些 token 解析为推理内容、工具调用和客户端请求的响应 schema。如果需要执行工具，则在解析之后由智能体运行时执行。

步骤 2 和步骤 5 是 CPU 工作，应放在 API 进程旁。步骤 4 是 GPU 或 NPU 工作，应放在单个 scale-up 域内、采用成组调度的组中。步骤 1 的网关，对应 DeepInfer README 中留给外部实现的“数据并行副本间的负载均衡”。

<a id="what-stays-ai-infra-work"></a>
## 哪些仍是 AI 基础设施的工作

| DeepInfer / recipe 未覆盖的部分 | 为什么属于平台工作 | 本仓库的对应内容 |
| --- | --- | --- |
| 超出单次基准运行的 KV 缓存 | 跨请求、节点和存储层级复用前缀 | [缓存](./caching.md)、Mooncake、LMCache |
| 将 VE / prefill / decode 作为可独立扩缩容的角色 | 引擎可以拆分阶段；服务必须负责放置、排序和自动扩缩容 | [P/D 解耦](./pd-disaggregation.md)、[Grove](./grove.md)、[Dynamo](./dynamo.md)、llm-d、LWS |
| prefill 和 decode 的 DP 负载均衡 | 副本选择取决于缓存局部性和队列深度 | Gateway API Inference Extension、AIBrix Gateway、Kthena Router |
| 工具执行 | Recipe 只解析工具调用，到此为止 | [AI 网关与智能体工作流](../../README.md#-3-ai-gateway--agentic-workflow)中的智能体运行时 |
| HTTP、认证、多租户隔离 | Recipe 和离线引擎不终接客户端流量 | 网关项目、[隔离](../kubernetes/isolation.md) |
| EP/CP 组的 scale-up 放置 | 已公布的曲线使用 4 和 64 块 SM100 GPU，各自位于一个 scale-up 域内 | [超节点](../hardware/supernode.md)、Grove 拓扑放置、DRA |

当工作负载是 DeepSeek-V4.1-Flash，且目标是在 SM100 或 Ascend 950 上使用生产内核和并行机制路径时，可使用 DeepInfer。当现有网关或 API 服务器必须生成 DeepSeek V4 / V4.1 提示词，且不想重新实现聊天模板时，可使用 deepseek-recipe。当平台必须在统一编排 API 后面服务多个模型家族时，应保留 vLLM 或 SGLang；两者都已吸收 DeepSeek 内核，而 DeepInfer 并不会消除对该平台的需求。

<a id="references"></a>
## 参考资料

- [DeepInfer](https://github.com/deepseek-ai/DeepInfer)
- [deepseek-recipe](https://github.com/deepseek-ai/deepseek-recipe)
- [deepseek-recipe 0.2.0](https://docs.rs/crate/deepseek-recipe/latest)
- [DeepSeek-V4.1-Flash](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash)
- [开源 DeepSeek 推理引擎（2025 年方向说明）](https://github.com/deepseek-ai/open-infra-index/blob/main/OpenSourcing_DeepSeek_Inference_Engine/README.md)
- [第 6 天：DeepSeek-V3/R1 推理系统概述](https://github.com/deepseek-ai/open-infra-index/blob/main/202502OpenSourceWeek/day_6_one_more_thing_deepseekV3R1_inference_system_overview.md)
