// script.js — 展示ブース向け助成金マッチングアプリ フロントエンド

const state = {
  challenges: new Set(),
  companySize: null,
};

// ========== Step navigation ==========
function showStep(n) {
  document.querySelectorAll(".step").forEach((s) => s.classList.remove("active"));
  const target = document.getElementById(`step-${n}`);
  if (target) {
    target.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

// Next/prev buttons
document.querySelectorAll("[data-next]").forEach((btn) => {
  btn.addEventListener("click", () => showStep(parseInt(btn.dataset.next)));
});

document.querySelectorAll("[data-prev]").forEach((btn) => {
  btn.addEventListener("click", () => showStep(parseInt(btn.dataset.prev)));
});

// ========== Step 1: Challenge selection ==========
const challengeBtns = document.querySelectorAll(".challenge-btn");
const toStep2Btn = document.getElementById("to-step-2");

challengeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    const val = btn.dataset.value;
    if (state.challenges.has(val)) {
      state.challenges.delete(val);
      btn.classList.remove("selected");
    } else if (state.challenges.size < 3) {
      state.challenges.add(val);
      btn.classList.add("selected");
    }
    toStep2Btn.disabled = state.challenges.size === 0;
  });
});

toStep2Btn.addEventListener("click", () => showStep(2));

// ========== Step 2: Company size selection ==========
const sizeBtns = document.querySelectorAll(".size-btn");

sizeBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    state.companySize = btn.dataset.value;
    sizeBtns.forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    startDiagnosis();
  });
});

// ========== Loading animation ==========
function animateLoadingSteps() {
  const steps = ["l-step-1", "l-step-2", "l-step-3"];
  let i = 0;

  function activate() {
    if (i < steps.length) {
      const el = document.getElementById(steps[i]);
      if (el) el.classList.add("active");
      i++;
      setTimeout(activate, 900);
    }
  }

  activate();
}

function markLoadingStepDone(stepId) {
  const el = document.getElementById(stepId);
  if (el) {
    el.classList.remove("active");
    el.classList.add("done");
  }
}

// ========== Diagnosis ==========
function startDiagnosis() {
  showStep(3);
  animateLoadingSteps();

  const body = {
    challenges: [...state.challenges],
    companySize: state.companySize,
  };

  fetchResults(body);
}

async function fetchResults(body) {
  const subsidyCardsEl = document.getElementById("subsidy-cards");
  const proposalBoxEl = document.getElementById("proposal-box");
  const resultTagsEl = document.getElementById("results-tags");

  let proposalText = "";

  try {
    const res = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        let msg;
        try {
          msg = JSON.parse(raw);
        } catch {
          continue;
        }

        if (msg.type === "subsidies") {
          markLoadingStepDone("l-step-1");
          markLoadingStepDone("l-step-2");
          renderSubsidies(msg.subsidies, subsidyCardsEl);
          renderTags(body, resultTagsEl);
          showStep(4);
        } else if (msg.type === "text") {
          markLoadingStepDone("l-step-3");
          proposalText += msg.text;
          renderProposal(proposalText, proposalBoxEl);
        } else if (msg.type === "done") {
          finalizeProposal(proposalBoxEl);
        } else if (msg.type === "error") {
          proposalBoxEl.textContent = "提案の生成中にエラーが発生しました。";
        }
      }
    }
  } catch (err) {
    console.error(err);
    showStep(4);
    subsidyCardsEl.innerHTML = `<p class="results__empty">通信エラーが発生しました。もう一度お試しください。</p>`;
    proposalBoxEl.textContent = "";
  }
}

// ========== Render helpers ==========
const CHALLENGE_LABELS = {
  dx_automation: "🤖 人手不足・業務の自動化",
  skill_training: "📚 社員の育成・スキルアップ",
  hiring: "👥 採用・雇用の改善",
  workstyle: "⏰ 働き方改革・残業削減",
  sales_expansion: "🌐 新規顧客開拓・販路拡大",
  digitalization: "💻 デジタル化・DX推進",
};

