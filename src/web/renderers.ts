export const WEB_APP_RENDERERS_SCRIPT = String.raw`
      function renderStats() {
        document.getElementById("stat-projects").textContent = String(state.projects.length);
        document.getElementById("stat-agents").textContent = String(state.agents.length);
        document.getElementById("stat-tasks").textContent = String(state.tasks.length);
        document.getElementById("stat-events").textContent = String(state.events.length);
      }

      function renderThreadList() {
        threadList.innerHTML = state.threads.slice().reverse().map((thread) => {
          const linkedTasks = state.tasks.filter((task) => thread.taskIds.includes(task.id));
          const activeTask = linkedTasks.find((task) => !taskComplete(task) && task.parentTaskId) || linkedTasks[0];
          const selected = thread.id === state.selectedThreadId ? "selected" : "";
          return \`<article class="thread-card \${selected}" data-thread-id="\${escapeHtml(thread.id)}">
            <header>
              <strong>\${escapeHtml(thread.title)}</strong>
              <span class="meta">\${formatDate(thread.updatedAt)}</span>
            </header>
            <div class="meta">messages: \${thread.messageIds.length} · tasks: \${thread.taskIds.length}</div>
            \${activeTask ? \`<div class="meta">active: \${escapeHtml(activeTask.title)} · \${escapeHtml(activeTask.status)}</div>\` : '<div class="meta">No linked task yet.</div>'}
          </article>\`;
        }).join("") || '<div class="empty">No threads yet. Start by telling Comphony what outcome you want.</div>';
      }

      function renderMessage(message) {
        const target = message.targetAgentId ? \` · to \${escapeHtml(message.targetAgentId)}\` : "";
        return \`<article class="message-card">
          <header>
            <strong>\${escapeHtml(message.role)}</strong>
            <span class="meta">\${formatDate(message.createdAt)}</span>
          </header>
          <div class="meta">project: \${escapeHtml(message.routedProjectId || "-")} · lane: \${escapeHtml(message.suggestedLane || "-")}\${target}</div>
          <p>\${escapeHtml(message.body)}</p>
        </article>\`;
      }

      function renderTaskCard(task, detail) {
        const isParent = !task.parentTaskId;
        const childClass = isParent ? "is-parent" : "is-child";
        const current = getCurrentThreadTask(detail);
        const primaryAction = current && current.id === task.id && !taskComplete(task)
          ? \`<button type="button" data-action="continue-thread">Continue</button>\`
          : "";
        const simpleNext = taskComplete(task)
          ? '<span class="chip">Completed</span>'
          : taskBlocked(task)
            ? \`<span class="chip is-danger">\${escapeHtml(task.blockingReason || "Waiting")}</span>\`
            : \`<span class="chip">Assignee: \${escapeHtml(task.assigneeId || "unassigned")}</span>\`;

        const advanced = \`
          <div class="actions advanced-only">
            <button type="button" class="secondary" data-action="autoassign" data-task-id="\${escapeHtml(task.id)}">Auto Assign</button>
            <button type="button" class="secondary" data-action="work" data-task-id="\${escapeHtml(task.id)}">Run Turn</button>
            <button type="button" class="secondary" data-action="handoff" data-task-id="\${escapeHtml(task.id)}" data-lane="build">To Build</button>
            <button type="button" class="secondary" data-action="handoff" data-task-id="\${escapeHtml(task.id)}" data-lane="review">To Review</button>
            <button type="button" class="secondary" data-action="sync" data-task-id="\${escapeHtml(task.id)}" data-provider="linear">Sync Linear</button>
            <button type="button" class="secondary" data-action="request-approval" data-task-id="\${escapeHtml(task.id)}" data-approval-action="repo_write">Need Approval</button>
          </div>
        \`;
        const externalRefs = Array.isArray(task.externalRefs) && task.externalRefs.length > 0
          ? \`<div class="meta">external: \${task.externalRefs.map((ref) => escapeHtml(ref.provider + ":" + (ref.externalKey || ref.externalId || "linked"))).join(" · ")}</div>\`
          : "";

        return \`<article class="task-card \${childClass}">
          <header>
            <strong>\${escapeHtml(task.title)}</strong>
            <span class="meta">\${formatDate(task.updatedAt)}</span>
          </header>
          <div class="meta">lane=\${escapeHtml(task.lane)} · status=\${escapeHtml(task.status)} · assignee=\${escapeHtml(task.assigneeId || "-")}</div>
          <div class="meta">depends on: \${task.dependsOnTaskIds.length ? escapeHtml(task.dependsOnTaskIds.join(", ")) : "-"}</div>
          <div class="meta">artifacts: \${task.artifactPaths.length}</div>
          \${externalRefs}
          \${task.completionSummary ? \`<div class="meta">summary: \${escapeHtml(task.completionSummary)}</div>\` : ""}
          <p>\${escapeHtml(task.description || "No description.")}</p>
          <div class="actions">
            \${primaryAction}
            \${simpleNext}
          </div>
          \${advanced}
        </article>\`;
      }

      function renderCoordination(detail) {
        const items = [];
        detail.consultations.forEach((item) => {
          items.push(\`<article class="info-card">
            <header><strong>Consultation</strong><span class="meta">\${escapeHtml(item.status)}</span></header>
            <div class="meta">to: \${escapeHtml(item.toAgentId)} · task: \${escapeHtml(item.taskId)}</div>
            <div>\${escapeHtml(item.reason)}</div>
          </article>\`);
        });
        detail.reviews.forEach((item) => {
          items.push(\`<article class="info-card">
            <header><strong>Review</strong><span class="meta">\${escapeHtml(item.status)}</span></header>
            <div class="meta">reviewer: \${escapeHtml(item.reviewerAgentId)} · task: \${escapeHtml(item.taskId)}</div>
            <div>\${escapeHtml(item.reason)}</div>
          </article>\`);
        });
        detail.approvals.forEach((item) => {
          items.push(\`<article class="info-card">
            <header><strong>Approval</strong><span class="meta">\${escapeHtml(item.status)}</span></header>
            <div class="meta">action: \${escapeHtml(item.action)} · task: \${escapeHtml(item.taskId || "-")}</div>
            <div>\${escapeHtml(item.reason)}</div>
          </article>\`);
        });
        chatCoordination.innerHTML = items.join("") || '<div class="empty">No active consultations, reviews, or approvals on this thread.</div>';
      }

      function renderGraphSummary(detail) {
        const parent = detail.tasks.find((task) => !task.parentTaskId) || null;
        const children = detail.tasks.filter((task) => task.parentTaskId);
        if (!parent) {
          chatGraphSummary.innerHTML = '<div class="empty">No task graph summary yet.</div>';
          return;
        }
        const laneTrail = children.map((task) => \`\${escapeHtml(task.lane)}:\${escapeHtml(task.status)}\`).join(" → ");
        const completed = children.filter((task) => taskComplete(task)).length;
        chatGraphSummary.innerHTML = \`<article class="info-card">
          <header>
            <strong>Root Request</strong>
            <span class="meta">\${escapeHtml(parent.status)}</span>
          </header>
          <div class="meta">children: \${children.length} · completed: \${completed}</div>
          <div class="meta">flow: \${laneTrail || "-"}</div>
          \${parent.completionSummary ? \`<div class="meta">summary: \${escapeHtml(parent.completionSummary)}</div>\` : ""}
        </article>\`;
      }

      function renderChatView() {
        const detail = state.selectedThreadDetail;
        if (!detail) {
          chatSummary.innerHTML = '<div class="empty">Select a thread to see what Comphony is doing.</div>';
          chatGraphSummary.innerHTML = "";
          chatMessages.innerHTML = "";
          chatTasks.innerHTML = "";
          chatCoordination.innerHTML = "";
          return;
        }

        const currentTask = getCurrentThreadTask(detail);
        chatSummary.innerHTML = \`<article class="info-card">
          <header>
            <strong>\${escapeHtml(detail.thread.title)}</strong>
            <span class="meta">\${formatDate(detail.thread.updatedAt)}</span>
          </header>
          <div class="meta">thread: <code>\${escapeHtml(detail.thread.id)}</code></div>
          <div class="meta">messages: \${detail.messages.length} · tasks: \${detail.tasks.length}</div>
          \${currentTask ? \`<div class="meta">current focus: \${escapeHtml(currentTask.title)} · \${escapeHtml(currentTask.status)} · \${escapeHtml(currentTask.assigneeId || "unassigned")}</div>\` : '<div class="meta">No active task.</div>'}
        </article>\`;

        renderGraphSummary(detail);
        chatMessages.innerHTML = detail.messages.map(renderMessage).join("") || '<div class="empty">No messages yet.</div>';
        chatTasks.innerHTML = detail.tasks
          .slice()
          .sort((left, right) => {
            if (left.parentTaskId === null && right.parentTaskId !== null) {
              return -1;
            }
            if (left.parentTaskId !== null && right.parentTaskId === null) {
              return 1;
            }
            return left.createdAt.localeCompare(right.createdAt);
          })
          .map((task) => renderTaskCard(task, detail))
          .join("") || '<div class="empty">No tasks linked to this thread.</div>';

        renderCoordination(detail);
      }

      function renderWorkView() {
        const activeTasks = state.tasks.filter((task) => !taskComplete(task));
        workView.innerHTML = activeTasks.map((task) => \`<article class="info-card">
          <header>
            <strong>\${escapeHtml(task.title)}</strong>
            <span class="meta">\${escapeHtml(task.status)}</span>
          </header>
          <div class="meta">project: \${escapeHtml(task.projectId)} · lane: \${escapeHtml(task.lane)}</div>
          <div class="meta">assignee: \${escapeHtml(task.assigneeId || "-")} · parent: \${escapeHtml(task.parentTaskId || "-")}</div>
          <div class="meta">external: \${Array.isArray(task.externalRefs) && task.externalRefs.length > 0 ? escapeHtml(task.externalRefs.map((ref) => ref.provider + ":" + (ref.externalKey || ref.externalId || "linked")).join(", ")) : "-"}</div>
          \${task.blockingReason ? \`<div class="meta">blocker: \${escapeHtml(task.blockingReason)}</div>\` : ""}
        </article>\`).join("") || '<div class="empty">No active tasks right now.</div>';
      }

      function renderPeopleView() {
        peopleView.innerHTML = state.people.map((person) => \`<article class="info-card">
          <header>
            <strong>\${escapeHtml(person.name)}</strong>
            <span class="meta">\${escapeHtml(person.role)} · \${escapeHtml(person.availability)}</span>
          </header>
          <div class="meta"><code>\${escapeHtml(person.id)}</code></div>
          <div class="meta">projects: \${escapeHtml(person.assignedProjects.join(", ") || "-")}</div>
          <div class="meta">active tasks: \${person.activeTaskCount} · blocked: \${person.blockedTaskCount}</div>
          <div class="meta">consultations: \${person.consultationCount} · reviews: \${person.reviewCount}</div>
          <div class="meta">trust: \${escapeHtml(person.trustState)}</div>
          <div class="meta">source: \${escapeHtml(person.sourceKind || "-")}</div>
          <div class="meta">current: \${escapeHtml(person.currentTaskTitles.join(" · ") || "-")}</div>
          <div class="actions">
            <button type="button" class="secondary" data-action="mention-agent" data-agent-id="\${escapeHtml(person.id)}">Talk To Agent</button>
          </div>
        </article>\`).join("") || '<div class="empty">No registered people yet.</div>';

        agentCatalogView.innerHTML = state.agentCatalog.map((agent) => \`<article class="info-card">
          <header>
            <strong>\${escapeHtml(agent.name)}</strong>
            <span class="meta">\${escapeHtml(agent.role)}</span>
          </header>
          <div class="meta"><code>\${escapeHtml(agent.id)}</code></div>
          <div class="meta">source: \${escapeHtml(agent.sourceKind || "-")} · trust: \${escapeHtml(agent.trustState)}</div>
          <div class="meta">projects: \${escapeHtml(agent.assignedProjects.join(", ") || "-")}</div>
          <div class="meta">cached: \${escapeHtml(agent.cachedPath || "-")}</div>
        </article>\`).join("") || '<div class="empty">No installed agent packages yet.</div>';
      }

      function renderProjectsView() {
        projectsView.innerHTML = state.projectOverview.map((project) => \`<article class="info-card">
          <header>
            <strong>\${escapeHtml(project.name)}</strong>
            <span class="meta">\${escapeHtml(project.id)} · \${escapeHtml(project.health)}</span>
          </header>
          <div class="meta">active: \${project.activeTaskCount} · blocked: \${project.blockedTaskCount}</div>
          <div class="meta">threads: \${project.openThreadCount} · agents: \${project.agentIds.length}</div>
          <div class="meta">lanes: \${escapeHtml(project.lanes.join(", "))}</div>
          <div class="meta">current work: \${escapeHtml(project.currentTaskTitles.join(" · ") || "-")}</div>
          <div class="meta">latest thread: \${escapeHtml(project.latestThreadTitle || "-")}</div>
          <div class="meta">latest artifact: \${escapeHtml(project.latestArtifactPath || "-")}</div>
        </article>\`).join("") || '<div class="empty">No projects yet.</div>';

        projectPortfolioView.innerHTML = state.projectOverview.map((project) => \`<article class="info-card">
          <header>
            <strong>\${escapeHtml(project.name)}</strong>
            <span class="meta">\${escapeHtml(project.health)}</span>
          </header>
          <div class="meta">repo: \${escapeHtml(project.repoSlug || "-")}</div>
          <div class="meta">staffed with: \${escapeHtml(project.agentIds.join(", ") || "-")}</div>
          <div class="meta">portfolio view: \${project.blockedTaskCount > 0 ? "needs help" : project.activeTaskCount > 0 ? "moving" : "quiet"}</div>
        </article>\`).join("") || '<div class="empty">No portfolio summary yet.</div>';
      }

      function renderMemoryView() {
        memoryList.innerHTML = state.memories.map((memory) => \`<article class="info-card">
          <header>
            <strong>\${escapeHtml(memory.kind)}</strong>
            <span class="meta">\${formatDate(memory.createdAt)}</span>
          </header>
          <div class="meta">\${escapeHtml(memory.scope)} · \${escapeHtml(memory.projectId || "-")} \${typeof memory.score === "number" ? "· score " + escapeHtml(memory.score) : ""}</div>
          <div>\${escapeHtml(memory.body)}</div>
        </article>\`).join("") || '<div class="empty">No related memory yet.</div>';

        similarTaskList.innerHTML = state.recommendedTasks.map((task) => \`<article class="info-card">
          <header>
            <strong>\${escapeHtml(task.title)}</strong>
            <span class="meta">\${typeof task.score === "number" ? "score " + escapeHtml(task.score) : ""}</span>
          </header>
          <div class="meta">\${escapeHtml(task.projectId)} · \${escapeHtml(task.lane)} · \${escapeHtml(task.status)}</div>
          <div class="meta">assignee: \${escapeHtml(task.assigneeId || "-")}</div>
        </article>\`).join("") || '<div class="empty">No similar tasks yet.</div>';

        eventList.innerHTML = state.events.slice(0, 20).map((event) => \`<article class="info-card">
          <header>
            <strong><code>\${escapeHtml(event.type)}</code></strong>
            <span class="meta">\${formatDate(event.timestamp)}</span>
          </header>
          <div class="meta">\${escapeHtml(event.entityType)} · <code>\${escapeHtml(event.entityId)}</code></div>
        </article>\`).join("") || '<div class="empty">No recent events.</div>';
      }

      function renderViews() {
        renderChatView();
        renderWorkView();
        renderPeopleView();
        renderProjectsView();
        renderMemoryView();
      }
`;
