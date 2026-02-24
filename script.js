// script.js
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

  // ---- 固定仕様 ----
  const ERROR_LEVEL = "H";        // 必ずH
  const BG_COLOR = "#FFFFFF";     // 背景は白固定
  const MAX_LEN = 300;

  // 余白（quiet zone）を十分に確保：標準4モジュール + 追加で余裕
  const QUIET_ZONE_MODULES = 8;

  // finder patterns（位置検出）を壊さないための保護領域（9x9推奨：7x7 + セパレータ）
  const FINDER_PROTECT = 9;

  // タイミングパターンも保護（安全寄り）
  const PROTECT_TIMING = true;

  // URLバリデーション（必須／最大300／形式ざっくり）
  function validateUrl(input) {
    const v = (input || "").trim();
    if (!v) return { ok: false, msg: "URLを入力してください。" };
    if (v.length > MAX_LEN) return { ok: false, msg: `URLは最大${MAX_LEN}文字までです。` };

    // 厳密にやりすぎない（QR用途なので）
    // ただし type=url のバリデーションだけだと空文字等を通す可能性があるので補助
    try {
      // 例: example.com だけだとURL()が落ちるので https を補って試す
      const test = v.includes("://") ? v : `https://${v}`;
      // eslint-disable-next-line no-new
      new URL(test);
    } catch {
      return { ok: false, msg: "URL形式が正しくありません。（例：https://example.com）" };
    }
    return { ok: true, msg: "" };
  }

  // ハート領域判定（モジュール座標 -> 正規化してハート方程式）
  // (x^2 + y^2 - 1)^3 - x^2*y^3 <= 0
  function isInHeart(nx, ny) {
    const x = nx;
    const y = ny;
    const a = x * x + y * y - 1;
    const v = a * a * a - x * x * y * y * y;
    return v <= 0;
  }

  // finder保護領域判定（r,c は 0..N-1）
  function isInFinderProtected(r, c, n) {
    const inTL = r < FINDER_PROTECT && c < FINDER_PROTECT;
    const inTR = r < FINDER_PROTECT && c >= (n - FINDER_PROTECT);
    const inBL = r >= (n - FINDER_PROTECT) && c < FINDER_PROTECT;
    return inTL || inTR || inBL;
  }

  function isTimingProtected(r, c) {
    return (r === 6 || c === 6);
  }

  function clearCanvasToWhite(sizePx) {
    canvas.width = sizePx;
    canvas.height = sizePx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, sizePx, sizePx);
  }

  // QRを生成して描画（ハートマスク：finderは保持）
  function renderQrHeart(text, colorHex, sizePx) {
    if (typeof window.qrcode !== "function") {
      throw new Error("QRライブラリの読み込みに失敗しました。ネットワーク環境を確認してください。");
    }

    // 生成（型番号0 = 自動）
    const qr = window.qrcode(0, ERROR_LEVEL);
    qr.addData(text);
    qr.make();

    const n = qr.getModuleCount();

    // 1モジュールのピクセルサイズを決める
    // 「n + quietZone*2」がsizePxに収まるように（整数）
    const moduleSize = Math.floor(sizePx / (n + QUIET_ZONE_MODULES * 2));
    if (moduleSize < 2) {
      throw new Error("出力サイズが小さすぎます。サイズを大きくしてください。");
    }

    // 実際の描画サイズ（端数を避ける）
    const drawSize = moduleSize * (n + QUIET_ZONE_MODULES * 2);
    const offset = moduleSize * QUIET_ZONE_MODULES;

    clearCanvasToWhite(drawSize);

    // 心臓（ハート）をQRの「データ領域」にフィットさせるための正規化範囲
    // 角のfinderを残すため、中心寄りに収める（scaleFactor を小さくするほどハートが大きく見える）
    const center = (n - 1) / 2;

    // finder領域の外からハート判定を行うため、ハートを少し大きめに
    // 値を上げるとハートが小さくなる。下げると大きくなる。
    const scaleFactor = 0.95;

    // まずは「通常のQR情報」をベースに描画しつつ、
    // finder以外は「ハート外」を白で潰す（= マスク処理）。
    // ※背景白固定／中央ロゴなし
    ctx.fillStyle = colorHex;

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const dark = qr.isDark(r, c);

        // デフォルトは「QRのモジュール通りに描画」だが、
        // finder(＋セパレータ)は絶対保持
        const protectedFinder = isInFinderProtected(r, c, n);
        const protectedTiming = PROTECT_TIMING && isTimingProtected(r, c);

        let keepAsIs = protectedFinder || protectedTiming;

        if (!keepAsIs) {
          // 正規化座標: [-1, 1] 近辺に収める
          // yは上が-なのでハートが上向きになるよう調整（ny を反転）
          const nx = ((c - center) / center) * scaleFactor;
          const ny = (-(r - center) / center) * scaleFactor;

          // ハート外なら「白で潰す」＝情報を減らすが、訂正レベルHで耐える設計
          // ただし quiet zone（そもそも描画していない）には影響なし
          const inHeart = isInHeart(nx, ny);
          keepAsIs = inHeart;
        }

        // keepAsIs=false の場合は背景白のまま（描画しない）
        if (keepAsIs && dark) {
          const x = offset + c * moduleSize;
          const y = offset + r * moduleSize;
          ctx.fillRect(x, y, moduleSize, moduleSize);
        }
      }
    }

    // さらに「読み取りテスト想定で十分な余白」を強化（外周の白枠）
    // 画像外枠に少し余白（ピクセル）を足したいので、追加キャンバスに載せ替え
    const extraPadPx = Math.max(12, Math.floor(drawSize * 0.04)); // 4% or min 12px
    const finalSize = drawSize + extraPadPx * 2;

    const tmp = document.createElement("canvas");
    tmp.width = finalSize;
    tmp.height = finalSize;
    const tctx = tmp.getContext("2d");
    tctx.fillStyle = BG_COLOR;
    tctx.fillRect(0, 0, finalSize, finalSize);
    tctx.drawImage(canvas, extraPadPx, extraPadPx);

    // 反映
    canvas.width = finalSize;
    canvas.height = finalSize;
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, finalSize, finalSize);
    ctx.drawImage(tmp, 0, 0);

    return { moduleCount: n, moduleSize, sizePx: finalSize };
  }

  function setError(msg) {
    errorEl.textContent = msg || "";
  }

  function getNormalizedText(raw) {
    const v = (raw || "").trim();
    // 形式補正：スキームがなければ https:// を補う（QR用途として便利）
    if (!v) return v;
    if (v.includes("://")) return v;
    return `https://${v}`;
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

  // 初期：白キャンバス
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
    // URL未入力や未生成の状態で押せないようdisabledにしているが、念のため
    if (downloadBtn.disabled) return;

    // ファイル名はドメインっぽく（安全な文字だけ）
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

  // レスポンシブ：表示サイズはCSSで制御。生成サイズは選択式。
  // 文字数カウンタ的なエラー（300超）を入力中に軽く補助
  urlInput.addEventListener("input", () => {
    const v = urlInput.value || "";
    if (v.length > MAX_LEN) {
      setError(`URLは最大${MAX_LEN}文字までです。`);
    } else if (errorEl.textContent) {
      // 入力し始めたらエラーを薄く消す
      setError("");
    }
  });
})();
