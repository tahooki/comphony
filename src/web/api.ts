export const WEB_APP_API_SCRIPT = String.raw`
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
`;
