export const WEB_APP_EVENTS_SCRIPT = String.raw`
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
`;