const SIZE_LABELS = {
  small: "🏪 小規模事業者",
  medium: "🏢 中小企業",
  large: "🏬 中堅・大企業",
};

function renderTags(body, container) {
  container.innerHTML = "";
  body.challenges.forEach((c) => {
    const tag = document.createElement("span");
    tag.className = "results__tag";
    tag.textContent = CHALLENGE_LABELS[c] || c;
    container.appendChild(tag);
  });
  const sizeTag = document.createElement("span");
  sizeTag.className = "results__tag";
  sizeTag.textContent = SIZE_LABELS[body.companySize] || body.companySize;
  container.appendChild(sizeTag);
}

function getStatusClass(status) {
  if (!status) return "closed";
  if (status.includes("公募中") || status === "通年") return "active";
  if (status === "受付前") return "pending";
  return "closed";
}

function getStatusLabel(status) {
  if (!status) return "状況不明";
  return status;
}

function renderSubsidies(subsidies, container) {
  if (!subsidies || subsidies.length === 0) {
    container.innerHTML = `<p class="results__empty">現在マッチする助成金が見つかりませんでした。</p>`;
    return;
  }

  container.innerHTML = "";
  subsidies.forEach((s) => {
    const statusClass = getStatusClass(s.status);
    const isActive = statusClass === "active";

    const card = document.createElement("div");
    card.className = `subsidy-card${isActive ? " subsidy-card--active" : ""}`;
    card.innerHTML = `
      <div class="subsidy-card__header">
        <span class="subsidy-card__name">${escHtml(s.name)}</span>
        <span class="subsidy-card__status subsidy-card__status--${statusClass}">${escHtml(getStatusLabel(s.status))}</span>
      </div>
      <div class="subsidy-card__meta">
        ${s.rate ? `<span>補助率: <strong>${escHtml(s.rate)}</strong></span>` : ""}
        ${s.maxAmount ? `<span>上限額: <strong>${escHtml(s.maxAmount)}</strong></span>` : ""}
        ${s.targetSize ? `<span>対象: <strong>${escHtml(s.targetSize)}</strong></span>` : ""}
      </div>
      ${s.url ? `<a class="subsidy-card__link" href="${escHtml(s.url)}" target="_blank" rel="noopener">公式サイトを見る →</a>` : ""}
    `;
    container.appendChild(card);
  });
}

function renderProposal(text, container) {
  container.innerHTML = "";
  const pre = document.createElement("div");
  pre.style.whiteSpace = "pre-wrap";
  pre.textContent = text;

  const cursor = document.createElement("span");
  cursor.className = "proposal-cursor";
  cursor.id = "streaming-cursor";

  container.appendChild(pre);
  container.appendChild(cursor);
}

function finalizeProposal(container) {
  const cursor = container.querySelector("#streaming-cursor");
  if (cursor) cursor.remove();
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ========== Restart ==========
document.getElementById("restart-btn").addEventListener("click", () => {
  state.challenges.clear();
  state.companySize = null;

  challengeBtns.forEach((b) => b.classList.remove("selected"));
  sizeBtns.forEach((b) => b.classList.remove("selected"));
  toStep2Btn.disabled = true;

  ["l-step-1", "l-step-2", "l-step-3"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove("active", "done");
  });

  document.getElementById("subsidy-cards").innerHTML = `<p class="results__empty">マッチする助成金を検索中…</p>`;
  document.getElementById("proposal-box").innerHTML = `<div class="proposal-loading"><span class="proposal-cursor"></span></div>`;
  document.getElementById("results-tags").innerHTML = "";

  showStep(0);
});

// Contact button (placeholder)
document.getElementById("contact-btn").addEventListener("click", () => {
  alert("担当スタッフにお声がけください。\nスタッフが詳しくご説明いたします！");
});
