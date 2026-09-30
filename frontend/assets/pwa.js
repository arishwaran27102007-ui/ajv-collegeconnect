let deferredInstallPrompt = null;

(function () {
  const installButton = document.getElementById("installAppBtn");

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

  function showInstallButton() {
    if (installButton && !isStandalone()) {
      installButton.hidden = false;
    }
  }

  // iOS Safari does not support beforeinstallprompt, so reveal install button if not installed
  if (isIos && !isStandalone()) {
    showInstallButton();
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallButton();
  });

  if (installButton) {
    installButton.addEventListener("click", async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const result = await deferredInstallPrompt.userChoice;
        if (result.outcome === "accepted") {
          installButton.hidden = true;
        }
        deferredInstallPrompt = null;
        return;
      }

      if (isIos) {
        alert("To install AJV CollegeConnect on iOS:\n\n1. Tap the Share button at the bottom of Safari.\n2. Scroll down and tap 'Add to Home Screen'.");
      } else {
        alert("To install AJV CollegeConnect:\n\nTap the browser menu (⋮) at top-right and select 'Install app' or 'Add to Home screen'.");
      }
    });
  }

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    if (installButton) installButton.hidden = true;
    if (typeof toast === "function") {
      toast("AJV College Connect installed successfully.");
    }
  });

  window.addEventListener("load", () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then(() => console.log("AJV PWA service worker registered"))
        .catch((error) => console.error("PWA service worker registration failed:", error));
    }
  });
})();
