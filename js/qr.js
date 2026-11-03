/**
 * QR helpers using the QRCode CDN library.
 */
(function (global) {
  function ensureLib() {
    if (!global.QRCode) throw new Error("QRCode library not loaded");
  }

  async function toCanvas(text, size) {
    ensureLib();
    const canvas = document.createElement("canvas");
    await global.QRCode.toCanvas(canvas, text, {
      width: size || 220,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    });
    return canvas;
  }

  async function toDataURL(text, size) {
    ensureLib();
    return global.QRCode.toDataURL(text, {
      width: size || 512,
      margin: 2,
      color: { dark: "#0f172a", light: "#ffffff" },
    });
  }

  function downloadDataUrl(dataUrl, filename) {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename || "pawsforward-qr.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  global.PfQr = { toCanvas, toDataURL, downloadDataUrl };
})(window);
