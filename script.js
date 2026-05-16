(function () {
  const form = document.querySelector('form[name="waitlist"]');
  const note = document.querySelector("#form-note");

  if (!form || !note) {
    return;
  }

  const encode = (data) =>
    new URLSearchParams(Array.from(data.entries())).toString();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim();
    const interest = String(formData.get("interest") || "customer");

    if (!email) {
      note.textContent = "Please enter your email address.";
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    if (button) {
      button.disabled = true;
      button.textContent = "Joining...";
    }

    try {
      const response = await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encode(formData),
      });

      if (!response.ok) {
        throw new Error("Waitlist form endpoint is not available.");
      }

      note.textContent =
        interest.includes("cook")
          ? "You are on the cook waitlist. We will email you before launch."
          : "You are on the waitlist. We will email you when LocalCoKitchen goes live.";
      form.reset();
    } catch (error) {
      const localEntries = JSON.parse(
        window.localStorage.getItem("localcokitchenWaitlist") || "[]"
      );
      localEntries.push({
        email,
        interest,
        createdAt: new Date().toISOString(),
      });
      window.localStorage.setItem(
        "localcokitchenWaitlist",
        JSON.stringify(localEntries)
      );
      note.textContent =
        "Preview saved locally. Connect a form backend before publishing.";
      form.reset();
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Notify me";
      }
    }
  });
})();
