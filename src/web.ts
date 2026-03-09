export function renderWebAppHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Comphony</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4efe3;
        --panel: rgba(255, 251, 244, 0.92);
        --line: rgba(24, 32, 41, 0.12);
        --text: #17202a;
        --muted: #5d6872;
        --accent: #14532d;
        --accent-2: #1d4ed8;
        --chip: rgba(20, 83, 45, 0.09);
        --danger: #9a3412;
        --radius: 18px;
        --shadow: 0 16px 38px rgba(15, 23, 42, 0.08);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(190, 242, 100, 0.4), transparent 30%),
          radial-gradient(circle at top right, rgba(147, 197, 253, 0.3), transparent 24%),
          linear-gradient(180deg, #f8f4ec 0%, #ece2d0 100%);
      }

      button, input, textarea { font: inherit; }

      .shell {
        max-width: 1500px;
        margin: 0 auto;
        padding: 28px 18px 40px;
      }

      .hero,
      .card {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        backdrop-filter: blur(10px);
      }

      .hero {
        display: grid;
        grid-template-columns: 1.4fr 1fr;
        gap: 18px;
        padding: 24px 26px;
        margin-bottom: 18px;
      }

      .hero h1 {
        margin: 0 0 10px;
        font-size: 40px;
        line-height: 1;
      }

      .hero p {
        margin: 0;
        color: var(--muted);
        max-width: 52rem;
      }

      .hero-side {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .stat-card {
        padding: 14px 16px;
      }

      .stat-label {
        display: block;
        font-size: 12px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .stat-value {
        display: block;
        margin-top: 8px;
        font-size: 28px;
        font-weight: 700;
      }

      .layout {
        display: grid;
        grid-template-columns: 320px minmax(0, 1fr);
        gap: 18px;
      }

      .sidebar,
      .main {
        min-width: 0;
      }

      .card {
        padding: 18px;
      }

      .section-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 12px;
      }

      .section-head h2,
      .section-head h3 {
        margin: 0;
      }

      .status-pill,
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 8px 12px;
        border-radius: 999px;
        background: var(--chip);
        color: var(--accent);
        font-size: 13px;
      }

      .chip.is-danger {
        background: rgba(154, 52, 18, 0.1);
        color: var(--danger);
      }

      .tabs {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 12px;
      }

      .tab {
        border: 0;
        border-radius: 999px;
        padding: 10px 14px;
        background: rgba(15, 23, 42, 0.08);
        color: var(--text);
        cursor: pointer;
      }

      .tab.active {
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        color: white;
      }

      .view {
        display: none;
      }

      .view.active {
        display: block;
      }

      .thread-list,
      .stack {
        display: grid;
        gap: 10px;
      }

      .thread-list {
        max-height: 480px;
        overflow: auto;
        padding-right: 4px;
      }

      .thread-card,
      .message-card,
      .task-card,
      .info-card {
        background: rgba(255, 255, 255, 0.74);
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 14px 16px;
      }

      .thread-card {
        cursor: pointer;
      }

      .thread-card.selected {
        border-color: rgba(29, 78, 216, 0.4);
        box-shadow: 0 10px 26px rgba(29, 78, 216, 0.12);
      }

      .thread-card header,
      .message-card header,
      .task-card header,
      .info-card header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 6px;
      }

      .meta {
        color: var(--muted);
        font-size: 13px;
      }

      .composer {
        display: grid;
        gap: 10px;
      }

      input, textarea {
        width: 100%;
        border-radius: 14px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.88);
        padding: 12px 14px;
      }

      textarea {
        min-height: 112px;
        resize: vertical;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      button {
        cursor: pointer;
        border: 0;
        border-radius: 999px;
        padding: 10px 14px;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        color: white;
      }

      button.secondary {
        background: rgba(15, 23, 42, 0.08);
        color: var(--text);
      }

      .task-card.is-child {
        margin-left: 20px;
      }

      .task-card.is-parent {
        border-style: dashed;
      }

      .two-col {
        display: grid;
        grid-template-columns: 1.3fr 0.8fr;
        gap: 16px;
      }

      .three-col {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
      }

      .toggle {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--muted);
        font-size: 14px;
      }

      .toggle input {
        width: auto;
      }

      .empty {
        border: 1px dashed rgba(15, 23, 42, 0.2);
        border-radius: 16px;
        padding: 18px;
        color: var(--muted);
      }

      .advanced-only {
        display: none;
      }

      body.advanced .advanced-only {
        display: flex;
      }

      body.advanced .advanced-only.block {
        display: block;
      }

      @media (max-width: 1200px) {
        .layout,
        .hero,
        .two-col,
        .three-col {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <div>
          <h1>Comphony</h1>
          <p>Tell Comphony what outcome you want. Comphony can decompose work, route it to agents, coordinate reviews and consultations, and report back without forcing you to operate the workflow by hand.</p>
        </div>
        <div class="hero-side">
          <div class="card stat-card">
            <span class="stat-label">Projects</span>
            <span class="stat-value" id="stat-projects">-</span>
          </div>
          <div class="card stat-card">
            <span class="stat-label">Agents</span>
            <span class="stat-value" id="stat-agents">-</span>
          </div>
          <div class="card stat-card">
            <span class="stat-label">Tasks</span>
            <span class="stat-value" id="stat-tasks">-</span>
          </div>
          <div class="card stat-card">
            <span class="stat-label">Events</span>
            <span class="stat-value" id="stat-events">-</span>
          </div>
        </div>
      </section>

      <section class="layout">
        <aside class="sidebar stack">
          <section class="card">
            <div class="section-head">
              <h2>Company Inbox</h2>
              <span class="status-pill" id="connection-status">Connecting...</span>
            </div>
            <form class="composer" id="intake-form">
              <input id="intake-title" placeholder="Request title" value="Refresh Product - Core dashboard" />
              <textarea id="intake-body" placeholder="Tell Comphony what you want.">Please redesign the Product - Core dashboard UI, improve the UX, and prepare it for implementation.</textarea>
              <div class="actions">
                <button type="submit">Send To Comphony</button>
              </div>
            </form>
          </section>

          <section class="card">
            <div class="section-head">
              <h2>Threads</h2>
              <button class="secondary" type="button" id="refresh-all">Refresh</button>
            </div>
            <div class="thread-list" id="thread-list"></div>
          </section>
        </aside>

        <section class="main stack">
          <section class="card">
            <div class="section-head">
              <div class="tabs" id="tabs">
                <button class="tab active" type="button" data-view="chat">Chat</button>
                <button class="tab" type="button" data-view="work">Work</button>
                <button class="tab" type="button" data-view="people">People</button>
                <button class="tab" type="button" data-view="projects">Projects</button>
                <button class="tab" type="button" data-view="memory">Memory</button>
              </div>
              <label class="toggle">
                <input type="checkbox" id="advanced-toggle" />
                Advanced Mode
              </label>
            </div>

            <section class="view active" id="view-chat">
              <div class="two-col">
                <div class="stack">
                  <div id="chat-summary"></div>
                  <div id="chat-messages"></div>
                  <form class="composer" id="thread-reply-form">
                    <input id="thread-reply-input" placeholder="Ask Comphony, or mention an agent like @Mina" value="What should happen next?" />
                    <div class="actions">
                      <button type="submit">Send Follow-up</button>
                      <button class="secondary" type="button" id="continue-thread">Continue Automatically</button>
                    </div>
                  </form>
                </div>
                <div class="stack">
                  <section>
                    <div class="section-head"><h3>Task Graph</h3></div>
                    <div id="chat-graph-summary" style="margin-bottom: 10px;"></div>
                    <div class="stack" id="chat-tasks"></div>
                  </section>
                  <section>
                    <div class="section-head"><h3>Coordination</h3></div>
                    <div class="stack" id="chat-coordination"></div>
                  </section>
                </div>
              </div>
            </section>

            <section class="view" id="view-work">
              <div class="section-head">
                <h2>Work</h2>
                <span class="chip">Company-wide active task view</span>
              </div>
              <div class="stack" id="work-view"></div>
            </section>

            <section class="view" id="view-people">
              <div class="section-head">
                <h2>People</h2>
                <span class="chip">Who exists, what they do, and what they carry</span>
              </div>
              <div class="two-col">
                <section class="stack">
                  <form class="composer card advanced-only block" id="agent-install-form">
                    <input id="agent-install-ref" placeholder="Agent package URL or local path" value="https://registry.example.com/agents/remote-designer" />
                    <div class="actions">
                      <button type="submit">Hire Agent</button>
                      <button class="secondary" type="button" id="agent-install-local">Use Local Example</button>
                    </div>
                  </form>
                  <div class="three-col" id="people-view"></div>
                </section>
                <section class="stack">
                  <div class="section-head"><h3>Agent Catalog</h3></div>
                  <div class="stack" id="agent-catalog-view"></div>
                </section>
              </div>
            </section>

            <section class="view" id="view-projects">
              <div class="section-head">
                <h2>Projects</h2>
                <span class="chip">Products, staffing, lanes, and delivery health</span>
              </div>
              <div class="two-col">
                <section class="stack">
                  <form class="composer card advanced-only block" id="project-create-form">
                    <input id="project-create-name" placeholder="Project name" value="Customer Portal" />
                    <input id="project-create-purpose" placeholder="Purpose" value="New product initiative created from Comphony chat" />
                    <div class="actions">
                      <button type="submit">Create Project</button>
                    </div>
                  </form>
                  <div class="three-col" id="projects-view"></div>
                </section>
                <section class="stack">
                  <div class="section-head"><h3>Portfolio Health</h3></div>
                  <div class="stack" id="project-portfolio-view"></div>
                </section>
              </div>
            </section>

            <section class="view" id="view-memory">
              <div class="two-col">
                <section>
                  <div class="section-head"><h3>Related Memory</h3></div>
                  <div class="stack" id="memory-list"></div>
                </section>
                <section>
                  <div class="section-head"><h3>Similar Tasks</h3></div>
                  <div class="stack" id="similar-task-list"></div>
                </section>
              </div>
              <section style="margin-top: 16px;">
                <div class="section-head"><h3>Recent Events</h3></div>
                <div class="stack" id="event-list"></div>
              </section>
            </section>
          </section>
        </section>
      </section>
    </main>

    <script>
      const state = {
        actorId: "owner_01",
        currentView: "chat",
        advanced: false,
        projects: [],
        projectOverview: [],
        agents: [],
        agentCatalog: [],
        people: [],
        threads: [],
        tasks: [],
        events: [],
        memories: [],
        recommendedTasks: [],
        selectedThreadId: null,
        selectedThreadDetail: null
      };

      const connectionStatus = document.getElementById("connection-status");
      const threadList = document.getElementById("thread-list");
      const chatSummary = document.getElementById("chat-summary");
      const chatMessages = document.getElementById("chat-messages");
      const chatGraphSummary = document.getElementById("chat-graph-summary");
      const chatTasks = document.getElementById("chat-tasks");
      const chatCoordination = document.getElementById("chat-coordination");
      const workView = document.getElementById("work-view");
      const peopleView = document.getElementById("people-view");
      const agentCatalogView = document.getElementById("agent-catalog-view");
      const projectsView = document.getElementById("projects-view");
      const projectPortfolioView = document.getElementById("project-portfolio-view");
      const memoryList = document.getElementById("memory-list");
      const similarTaskList = document.getElementById("similar-task-list");
      const eventList = document.getElementById("event-list");

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");
      }

      function formatDate(value) {
        try {
          return new Date(value).toLocaleTimeString();
        } catch {
          return value;
        }
      }

      function taskComplete(task) {
        return ["reported", "done"].includes(task.status);
      }

      function taskBlocked(task) {
        return ["blocked", "waiting", "consulting"].includes(task.status) || task.needsApproval;
      }

      function getCurrentThreadTask(detail) {
        if (!detail) {
          return null;
        }
        return detail.tasks.find((task) => task.parentTaskId && !taskComplete(task)) || detail.tasks.find((task) => !taskComplete(task)) || detail.tasks[0] || null;
      }

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

      async function refreshRecommendationPanels() {
        const latestUserMessage = state.selectedThreadDetail
          ? [...state.selectedThreadDetail.messages].reverse().find((message) => message.role === "user")
          : null;
        const currentTask = getCurrentThreadTask(state.selectedThreadDetail);
        const memoryUrl = state.selectedThreadId
          ? "/v1/memory/recommend?threadId=" + encodeURIComponent(state.selectedThreadId) + "&limit=10" + (latestUserMessage ? "&query=" + encodeURIComponent(latestUserMessage.body) : "")
          : "/v1/memory/recommend?limit=10";
        const taskUrl = state.selectedThreadId
          ? "/v1/tasks/recommend?threadId=" + encodeURIComponent(state.selectedThreadId)
              + (currentTask ? "&taskId=" + encodeURIComponent(currentTask.id) + "&projectId=" + encodeURIComponent(currentTask.projectId) : "")
              + "&limit=10"
              + (latestUserMessage ? "&query=" + encodeURIComponent(latestUserMessage.body) : "")
          : "/v1/tasks/recommend?limit=10";

        const [memoryRes, taskRes] = await Promise.all([fetch(memoryUrl), fetch(taskUrl)]);
        state.memories = (await memoryRes.json()).memories;
        state.recommendedTasks = (await taskRes.json()).tasks;
      }

      async function refreshThreadDetail() {
        if (!state.selectedThreadId) {
          state.selectedThreadDetail = null;
          renderViews();
          return;
        }
        const response = await fetch("/v1/threads/" + encodeURIComponent(state.selectedThreadId));
        if (!response.ok) {
          state.selectedThreadDetail = null;
          renderViews();
          return;
        }
        state.selectedThreadDetail = await response.json();
        await refreshRecommendationPanels();
        renderViews();
      }

      async function refreshSnapshots() {
        const [projectsRes, projectOverviewRes, agentsRes, agentCatalogRes, peopleRes, threadsRes, tasksRes, eventsRes] = await Promise.all([
          fetch("/v1/projects"),
          fetch("/v1/projects/overview"),
          fetch("/v1/agents"),
          fetch("/v1/agents/catalog"),
          fetch("/v1/people"),
          fetch("/v1/threads"),
          fetch("/v1/tasks"),
          fetch("/v1/events?limit=20")
        ]);
        state.projects = (await projectsRes.json()).projects;
        state.projectOverview = (await projectOverviewRes.json()).projects;
        state.agents = (await agentsRes.json()).agents;
        state.agentCatalog = (await agentCatalogRes.json()).agents;
        state.people = (await peopleRes.json()).people;
        state.threads = (await threadsRes.json()).threads;
        state.tasks = (await tasksRes.json()).tasks;
        state.events = (await eventsRes.json()).events;
        if (!state.selectedThreadId && state.threads.length > 0) {
          state.selectedThreadId = state.threads[state.threads.length - 1].id;
        }
        renderStats();
        renderThreadList();
        await refreshThreadDetail();
      }

      async function postJson(url, payload) {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Comphony-Actor-Id": state.actorId
          },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: "Unknown error" }));
          throw new Error(error.message || "Request failed");
        }
        return response.json();
      }

      document.getElementById("advanced-toggle").addEventListener("change", (event) => {
        state.advanced = event.target.checked;
        document.body.classList.toggle("advanced", state.advanced);
      });

      document.getElementById("tabs").addEventListener("click", (event) => {
        const button = event.target.closest("[data-view]");
        if (!button) {
          return;
        }
        state.currentView = button.getAttribute("data-view");
        document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab === button));
        document.querySelectorAll(".view").forEach((view) => {
          view.classList.toggle("active", view.id === "view-" + state.currentView);
        });
      });

      document.getElementById("intake-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const title = document.getElementById("intake-title").value.trim();
        const body = document.getElementById("intake-body").value.trim();
        if (!title || !body) {
          return;
        }
        const result = await postJson("/v1/intake", { title, body });
        state.selectedThreadId = result.thread.id;
        await refreshSnapshots();
      });

      document.getElementById("refresh-all").addEventListener("click", async () => {
        await refreshSnapshots();
      });

      document.getElementById("agent-install-local").addEventListener("click", () => {
        document.getElementById("agent-install-ref").value = "./agents/design_planner_01";
      });

      threadList.addEventListener("click", async (event) => {
        const card = event.target.closest("[data-thread-id]");
        if (!card) {
          return;
        }
        state.selectedThreadId = card.getAttribute("data-thread-id");
        renderThreadList();
        await refreshThreadDetail();
      });

      document.getElementById("thread-reply-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!state.selectedThreadId) {
          return;
        }
        const input = document.getElementById("thread-reply-input");
        const body = input.value.trim();
        if (!body) {
          return;
        }
        await postJson("/v1/threads/respond", { threadId: state.selectedThreadId, body });
        input.value = "";
        await refreshSnapshots();
      });

      document.getElementById("agent-install-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const ref = document.getElementById("agent-install-ref").value.trim();
        if (!ref) {
          return;
        }
        const sourceKind = ref.startsWith("http") ? "registry_package" : "local_package";
        const result = await postJson("/v1/agents/install", {
          sourceKind,
          ref,
          trustState: sourceKind === "registry_package" ? "restricted" : "trusted"
        });
        const currentProjectId = state.selectedThreadDetail?.tasks[0]?.projectId;
        if (currentProjectId && result.agent?.id) {
          await postJson("/v1/agents/assign-project", {
            agentId: result.agent.id,
            projectId: currentProjectId
          });
        }
        await refreshSnapshots();
      });

      document.getElementById("project-create-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const name = document.getElementById("project-create-name").value.trim();
        const purpose = document.getElementById("project-create-purpose").value.trim();
        if (!name) {
          return;
        }
        const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
        const repoSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
        await postJson("/v1/projects", {
          id: id || ("project_" + Date.now()),
          name,
          purpose,
          repoSlug: repoSlug || null,
          lanes: ["planning", "research", "design", "build", "review"]
        });
        await refreshSnapshots();
      });

      document.getElementById("continue-thread").addEventListener("click", async () => {
        if (!state.selectedThreadId) {
          return;
        }
        await postJson("/v1/threads/continue", { threadId: state.selectedThreadId });
        await refreshSnapshots();
      });

      peopleView.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-action='mention-agent']");
        if (!button) {
          return;
        }
        const agentId = button.getAttribute("data-agent-id");
        const input = document.getElementById("thread-reply-input");
        input.value = \`@\${agentId} what are you doing and what do you need next?\`;
        state.currentView = "chat";
        document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.getAttribute("data-view") === "chat"));
        document.querySelectorAll(".view").forEach((view) => {
          view.classList.toggle("active", view.id === "view-chat");
        });
      });

      chatTasks.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-action]");
        if (!button) {
          return;
        }
        const action = button.getAttribute("data-action");
        const taskId = button.getAttribute("data-task-id");
        if (action === "continue-thread") {
          if (!state.selectedThreadId) {
            return;
          }
          await postJson("/v1/threads/continue", { threadId: state.selectedThreadId });
        } else if (action === "autoassign" && taskId) {
          await postJson("/v1/tasks/assign", { taskId });
        } else if (action === "work" && taskId) {
          await postJson("/v1/tasks/work", { taskId });
        } else if (action === "handoff" && taskId) {
          await postJson("/v1/tasks/handoff", { taskId, lane: button.getAttribute("data-lane") });
        } else if (action === "sync" && taskId) {
          await postJson("/v1/tasks/sync", {
            taskId,
            provider: button.getAttribute("data-provider") || "linear"
          });
        } else if (action === "request-approval" && taskId) {
          await postJson("/v1/approvals/request", {
            taskId,
            action: button.getAttribute("data-approval-action") || "guarded_action",
            reason: "Approval requested from advanced mode."
          });
        }
        await refreshSnapshots();
      });

      function connectEvents() {
        const source = new EventSource("/v1/events/stream");
        source.onopen = () => {
          connectionStatus.textContent = "Live event stream connected";
        };
        source.onmessage = async () => {
          await refreshSnapshots();
        };
        source.onerror = () => {
          connectionStatus.textContent = "Event stream reconnecting...";
        };
      }

      refreshSnapshots().then(connectEvents);
    </script>
  </body>
</html>`;
}
