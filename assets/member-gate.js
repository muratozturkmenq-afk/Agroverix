import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.1/+esm";
const root = "/";
const cfg = window.AGROVERIX_SUPABASE || {};
try {
  if (!cfg.url || !cfg.publishableKey) throw new Error("Auth unavailable");
  const client = createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const { data, error } = await client.auth.getSession();
  if (error || !data.session) {
    location.replace(root);
  } else {
    document.documentElement.classList.remove("member-route-check");
    client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") location.replace(root);
    });
  }
} catch {
  location.replace(root);
}
