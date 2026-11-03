/**
 * QR helpers — uses local vendor QRCode (browser UMD), with img fallback.
 */
(function (global) {
  function qrImageUrl(text, size) {
    const s = size || 220;
    return (
      "https://api.qrserver.com/v1/create-qr-code/?size=" +
      s +
      "x" +
      s +
      "&margin=8&data=" +
      encodeURIComponent(text)
    );
  }

  function getLib() {
    return global.QRCode || global.qrcode || null;
  }

  async function toCanvas(text, size) {
    const dim = size || 220;
    const lib = getLib();
    if (!lib || typeof lib.toCanvas !== "function") {
      throw new Error("QR library not loaded");
    }
    const canvas = document.createElement("canvas");
    await new Promise((resolve, reject) => {
      lib.toCanvas(
        canvas,
        String(text || ""),
        {
          width: dim,
          margin: 2,
          color: { dark: "#0f172a", light: "#ffffff" },
          errorCorrectionLevel: "M",
        },
        (err) => (err ? reject(err) : resolve())
      );
    });
    return canvas;
  }

  async function toDataURL(text, size) {
    const lib = getLib();
    if (lib && typeof lib.toDataURL === "function") {
      return await new Promise((resolve, reject) => {
        lib.toDataURL(
          String(text || ""),
          {
            width: size || 512,
            margin: 2,
            color: { dark: "#0f172a", light: "#ffffff" },
            errorCorrectionLevel: "M",
          },
          (err, url) => (err ? reject(err) : resolve(url))
        );
      });
    }
    const canvas = await toCanvas(text, size || 512);
    return canvas.toDataURL("image/png");
  }

  async function renderInto(host, text, size) {
    if (!host) throw new Error("Missing QR host");
    host.innerHTML = "";
    try {
      const canvas = await toCanvas(text, size || 220);
      host.appendChild(canvas);
      return { mode: "canvas", canvas };
    } catch (err) {
      console.warn("QR canvas failed, using image fallback", err);
      const img = document.createElement("img");
      img.width = size || 220;
      img.height = size || 220;
      img.alt = "QR code";
      img.decoding = "async";
      img.src = qrImageUrl(text, size || 220);
      host.appendChild(img);
      await new Promise((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Could not load QR image"));
      });
      return { mode: "img", img };
    }
  }

  function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename || "pawsforward-qr.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  global.PfQr = { toCanvas, toDataURL, downloadDataUrl, qrImageUrl, renderInto };
})(window);
