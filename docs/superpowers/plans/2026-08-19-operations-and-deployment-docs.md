# Operations And Deployment Documentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document local operation, user workflow, and the verified KVM/Ubuntu deployment path so the application can be deployed and maintained without relying on chat history.

**Architecture:** Keep the README as the concise entry point and user workflow guide. Keep the existing operations guide focused on local Windows operation, while a new Ubuntu/KVM guide owns host routing prerequisites, Node setup, systemd lifecycle, updates, and verification.

**Tech Stack:** Markdown, PowerShell, Ubuntu apt, systemd, Node.js, npm, KVM/libvirt NAT networking.

---

### Task 1: Establish Documentation Entry Points

**Files:**
- Modify: `README.md`
- Modify: `docs/operations.md`

- [x] **Step 1: Add a user workflow to the README**

Describe the path from opening the page, importing or pasting a PRD, confirming analysis options, monitoring progress, and managing generated tasks. State that analysis and review use the server-side `OPENAI_MODEL` and that the UI does not switch models.

- [x] **Step 2: Add a documentation index to the README**

Link to `docs/operations.md` for Windows local development and maintenance and to `docs/deployment-kvm-ubuntu.md` for the Ubuntu KVM production deployment.

- [x] **Step 3: Link the production section of the operations guide to the Ubuntu deployment guide**

Keep existing Windows instructions intact and direct KVM/Ubuntu operators to the dedicated guide.

### Task 2: Add The KVM/Ubuntu Deployment Guide

**Files:**
- Create: `docs/deployment-kvm-ubuntu.md`

- [x] **Step 1: Document network and access prerequisites**

Explain the `192.168.0.197 -> 192.168.122.0/24` routing relationship, require verified SSH access to the guest, and identify the health-check URL without publishing credentials.

- [x] **Step 2: Document application installation and configuration**

Provide commands to install Node.js and npm, deploy the source, create a protected `.env.local`, install dependencies, build assets, and run tests. Specify that `data/workspace.json` stays on the server across code updates.

- [x] **Step 3: Document the systemd service and lifecycle commands**

Include the complete service unit, enable/start, status, logs, restart, and update commands. Require the service to run as the non-root deployment user and load `.env.local` through the working directory.

- [x] **Step 4: Add verification and troubleshooting commands**

Cover local and LAN health checks, service logs, port checks, model configuration validation, firewall guidance, and the expected behavior for a kernel update notice.

### Task 3: Verify And Publish Documentation

**Files:**
- Verify: `README.md`
- Verify: `docs/operations.md`
- Verify: `docs/deployment-kvm-ubuntu.md`

- [x] **Step 1: Verify Markdown links and required operational commands**

Run:

```powershell
rg -n "deployment-kvm-ubuntu|运行与维护|task-assignment\\.service|api/health" README.md docs
```

Expected: README links resolve to both operational guides and the deployment guide includes service and health-check commands.

- [x] **Step 2: Review the final diff**

Run:

```powershell
git diff --check
git diff -- README.md docs/operations.md docs/deployment-kvm-ubuntu.md
```

Expected: no whitespace errors and no credential values.

- [x] **Step 3: Commit and push the documentation update**

Run:

```powershell
git add README.md docs/operations.md docs/deployment-kvm-ubuntu.md docs/superpowers/plans/2026-08-19-operations-and-deployment-docs.md
git commit -m "docs: add KVM Ubuntu deployment guide"
git push origin main
```

Expected: the commit is accepted by `origin/main`.
