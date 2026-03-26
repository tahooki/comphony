export const WEB_APP_STYLES = String.raw`
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
`;

export const WEB_APP_BODY = String.raw`
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
`;
