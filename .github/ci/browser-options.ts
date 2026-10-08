// Local CI must never reach canonical/provider hosts. This blocks external DNS;
// it does not redirect, proxy, or substitute a live endpoint.
export const LOCAL_ONLY_BROWSER_ARGS = [
  "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1",
];
