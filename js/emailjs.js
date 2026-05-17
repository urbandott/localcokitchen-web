(function () {
  const form = document.querySelector('form[name="waitlist"]');
  const note = document.querySelector("#form-note");
  const publicKey = "5UfHbfEdu2nuA3dVM";
  const serviceID = "default_service";
  const templateID = "template_f26aocx";

  if (!form || !note) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim();
    const interest = String(formData.get("interest") || "customer");
    const button = form.querySelector('button[type="submit"]');

    if (!email) {
      note.textContent = "Please enter your email address.";
      return;
    }

    if (!window.emailjs) {
      note.textContent =
        "The email service is still loading. Please try again in a moment.";
      return;
    }

    if (button) {
      button.disabled = true;
      button.textContent = "Joining...";
    }

    note.textContent = "Submitting your waitlist request...";

    try {
      emailjs.init({ publicKey });

      await emailjs.send(serviceID, templateID, {
        email,
        interest,
      });

      note.textContent =
        interest.includes("cook") || interest === "both"
          ? "You are on the cook waitlist. We will email you before launch."
          : "You are on the waitlist. We will email you when LocalCoKitchen goes live.";
      form.reset();
    } catch (error) {
      console.error("EmailJS waitlist submission failed:", error);
      note.textContent =
        "We could not submit your request. Please try again in a moment.";
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Notify me";
      }
    }
  });
})();
