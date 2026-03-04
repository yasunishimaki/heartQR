// script.js — キャリアデザインカードゲーム授業 提案サイト

// ========== Tab switching ==========
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.tab;

    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));

    btn.classList.add("active");
    const panel = document.getElementById(`tab-${target}`);
    if (panel) panel.classList.add("active");
  });
});

// ========== Counter animation ==========
function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const duration = 1200;
  const start = performance.now();

  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // ease-out-quart
    const ease = 1 - Math.pow(1 - progress, 4);
    el.textContent = Math.round(ease * target);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

// Trigger counter when stats section enters viewport
const statsSection = document.querySelector(".stats");
if (statsSection) {
  const counters = statsSection.querySelectorAll(".stat__num");
  let animated = false;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !animated) {
        animated = true;
        counters.forEach(animateCounter);
      }
    },
    { threshold: 0.3 }
  );

  observer.observe(statsSection);
}

// ========== Scroll-in animation ==========
const fadeEls = document.querySelectorAll(
  ".reason, .effect, .req, .voice, .timeline__item"
);

const fadeObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        fadeObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

fadeEls.forEach((el) => {
  el.classList.add("fade-in");
  fadeObserver.observe(el);
});

// ========== Smooth scroll for anchor links ==========
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href").slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});
