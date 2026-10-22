---
status: Active
maintainer: pacoxu
last_updated: 2025-10-29
tags: training, argocd, gitops, continuous-deployment
canonical_path: docs/training/argocd.md
source_path: docs/training/argocd.md
source_commit: 3cc83ef18ed502929e55d0e598129c7525e5f993
translation_status: translated
---

<a id="argocd-for-ai-workload-management"></a>

# 使用 ArgoCD 管理 AI 工作负载

<a id="overview"></a>

## 概述

<a href="https://github.com/argoproj/argo-cd">`ArgoCD`</a> 是一个 CNCF 毕业项目，为 Kubernetes 提供声明式、基于 GitOps 的持续交付。在 AI 基础设施场景中，ArgoCD 使团队能够以 Git 为唯一事实来源，管理、版本化和部署 ML 训练作业、推理服务及数据流水线。

<a id="why-argocd-for-ai-workloads"></a>

## 为什么将 ArgoCD 用于 AI 工作负载？

<a id="key-benefits"></a>

### 主要优势

1. **GitOps 工作流**
   - 对 ML 作业配置进行版本控制
   - 为所有变更保留审计轨迹
   - 轻松回滚到先前版本
   - 通过拉取请求开展协作评审

2. **声明式配置**
   - 将训练作业、模型和基础设施定义为代码
   - 在不同环境中实现可复现的部署
   - 一致的配置管理

3. **多环境支持**
   - 管理开发、预发布和生产环境
   - 渐进式发布新模型
   - 针对特定环境的配置

4. **自动化与自愈**
   - 与 Git 仓库自动同步
   - 针对漂移检测进行自愈
   - 自动化部署流水线

<a id="argocd-in-the-kubeflow-ecosystem"></a>

## Kubeflow 生态系统中的 ArgoCD

ArgoCD 为 ML 工作负载提供持续部署能力，与 Kubeflow 形成互补。如<a href="https://mp.weixin.qq.com/s/qFmMduuQtgOdjwQLaT95dw">Kubeflow 生态系统架构</a>（中文资源）所示，并参考 <a href="https://argo-cd.readthedocs.io/">ArgoCD 官方文档</a>，ArgoCD 可与多种 Kubeflow 组件集成：

