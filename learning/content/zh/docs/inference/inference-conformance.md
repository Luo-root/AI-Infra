---
status: Active
maintainer: pacoxu
last_updated: 2026-10-04
tags: inference, conformance, preflight, llm, slo
canonical_path: docs/inference/inference-conformance.md
source_path: docs/inference/inference-conformance.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="inference-conformance-and-preflight-gate"></a>

# 推理符合性检查与发布前检查门禁

在将 LLM 服务晋级发布之前，使用这份不依赖具体引擎的检查清单。[`scripts/conformance/preflight.sh`](../../scripts/conformance/preflight.sh) 中的发布前检查脚本会测试兼容 OpenAI 的聊天端点，并评估外部采集的指标快照。它是一个小型发布门禁，不是基准测试，也不能替代生产监控。

<a id="gate-policy"></a>

## 门禁策略

| 门禁 | 要求 | 通过条件 |
| --- | --- | --- |
| 冒烟检查 | **必需** | 一次有代表性的请求成功，返回有效输出，且 HTTP 状态表示成功。 |
| 负载检查 | **必需** | 配置的请求样本执行完成且无错误，并达到配置的最低成功请求速率。并发和真实流量形态应使用专用负载工具测试。 |
| SLO | **必需** | 新鲜的指标快照包含所有必需测量值，且所有配置的阈值均通过。 |
| 回滚 | **必需** | 晋级发布前，提供的只读回滚就绪检查成功。若部署后门禁失败，请按下文回滚清单处理；脚本不会修改生产流量或自动回滚。 |
| 质量、韧性和容量扩展 | 建议 | 按风险加入模型专属质量检查、故障注入、逐步增加并发、自动扩缩容，以及更长时间的持续负载测试。 |

对隔离的候选实例或金丝雀实例运行门禁。不要向未经批准的生产服务发送合成负载。任何必需门禁失败，都应阻止晋级发布。

<a id="conformance-dimensions"></a>

## 符合性检查维度

| 维度 | 必需检查 | 建议检查 |
| --- | --- | --- |
| 模型与制品 | 模型 ID/修订版本、分词器、量化方式、上下文长度和制品摘要与发布清单一致；有代表性的提示词返回非空生成结果。 | 用固定质量/评估集与已批准基线比较；测试模型切换和预热。 |
| 运行时 | 就绪副本提供预期 API 和模型；启动在部署截止时间内完成；固定运行时配置和镜像版本。 | 测试优雅关闭、OOM 恢复、批处理、推测解码和冷启动。 |
| 路由器与发布 | 经路由的端点确实到达候选实例，并报告请求错误；鉴权、超时、重试与流量分配策略正确。 | 验证粘性/会话路由、基于健康状态的故障切换、限流和金丝雀隔离。 |
| GPU 与容量 | 已分配预期类型和数量的加速器；没有持续 GPU 错误或内存不足事件；目标负载下容量仍有余量。 | 检查 GPU 利用率、内存带宽、功率/温度状态、碎片和自动扩缩容行为。 |
| KV 缓存 | 有缓存用量和命中率测量值；缓存压力保持在工作负载批准的限值内。 | 测试前缀复用、驱逐、缓存隔离、卸载，以及模型或适配器切换后的正确性。 |
| 指标与 SLO | 采集 TTFT、TPOT、ITL、有效吞吐量（goodput）、GPU 缓存使用率、KV 命中率、请求错误以及时间窗口/样本数。SLO 门禁检查下方阈值模板中的六个值。 | 按模型、提示词/输出长度、副本、租户及缓存命中状态细分；对饱和与错误预算告警。 |
| 恢复 | 存在已知正常的修订版本/制品，且回滚就绪检查能解析出回滚目标。 | 在预发布环境演练流量回滚，验证数据/配置兼容性及恢复时间。 |

<a id="metrics-and-example-thresholds"></a>

### 指标与示例阈值

把下面内容当作模板，而非通用 SLO。根据产品 SLO、工作负载组合、模型、硬件和有代表性的基线设定阈值。表中数值仅为示例；除基本延迟上限外，脚本环境变量的默认值刻意设置得较宽松。

