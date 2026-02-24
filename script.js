// script.js（ドットだけでハートを見せる版：QRは規格通り、外側にドットハート）
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

  const ERROR_LEVEL = "H";
  const BG = "#FFFFFF";
  const MAX_LEN = 300;

  // quiet zoneはQR規格的に4モジュール以上。読み取り安定のため広め。
  const QUIET_ZONE_MODULES = 8;

  // QR描画サイズ（キャンバスに対する割合）
  // 小さくすると周りにハートが見えやすい
  const QR_SCALE = 0.72;

  // ドット設定
  const DOT = {
    // 1モジュールに対するドット直径比（0.70〜0.92推奨）
    fillRatio: 0.86,
    // Finderのドット比（少し大きめにして検出を助ける）
    finderRatio: 0.92,
  };

  // 外側のドットハート設定（全部ドット）
  const HEART = {
    // ハートはQRの外側に描く。quiet zoneの外から開始。
    // dotPaddingModules を増やすほどQRから離れて「別物感」が出る。
    dotPaddingModules: 2,

    // ハート形状の縦横比と位置
    sx: 0.95,
    sy: 1.10,
    yShift: 0.08,

    // ハートを「輪郭」だけにするなら outlineOnly=true
    // かわいくするなら輪郭＋少し内側も入れる（false）
    outlineOnly: false,

    // 濃さ（0.10〜0.28推奨）。濃すぎると主役がQRからズレる
    alpha: 0.20,

    // 輪郭の太さ（outlineOnly=falseでも輪郭を強められる）
    outlineAlpha: 0.28,
  };

  function setError(msg) { errorEl.textContent = msg || ""; }

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

  function hexToRgba(hex, a) {
    const h = hex.replace("#", "").trim();
    const full = h.length === 3 ? h.split("").map(ch => ch + ch).join("") : h;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function clearWhite(size) {
    canvas.width = size;
    canvas.height = size;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, size, size);
  }

  // ハート方程式
  function heartValue(x, y) {
    const a = x * x + y * y - 1;
    return a * a * a - x * x * y * y * y;
  }
  function inHeart(nx, ny) {
    const x = nx / HEART.sx;
    const y = (ny + HEART.yShift) / HEART.sy;
    return heartValue(x, y) <= 0;
  }

  // 近傍で境界判定（輪郭にする）
  function isHeartBoundary(nx, ny, step) {
    if (!inHeart(nx, ny)) return false;
    // 周りに外があれば境界
    const dirs = [
      [ step, 0], [-step, 0], [0, step], [0,-step],
      [ step, step], [ step,-step], [-step, step], [-step,-step],
    ];
    for (const [dx, dy] of dirs) {
      if (!inHeart(nx + dx, ny + dy)) return true;
    }
    return false;
  }

  function drawDot(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function render(text, fgHex, canvasSize) {
    if (typeof window.qrcode !== "function") {
      throw new Error("QRライブラリの読み込みに失敗しました。");
    }

    // QR生成
    const qr = window.qrcode(0, ERROR_LEVEL);
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();

    // QR描画領域
    const qrTarget = Math.floor(canvasSize * QR_SCALE);

    // moduleSize
    const moduleSize = Math.floor(qrTarget / (n + QUIET_ZONE_MODULES * 2));
    if (moduleSize < 2) throw new Error("出力サイズが小さすぎます。サイズを上げてください。");

    const qrDrawSize = moduleSize * (n + QUIET_ZONE_MODULES * 2);
    const qx = Math.floor((canvasSize - qrDrawSize) / 2);
    const qy = Math.floor((canvasSize - qrDrawSize) / 2);
    const offset = QUIET_ZONE_MODULES * moduleSize;

    clearWhite(canvasSize);

    // 1) 外側にドットハートを描く（quiet zoneの外だけ）
    // グリッド感を合わせるため、同じ moduleSize の格子点にドットを置く
    const cols = Math.floor(canvasSize / moduleSize);
    const rows = Math.floor(canvasSize / moduleSize);
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    const sx = cx;
    const sy = cy;

    const heartColor = hexToRgba(fgHex, HEART.alpha);
    const outlineColor = hexToRgba(fgHex, HEART.outlineAlpha);

    // QRの「絶対白領域」 = quiet zone込みの正方形
    // ここにはハートのドットを置かない
    const qrWhiteLeft = qx;
    const qrWhiteTop = qy;
    const qrWhiteRight = qx + qrDrawSize;
    const qrWhiteBottom = qy + qrDrawSize;

    // quiet zoneの外に少し間を空ける
    const extra = HEART.dotPaddingModules * moduleSize;
    const safeLeft = qrWhiteLeft - extra;
    const safeTop = qrWhiteTop - extra;
    const safeRight = qrWhiteRight + extra;
    const safeBottom = qrWhiteBottom + extra;

    const dotR = (moduleSize * DOT.fillRatio) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = c * moduleSize + moduleSize / 2;
        const py = r * moduleSize + moduleSize / 2;

        // QRの近辺（quiet zone周辺）を避けて、混線しないようにする
        if (px >= safeLeft && px <= safeRight && py >= safeTop && py <= safeBottom) continue;

        const nx = (c - cx) / sx;
        const ny = -((r - cy) / sy);

        if (!inHeart(nx, ny)) continue;

        if (HEART.outlineOnly) {
          const step = 1 / Math.max(sx, sy) * 2.2;
          if (isHeartBoundary(nx, ny, step)) drawDot(px, py, dotR, outlineColor);
        } else {
          // 輪郭は少し濃く、内側は薄く
          const step = 1 / Math.max(sx, sy) * 2.2;
          const boundary = isHeartBoundary(nx, ny, step);
          drawDot(px, py, dotR, boundary ? outlineColor : heartColor);
        }
      }
    }

    // 2) QRのquiet zone領域は真っ白で確保（ハートが入り込まないように）
    ctx.fillStyle = BG;
    ctx.fillRect(qrWhiteLeft, qrWhiteTop, qrDrawSize, qrDrawSize);

    // 3) QR本体を「ドット」で描く（四角は使わない）
    const dotColor = fgHex;

    // Finder領域判定（7x7 + separatorの周辺は描き分け）
    const isFinderArea = (rr, cc) => {
      const inTL = rr < 9 && cc < 9;
      const inTR = rr < 9 && cc >= (n - 9);
      const inBL = rr >= (n - 9) && cc < 9;
      return inTL || inTR || inBL;
    };

    for (let rr = 0; rr < n; rr++) {
      for (let cc = 0; cc < n; cc++) {
        if (!qr.isDark(rr, cc)) continue;

        const px = qx + offset + cc * moduleSize + moduleSize / 2;
        const py = qy + offset + rr * moduleSize + moduleSize / 2;

        const ratio = isFinderArea(rr, cc) ? DOT.finderRatio : DOT.fillRatio;
        const rDot = (moduleSize * ratio) / 2;

        drawDot(px, py, rDot, dotColor);
      }
    }

    return { modules: n, moduleSize, size: canvasSize };
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

  // 初期表示
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
    const size = parseInt(sizeSelect.value, 10);

    try {
      const info = render(text, fgHex, size);
      downloadBtn.disabled = false;
      metaText.textContent = `生成済み：${info.size}px / modules=${info.modules} / level=H`;
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
