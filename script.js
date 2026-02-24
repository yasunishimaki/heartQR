// script.js
(() => {
  const form = document.getElementById("form");
  const urlInput = document.getElementById("urlInput");
  const colorSelect = document.getElementById("colorSelect");
  const heartColorSelect = document.getElementById("heartColorSelect");
  const bgPatternSelect = document.getElementById("bgPatternSelect");
  const bgPatternColorSelect = document.getElementById("bgPatternColorSelect");
  const sizeSelect = document.getElementById("sizeSelect");
  const errorEl = document.getElementById("error");
  const canvas = document.getElementById("qrCanvas");
  const ctx = canvas.getContext("2d");
  const downloadBtn = document.getElementById("downloadBtn");
  const metaText = document.getElementById("metaText");

  const ERROR_LEVEL = "H"; // 必須
  const BG = "#FFFFFF";    // 背景白固定
  const MAX_LEN = 300;

  // 余白（quiet zone）を広めに。ハートで欠損が増えるため安定性重視
  const QUIET = 8;

  // 角の位置検出パターンを壊さない保護領域（モジュール数）
  // 9 = finder(7) + separator(1) + マージン(1)
  const FINDER_PROTECT = 9;

  // 表現チューニング
  const LOOK = {
    // ドット（角丸四角）っぽさ
    dotScale: 0.82,      // 0.72〜0.90
    roundness: 0.40,     // 0〜0.5

    // ハート形（データ領域をハートに残す）
    heartSx: 0.95,
    heartSy: 1.12,
    heartYShift: 0.10,

    // ハート内判定を少し緩める（大きいほどハートが太る）
    heartExpand: 0.06,

    // ハートに寄せる強さ（小さいほどハートが大きくなる＝欠損増）
    heartSizeFactor: 0.92,

    // 背景柄を「データ領域の白セル」に入れるか（可愛いが読取リスク上がる）
    // ただし quiet zone と finder周辺は絶対に入れない
    patternInsideDataWhiteCells: true,

    // 外側余白（読み取りテスト想定）
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

  function isInFinderProtected(r, c, n) {
    const inTL = r < FINDER_PROTECT && c < FINDER_PROTECT;
    const inTR = r < FINDER_PROTECT && c >= (n - FINDER_PROTECT);
    const inBL = r >= (n - FINDER_PROTECT) && c < FINDER_PROTECT;
    return inTL || inTR || inBL;
  }

  // ハート方程式
  function heartValue(x, y) {
    const a = x * x + y * y - 1;
    return a * a * a - x * x * y * y * y;
  }

  function inHeart(nx, ny) {
    const x = nx / LOOK.heartSx;
    const y = (ny + LOOK.heartYShift) / LOOK.heartSy;
    return heartValue(x, y) <= LOOK.heartExpand;
  }

  // 角丸四角（ドット風）
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

  function drawPattern(type, color, sizePx, clipRect) {
    // clipRect: {x,y,w,h} ここにだけ柄を描く（QR全体 or QR外側など）
    const { x, y, w, h } = clipRect;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    ctx.fillStyle = color;
    ctx.strokeStyle = color;

    if (type === "none") {
      // 何もしない
    } else if (type === "dots") {
      const step = 14;
      const r = 1.6;
      for (let yy = y; yy < y + h; yy += step) {
        for (let xx = x; xx < x + w; xx += step) {
          ctx.beginPath();
          ctx.arc(xx + step / 2, yy + step / 2, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (type === "stripes") {
      const step = 18;
      ctx.lineWidth = 2;
      for (let i = -sizePx; i < sizePx * 2; i += step) {
        ctx.beginPath();
        ctx.moveTo(i, y);
        ctx.lineTo(i + sizePx, y + sizePx);
        ctx.stroke();
      }
    } else if (type === "grid") {
      const step = 18;
      ctx.lineWidth = 1.5;
      for (let xx = x; xx <= x + w; xx += step) {
        ctx.beginPath();
        ctx.moveTo(xx, y);
        ctx.lineTo(xx, y + h);
        ctx.stroke();
      }
      for (let yy = y; yy <= y + h; yy += step) {
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.lineTo(x + w, yy);
        ctx.stroke();
      }
    } else if (type === "noise") {
      // 軽いノイズ（紙っぽい）
      const img = ctx.getImageData(x, y, w, h);
      const data = img.data;
      for (let i = 0; i < data.length; i += 4) {
        const v = (Math.random() * 18) | 0; // 0..17
        // colorはrgba指定なので、ここは黒系ノイズに寄せる
        data[i] = Math.min(255, data[i] + v);
        data[i + 1] = Math.min(255, data[i + 1] + v);
        data[i + 2] = Math.min(255, data[i + 2] + v);
        // alphaはそのまま
      }
      ctx.putImageData(img, x, y);
    }

    ctx.restore();
  }

  function render(text, fgHex, heartHex, sizePx, patternType, patternColor) {
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

    const drawSize = moduleSize * (n + QUIET * 2);

    // 外側余白（読み取りテスト想定）
    const outer = Math.max(LOOK.outerPadMin, Math.floor(drawSize * LOOK.outerPadRatio));
    const finalSize = drawSize + outer * 2;

    clearWhite(finalSize);

    // まず背景柄を「全体」に薄く入れる（whiteを保ちつつ雰囲気）
    drawPattern(patternType, patternColor, finalSize, { x: 0, y: 0, w: finalSize, h: finalSize });

    // QR領域（quiet含む）を白で戻す（背景柄がquietに入ると読取に影響）
    const qrX = outer;
    const qrY = outer;
    ctx.fillStyle = BG;
    ctx.fillRect(qrX, qrY, drawSize, drawSize);

    // ただし「白セルにも柄を入れたい」場合は、後でデータ領域だけ薄く柄を入れる
    const dataX = outer + QUIET * moduleSize;
    const dataY = outer + QUIET * moduleSize;
    const dataSize = moduleSize * n;

    // オフスクリーンに「柄」を描いておき、白セルにだけ転写する
    let patternOff = null;
    if (LOOK.patternInsideDataWhiteCells && patternType !== "none") {
      patternOff = document.createElement("canvas");
      patternOff.width = finalSize;
      patternOff.height = finalSize;
      const pctx = patternOff.getContext("2d");
      pctx.fillStyle = BG;
      pctx.fillRect(0, 0, finalSize, finalSize);

      // ここではパターンを描画（本体と同じ見え方）
      // drawPatternはctx固定なので、ここだけローカル実装
      const tmp = ctx;
      // 擬似的に差し替え
      ctx = pctx; // eslint-disable-line no-func-assign
      drawPattern(patternType, patternColor, finalSize, { x: 0, y: 0, w: finalSize, h: finalSize });
      ctx = tmp; // eslint-disable-line no-func-assign
    }

    // モジュール描画オフセット
    const offset = outer + QUIET * moduleSize;

    // ハート判定中心
    const center = (n - 1) / 2;
    const sf = LOOK.heartSizeFactor;

    // 1) 先に「白セルに柄」を入れる（オプション）
    // 条件：quiet zoneは絶対禁止 / finder保護領域周辺も禁止
    if (patternOff) {
      // データ領域だけ走査して、白セルのみ薄柄を転写
      // finderの周りは見やすさのため禁止
      const ban = FINDER_PROTECT + 2;

      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const isDark = qr.isDark(r, c);
          if (isDark) continue;

          // finder近傍は柄禁止
          const nearTL = r < ban && c < ban;
          const nearTR = r < ban && c >= (n - ban);
          const nearBL = r >= (n - ban) && c < ban;
          if (nearTL || nearTR || nearBL) continue;

          const x0 = offset + c * moduleSize;
          const y0 = offset + r * moduleSize;

          // 白セルに、オフスクリーンの柄を小さく転写
          // ただし薄いだけなので視認性は保たれる
          ctx.drawImage(patternOff, x0, y0, moduleSize, moduleSize, x0, y0, moduleSize, moduleSize);
        }
      }

      // quiet zoneと外枠は白に戻す（万一の侵食対策）
      ctx.fillStyle = BG;
      // 上
      ctx.fillRect(qrX, qrY, drawSize, QUIET * moduleSize);
      // 下
      ctx.fillRect(qrX, qrY + drawSize - QUIET * moduleSize, drawSize, QUIET * moduleSize);
      // 左
      ctx.fillRect(qrX, qrY, QUIET * moduleSize, drawSize);
      // 右
      ctx.fillRect(qrX + drawSize - QUIET * moduleSize, qrY, QUIET * moduleSize, drawSize);
    }

    // 2) 黒セル（濃いセル）を、ハート色と通常色で描く
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;

        const protectedFinder = isInFinderProtected(r, c, n);

        // 色分け：finderは常にQR主色
        let useColor = fgHex;

        if (!protectedFinder) {
          // ハート内ならハート色、それ以外はQR主色（欠損を増やさず読取優先）
          const nx = ((c - center) / center) * sf;
          const ny = (-(r - center) / center) * sf;
          if (inHeart(nx, ny)) useColor = heartHex;
        }

        ctx.fillStyle = useColor;

        // ドット風描画
        const x0 = offset + c * moduleSize;
        const y0 = offset + r * moduleSize;

        const s = moduleSize * LOOK.dotScale;
        const pad = (moduleSize - s) / 2;
        const x = x0 + pad;
        const y = y0 + pad;

        // finderは少し角を立てて検出を助ける
        const isFinder = protectedFinder;
        const rr = (s * (isFinder ? Math.min(0.18, LOOK.roundness) : LOOK.roundness));

        roundRect(x, y, s, s, rr);
      }
    }

    // 3) 角の保護領域が柄や処理で影響を受けないように、finderだけ最後に上書き（安全策）
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        if (!isInFinderProtected(r, c, n)) continue;

        ctx.fillStyle = fgHex;

        const x0 = offset + c * moduleSize;
        const y0 = offset + r * moduleSize;

        const s = moduleSize * Math.min(0.92, LOOK.dotScale + 0.08);
        const pad = (moduleSize - s) / 2;
        const x = x0 + pad;
        const y = y0 + pad;
        const rr = s * 0.12;

        roundRect(x, y, s, s, rr);
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

  // 初期プレビュー
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
    const heartHex = heartColorSelect.value;
    const sizePx = parseInt(sizeSelect.value, 10);
    const patternType = bgPatternSelect.value;
    const patternColor = bgPatternColorSelect.value;

    try {
      const info = render(text, fgHex, heartHex, sizePx, patternType, patternColor);
      downloadBtn.disabled = false;
      metaText.textContent = `生成済み：${info.sizePx}px / modules=${info.modules} / level=H / bg=white`;
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