| 指标 | 门禁中的定义 | 示例阈值 | 方向 |
| --- | --- | --- | --- |
| TTFT P95（ms） | 从接受请求到生成首个 token 的时间；只有产品 SLO 本身排除排队时间时，才排除它。 | 1,000 | 最大值 |
| TPOT P95（ms/token） | 首个 token 后每个输出 token 的平均耗时，先逐请求计算，再取 P95。 | 100 | 最大值 |
| ITL P95（ms） | 相邻生成 token 时间间隔的 P95。 | 150 | 最大值 |
| Goodput（输出 tokens/s） | 请求满足延迟和错误 SLO 时交付的每秒输出 token 数。 | 100 | 最小值 |
| GPU 缓存使用率（%） | 同一负载窗口中 KV/GPU 缓存占用的峰值或持续值；记录使用了哪种聚合方式。 | 90 | 最大值 |
| KV 命中率（%） | 同一工作负载窗口内缓存命中次数除以缓存查询次数。 | 20 | 最小值 |

`METRICS_FILE` 是由部署环境的指标适配器提供的 JSON，包含名为 `ttft_p95_ms`、`tpot_p95_ms`、`itl_p95_ms`、`goodput_tokens_per_sec`、`gpu_cache_usage_pct` 和 `kv_hit_rate_pct` 的数值。预热后，从同一个有代表性的负载窗口采集这些值，并在发布证据中包含抓取间隔与样本数。各引擎的指标名和标签不同；应将引擎的 Prometheus 时间序列映射成这个小型公共结构，而不是假定名称和语义相同。

发布前检查脚本对串行 HTTP 请求计时，用于最低限度的负载门禁。这些请求耗时不是 token 级 TTFT、TPOT 或 ITL。请使用流式基准测试或遥测适配器测量它们；不要用串行请求计时器填写 SLO 快照。负载门禁的请求速率也不能替代 token 有效吞吐量。

<a id="run-the-minimum-preflight"></a>

## 运行最小发布前检查

要求：Bash、`curl` 和 `jq`。端点必须实现兼容 OpenAI 的 `POST /v1/chat/completions` API。配置新鲜的指标快照，以及可信的只读命令，用于验证已知正常的修订版本与回滚机制。回滚检查命令通过 `bash -c` 执行；不要用不可信输入设置它。

```bash
export BASE_URL=https://candidate.example.com
export MODEL=my-model
# export API_KEY=your-token # omit when the endpoint does not require authentication
export METRICS_FILE=./candidate-metrics.json
export ROLLBACK_CHECK_CMD='kubectl get deployment/my-model -o json | jq -e ".metadata.annotations.rollbackRevision"'
export LOAD_REQUESTS=10
export LOAD_MIN_REQUESTS_PER_SEC=0.5
export TTFT_P95_MAX_MS=1000
export TPOT_P95_MAX_MS=100
export ITL_P95_MAX_MS=150
export GOODPUT_MIN_TOKENS_PER_SEC=100
export GPU_CACHE_USAGE_MAX_PCT=90
export KV_HIT_RATE_MIN_PCT=20

bash scripts/conformance/preflight.sh
```

上面的回滚命令只是示例：请按平台调整，确保它验证的是实际的上一已知正常版本。命令必须只读；脚本绝不会执行回滚。

| 结果 | 示例 | 预期结果 |
| --- | --- | --- |
| 成功路径 | 健康候选实例返回生成结果，负载样本通过，快照的六个值均满足阈值，回滚就绪命令以 0 退出。 | 脚本以 0 退出并打印 `Preflight passed`。 |
| 失败路径 | 将 `TTFT_P95_MAX_MS=1`，而指标快照的 `ttft_p95_ms` 为 100。 | 脚本在 SLO 门禁以非零状态退出，打印未通过的测量值，阻止晋级发布。若候选实例已接收流量，使用回滚清单。 |

<a id="engine-and-platform-adapters"></a>

## 引擎与平台适配器

