// Moves through the slides with the arrow keys, space, or a click. The slide
// number is kept in the address (#3), so a slide can be linked or reloaded.
(() => {
  const slides = Array.from(document.querySelectorAll(".slide"));
  const counter = document.querySelector(".counter");
  let index = Math.max(0, Math.min(slides.length - 1, Number(location.hash.slice(1)) - 1 || 0));

  function fit() {
    const scale = Math.min(window.innerWidth / 1300, window.innerHeight / 740);
    document.documentElement.style.setProperty("--fit", String(scale));
  }

  /** Numbers count up when their slide appears. */
  function countUp(slide) {
    for (const number of slide.querySelectorAll("[data-count]")) {
      const target = Number(number.dataset.count);
      const decimals = (number.dataset.count.split(".")[1] ?? "").length;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / 1100);
        const value = target * (1 - Math.pow(1 - t, 3));
        number.textContent = value.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        });
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }

  function show(next) {
    index = Math.max(0, Math.min(slides.length - 1, next));
    slides.forEach((slide, i) => slide.classList.toggle("active", i === index));
    counter.textContent = `${index + 1} / ${slides.length}`;
    history.replaceState(null, "", `#${index + 1}`);
    countUp(slides[index]);
  }

  window.addEventListener("keydown", (event) => {
    if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(event.key)) show(index + 1);
    if (["ArrowLeft", "ArrowUp", "PageUp"].includes(event.key)) show(index - 1);
    if (event.key === "Home") show(0);
    if (event.key === "End") show(slides.length - 1);
  });
  window.addEventListener("click", (event) =>
    show(index + (event.clientX < window.innerWidth / 3 ? -1 : 1)),
  );
  window.addEventListener("resize", fit);
  fit();
  show(index);
})();
