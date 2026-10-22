---
status: Active
maintainer: pacoxu
last_updated: 2026-10-08
tags: agent, observability, opentelemetry, genai, sandbox
canonical_path: docs/observability/agent-otel-genai.md
source_path: docs/observability/agent-otel-genai.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="agent-tool-and-sandbox-observability"></a>
# 智能体、工具与沙箱可观测性

本规范描述如何关联一个智能体步骤、它调用的工具以及沙箱操作，以便进行端到端调试和成本归因。使用 OpenTelemetry（OTel）trace 表示执行拓扑，使用结构化事件记录因果关系；两者不能相互替代。

<a id="trace-topology-and-context-propagation"></a>
## Trace 拓扑与上下文传播

使用父子 span 表示同步工作：

```text
invoke_agent
└── agent_step
    └── execute_tool
        └── mcp.request
            └── sandbox.operation
```

当工作跨越异步边界、作为新 trace 重试，或存在多个因果父级/消费者时，使用 span link。不要为非同步执行的工作人为制造父子关系。

将活动 trace context 从智能体传播到工具、MCP server 和沙箱。对于 MCP，在支持时将 W3C `traceparent` 和 `tracestate` 转发到 `params._meta`。每个接收方在创建自己的 span 前都要提取 context。

通过消息上下文和 span link 跨队列保留 trace context；只有在信任边界或保留策略要求时才启动新 trace，并将其链接到起始 span。

<a id="field-and-semantic-conventions"></a>
## 字段与语义约定

在可用时，使用标准 OTel trace/span 标识符和 GenAI 语义属性。将标识符同时保存在 span 和结构化事件中，以便关联 trace backend 与事件存储：

| 字段 | 含义与指导 |
| --- | --- |
| `trace_id` | OTel trace 标识符；使用 trace backend 的原生字段。 |
| `agent_session_id` | 对话/会话标识符；映射到 `gen_ai.conversation.id`。 |
| `agent_step_id` | 一个智能体推理/动作步骤的本地标识符。 |
| `tool_call_id` | 工具调用标识符；映射到 `gen_ai.tool.call.id`。 |
| `sandbox_id` | 执行该操作的沙箱实例的本地标识符。 |
| `event_id` | 唯一的结构化事件标识符。 |
| `parent_event_id` | 因果父事件（存在时）；不能替代 span 的父子关系。 |
| `is_root_cause` | 表示该事件是否是原始故障，而不是传播而来的错误。 |
| `mutation_type` | 沙箱动作类别，例如 `read`、`write`、`exec` 或 `network`。 |

同时记录 `service.name`、`span_id`、`parent_span_id`、`event_name`、`status`、`error.type` 和时间戳。在 span 上，优先使用 OTel 原生 trace context 与父子关系，而不是将 trace ID 复制到自定义属性中。使用 `agent_step_id`、`sandbox_id` 和 `mutation_type` 作为本地扩展属性。记录工具名称、沙箱镜像/运行时和结果，但属性必须有界。避免将提示词、工具参数、密钥或用户内容放入属性或事件。

每个结构化事件都应包含 `event_id`、`event_name`、`event_time`、`trace_id`、`span_id`、已知时的 `parent_event_id`，以及适用的 `agent_session_id`、`agent_step_id`、`tool_call_id` 和 `sandbox_id`。沙箱发生变更时包含 `mutation_type`，失败时包含 `status` 和规范化的 `error.type`。在首次表示故障的事件上设置 `is_root_cause`；传播错误保持为 false。发出沙箱 `created`、`ready`、`operation_started`、`operation_completed` 和 `terminated` 等生命周期事件。

<a id="minimum-instrumentation"></a>
## 最小埋点要求

将 `invoke_agent`、每个 `agent_step`、`execute_tool`、MCP request 以及每个沙箱操作埋点为 span。至少在工具调用开始和完成时，以及沙箱创建、就绪、执行操作或终止时，发出具有关联关系的结构化事件。在每个边界传播活动 context 和适用的关联字段。在智能体/模型操作上记录 token 使用量，在对应的 span 和事件上记录沙箱生命周期/操作结果。这是最小的有效闭环；特定框架的 hook 可以增加细节，但不能改变字段契约。

<a id="metrics-errors-and-log-policy"></a>
## 指标、错误与日志策略

将 token 使用量记录为 `gen_ai.client.token.usage` 或实现中的等价字段，并用 `gen_ai.token.type` 区分输入和输出 token。将工具耗时记录为 histogram，将沙箱生命周期耗时（例如从创建到就绪的耗时和操作耗时）记录为 histogram。按工具名称、操作类别、运行时和规范化错误类型等有界维度统计操作、超时和失败。不要将会话、trace、工具调用和沙箱 ID 放进指标标签；使用 trace exemplar 或事件存储进行下钻。

将错误归因到首次发生错误的 span，并为依赖 span 标记适当结果，但不要对同一个根故障重复计数。使用稳定的 `error.type` 分类：

