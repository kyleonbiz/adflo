export const THEME_KEY = "adflo.theme";

/**
 * AdFlo is Day only. Runs before first paint (see the root layout): it clears any Night choice saved earlier
 * and makes sure the page is never dark, whatever the device is set to.
 */
export const THEME_INIT_SCRIPT = `try{localStorage.removeItem("${THEME_KEY}")}catch(e){}document.documentElement.classList.remove("dark")`;
