// script.js（ドット風・角丸モジュール＋ハートマスク＋ガイド保護）
// 前提：index.html に form / urlInput / colorSelect / sizeSelect / error / qrCanvas / downloadBtn / metaText がある
(() => {
  const form = document.getElementById("form");
  const urlInput = document.getElementById("urlInput");
  const colorSelect = document.getElementById("colorSelect");
  const sizeSelect = document.getElementById("sizeSelect");
  const errorEl = document.getElementById("error");
  const canvas = document.getElementById("qrCanvas");
  const ctx = canvas.getContext("2d");
  const downloadBtn = document.getElementById("downloadBtn");
  const metaText = document.getElementById("metaText");

  // 必須仕様
  const ERROR_LEVEL = "H";
  const BG = "#FFFFFF";
  const MAX_LEN = 300;

  // quiet zone（読み取り試験を想定して十分広く）
  const QUIET = 8;

  // Finder（角のガイド）を壊さない保護領域
  // 9 = finder(7) + separator(1) + 安全マージン(1)
  const FINDER_PROTECT = 9;

  // 見た目チューニング
  const LOOK = {
    // モジュールを「ドット風」に：小さいほどスカスカで可愛いが読取は下がる
    // 推奨 0.70〜0.90
    dotScale: 0.82,

    // 角丸の丸み（0〜0.5くらい） 大きいほど“ドット感”
    roundness: 0.38,

    // ハート形状（内側判定のスケール）
    heartSx: 0.95,
    heartSy: 1.10,
    heartYShift: 0.08,

    // ハートを少し強める（内側判定を少し緩める）
    // 大きすぎると欠損が増えて読めなくなる
    heartExpand: 0.08,

    // ハートの中に残す割合（小さいほどハートが大きくなる＝削りが増える）
    // 推奨 0.86〜0.98
    heartSizeFactor: 0.92,

    // 出力外側余白（px）
    outerPadMin: 24,
    outerPadRatio: 0.08,
  };

  function setError(msg) {
    errorEl.textContent = msg || "";
  }

  function validateUrl(input) {
    const v = (input || "").trim();
    if (!v) return { ok: false, msg: "URLを入力してください。" };
    if (v.length > MAX_LEN) return { ok: false, msg: `URLは最大${MAX_LEN}文字までです。` };
    try {
      const test = v.includes("://") ? v : `https://${v}`;
      new URL(test);
    } catch {
      return { ok: false, msg: "URL形式が正しくありません。（例：https://example.com）" };
    }
    return { ok: true, msg: "" };
  }

  function normalizeUrl(raw) {
    const v = (raw || "").trim();
    if (!v) return v;
    return v.includes("://") ? v : `https://${v}`;
  }

  function clearWhite(sizePx) {
    canvas.width = sizePx;
    canvas.height = sizePx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, sizePx, sizePx);
  }

  // finder保護
  function isInFinderProtected(r, c, n) {
    const inTL = r < FINDER_PROTECT && c < FINDER_PROTECT;
    const inTR = r < FINDER_PROTECT && c >= (n - FINDER_PROTECT);
    const inBL = r >= (n - FINDER_PROTECT) && c < FINDER_PROTECT;
    return inTL || inTR || inBL;
  }

  // ハート式 (x^2 + y^2 - 1)^3 - x^2*y^3 <= 0
  function heartValue(x, y) {
    const a = x * x + y * y - 1;
    return a * a * a - x * x * y * y * y;
  }

  function inHeart(nx, ny) {
    const x = nx / LOOK.heartSx;
    const y = (ny + LOOK.heartYShift) / LOOK.heartSy;
    return heartValue(x, y) <= LOOK.heartExpand;
  }

  // 角丸四角（ドット風）を描く
  function roundRect(x, y, w, h, r) {
    const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    ctx.fill();
  }

  function render(text, fgHex, sizePx) {
    if (typeof window.qrcode !== "function") {
      throw new Error("QRライブラリの読み込みに失敗しました。");
    }

    // QR生成
    const qr = window.qrcode(0, ERROR_LEVEL);
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();

    // moduleSize
    const moduleSize = Math.floor(sizePx / (n + QUIET * 2));
    if (moduleSize < 2) throw new Error("出力サイズが小さすぎます。サイズを大きくしてください。");

    // QR全体（quiet含む）を実描画するサイズ
    const drawSize = moduleSize * (n + QUIET * 2);

    // 外側余白（読み取り安定）
    const extraOuter = Math.max(LOOK.outerPadMin, Math.floor(drawSize * LOOK.outerPadRatio));
    const finalSize = drawSize + extraOuter * 2;

    clearWhite(finalSize);

    const offset = extraOuter + QUIET * moduleSize;

    // ハート判定用中心
    const center = (n - 1) / 2;
    const sf = LOOK.heartSizeFactor;

    ctx.fillStyle = fgHex;

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;

        // 角は必ず残す（読み取りの核）
        const protectedFinder = isInFinderProtected(r, c, n);

        let keep = protectedFinder;

        if (!keep) {
          // ハート内だけ描く
          const nx = ((c - center) / center) * sf;
          const ny = (-(r - center) / center) * sf;
          keep = inHeart(nx, ny);
        }

        if (!keep) continue;

        // ドット風描画
        const x0 = offset + c * moduleSize;
        const y0 = offset + r * moduleSize;

        const s = moduleSize * LOOK.dotScale;
        const pad = (moduleSize - s) / 2;
        const x = x0 + pad;
        const y = y0 + pad;

        const radius = s * LOOK.roundness;

        roundRect(x, y, s, s, radius);
      }
    }

    // quiet zone を白で再強制（万一の侵食を防ぐ）
    ctx.fillStyle = BG;
    const qx = extraOuter;
    const qy = extraOuter;
    const qSize = drawSize;

    // quiet zone “外枠”だけ白で上書き（中心のデータ領域は残す）
    // ここで全部白にするとQRが消えるので、外周だけ
    // 上
    ctx.fillRect(qx, qy, qSize, QUIET * moduleSize);
    // 下
    ctx.fillRect(qx, qy + qSize - QUIET * moduleSize, qSize, QUIET * moduleSize);
    // 左
    ctx.fillRect(qx, qy, QUIET * moduleSize, qSize);
    // 右
    ctx.fillRect(qx + qSize - QUIET * moduleSize, qy, QUIET * moduleSize, qSize);

    // 角の保護領域が quiet 上書きで欠けないよう、角だけもう一度描き直し（安全策）
    ctx.fillStyle = fgHex;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        if (!isInFinderProtected(r, c, n)) continue;

        const x0 = offset + c * moduleSize;
        const y0 = offset + r * moduleSize;
        const s = moduleSize * Math.min(0.92, LOOK.dotScale + 0.08); // finderは少し大きめ
        const pad = (moduleSize - s) / 2;
        const x = x0 + pad;
        const y = y0 + pad;
        const radius = s * Math.min(0.20, LOOK.roundness); // finderは丸めすぎない
        roundRect(x, y, s, s, radius);
      }
    }

    return { modules: n, moduleSize, sizePx: finalSize };
  }

  function downloadPng(nameBase) {
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nameBase}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // 初期
  clearWhite(parseInt(sizeSelect.value, 10));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    setError("");

    const raw = urlInput.value;
    const v = validateUrl(raw);
    if (!v.ok) {
      downloadBtn.disabled = true;
      metaText.textContent = "未生成";
      setError(v.msg);
      return;
    }

    const text = normalizeUrl(raw);
    const fgHex = colorSelect.value;
    const sizePx = parseInt(sizeSelect.value, 10);

    try {
      const info = render(text, fgHex, sizePx);
      downloadBtn.disabled = false;
      metaText.textContent = `生成済み：${info.sizePx}px / modules=${info.modules} / level=H`;
    } catch (err) {
      downloadBtn.disabled = true;
      metaText.textContent = "未生成";
      setError(err instanceof Error ? err.message : "生成に失敗しました。");
    }
  });

  downloadBtn.addEventListener("click", () => {
    if (downloadBtn.disabled) return;

    const raw = (urlInput.value || "").trim();
    const text = normalizeUrl(raw);
    const safe = text
      .replace(/^https?:\/\//i, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "qr";

    downloadPng(`heart-qr_${safe}`);
  });

  urlInput.addEventListener("input", () => {
    const v = urlInput.value || "";
    if (v.length > MAX_LEN) setError(`URLは最大${MAX_LEN}文字までです。`);
    else if (errorEl.textContent) setError("");
  });
})();
