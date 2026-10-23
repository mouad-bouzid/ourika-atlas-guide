/* Ourika Atlas Guide — motion layer.
   Needs (loaded before this file): gsap, ScrollTrigger, Lenis, LightRays.
   If any library fails to load, the page simply stays static and fully usable. */
(() => {
  "use strict";
  if (!window.gsap || !window.ScrollTrigger) return;

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  gsap.registerPlugin(ScrollTrigger);

  // The old IntersectionObserver reveal in index.html hides [data-reveal] elements.
  // GSAP takes over below, so switch that CSS off to avoid two systems fighting.
  root.classList.remove("js-reveal");

  /* ---------- 1. Lenis, driven by the GSAP ticker ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));   // GSAP time is in seconds
    gsap.ticker.lagSmoothing(0);
    window.lenis = lenis;

    // in-page anchors (#activities …) go through Lenis
    document.addEventListener("click", (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.classList.contains("skip")) return;
      const id = a.getAttribute("href");
      const target = id.length > 1 ? document.querySelector(id) : null;
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -72, duration: 1.2 });
    });

    // pause Lenis while the mobile menu is open
    new MutationObserver(() => {
      document.body.classList.contains("menu-open") ? lenis.stop() : lenis.start();
    }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  }

  /* ---------- 2. Hero title — Blur Text (React Bits) ---------- */
  const title = $(".hero__title");
  if (title && !reduce) {
    const text = title.textContent.trim();
    const words = text.split(/\s+/);
    title.setAttribute("aria-label", text);
    title.textContent = "";
    const spans = words.map((w, i) => {
      const s = document.createElement("span");
      s.className = "blur-word";
      s.setAttribute("aria-hidden", "true");
      s.textContent = w;
      title.append(s);
      if (i < words.length - 1) title.append(" ");
      return s;
    });
    gsap.set(spans, { opacity: 0, y: -24, filter: "blur(10px)" });
    title.classList.add("is-split");
    gsap.to(spans, {
      opacity: 1, y: 0, filter: "blur(0px)",
      duration: 1, ease: "power3.out", stagger: 0.12, delay: 0.2,
      onComplete: () => gsap.set(spans, { clearProps: "filter,transform,opacity,willChange" })
    });
  }

  /* ---------- 3. Hero background — Light Rays (React Bits) ---------- */
  const hero = $(".hero");
  if (hero && window.LightRays) {
    const holder = document.createElement("div");
    holder.className = "light-rays";
    holder.setAttribute("aria-hidden", "true");
    const photo = $(".hero__img", hero);
    photo ? photo.after(holder) : hero.prepend(holder);
    const css = getComputedStyle(root);
    const handle = window.LightRays.init(holder, {
      color: css.getPropertyValue("--glacier").trim() || "#D5E4E1",   // site colour
      static: reduce
    });
    if (!handle) holder.remove();
  }

  /* ---------- 4. Scroll reveal for every section ---------- */
  if (!reduce) {
    const PARTS = [
      ".shead > *", ".statement__line", ".statement__sub",
      ".split__media", ".split__copy > *",
      ".dtile", ".promise", ".tcard",
      ".gal__track", ".gal__range",
      ".quote-band figure", ".closer__card",
      ".footer__top", ".footer__word", ".footer__bottom"
    ].join(",");

    $$("main > section:not(.hero), .footer").forEach((section) => {
      const items = $$(PARTS, section);
      if (!items.length) return;
      gsap.set(items, { opacity: 0, y: 28 });
      ScrollTrigger.batch(items, {
        start: "top 88%",
        once: true,
        onEnter: (batch) => gsap.to(batch, {
          opacity: 1, y: 0,
          duration: 0.9, ease: "power2.out", stagger: 0.08, overwrite: true,
          // hand transform back to CSS so hover effects (.tcard:hover) work again
          onComplete: () => gsap.set(batch, { clearProps: "opacity,transform" })
        })
      });
    });
  }

  /* ---------- 5. Count Up — <span data-countup="120" data-suffix="+"> ---------- */
  $$("[data-countup]").forEach((el) => {
    const raw = el.dataset.countup;
    const to = parseFloat(raw);
    if (Number.isNaN(to)) return;
    const decimals = (raw.split(".")[1] || "").length;
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const fmt = (v) => prefix + v.toLocaleString("en-US", {
      minimumFractionDigits: decimals, maximumFractionDigits: decimals
    }) + suffix;
    if (reduce) { el.textContent = fmt(to); return; }
    el.textContent = fmt(0);
    const state = { v: 0 };
    ScrollTrigger.create({
      trigger: el, start: "top 90%", once: true,
      onEnter: () => gsap.to(state, {
        v: to, duration: 2, ease: "power2.out",
        onUpdate: () => { el.textContent = fmt(state.v); }
      })
    });
  });

  /* ---------- 6. Main CTA — Star Border (React Bits) ---------- */
  const cta = $(".hero__actions .cta-orbit");
  const pill = cta && $(".cta-orbit__text", cta);
  if (pill && !reduce) {
    cta.classList.add("cta-orbit--star");
    ["bottom", "top"].forEach((pos) => {
      const g = document.createElement("span");
      g.className = "star-border__glow star-border__glow--" + pos;
      g.setAttribute("aria-hidden", "true");
      pill.append(g);
    });
  }

  // lazy images change layout height → recalc trigger positions
  window.addEventListener("load", () => ScrollTrigger.refresh());
})();