- `agent`：规划、编排或响应处理失败
- `tool`：工具查找、调用或工具层失败
- `mcp`：协议、传输或 server 失败
- `sandbox.provision`：沙箱创建或就绪失败
- `sandbox.operation`：执行、策略或资源限制失败
- `timeout`、`cancelled` 和 `unknown`：跨领域或未分类结果

将原始失败消息保存在访问受控的日志中，而不是指标标签中。为所有失败发出结构化生命周期和错误事件。使用一致的 trace 级策略对成功 trace 采样，并保留所有错误 trace 以及具有代表性的成功 trace 基线。在可用时使用基于尾部的采样，使采样可以考虑最终状态和延迟。跨服务保持采样决策一致，并为已采样 trace 保留事件标识符。

<a id="verification-queries"></a>
## 验证查询

以下 SQL 使用说明性的 `spans` 和 `agent_events` 视图；请将其中的列映射到正在使用的 trace backend 或数据仓库。对精确的 `trace_id` 过滤，以重建一次执行：

```sql
SELECT
  s.trace_id,
  s.span_id,
  s.parent_span_id,
  s.name AS span_name,
  s.start_time,
  s.duration_ms,
  s.status,
  e.event_id,
  e.parent_event_id,
  e.event_name,
  e.agent_session_id,
  e.agent_step_id,
  e.tool_call_id,
  e.sandbox_id,
  e.mutation_type,
  e.error_type
FROM spans AS s
LEFT JOIN agent_events AS e
  ON e.trace_id = s.trace_id AND e.span_id = s.span_id
WHERE s.trace_id = :trace_id
ORDER BY s.start_time, e.event_time;
```

在固定时间窗口内，按 `error_type`、工具和运行时对失败的 span 或根因事件分组，以找出主要失败贡献者。统计根因事件，而不是每个传播的失败 span：

```sql
SELECT error_type, tool_name, runtime, COUNT(*) AS failures
FROM agent_events
WHERE status = 'error'
  AND is_root_cause = TRUE
  AND event_time >= :window_start
GROUP BY error_type, tool_name, runtime
ORDER BY failures DESC
LIMIT 10;
```

使用会话、工具调用和沙箱标识符，对 token 使用量和沙箱资源成本分组，以找出主要成本贡献者：

```sql
SELECT
  agent_session_id,
  tool_name,
  sandbox_id,
  SUM(input_tokens) AS input_tokens,
  SUM(output_tokens) AS output_tokens,
  SUM(sandbox_cost) AS sandbox_cost
FROM agent_cost_events
WHERE event_time >= :window_start
GROUP BY agent_session_id, tool_name, sandbox_id
ORDER BY SUM(estimated_cost) DESC
LIMIT 10;
```

成本事件应携带与执行事件相同的 trace/session/tool/sandbox 关联字段。说明 token 和沙箱成本是实测值还是估算值，以及使用的定价版本。示例中的 `agent_cost_events` 视图公开了输入/输出 token 数、沙箱成本和估算成本，以及工具名称和事件时间。

<a id="dashboard-and-alert-recommendations"></a>
## 仪表盘与告警建议

构建一个具有共享时间范围和 service、tool、runtime、error type 筛选器的仪表盘。将聚合面板中的 trace exemplar 和事件 ID 链接到详细的 trace/event 查询。

| 仪表盘区域 | SLO/SLA 视图 |
| --- | --- |
| 智能体请求健康度 | 成功完成的请求，以及相对于服务 SLO 的端到端延迟百分位数。 |
| 工具执行 | 工具调用成功率、延迟百分位数、超时次数和最慢的工具。 |
| 沙箱生命周期 | 从创建到就绪的耗时和操作延迟、容量、生命周期失败以及终止结果。 |
| 失败归因 | 按分类、工具、运行时和沙箱镜像统计的根因失败；链接到代表性 trace。 |
| 成本归因 | 在获得授权的情况下，按模型、工具、会话和租户统计输入/输出 token 以及估算/实际沙箱成本。 |

以服务发布的 SLO/SLA 作为阈值来源。以下是建议的初始告警，应结合基线进行调优：

- 当智能体或工具失败率在短窗口和长窗口内都突破其错误预算消耗阈值时触发值班呼叫通知；按根因分类分组。
- 当工具或沙箱操作超时率超过其 SLO，或沙箱就绪延迟突破其延迟目标时告警。
- 当每个成功请求的成本或 token 使用量相对于滚动基线持续增加时告警；包含贡献最高的模型/工具。
- 在沙箱配置失败和生命周期耗时异常可能造成请求级 SLO 违规之前告警。

每条告警都应包含受影响的 service/tool/runtime、时间窗口、错误类型或成本驱动因素，以及指向仪表盘和已采样 trace 查询的链接。避免使用 ID 作为告警分组标签。
