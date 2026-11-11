/* Netrapal: small, dependency-free script (CSP-friendly: no inline code). */
(function () {
  "use strict";

  document.documentElement.classList.add("js");

  var year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Mobile nav ---------- */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        nav.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- Contact form ---------- */
  var form = document.getElementById("contact-form");
  if (!form) return;

  var statusEl = document.getElementById("form-status");
  var tsEl = document.getElementById("turnstile");
  var button = form.querySelector("button[type=submit]");
  var widgetId = null;
  var tsRequested = false;

  function setStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  // Load Cloudflare Turnstile only when the visitor gets near the form,
  // so it costs nothing for people who never scroll that far.
  function loadTurnstile() {
    if (tsRequested) return;
    tsRequested = true;
    var s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = function () {
      widgetId = window.turnstile.render(tsEl, { sitekey: tsEl.getAttribute("data-sitekey") });
    };
    s.onerror = function () {
      setStatus("The spam check could not be loaded. Please reload the page and try again.", "error");
    };
    document.head.appendChild(s);
  }

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries.some(function (e) { return e.isIntersecting; })) {
        loadTurnstile();
        io.disconnect();
      }
    }, { rootMargin: "400px" });
    io.observe(form);
  } else {
    loadTurnstile();
  }
  form.addEventListener("focusin", loadTurnstile);

  var EMAIL_RE = /^[^\s@<>,;"]+@[^\s@<>,;"]+\.[^\s@<>,;"]+$/;

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    setStatus("", "");

    var data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      company: form.company.value.trim(),
      message: form.message.value.trim(),
      website: form.website.value, // honeypot
      token: ""
    };

    if (!data.name || !data.message) {
      setStatus("Please fill in your name and a message.", "error");
      return;
    }
    if (!EMAIL_RE.test(data.email)) {
      setStatus("Please enter a valid email address.", "error");
      return;
    }
    if (window.turnstile && widgetId !== null) {
      data.token = window.turnstile.getResponse(widgetId) || "";
    }
    if (!data.token) {
      setStatus("Please complete the spam check and try again.", "error");
      return;
    }

    button.disabled = true;
    setStatus("Sending...", "");

    fetch(form.getAttribute("action"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          if (!res.ok) throw new Error(body.error || "Something went wrong.");
        });
      })
      .then(function () {
        form.reset();
        setStatus("Thank you. Your message has been sent and we will be in touch soon.", "ok");
      })
      .catch(function (err) {
        setStatus(err.message || "Could not send your message. Please try again.", "error");
      })
      .then(function () {
        button.disabled = false;
        if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
      });
  });
})();
