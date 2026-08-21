const DEFAULT_COOLDOWN_SECONDS = 60;

export function startResendCooldown(
  button: HTMLButtonElement,
  seconds = DEFAULT_COOLDOWN_SECONDS,
) {
  const originalLabel =
    button.dataset.resendLabel ??
    button.textContent?.trim() ??
    "Resend verification email.";
  button.dataset.resendLabel = originalLabel;

  let remaining = seconds;
  const updateButton = () => {
    button.disabled = true;
    button.textContent = `Resend available in ${remaining}s`;
  };

  updateButton();
  const timer = window.setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      window.clearInterval(timer);
      button.disabled = false;
      button.textContent = originalLabel;
      return;
    }
    updateButton();
  }, 1000);
}
