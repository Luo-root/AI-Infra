---
status: Active
maintainer: pacoxu
last_updated: 2026-04-14
tags: inference, kubernetes, agentic, networking, governance
canonical_path: docs/inference/kube-agentic-networking.md
source_path: docs/inference/kube-agentic-networking.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="kube-agentic-networking-agentic-networking-governance-on-kubernetes"></a>
# kube-agentic-networking：Kubernetes 上的智能体网络治理

[`kube-agentic-networking`](https://github.com/kubernetes-sigs/kube-agentic-networking)
是一个 Kubernetes SIG 项目，专注于智能体工作负载的网络策略与治理。在实践中，它针对的是智能体平台的一个常见问题：智能体必须调用许多工具和 API，但平台团队仍然需要清晰的边界、最小权限控制以及可审计性。

<a id="why-it-matters"></a>
## 为什么这很重要

智能体系统不同于传统微服务：

- **动态出站访问模式**：工具调用通常在运行时决定，而不是在部署时固定。
- **跨域访问**：一个工作流可能涉及模型端点、MCP 工具、外部 API 和内部服务。
- **治理要求**：企业环境要求对智能体行为进行策略控制、追踪，并实现租户隔离。

`kube-agentic-networking` 将能够感知智能体的网络治理引入 Kubernetes 原生工作流，以满足这些需求。

<a id="role-in-the-ai-infra-stack"></a>
## 在 AI 基础设施栈中的角色

在本仓库的 AI 基础设施模型中，`kube-agentic-networking` 位于以下各层之间：

- **智能体运行时/编排器**（Dify、AgentScope、LangGraph 风格的系统）
- **网关与路由层**（AI 网关、推理路由）
- **工具后端与外部 API**（MCP 服务器、内部平台、SaaS）

它专注于网络策略边界与治理体系，与 API 网关和智能体协议（例如 MCP/A2A）形成互补。

<a id="typical-use-cases"></a>
## 典型使用场景

- **多租户智能体平台**：强制落实命名空间/团队边界，使一个团队的智能体默认无法访问另一个团队的内部工具。
- **受控工具访问**：针对特定智能体类别，仅允许访问获批的工具/API 目标。
- **合规与审计**：记录并审查高风险工作流的网络意图和访问模式。

<a id="adoption-guidance"></a>
## 采用建议

对于生产推广，一个务实的顺序是：

1. 从非生产智能体工作流开始，并定义明确的工具/API 访问清单。
2. 首先为智能体工作负载应用最小权限网络策略。
3. 在大范围推广之前，加入策略验证与可观测能力。
4. 在策略漂移和误报得到控制后，再扩展到多租户及受监管的工作负载。

<a id="learning-topics"></a>
## 学习主题

- 智能体到工具流量的策略设计
- Kubernetes 中的多租户边界建模
- 与 AI 网关和协议层的治理集成
- 智能体网络访问的运维可观测性

<a id="references"></a>
## 参考资料

- [GitHub：kubernetes-sigs/kube-agentic-networking](https://github.com/kubernetes-sigs/kube-agentic-networking)
- [Kubernetes SIGs](https://github.com/kubernetes-sigs)
