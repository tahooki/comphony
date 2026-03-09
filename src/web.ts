export function renderWebAppHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Comphony Chat</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f3efe5;
        --panel: rgba(255, 252, 246, 0.88);
        --line: rgba(24, 32, 41, 0.12);
        --line-strong: rgba(24, 32, 41, 0.22);
        --text: #17202a;
        --muted: #5f6b76;
        --accent: #14532d;
        --accent-soft: #d9f99d;
        --signal: #1d4ed8;
        --warning: #92400e;
        --radius: 18px;
        --shadow: 0 18px 40px rgba(16, 24, 40, 0.08);
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(217, 249, 157, 0.55), transparent 28%),
          radial-gradient(circle at top right, rgba(147, 197, 253, 0.4), transparent 26%),
          linear-gradient(180deg, #f7f4ec 0%, #efe6d6 100%);
      }

      .shell {
        max-width: 1440px;
        margin: 0 auto;
        padding: 32px 20px 40px;
      }

      .hero {
        display: grid;
        grid-template-columns: 1.4fr 0.9fr;
        gap: 18px;
        margin-bottom: 20px;
      }

      .card {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        backdrop-filter: blur(10px);
      }

      .hero-main {
        padding: 26px 28px;
      }

      .hero-main h1 {
        margin: 0 0 8px;
        font-size: 40px;
        line-height: 1;
      }

      .hero-main p {
        margin: 0;
        color: var(--muted);
        max-width: 50rem;
      }

      .hero-stats {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      .stat {
        padding: 18px;
      }

      .stat-label {
        display: block;
        font-size: 12px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        margin-bottom: 8px;
      }

      .stat-value {
        font-size: 28px;
        font-weight: 700;
      }

      .grid {
        display: grid;
        grid-template-columns: 0.9fr 1.2fr 0.8fr;
        gap: 18px;
      }

      .panel {
        padding: 20px;
      }

      .section-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        margin-bottom: 12px;
      }

      .section-head h2, .section-head h3 {
        margin: 0;
      }

      .thread-list,
      .message-list,
      .task-list,
      .event-list {
        display: grid;
        gap: 10px;
      }

      .thread-list {
        max-height: 620px;
        overflow: auto;
        padding-right: 4px;
      }

      .thread-card,
      .message-card,
      .task-card,
      .event-card {
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 14px 16px;
        background: rgba(255, 255, 255, 0.72);
      }

      .thread-card {
        cursor: pointer;
        transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
      }

      .thread-card:hover,
      .thread-card.selected {
        transform: translateY(-1px);
        border-color: var(--line-strong);
        box-shadow: 0 12px 26px rgba(16, 24, 40, 0.08);
      }

      .message-card header,
      .thread-card header,
      .task-card header,
      .event-card header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        margin-bottom: 6px;
      }

      .message-card header strong,
      .thread-card header strong,
      .task-card header strong,
      .event-card header strong {
        display: block;
      }

      .meta {
        color: var(--muted);
        font-size: 13px;
      }

      .detail-grid {
        display: grid;
        gap: 16px;
      }

      .composer {
        display: grid;
        gap: 10px;
        margin-top: 16px;
      }

      input, textarea, button {
        font: inherit;
      }

      input, textarea {
        width: 100%;
        border-radius: 14px;
        border: 1px solid var(--line);
        padding: 12px 14px;
        background: rgba(255, 255, 255, 0.88);
      }

      textarea {
        min-height: 120px;
        resize: vertical;
      }

      .composer-actions,
      .task-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 8px;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 8px 12px;
        background: rgba(20, 83, 45, 0.08);
        color: var(--accent);
        font-size: 13px;
      }

      button {
        cursor: pointer;
        border: 0;
        border-radius: 999px;
        padding: 10px 14px;
        background: linear-gradient(135deg, #14532d, #1d4ed8);
        color: white;
        box-shadow: var(--shadow);
      }

      button.secondary {
        background: rgba(20, 32, 42, 0.08);
        color: var(--text);
        box-shadow: none;
      }

      .task-actions button {
        padding: 8px 12px;
      }

      .empty {
        border: 1px dashed var(--line-strong);
        border-radius: 16px;
        padding: 18px;
        color: var(--muted);
        background: rgba(255, 255, 255, 0.5);
      }

      code {
        color: var(--signal);
      }

      @media (max-width: 1200px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 960px) {
        .hero {
          grid-template-columns: 1fr;
        }

        .hero-main h1 {
          font-size: 32px;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <div class="card hero-main">
          <h1>Comphony Chat</h1>
          <p>Talk to Comphony, create intake requests, inspect thread context, and move tasks through assignment and status updates without leaving the conversation surface.</p>
        </div>
        <div class="hero-stats">
          <div class="card stat">
            <span class="stat-label">Projects</span>
            <span class="stat-value" id="stat-projects">-</span>
          </div>
          <div class="card stat">
            <span class="stat-label">Agents</span>
            <span class="stat-value" id="stat-agents">-</span>
          </div>
          <div class="card stat">
            <span class="stat-label">Tasks</span>
            <span class="stat-value" id="stat-tasks">-</span>
          </div>
          <div class="card stat">
            <span class="stat-label">Events</span>
            <span class="stat-value" id="stat-events">-</span>
          </div>
        </div>
      </section>

      <section class="grid">
        <section class="card panel">
          <div class="section-head">
            <h2>Threads</h2>
            <span class="status-pill" id="connection-status">Connecting...</span>
          </div>
          <div class="thread-list" id="thread-list"></div>
        </section>

        <section class="card panel">
          <div class="section-head">
            <h2>Selected Thread</h2>
            <button class="secondary" type="button" id="refresh-detail">Refresh</button>
          </div>
          <div class="detail-grid">
            <div id="thread-detail"></div>
            <form class="composer" id="intake-form">
              <input id="intake-title" placeholder="Request title" value="Refresh Product - Core dashboard" />
              <textarea id="intake-body" placeholder="Tell Comphony what you want done.">Please redesign the Product - Core dashboard UI and improve the UX.</textarea>
              <div class="composer-actions">
                <div class="status-pill">Intake creates thread, message, task, and auto-assignment.</div>
                <button type="submit">Send To Comphony</button>
              </div>
            </form>
          </div>
        </section>

        <aside class="card panel">
          <div class="section-head">
            <h2>Recent Events</h2>
            <button class="secondary" type="button" id="refresh-events">Reload</button>
          </div>
          <div class="event-list" id="event-list"></div>
          <div class="section-head" style="margin-top: 18px;">
            <h2>Recent Memory</h2>
          </div>
          <div class="event-list" id="memory-list"></div>
        </aside>
      </section>
    </main>

    <script>
      const threadList = document.getElementById("thread-list");
      const threadDetail = document.getElementById("thread-detail");
      const eventList = document.getElementById("event-list");
      const memoryList = document.getElementById("memory-list");
      const connectionStatus = document.getElementById("connection-status");
      const intakeForm = document.getElementById("intake-form");
      const refreshDetailButton = document.getElementById("refresh-detail");
      const refreshEventsButton = document.getElementById("refresh-events");

      const state = {
        projects: [],
        agents: [],
        threads: [],
        tasks: [],
        events: [],
        memories: [],
        selectedThreadId: null,
        selectedThreadDetail: null
      };

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

      function eligibleAgents(task) {
        return state.agents.filter((agent) => Array.isArray(agent.assignedProjects) && agent.assignedProjects.includes(task.projectId));
      }

      function renderThreadList() {
        threadList.innerHTML = state.threads.slice().reverse().map((thread) => {
          const isSelected = thread.id === state.selectedThreadId;
          const linkedTasks = state.tasks.filter((task) => thread.taskIds.includes(task.id));
          return \`<article class="thread-card \${isSelected ? "selected" : ""}" data-thread-id="\${escapeHtml(thread.id)}">
            <header>
              <strong>\${escapeHtml(thread.title)}</strong>
              <span class="meta">\${formatDate(thread.updatedAt)}</span>
            </header>
            <div class="meta">thread: <code>\${escapeHtml(thread.id)}</code></div>
            <div class="meta">messages: \${thread.messageIds.length} · tasks: \${thread.taskIds.length}</div>
            \${linkedTasks[0] ? \`<div class="meta">latest task: \${escapeHtml(linkedTasks[0].title)}</div>\` : ""}
          </article>\`;
        }).join("") || '<div class="empty">No threads yet. Send an intake request to create one.</div>';
      }

      function renderTaskCard(task) {
        const agentButtons = eligibleAgents(task).map((agent) => {
          const label = task.assigneeId === agent.id ? \`Assigned: \${agent.name}\` : \`Assign \${agent.name}\`;
          return \`<button type="button" class="secondary" data-action="assign" data-task-id="\${escapeHtml(task.id)}" data-agent-id="\${escapeHtml(agent.id)}">\${escapeHtml(label)}</button>\`;
        }).join("");

        return \`<article class="task-card">
          <header>
            <strong>\${escapeHtml(task.title)}</strong>
            <span class="meta">\${formatDate(task.updatedAt)}</span>
          </header>
          <div class="meta">task: <code>\${escapeHtml(task.id)}</code></div>
          <div class="meta">project: \${escapeHtml(task.projectId)} · lane: \${escapeHtml(task.lane)}</div>
          <div class="meta">status: \${escapeHtml(task.status)} · assignee: \${escapeHtml(task.assigneeId || "-")}</div>
          <div class="meta">artifacts: \${task.artifactPaths && task.artifactPaths.length ? task.artifactPaths.length : 0}</div>
          <p>\${escapeHtml(task.description || "No description.")}</p>
          \${task.artifactPaths && task.artifactPaths.length ? \`
            <div class="meta">latest artifact: \${escapeHtml(task.artifactPaths[task.artifactPaths.length - 1])}</div>
            <div class="meta">\${task.artifactPaths.map((path) => escapeHtml(path)).join("<br />")}</div>
          \` : ""}
          <div class="task-actions">
            <button type="button" data-action="autoassign" data-task-id="\${escapeHtml(task.id)}">Auto Assign</button>
            <button type="button" class="secondary" data-action="work" data-task-id="\${escapeHtml(task.id)}">Run Turn</button>
            <button type="button" class="secondary" data-action="handoff" data-task-id="\${escapeHtml(task.id)}" data-lane="build">To Build</button>
            <button type="button" class="secondary" data-action="handoff" data-task-id="\${escapeHtml(task.id)}" data-lane="review">To Review</button>
            <button type="button" class="secondary" data-action="status" data-task-id="\${escapeHtml(task.id)}" data-status="in_progress">In Progress</button>
            <button type="button" class="secondary" data-action="status" data-task-id="\${escapeHtml(task.id)}" data-status="review">Review</button>
            <button type="button" class="secondary" data-action="status" data-task-id="\${escapeHtml(task.id)}" data-status="done">Done</button>
          </div>
          \${agentButtons ? \`<div class="task-actions">\${agentButtons}</div>\` : ""}
        </article>\`;
      }

      function renderThreadDetail() {
        const detail = state.selectedThreadDetail;
        if (!detail) {
          threadDetail.innerHTML = '<div class="empty">Select a thread to inspect its messages and tasks.</div>';
          return;
        }

        const messagesHtml = detail.messages.map((message) => \`<article class="message-card">
          <header>
            <strong>\${escapeHtml(message.role)}</strong>
            <span class="meta">\${formatDate(message.createdAt)}</span>
          </header>
          <div class="meta">message: <code>\${escapeHtml(message.id)}</code></div>
          <div class="meta">routed project: \${escapeHtml(message.routedProjectId || "-")} · lane: \${escapeHtml(message.suggestedLane || "-")}</div>
          <p>\${escapeHtml(message.body)}</p>
        </article>\`).join("");

        const tasksHtml = detail.tasks.map(renderTaskCard).join("");

        threadDetail.innerHTML = \`
          <section class="detail-grid">
            <article class="message-card">
              <header>
                <strong>\${escapeHtml(detail.thread.title)}</strong>
                <span class="meta">\${formatDate(detail.thread.updatedAt)}</span>
              </header>
              <div class="meta">thread: <code>\${escapeHtml(detail.thread.id)}</code></div>
              <div class="meta">messages: \${detail.messages.length} · tasks: \${detail.tasks.length}</div>
            </article>
            <form class="composer" id="thread-reply-form">
              <input id="thread-reply-input" placeholder="Ask Comphony about this thread" value="What is the current status?" />
              <div class="composer-actions">
                <div class="status-pill">This adds a user follow-up and a Comphony response.</div>
                <button type="submit">Send Follow-up</button>
              </div>
            </form>
            <section>
              <div class="section-head"><h3>Messages</h3></div>
              <div class="message-list">\${messagesHtml || '<div class="empty">No messages on this thread yet.</div>'}</div>
            </section>
            <section>
              <div class="section-head"><h3>Tasks</h3></div>
              <div class="task-list">\${tasksHtml || '<div class="empty">No tasks linked to this thread yet.</div>'}</div>
            </section>
          </section>
        \`;
      }

      function renderEvents() {
        eventList.innerHTML = state.events.slice(0, 16).map((event) => \`<article class="event-card">
          <header>
            <strong><code>\${escapeHtml(event.type)}</code></strong>
            <span class="meta">\${formatDate(event.timestamp)}</span>
          </header>
          <div class="meta">\${escapeHtml(event.entityType)} · <code>\${escapeHtml(event.entityId)}</code></div>
        </article>\`).join("") || '<div class="empty">No events yet.</div>';
      }

      function renderMemories() {
        memoryList.innerHTML = state.memories.slice(0, 10).map((memory) => \`<article class="event-card">
          <header>
            <strong><code>\${escapeHtml(memory.kind)}</code></strong>
            <span class="meta">\${formatDate(memory.createdAt)}</span>
          </header>
          <div class="meta">\${escapeHtml(memory.scope)} · \${escapeHtml(memory.projectId || "-")}</div>
          <div>\${escapeHtml(memory.body)}</div>
        </article>\`).join("") || '<div class="empty">No memory yet.</div>';
      }

      function renderStats() {
        document.getElementById("stat-projects").textContent = String(state.projects.length);
        document.getElementById("stat-agents").textContent = String(state.agents.length);
        document.getElementById("stat-tasks").textContent = String(state.tasks.length);
        document.getElementById("stat-events").textContent = String(state.events.length);
      }

      async function refreshSnapshots() {
        const [projectsRes, agentsRes, threadsRes, tasksRes, eventsRes, memoriesRes] = await Promise.all([
          fetch("/v1/projects"),
          fetch("/v1/agents"),
          fetch("/v1/threads"),
          fetch("/v1/tasks"),
          fetch("/v1/events?limit=20"),
          fetch(state.selectedThreadId ? "/v1/memory?threadId=" + encodeURIComponent(state.selectedThreadId) + "&limit=10" : "/v1/memory?limit=10")
        ]);
        state.projects = (await projectsRes.json()).projects;
        state.agents = (await agentsRes.json()).agents;
        state.threads = (await threadsRes.json()).threads;
        state.tasks = (await tasksRes.json()).tasks;
        state.events = (await eventsRes.json()).events;
        state.memories = (await memoriesRes.json()).memories;
        if (!state.selectedThreadId && state.threads.length > 0) {
          state.selectedThreadId = state.threads[state.threads.length - 1].id;
        }
        renderStats();
        renderThreadList();
        renderEvents();
        renderMemories();
        await refreshThreadDetail();
      }

      async function refreshThreadDetail() {
        if (!state.selectedThreadId) {
          state.selectedThreadDetail = null;
          renderThreadDetail();
          return;
        }
        const response = await fetch("/v1/threads/" + encodeURIComponent(state.selectedThreadId));
        if (!response.ok) {
          state.selectedThreadDetail = null;
          renderThreadDetail();
          return;
        }
        state.selectedThreadDetail = await response.json();
        renderThreadDetail();
      }

      async function postJson(url, payload) {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: "Unknown error" }));
          throw new Error(error.message || "Request failed");
        }
        return response.json();
      }

      intakeForm.addEventListener("submit", async (event) => {
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

      refreshDetailButton.addEventListener("click", async () => {
        await refreshThreadDetail();
      });

      refreshEventsButton.addEventListener("click", async () => {
        await refreshSnapshots();
      });

      threadList.addEventListener("click", async (event) => {
        const threadCard = event.target.closest("[data-thread-id]");
        if (!threadCard) {
          return;
        }
        state.selectedThreadId = threadCard.getAttribute("data-thread-id");
        renderThreadList();
        await refreshThreadDetail();
      });

      threadDetail.addEventListener("click", async (event) => {
        const button = event.target.closest("[data-action]");
        if (!button) {
          return;
        }
        const action = button.getAttribute("data-action");
        const taskId = button.getAttribute("data-task-id");
        if (!taskId) {
          return;
        }
        if (action === "assign") {
          await postJson("/v1/tasks/assign", {
            taskId,
            agentId: button.getAttribute("data-agent-id")
          });
        } else if (action === "autoassign") {
          await postJson("/v1/tasks/assign", { taskId });
        } else if (action === "work") {
          await postJson("/v1/tasks/work", { taskId });
        } else if (action === "handoff") {
          await postJson("/v1/tasks/handoff", {
            taskId,
            lane: button.getAttribute("data-lane")
          });
        } else if (action === "status") {
          await postJson("/v1/tasks/status", {
            taskId,
            status: button.getAttribute("data-status")
          });
        }
        await refreshSnapshots();
      });

      threadDetail.addEventListener("submit", async (event) => {
        const form = event.target.closest("#thread-reply-form");
        if (!form) {
          return;
        }
        event.preventDefault();
        if (!state.selectedThreadId) {
          return;
        }
        const input = document.getElementById("thread-reply-input");
        const body = input.value.trim();
        if (!body) {
          return;
        }
        await postJson("/v1/threads/respond", {
          threadId: state.selectedThreadId,
          body
        });
        input.value = "";
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
