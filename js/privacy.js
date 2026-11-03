(function () {
  const form = document.getElementById("deletion-form");
  const emailEl = document.getElementById("del-email");
  const detailsEl = document.getElementById("del-details");
  const errEmail = document.getElementById("err-del-email");
  const status = document.getElementById("del-status");
  const submit = document.getElementById("del-submit");

  function setStatus(msg, kind) {
    if (!status) return;
    if (!msg) {
      status.hidden = true;
      status.textContent = "";
      return;
    }
    status.hidden = false;
    status.textContent = msg;
    status.classList.toggle("is-ok", kind === "ok");
    status.classList.toggle("is-err", kind === "err");
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    errEmail.hidden = true;
    errEmail.textContent = "";
    setStatus("");

    const email = String(emailEl.value || "").trim();
    if (!email || !email.includes("@")) {
      errEmail.hidden = false;
      errEmail.textContent = "Enter a valid email so we can follow up.";
      return;
    }

    const sb = window.SiteSupabase.getClient();
    if (!sb) {
      setStatus("Could not reach the server. Email privacy@pawsforward.org instead.", "err");
      return;
    }

    submit.disabled = true;
    const { error } = await sb.from("data_deletion_requests").insert({
      email,
      details: String(detailsEl.value || "").trim() || null,
    });
    submit.disabled = false;

    if (error) {
      setStatus(error.message || "Could not submit. Email privacy@pawsforward.org.", "err");
      return;
    }

    form.reset();
    setStatus("Request received. We will follow up at that email.", "ok");
  });
})();