![Kubeflow 生态系统](https://github.com/user-attachments/assets/bc87980f-37d8-452f-ae1d-94cadc53a8f1)

<a id="integration-points"></a>

### 集成点

**Kubeflow 组件：**

- Jupyter Notebook 部署
- Training Operators（PyTorch、TensorFlow、XGBoost）
- Kubeflow Pipelines
- 用于可视化的 Tensorboard
- Katib 超参数调优作业
- KServe 模型服务部署
- 用于分布式训练的 MPI Operator
- Kubeflow Metadata 跟踪
- Recurring Jobs 调度

**基础设施组件：**

- Istio 服务网格配置
- Knative 无服务器函数
- cert-manager 证书
- MinIO 对象存储
- Dex 身份管理

<a id="argocd-architecture-for-ml-workflows"></a>

## 面向 ML 工作流的 ArgoCD 架构

<a id="components"></a>

### 组件

1. **Git 仓库**：所有配置的事实来源
   - 训练作业定义
   - 模型服务配置
   - 流水线定义
   - 基础设施清单

2. **ArgoCD Application**：定义部署策略
   - 源仓库和分支
   - 目标 Kubernetes 命名空间
   - 同步策略（手动或自动）
   - 健康检查和状态

3. **Kubernetes 集群**：目标部署环境
   - 训练作业（PyTorchJob、TFJob）
   - 推理服务（KServe）
   - ML 流水线（Kubeflow Pipelines）

<a id="gitops-workflow-for-training-jobs"></a>

## 训练作业的 GitOps 工作流

<a id="repository-structure"></a>

### 仓库结构

```text
ml-training-repo/
├── base/
│   ├── kustomization.yaml
│   └── pytorch-job-template.yaml
├── overlays/
│   ├── dev/
│   │   ├── kustomization.yaml
│   │   └── patches.yaml
│   ├── staging/
│   │   ├── kustomization.yaml
│   │   └── patches.yaml
│   └── prod/
│       ├── kustomization.yaml
│       └── patches.yaml
└── argocd/
    ├── training-dev.yaml
    ├── training-staging.yaml
    └── training-prod.yaml
```

<a id="example-pytorch-training-job-in-git"></a>

### 示例：Git 中的 PyTorch 训练作业

```yaml
# base/pytorch-job-template.yaml
apiVersion: kubeflow.org/v1
kind: PyTorchJob
metadata:
  name: pytorch-distributed-training
spec:
  pytorchReplicaSpecs:
    Master:
      replicas: 1
      restartPolicy: OnFailure
      template:
        spec:
          containers:
          - name: pytorch
            image: pytorch/pytorch:2.0.0-cuda11.7-cudnn8-runtime
            command:
              - python
              - train.py
            resources:
              limits:
                nvidia.com/gpu: 1
    Worker:
      replicas: 3
      restartPolicy: OnFailure
      template:
        spec:
          containers:
          - name: pytorch
            image: pytorch/pytorch:2.0.0-cuda11.7-cudnn8-runtime
            command:
              - python
              - train.py
            resources:
              limits:
                nvidia.com/gpu: 1
```

<a id="argocd-application-definition"></a>

### ArgoCD Application 定义

```yaml
# argocd/training-prod.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ml-training-prod
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/ml-training-repo
    targetRevision: main
    path: overlays/prod
  destination:
    server: https://kubernetes.default.svc
    namespace: ml-training
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
```

<a id="managing-training-jobs-with-argocd"></a>

## 使用 ArgoCD 管理训练作业

<a id="deployment-workflow"></a>

### 部署工作流

1. **定义训练作业**：在 Git 中创建 PyTorchJob 或 TFJob 清单
2. **提交到仓库**：将变更推送到功能分支
3. **代码评审**：团队通过拉取请求评审作业配置
4. **合并到主分支**：将获批的变更合并到 main 分支
5. **ArgoCD 同步**：ArgoCD 检测变更并同步到集群
6. **作业执行**：Kubernetes 创建 Pod 并运行训练
7. **监控**：在 ArgoCD UI 和 Kubeflow 仪表板中跟踪作业状态

<a id="progressive-rollout-strategy"></a>

### 渐进式发布策略

```yaml
# Progressive rollout with ArgoCD sync waves
apiVersion: kubeflow.org/v1
kind: PyTorchJob
metadata:
  name: llm-training-v2
  annotations:
    argocd.argoproj.io/sync-wave: "1"  # Deploy after infrastructure
spec:
  # Job configuration
```

<a id="handling-job-updates"></a>

### 处理作业更新

<a id="scenario-update-training-hyperparameters"></a>

#### 场景：更新训练超参数

```bash
# 1. Clone repository
git clone https://github.com/your-org/ml-training-repo
cd ml-training-repo

# 2. Create feature branch
git checkout -b update-learning-rate

# 3. Update job configuration
vim overlays/prod/patches.yaml
# Change learning rate from 0.001 to 0.0005

# 4. Commit and push
git add overlays/prod/patches.yaml
git commit -m "Update learning rate to 0.0005"
git push origin update-learning-rate

# 5. Create pull request and merge after review

# 6. ArgoCD automatically syncs the change
```

<a id="integration-with-cicd-pipelines"></a>

## 与 CI/CD 流水线集成

<a id="github-actions--argocd"></a>

### GitHub Actions + ArgoCD

```yaml
# .github/workflows/deploy-training.yaml
name: Deploy Training Job
on:
  push:
    branches: [main]
    paths:
      - 'overlays/prod/**'

jobs:
  validate-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Validate Kubernetes manifests
        run: |
          kubectl --dry-run=client apply -f overlays/prod/
      
      - name: Trigger ArgoCD Sync
        env:
          ARGOCD_SERVER: ${{ secrets.ARGOCD_SERVER }}
          ARGOCD_TOKEN: ${{ secrets.ARGOCD_TOKEN }}
        run: |
          argocd app sync ml-training-prod --grpc-web
```

<a id="pre-sync-hooks-for-data-preparation"></a>

### 用于数据准备的 Pre-Sync 钩子

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: prepare-training-data
  annotations:
    argocd.argoproj.io/hook: PreSync
    argocd.argoproj.io/hook-delete-policy: HookSucceeded
spec:
  template:
    spec:
      containers:
      - name: data-prep
        image: python:3.11
        command:
          - python
          - prepare_data.py
      restartPolicy: Never
```

<a id="multi-cluster-training-management"></a>

## 多集群训练管理

<a id="scenario-training-across-multiple-regions"></a>

### 场景：跨多个地域训练

ArgoCD 支持将训练作业部署到多个 Kubernetes 集群：

```yaml
# argocd/training-us-west.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ml-training-us-west
spec:
  destination:
    server: https://us-west-k8s.example.com
    namespace: ml-training
  source:
    repoURL: https://github.com/your-org/ml-training-repo
    path: overlays/us-west

---
# argocd/training-eu-central.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ml-training-eu-central
spec:
  destination:
    server: https://eu-central-k8s.example.com
    namespace: ml-training
  source:
    repoURL: https://github.com/your-org/ml-training-repo
    path: overlays/eu-central
```

<a id="monitoring-and-observability"></a>

## 监控与可观测性

<a id="argocd-application-health"></a>

### ArgoCD Application 健康状态

ArgoCD 为训练作业提供健康状态：

- **Healthy**：所有 Pod 均成功运行
- **Progressing**：作业正在部署或运行
- **Degraded**：部分 Pod 失败，或作业遇到错误
- **Suspended**：作业已暂停或正在等待资源
- **Missing**：集群中未找到作业定义

<a id="custom-health-checks"></a>

### 自定义健康检查

```yaml
# Custom health check for PyTorchJob
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: pytorch-training
spec:
  # ... other configuration
  ignoreDifferences:
  - group: kubeflow.org
    kind: PyTorchJob
    jsonPointers:
    - /status
  # Custom health assessment
  health:
    status: Progressing
    message: "Training job is running"
```

<a id="integration-with-prometheus"></a>

### 与 Prometheus 集成

监控 ML 工作负载部署的 ArgoCD 指标：

```promql
# Number of out-of-sync ML training applications
argocd_app_info{namespace="ml-training",sync_status="OutOfSync"}

# Deployment frequency
rate(argocd_app_sync_total{namespace="ml-training"}[1h])

# Failed synchronizations
argocd_app_sync_total{namespace="ml-training",phase="Failed"}
```

<a id="best-practices-for-ai-workloads"></a>

## AI 工作负载的最佳实践

<a id="1-separate-configuration-from-code"></a>

### 1. 将配置与代码分离

- 将训练脚本存储在独立仓库中
- 使用容器镜像承载代码
- 在 ArgoCD 跟踪的仓库中管理作业配置

<a id="2-environment-specific-configurations"></a>

### 2. 针对特定环境的配置

```text
overlays/
├── dev/          # Small dataset, single GPU, frequent updates
├── staging/      # Medium dataset, 4 GPUs, pre-production validation
└── prod/         # Full dataset, 16+ GPUs, stable releases
```

<a id="3-version-control-strategies"></a>

### 3. 版本控制策略

- 对训练作业定义使用语义化版本
- 为生产部署打发布标签
- 为实验维护独立分支

<a id="4-secrets-management"></a>

### 4. Secret 管理

```yaml
# Use sealed secrets or external secret operators
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: training-secrets
spec:
  encryptedData:
    api-key: AgBhQ3J...  # Encrypted API key
```

<a id="5-resource-quotas-and-limits"></a>

### 5. 资源配额与限制

定义资源约束，防止作业失控：

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: ml-training-quota
spec:
  hard:
    requests.nvidia.com/gpu: "32"
    requests.cpu: "256"
    requests.memory: "1024Gi"
```

<a id="troubleshooting"></a>

## 故障排查

<a id="common-issues"></a>

### 常见问题

<a id="1-application-out-of-sync"></a>

#### 1. Application 不同步

```bash
# Check differences
argocd app diff ml-training-prod

# Force sync
argocd app sync ml-training-prod --force
```

<a id="2-training-job-stuck-in-pending"></a>

#### 2. 训练作业卡在 Pending 状态

```bash
# Check ArgoCD logs
argocd app logs ml-training-prod

# Check Kubernetes events
kubectl describe pytorchjob pytorch-training -n ml-training
```

<a id="3-sync-hooks-failing"></a>

#### 3. 同步钩子失败

```bash
# View hook logs
argocd app logs ml-training-prod --kind Job
```

<a id="comparison-with-other-cd-tools"></a>

## 与其他 CD 工具的比较

<a id="argocd-vs-flux-cd"></a>

### ArgoCD 与 Flux CD 对比

- **ArgoCD**：Web UI、多租户、面向多个集群的 ApplicationSet
- **Flux CD**：更轻量、原生 Kubernetes、HelmRelease CRD

<a id="argocd-vs-jenkins"></a>

### ArgoCD 与 Jenkins 对比

- **ArgoCD**：GitOps、声明式、Kubernetes 原生
- **Jenkins**：命令式、通用 CI/CD，需要插件才能支持 K8s

<a id="argocd-vs-kubeflow-pipelines"></a>

### ArgoCD 与 Kubeflow Pipelines 对比

- **ArgoCD**：部署和生命周期管理
- **Kubeflow Pipelines**：ML 工作流编排和实验
- **结合使用**：ArgoCD 部署 Pipelines，Pipelines 编排训练

<a id="learning-resources"></a>

## 学习资源

<a id="official-documentation"></a>

### 官方文档

- <a href="https://argo-cd.readthedocs.io/">ArgoCD 文档</a>
- <a href="https://github.com/argoproj/argo-cd">ArgoCD GitHub 仓库</a>
- <a href="https://argo-cd.readthedocs.io/en/stable/user-guide/best_practices/">ArgoCD 最佳实践</a>

<a id="community-resources"></a>

### 社区资源

- <a href="https://mp.weixin.qq.com/s/qFmMduuQtgOdjwQLaT95dw">包含 ArgoCD 的 Kubeflow 生态系统</a>（中文）
- <a href="https://www.cncf.io/blog/2023/01/12/argo-cd-best-practices/">CNCF ArgoCD 博客</a>
- <a href="https://argoproj.github.io/community/">ArgoCD 社区</a>

<a id="tutorials"></a>

### 教程

- <a href="https://argo-cd.readthedocs.io/en/stable/getting_started/">ArgoCD 入门</a>
- <a href="https://codefresh.io/learn/argo-cd/">Codefresh 的 ArgoCD 教程</a>

<a id="related-projects-in-argo-ecosystem"></a>

## Argo 生态系统中的相关项目

- <a href="https://github.com/argoproj/argo-workflows">`Argo Workflows`</a>：Kubernetes 原生工作流引擎（CNCF 毕业项目）
- <a href="https://github.com/argoproj/argo-rollouts">`Argo Rollouts`</a>：面向 Kubernetes 的渐进式交付
- <a href="https://github.com/argoproj/argo-events">`Argo Events`</a>：事件驱动的工作流自动化

<a id="roadmap-and-future-development"></a>

## 路线图与未来发展

<a id="upcoming-features"></a>

### 即将推出的特性

- 增强 ApplicationSet，以动态生成应用
- 改进对 Helm charts 和 Kustomize 的支持
- 更好地集成云原生安全工具
- 高级部署策略（蓝绿部署、金丝雀部署）

<a id="contributing"></a>

## 参与贡献

欢迎为 ArgoCD 做出贡献！更多信息请参阅<a href="https://github.com/argoproj/argo-cd/blob/master/CONTRIBUTING.md">贡献指南</a>。

---

**注意：** 部分内容可能由所引用的来源生成或概括而来。用于生产环境前，请通过官方文档核实技术细节。

> **译者注（未核实范围）：** 本文忠实翻译指定源版本，未独立核实 CNCF 项目阶段、功能支持、健康状态映射、自定义健康检查示例、指标名称及路线图的当前有效性；代码、API、版本和命令均按原文保留，未执行或验证，不代表对其适用性的事实更新。
