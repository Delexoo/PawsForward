(function () {
  var origin = "https://joinpawsforward.com";
  var donate = document.getElementById("qr-donate");
  var join = document.getElementById("qr-join");
  var printBtn = document.getElementById("print-btn");

  if (window.PfQr) {
    if (donate) window.PfQr.renderInto(donate, origin + "/donate", 168);
    if (join) window.PfQr.renderInto(join, origin + "/join", 168);
  }

  if (printBtn) {
    printBtn.addEventListener("click", function () {
      window.print();
    });
  }
})();
