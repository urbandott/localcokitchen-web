(function () {
  let toastTimer = 0;

  const getRegion = () => {
    let region = document.querySelector("[data-toast-region]");

    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.dataset.toastRegion = "";
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-atomic", "true");
      document.body.append(region);
    }

    return region;
  };

  const show = (message) => {
    const text = String(message || "").trim();

    if (!text) {
      return;
    }

    const region = getRegion();
    region.textContent = "";

    const toast = document.createElement("div");
    toast.className = "toast-message";
    toast.textContent = text;
    region.append(toast);

    window.clearTimeout(toastTimer);
    requestAnimationFrame(() => {
      toast.classList.add("is-visible");
    });

    toastTimer = window.setTimeout(() => {
      toast.classList.remove("is-visible");
      window.setTimeout(() => {
        toast.remove();
      }, 220);
    }, 3000);
  };

  window.LocalCoKitchenToast = { show };
})();
