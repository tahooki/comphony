import { TASK_STATUS } from "../state/task-policy.js";

export const WEB_APP_CLIENT_STATE_SCRIPT = String.raw`
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
        return ${JSON.stringify([TASK_STATUS.reported, TASK_STATUS.done])}.includes(task.status);
      }

      function taskBlocked(task) {
        return ${JSON.stringify([TASK_STATUS.blocked, TASK_STATUS.waiting, TASK_STATUS.consulting])}.includes(task.status) || task.needsApproval;
      }

      function getCurrentThreadTask(detail) {
        if (!detail) {
          return null;
        }
        return detail.tasks.find((task) => task.parentTaskId && !taskComplete(task)) || detail.tasks.find((task) => !taskComplete(task)) || detail.tasks[0] || null;
      }
`;
