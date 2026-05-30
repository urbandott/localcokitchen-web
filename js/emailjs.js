(function () {
  const form = document.querySelector('form[name="waitlist"]');
  const note = document.querySelector("#form-note");
  const publicKey = "5UfHbfEdu2nuA3dVM";
  const serviceID = "default_service";
  const templateID = "template_f26aocx";
  const allowedInterests = new Set(["customer", "home-cook"]);

  const cleanTextValue = (value, maxLength = 254) =>
    String(value || "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, maxLength);

  if (!form || !note) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();

    const formData = new FormData(form);
    const email = cleanTextValue(formData.get("email")).toLowerCase();
    const requestedInterest = cleanTextValue(formData.get("interest"), 20);
    const interest = allowedInterests.has(requestedInterest)
      ? requestedInterest
      : "customer";
    const button = form.querySelector('button[type="submit"]');
    const emailInput = form.querySelector('input[name="email"]');

    if (!emailInput?.validity.valid) {
      note.textContent = "Please enter a valid email address.";
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
        interest.includes("cook")
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
