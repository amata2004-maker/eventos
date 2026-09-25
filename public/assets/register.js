// Formulario de registro de la página pública /e/<slug>.
(function () {
  const form = document.getElementById("reg");
  if (!form) return;
  const msg = form.querySelector(".msg");
  const btn = form.querySelector("button");
  const done = document.getElementById("done");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    payload.slug = form.dataset.slug;
    if (!payload.name.trim()) return (msg.textContent = "Escribe tu nombre.");
    if (!/^\S+@\S+\.\S{2,}$/.test(payload.email.trim())) return (msg.textContent = "Escribe un correo válido.");
    btn.disabled = true;
    btn.textContent = "Registrando…";
    try {
      const r = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "No se pudo completar el registro.");
      form.hidden = true;
      done.hidden = false;
      if (data.ticket_url) {
        done.innerHTML = '¡Listo, tu lugar está reservado! 🎉<br><span class="small">Te enviamos la confirmación a tu correo.</span>';
        const a = document.createElement("a");
        a.href = data.ticket_url;
        a.className = "btn big";
        a.textContent = "Ver mi boleto";
        done.appendChild(a);
      } else {
        done.textContent = "Ya estabas registrado con ese correo. Te reenviamos tu boleto — revisa tu bandeja (y spam).";
      }
    } catch (err) {
      msg.textContent = err.message;
      btn.disabled = false;
      btn.textContent = "Registrarme gratis";
    }
  });
})();
