(function () {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const header = document.querySelector(".topbar");
  const media = document.querySelector(".hero-media");
  let frame = 0;

  function paint() {
    frame = 0;
    const y = window.scrollY;
    if (header) header.classList.toggle("is-solid", y > 24);
    if (reduced) return;
    if (media) {
      const shift = Math.min(Math.max(y, 0), window.innerHeight) * 0.16;
      media.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0)`;
    }
  }

  function onScroll() {
    if (frame) return;
    frame = requestAnimationFrame(paint);
  }

  paint();
  window.addEventListener("scroll", onScroll, { passive: true });

  if (!reduced) {
    document.documentElement.classList.add("can-reveal");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add("is-in");
        }
      },
      { threshold: 0.18 }
    );
    document.querySelectorAll(".reveal").forEach((node) => observer.observe(node));
  } else {
    document.querySelectorAll(".reveal").forEach((node) => node.classList.add("is-in"));
  }

  function setupListingSlides() {
    const root = document.querySelector(".works-photo");
    if (!root) return;
    const images = [...root.querySelectorAll("img")];
    const dots = [...root.querySelectorAll(".works-dots button")];
    if (images.length < 2) return;
    let index = 0;
    let timer = 0;

    function show(next) {
      index = (next + images.length) % images.length;
      images.forEach((img, i) => img.classList.toggle("is-on", i === index));
      dots.forEach((dot, i) => {
        const on = i === index;
        dot.classList.toggle("is-on", on);
        dot.setAttribute("aria-selected", on ? "true" : "false");
      });
    }

    function start() {
      stop();
      if (reduced) return;
      timer = window.setInterval(() => show(index + 1), 4200);
    }

    function stop() {
      window.clearInterval(timer);
    }

    dots.forEach((dot, i) => {
      dot.addEventListener("click", () => {
        show(i);
        start();
      });
    });
    root.addEventListener("mouseenter", stop);
    root.addEventListener("mouseleave", start);
    show(0);
    start();
  }

  setupListingSlides();

  const video = document.querySelector(".hero-video");
  if (video && media) {
    let gaveUp = false;
    const showStill = () => {
      gaveUp = true;
      media.classList.remove("is-playing");
      video.pause();
    };
    const showVideo = () => {
      if (gaveUp || video.paused || video.readyState < 2) return;
      media.classList.add("is-playing");
    };
    const tryPlay = () => {
      if (gaveUp || reduced) return;
      const pending = video.play();
      if (pending && typeof pending.then === "function") {
        pending.then(showVideo).catch(showStill);
        return;
      }
      showVideo();
    };
    video.addEventListener("playing", showVideo);
    video.addEventListener("error", showStill);
    if (reduced) showStill();
    else {
      tryPlay();
      window.setTimeout(() => {
        if (!media.classList.contains("is-playing")) showStill();
      }, 2500);
    }
  }
})();
