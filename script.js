// script.js（ハート型クリッピングマスク方式：外側は白、角は必ず守る）
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
  const BG_COLOR = "#FFFFFF";
  const MAX_LEN = 300;

  // 読み取りのための余白（quiet zone）
  // ハートで外周を削るので、ここは広めが安定
  const QUIET_ZONE_MODULES = 8;

  // 角（位置検出パターン）を壊さないための保護領域
  // 9 = finder(7) + separator(1) + 安全マージン(1)
  const FINDER_PROTECT = 9;

  // ハート形状チューニング（まずはこれで様子を見る）
  const HEART = {
    // ハートを縦長にするとハートっぽく見える
    sx: 0.95,
    sy: 1.12,
    // 少し上に寄せると下の尖りが出る
    yShift: 0.10,
    // ハートを少し大きめに（小さくすると丸っこくなる）
    scale: 1.02,
    // クリップ境界を少しだけ外側へ（見た目の輪郭が出る）
    expand: 0.10,
  };

  // ハート方程式： (x^2 + y^2 - 1)^3 - x^2*y^3 <= 0
  function heartValue(x, y) {
    const a = x * x + y * y - 1;
    return a * a * a - x * x * y * y * y;
  }

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
    if (v.includes("://")) return v;
    return `https://${v}`;
  }

  function clearToWhite(sizePx) {
    canvas.width = sizePx;
    canvas.height = sizePx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, sizePx, sizePx);
  }

  function isInFinderProtected(r, c, n) {
    const inTL = r < FINDER_PROTECT && c < FINDER_PROTECT;
    const inTR = r < FINDER_PROTECT && c >= (n - FINDER_PROTECT);
    const inBL = r >= (n - FINDER_PROTECT) && c < FINDER_PROTECT;
    return inTL || inTR || inBL;
  }

  function makeQrMatrix(text) {
    if (typeof window.qrcode !== "function") {
      throw new Error("QRライブラリの読み込みに失敗しました。");
    }
    const qr = window.qrcode(0, ERROR_LEVEL);
    qr.addData(text);
    qr.make();

    const n = qr.getModuleCount();
    const m = new Array(n);
    for (let r = 0; r < n; r++) {
      m[r] = new Array(n);
      for (let c = 0; c < n; c++) {
        m[r][c] = qr.isDark(r, c);
      }
    }
    return { n, matrix: m };
  }

  function drawQrToCanvas(targetCtx, matrix, n, moduleSize, offsetPx, fgHex) {
    targetCtx.fillStyle = fgHex;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!matrix[r][c]) continue;
        const x = offsetPx + c * moduleSize;
        const y = offsetPx + r * moduleSize;
        targetCtx.fillRect(x, y, moduleSize, moduleSize);
      }
    }
  }

  function heartClipPath(c, sizePx) {
    // 正規化座標でハートを描く（-1..1）
    const steps = 240;
    const pts = [];

    // ハート領域をスキャンして輪郭点っぽく作るのではなく
    // parametricで滑らかなパスを作る（見た目が綺麗）
    // ただし式ベースの方が安定なので、ここは簡易に「円弧2つ＋下尖り」で作る
    // 見た目優先で十分ハートに見える
    const cx = sizePx / 2;
    const cy = sizePx / 2;

    const s = (sizePx / 2) * HEART.scale;

    // ハートパス（ベジエで滑らかに）
    c.beginPath();
    c.moveTo(cx, cy + s * 0.55);

    c.bezierCurveTo(
      cx - s * 0.95, cy + s * 0.10,
      cx - s * 0.90, cy - s * 0.60,
      cx,            cy - s * 0.20
    );
    c.bezierCurveTo(
      cx + s * 0.90, cy - s * 0.60,
      cx + s * 0.95, cy + s * 0.10,
      cx,            cy + s * 0.55
    );
    c.closePath();

    // 位置調整（少し上寄せ）
    // clipの前に変換を掛ける
  }

  function renderHeartMaskedQr(text, fgHex, sizePx) {
    // 1) QR行列を作る
    const { n, matrix } = makeQrMatrix(text);

    // 2) moduleSize決定
    // キャンバスサイズ内に quiet zone 込みで収める
    const moduleSize = Math.floor(sizePx / (n + QUIET_ZONE_MODULES * 2));
    if (moduleSize < 2) {
      throw new Error("出力サイズが小さすぎます。サイズを大きくしてください。");
    }

    // 実際に描くQRの全体サイズ（quiet zone含む）
    const qrAllSize = moduleSize * (n + QUIET_ZONE_MODULES * 2);

    // 出力canvasは「qrAllSize + 周囲余白」を確保（読み取り試験用）
    const extraOuter = Math.max(24, Math.floor(qrAllSize * 0.08));
    const finalSize = qrAllSize + extraOuter * 2;

    clearToWhite(finalSize);

    // 中央にQR配置
    const qx = extraOuter;
    const qy = extraOuter;
    const offsetPx = extraOuter + QUIET_ZONE_MODULES * moduleSize;

    // 3) オフスクリーンに「正規QR（正方形）」を描く
    const off = document.createElement("canvas");
    off.width = finalSize;
    off.height = finalSize;
    const octx = off.getContext("2d");
    octx.fillStyle = BG_COLOR;
    octx.fillRect(0, 0, finalSize, finalSize);

    // quiet zone含む外枠は白、データ部だけ描く
    drawQrToCanvas(octx, matrix, n, moduleSize, offsetPx, fgHex);

    // 4) 出力にハートクリップして描画
    // まず白で塗ってから、ハート内だけQRを転写
    ctx.save();
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, finalSize, finalSize);

    // クリップパス（上寄せ・縦長補正）
    ctx.translate(0, -finalSize * 0.04); // 少し上へ
    ctx.scale(HEART.sx, HEART.sy);

    // スケールで座標がズレるので、逆補正
    ctx.translate((finalSize * (1 - HEART.sx)) / (2 * HEART.sx), (finalSize * (1 - HEART.sy)) / (2 * HEART.sy));

    // ハートパス作成
    heartClipPath(ctx, finalSize);

    ctx.clip();

    // クリップ内にオフスクリーンQRを描く
    ctx.drawImage(off, 0, 0);

    ctx.restore();

    // 5) Finder領域を「必ず復元」する（クリップで欠けた可能性を潰す）
    // Finder + 周辺マージンを復元することで読み取り安定
    const protectPx = FINDER_PROTECT * moduleSize;

    // TL
    ctx.drawImage(off, 0, 0, protectPx, protectPx, 0, 0, protectPx, protectPx);
    // TR
    ctx.drawImage(off, finalSize - protectPx, 0, protectPx, protectPx, finalSize - protectPx, 0, protectPx, protectPx);
    // BL
    ctx.drawImage(off, 0, finalSize - protectPx, protectPx, protectPx, 0, finalSize - protectPx, protectPx, protectPx);

    // 6) さらに「quiet zone」は白が必須なので、ハート外周で侵食していないか保険
    // 今回は off を転写しているので quiet zone は基本守られるが、
    // Finder復元後に周囲を白で整える（最外周だけ）
    ctx.fillStyle = BG_COLOR;
    // 最外周1モジュール分の白枠
    const rim = moduleSize;
    ctx.fillRect(0, 0, finalSize, rim);
    ctx.fillRect(0, finalSize - rim, finalSize, rim);
    ctx.fillRect(0, 0, rim, finalSize);
    ctx.fillRect(finalSize - rim, 0, rim, finalSize);

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

  // 初期キャンバス
  clearToWhite(parseInt(sizeSelect.value, 10));

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
    const colorHex = colorSelect.value;
    const sizePx = parseInt(sizeSelect.value, 10);

    try {
      const info = renderHeartMaskedQr(text, colorHex, sizePx);
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
