const $ = (id) => document.getElementById(id);
chrome.storage.local.get(["accepted", "autoSubmit", "token"]).then((s) => { $("accepted").checked = !!s.accepted; $("autoSubmit").checked = !!s.autoSubmit; $("tok").textContent = s.token ? "Signed in to fashionistas.ai ✓" : "Open your fashionistas.ai seller board once while signed in to link it."; });
for (const k of ["accepted", "autoSubmit"]) $(k).onchange = () => chrome.storage.local.set({ [k]: $(k).checked });
