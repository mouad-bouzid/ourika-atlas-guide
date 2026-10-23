/* Fjelvik — one small vanilla script. No dependencies. */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Toast ---------------------------------------------------------------- */
  const toastEl = $(".toast");
  let toastTimer;
  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastEl.hidden = true; }, 3600);
  }

  /* Header: transparent over a photo, solid once scrolled ---------------- */
  const header = $(".header");
  if (header && header.dataset.header === "photo") {
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* Mobile menu — click/keyboard only, never hover ----------------------- */
  const burger = $(".burger");
  const nav = $("#site-nav");
  if (burger && nav) {
    const setOpen = (open) => {
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      document.body.classList.toggle("menu-open", open);
    };
    burger.addEventListener("click", () => setOpen(burger.getAttribute("aria-expanded") !== "true"));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && document.body.classList.contains("menu-open")) {
        setOpen(false);
        burger.focus();
      }
    });
    $$("a", nav).forEach((a) => a.addEventListener("click", () => setOpen(false)));
    window.matchMedia("(min-width: 961px)").addEventListener("change", (e) => { if (e.matches) setOpen(false); });
  }

  /* Booking panel: tabs + dates + guests --------------------------------- */
  $$("[data-booking]").forEach((panel) => {
    const tabs = $$('[role="tab"]', panel);
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        $("#" + t.getAttribute("aria-controls")).hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => select(tab, false));
      tab.addEventListener("keydown", (e) => {
        const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!step) return;
        e.preventDefault();
        select(tabs[(i + step + tabs.length) % tabs.length], true);
      });
    });

    // Default the dates to a week-long trip starting a fortnight from today.
    const iso = (d) => d.toISOString().slice(0, 10);
    const today = new Date();
    const start = new Date(today.getTime() + 14 * 864e5);
    const end = new Date(start.getTime() + 7 * 864e5);
    $$('input[type="date"]', panel).forEach((input) => {
      input.min = iso(today);
      if (!input.value) input.value = iso(input.dataset.date === "end" ? end : start);
    });
    $$("[data-date-pair]", panel).forEach((pair) => {
      const [a, b] = $$('input[type="date"]', pair);
      if (!a || !b) return;
      a.addEventListener("change", () => {
        b.min = a.value;
        if (b.value < a.value) b.value = a.value;
      });
    });

    $$("[data-stepper]", panel).forEach((stepper) => {
      const out = $("output", stepper);
      const min = Number(stepper.dataset.min || 1);
      const max = Number(stepper.dataset.max || 12);
      // The count lives in data-count: an <output>'s .value is its text ("4 people"), not a number.
      $$("button", stepper).forEach((btn) => btn.addEventListener("click", () => {
        const current = Number(out.dataset.count) || min;
        const next = Math.min(max, Math.max(min, current + Number(btn.dataset.step)));
        out.dataset.count = String(next);
        out.textContent = `${next} ${next === 1 ? "person" : "people"}`;
      }));
    });

    panel.addEventListener("submit", (e) => {
      e.preventDefault();
      const active = tabs.find((t) => t.getAttribute("aria-selected") === "true");
      toast(`${active ? active.textContent.trim() : "Trip"} search is a demo — wire this form to your booking engine.`);
    });
  });

  /* Tours: filter chips, price cap, sort --------------------------------- */
  const grid = $("[data-tour-grid]");
  if (grid) {
    const cards = $$(".tcard", grid);
    const count = $("[data-tour-count]");
    const empty = $("[data-tour-empty]");
    const chips = $$("[data-kind-chip]");
    const cap = $("[data-price-cap]");
    const capOut = $("[data-price-out]");
    const sort = $("[data-sort]");
    cards.forEach((c, i) => { c.dataset.order = i; });

    const apply = () => {
      const kind = (chips.find((c) => c.getAttribute("aria-pressed") === "true") || {}).dataset?.kindChip || "all";
      const max = cap ? Number(cap.value) : Infinity;
      if (capOut) capOut.textContent = `$${max.toLocaleString("en-US")}`;
      let shown = 0;
      cards.forEach((c) => {
        const ok = (kind === "all" || c.dataset.kind === kind) && Number(c.dataset.price) <= max;
        c.hidden = !ok;
        if (ok) shown += 1;
      });
      const key = sort ? sort.value : "featured";
      const by = {
        featured: (a, b) => a.dataset.order - b.dataset.order,
        "price-asc": (a, b) => a.dataset.price - b.dataset.price,
        "price-desc": (a, b) => b.dataset.price - a.dataset.price,
        days: (a, b) => a.dataset.days - b.dataset.days,
      }[key];
      cards.slice().sort(by).forEach((c) => grid.appendChild(c));
      if (count) count.textContent = `${shown} ${shown === 1 ? "tour" : "tours"}`;
      if (empty) empty.hidden = shown > 0;
    };

    chips.forEach((chip) => chip.addEventListener("click", () => {
      chips.forEach((c) => c.setAttribute("aria-pressed", String(c === chip)));
      apply();
    }));
    cap?.addEventListener("input", apply);
    sort?.addEventListener("change", apply);
    $("[data-tour-reset]")?.addEventListener("click", () => {
      chips.forEach((c, i) => c.setAttribute("aria-pressed", String(i === 0)));
      if (cap) cap.value = cap.max;
      apply();
    });
    apply();
  }

  /* Accordion (itinerary, FAQ) ------------------------------------------- */
  $$("[data-accordion] .acc__btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!open));
      $("#" + btn.getAttribute("aria-controls")).hidden = open;
    });
  });

  /* Tour gallery thumbnails ---------------------------------------------- */
  const stage = $("[data-gallery-stage]");
  if (stage) {
    const thumbs = $$("[data-gallery-thumb]");
    thumbs.forEach((thumb) => thumb.addEventListener("click", () => {
      stage.src = thumb.dataset.full;
      stage.alt = thumb.dataset.alt;
      thumbs.forEach((t) => t.setAttribute("aria-pressed", String(t === thumb)));
    }));
  }

  /* Demo forms: validate, then say it's a demo --------------------------- */
  $$("[data-demo-form]").forEach((form) => {
    const note = $(".form-note", form);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const invalid = $$("input, select, textarea", form).filter((f) => !f.checkValidity());
      $$(".is-invalid", form).forEach((f) => f.classList.remove("is-invalid"));
      if (invalid.length) {
        invalid.forEach((f) => {
          f.classList.add("is-invalid");
          f.setAttribute("aria-invalid", "true");
        });
        invalid[0].focus();
        if (note) note.textContent = "Please check the highlighted fields.";
        return;
      }
      $$("[aria-invalid]", form).forEach((f) => f.removeAttribute("aria-invalid"));
      if (note) note.textContent = "Thanks — this form is a demo. Connect it to your own handler.";
      form.reset();
    });
  });

  /* Reveal on scroll ----------------------------------------------------- */
  const reveals = $$("[data-reveal]");
  if (reveals.length && !reduceMotion && "IntersectionObserver" in window) {
    document.documentElement.classList.add("js-reveal");
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px" });
    reveals.forEach((el) => io.observe(el));
  }

  $$("[data-year]").forEach((el) => { el.textContent = new Date().getFullYear(); });
})();
