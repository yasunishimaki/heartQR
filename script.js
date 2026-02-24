// script.js（置き換え用：ハート強め版）
(() => {
  const form = document.getElementById("form");
  const urlInput = document.getElementById("urlInput");
  const colorSelect = document.getElementById("colorSelect");
  const sizeSelect = document.getElementById("sizeSelect");
  const errorEl = document.getElementById("error");
  const canvas = document.getElementById("qrCanvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  const downloadBtn = document.getElementById("downloadBtn");
  const metaText = document.getElementById("metaText");

  // 固定仕様
  const ERROR_LEVEL = "H";
  const BG_COLOR = "#FFFFFF";
  const MAX_LEN = 300;

  // 読み取り余白（quiet zone）を十分に
  const QUIET_ZONE_MODULES = 8;

  // Finder（位置検出）を壊さない保護領域
  // 9 = finder(7) + separator(1) + format周辺の安全マージン(1)
  const FINDER_PROTECT = 9;

  // タイミングパターン保護（基本壊さない）
  const PROTECT_TIMING = true;

  // ハート形状のチューニング
  // 数値を変えると見た目が変わります（まずはこのままでOK）
  const HEART = {
    // 縦横スケール：縦を少し強めるとハートらしくなる
    sx: 0.92,
    sy: 1.10,

    // 上下位置：少し上に寄せると下の尖りが出やすい
    yShift: 0.10,

    // ハート境界の拡張：少しだけ外側まで「中」とみなす（形を強調）
    // 0 に近いほど厳密。大きすぎると読み取りが落ちる可能性あり。
    expandThreshold: 0.10,

    // ハートの“占有率”（小さいほどハートが大きくなる）
    // 大きくしすぎると四角っぽく、下げすぎると欠損が増えます。
    sizeFactor: 0.86,
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
      // eslint-disable-next-line no-new
      new URL(test);
    } catch {
      return { ok: false, msg: "URL形式が正しくありません。（例：https://example.com）" };
    }
    return { ok: true, msg: "" };
  }

  function getNormalizedText(raw) {
    const v = (raw || "").trim();
    if (!v) return v;
    if (v.includes("://")) return v;
    return `https://${v}`;
  }

  function clearCanvasToWhite(sizePx) {
    canvas.width = sizePx;
    canvas.height = sizePx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, sizePx, sizePx);
  }

  // Finder保護判定
  function isInFinderProtected(r, c, n) {
    const inTL = r < FINDER_PROTECT && c < FINDER_PROTECT;
    const inTR = r < FINDER_PROTECT && c >= (n - FINDER_PROTECT);
    const inBL = r >= (n - FINDER_PROTECT) && c < FINDER_PROTECT;
    return inTL || inTR || inBL;
  }

  // タイミングパターン保護判定
  function isTimingProtected(r, c) {
    return (r === 6 || c === 6);
  }

  // ハート方程式： (x^2 + y^2 - 1)^3 - x^2*y^3 <= 0
  // これを基準に、拡張閾値で少し外側まで「中」にする
  function heartValue(x, y) {
    const a = x * x + y * y - 1;
    return a * a * a - x * x * y * y * y;
  }

  function isInHeart(nx, ny) {
    // スケール＋位置調整
    const x = (nx / HEART.sx);
    const y = ((ny + HEART.yShift) / HEART.sy);

    // 値が小さいほど内側。 expandThreshold を足して内側判定を緩める
    const v = heartValue(x, y);
    return v <= HEART.expandThreshold;
  }

  function renderQrHeart(text, colorHex, sizePx) {
    if (typeof window.qrcode !== "function") {
      throw new Error("QRライブラリの読み込みに失敗しました。ネットワーク環境を確認してください。");
    }

    // QR生成（型番号0=自動、誤り訂正H固定）
    const qr = window.qrcode(0, ERROR_LEVEL);
    qr.addData(text);
    qr.make();

    const n = qr.getModuleCount();

    // 1モジュールのピクセルサイズ
    const moduleSize = Math.floor(sizePx / (n + QUIET_ZONE_MODULES * 2));
    if (moduleSize < 2) {
      throw new Error("出力サイズが小さすぎます。サイズを大きくしてください。");
    }

    const drawSize = moduleSize * (n + QUIET_ZONE_MODULES * 2);
    const offset = moduleSize * QUIET_ZONE_MODULES;

    clearCanvasToWhite(drawSize);

    // 正規化用
    const center = (n - 1) / 2;

    // sizeFactor：小さいほどハートが大きくなる（=マスクが強くなる）
    const sf = HEART.sizeFactor;

    ctx.fillStyle = colorHex;

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const dark = qr.isDark(r, c);

        // まず、絶対に守る領域
        const protectedFinder = isInFinderProtected(r, c, n);
        const protectedTiming = PROTECT_TIMING && isTimingProtected(r, c);

        let keep = protectedFinder || protectedTiming;

        if (!keep) {
          // [-1, 1] に正規化してハート判定
          // nyは上下反転（上をプラスにしてハートを上向きに）
          const nx = ((c - center) / center) * sf;
          const ny = (-(r - center) / center) * sf;

          keep = isInHeart(nx, ny);
        }

        // keep=false の場合は白のまま（描画しない）
        if (keep && dark) {
          const x = offset + c * moduleSize;
          const y = offset + r * moduleSize;
          ctx.fillRect(x, y, moduleSize, moduleSize);
        }
      }
    }

    // 追加の外側白余白（読み取り安定化）
    const extraPadPx = Math.max(16, Math.floor(drawSize * 0.05)); // 5% or min 16px
    const finalSize = drawSize + extraPadPx * 2;

    const tmp = document.createElement("canvas");
    tmp.width = finalSize;
    tmp.height = finalSize;
    const tctx = tmp.getContext("2d");
    tctx.fillStyle = BG_COLOR;
    tctx.fillRect(0, 0, finalSize, finalSize);
    tctx.drawImage(canvas, extraPadPx, extraPadPx);

    canvas.width = finalSize;
    canvas.height = finalSize;
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, finalSize, finalSize);
    ctx.drawImage(tmp, 0, 0);

    return { moduleCount: n, moduleSize, sizePx: finalSize };
  }

  function downloadPng(filenameBase = "heart-qr") {
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filenameBase}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // 初期表示：白キャンバス
  clearCanvasToWhite(parseInt(sizeSelect.value, 10));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    setError("");

    const raw = urlInput.value;
    const vres = validateUrl(raw);
    if (!vres.ok) {
      downloadBtn.disabled = true;
      metaText.textContent = "未生成";
      setError(vres.msg);
      return;
    }

    const text = getNormalizedText(raw);
    const colorHex = colorSelect.value;
    const sizePx = parseInt(sizeSelect.value, 10);

    try {
      const info = renderQrHeart(text, colorHex, sizePx);
      downloadBtn.disabled = false;
      metaText.textContent = `生成済み：${info.sizePx}px / modules=${info.moduleCount} / level=H / bg=white`;
    } catch (err) {
      downloadBtn.disabled = true;
      metaText.textContent = "未生成";
      setError(err instanceof Error ? err.message : "生成に失敗しました。");
    }
  });

  downloadBtn.addEventListener("click", () => {
    if (downloadBtn.disabled) return;

    const raw = (urlInput.value || "").trim();
    const text = getNormalizedText(raw);
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
