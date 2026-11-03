/**
 * QR helpers — uses a remote QR image API (no third-party script).
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

  async function toCanvas(text, size) {
    const img = await loadImage(qrImageUrl(text, size || 220));
    const canvas = document.createElement("canvas");
    const dim = size || 220;
    canvas.width = dim;
    canvas.height = dim;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, dim, dim);
    ctx.drawImage(img, 0, 0, dim, dim);
    return canvas;
  }

  async function toDataURL(text, size) {
    const canvas = await toCanvas(text, size || 512);
    return canvas.toDataURL("image/png");
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not load QR image"));
      img.src = src;
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

  global.PfQr = { toCanvas, toDataURL, downloadDataUrl, qrImageUrl };
})(window);