保持门禁结果的共同含义，并在原生运行时、路由器或平台适配器中实现采集：

| 系统 | 适配器专属证据 |
| --- | --- |
| vLLM | 兼容 OpenAI 的健康/生成端点；模型与引擎参数；vLLM 请求、延迟和 `vllm:gpu_cache_usage_perc` 指标。 |
| SGLang | 兼容 OpenAI 的端点及模型/运行时配置；由其 exporter 提供的调度器、缓存和 token 延迟指标。 |
| TensorRT-LLM | Triton 或所部署前端的端点；引擎/构建兼容性、模型仓库就绪状态及 GenAI/Triton 指标。 |
| KServe | `InferenceService`/`LLMInferenceService` 就绪状态、预测器健康状态、修订版本/流量分配，以及经过路由的端点，而不仅是内部 Pod。 |
| AIBrix | 网关路由与模型标识、路由/缓存行为、`StormService`/副本就绪状态，以及网关和引擎指标。 |
| llm-d | KServe 入口、路由/连接器就绪状态、prefill/decode 角色、KV 传输健康状态与角色级指标。 |

通用检查对应可观察的契约：预期的模型与版本、服务端点、有效响应、经过测量的工作负载、公共 SLO 字段和可恢复的发布。在组件边界验证额外的原生健康状态与指标；不要假设端点冒烟检查通过就证明控制面、路由器或引擎健康。

<a id="pd-disaggregation-and-multi-node-additions"></a>

## P/D 分离与多节点附加检查

**当部署使用 P/D 分离或多节点时，必须进行**以下检查：

- 发送流量前，验证每个 prefill 和 decode 角色都有预期的副本数、模型修订版本、资源和就绪状态。
- 请求应经过计划用于生产的路由器，并证明 prefill 输出到达 decode。检查路由、KV 传输/连接器错误、超时、重试和取消行为。
- 测量端到端 TTFT 和 TPOT，以及角色级排队与服务耗时。检查 KV 传输延迟、吞吐、失败、缓存用量和缓存命中率；组合系统必须满足相同的面向用户 SLO。
- 确认节点能通过预期的网络/拓扑及传输方式通信（例如配置了 RDMA/NIXL 时）。验证放置、gang/启动顺序、对端发现，以及节点或角色丢失时的失败处理。
- 使用角色感知容量测试扩缩容和发布：不能部分发布后留下一组不可用角色，且上一完整版本仍可用于回滚。

对于单节点、非分离式服务，这些检查不适用；在发布证据中记录该范围。

<a id="failure-handling-and-rollback-checklist"></a>

## 失败处理与回滚清单

1. 任何必需门禁失败时，**阻止晋级发布**。记录候选版本、工作负载、指标快照/窗口、阈值、失败检查和日志。不要把缺失指标当成零来掩盖问题。
2. **分类并控制影响**：区分模型/制品、运行时、路由器、加速器/容量、KV 缓存或 P/D/网络问题。停止负载发生器，保持金丝雀流量隔离。
3. **若候选实例已在服务流量**，按平台经过测试的流程将流量切回上一已知正常版本（KServe 流量分配、网关路由或部署修订版本）。脚本不执行该操作。
4. 验证上一版本能处理冒烟请求，错误和延迟回到 SLO 范围内，GPU/缓存资源恢复。对于 P/D，验证完整的上一套 prefill/decode 角色及路由器/KV 路径，而不只是单个角色。
5. 保留证据、通知负责人，并建立包含修复措施和可重复回归检查的后续任务。只有在新鲜快照上所有必需门禁通过，且重新验证回滚就绪后，才重试晋级发布。

<a id="related-documentation"></a>

## 相关文档

- [性能测试与基准工具](./performance-testing.md)
- [预填充-解码分离](./pd-disaggregation.md)
- [LLM 推理中的缓存](./caching.md)
- [模型生命周期管理](./model-lifecycle.md)

> 译者注：本篇为指定源提交的完整译文。示例阈值不是通用 SLO；本文未实际运行发布前检查或部署命令，平台指标与 API 支持应按目标版本复核。
